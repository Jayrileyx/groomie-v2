const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { protect, restrictTo } = require('../middleware/auth');
const User = require('../models/User');
const Booking = require('../models/Booking');
const GroomerProfile = require('../models/GroomerProfile');

const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT) || 20;

// ── Customer: create SetupIntent to save card ─────────────────────────────────
// POST /api/payments/setup-intent
router.post('/setup-intent', protect, restrictTo('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    // Create or retrieve Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        metadata: { userId: user._id.toString() },
      });
      stripeCustomerId = customer.id;
      user.stripeCustomerId = stripeCustomerId;
      await user.save();
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
    });

    res.json({ clientSecret: setupIntent.client_secret, stripeCustomerId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Customer: list saved payment methods ─────────────────────────────────────
// GET /api/payments/cards
router.get('/cards', protect, restrictTo('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('stripeCustomerId');
    if (!user?.stripeCustomerId) return res.json([]);
    const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' });
    res.json(methods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Customer: remove a saved card ─────────────────────────────────────────────
// DELETE /api/payments/cards/:pmId
router.delete('/cards/:pmId', protect, restrictTo('customer'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('stripeCustomerId');
    if (!user?.stripeCustomerId) return res.status(400).json({ message: 'No payment methods on file.' });

    const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: 'card' });

    // Block removal of the last card
    if (methods.data.length <= 1) {
      return res.status(400).json({
        message: 'You must keep at least one card on file. Add a new card before removing this one.',
      });
    }

    // Ensure the card actually belongs to this customer
    const belongs = methods.data.some(m => m.id === req.params.pmId);
    if (!belongs) return res.status(404).json({ message: 'Card not found.' });

    await stripe.paymentMethods.detach(req.params.pmId);
    res.json({ message: 'Card removed.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Groomer: create/resume Connect onboarding (Account Links — no OAuth needed)
// GET /api/payments/connect/url
router.get('/connect/url', protect, restrictTo('groomer'), async (req, res) => {
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
  try {
    const user = await User.findById(req.user.id).select('email firstName lastName');
    let profile = await GroomerProfile.findOne({ user: req.user.id });

    // Create an Express account if the groomer doesn't have one yet
    let stripeAccountId = profile?.stripeAccountId;
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { userId: req.user.id.toString() },
      });
      stripeAccountId = account.id;
      await GroomerProfile.findOneAndUpdate({ user: req.user.id }, { stripeAccountId });
    }

    // Generate a fresh onboarding / update link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${CLIENT_URL}/groomer/profile?stripe=error`,
      return_url:  `${CLIENT_URL}/groomer/profile?stripe=connected`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Groomer: check Connect account status ─────────────────────────────────────
// GET /api/payments/connect/status
router.get('/connect/status', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const profile = await GroomerProfile.findOne({ user: req.user.id }).select('stripeAccountId');
    if (!profile?.stripeAccountId) return res.json({ connected: false });
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);
    res.json({
      connected: account.charges_enabled && account.payouts_enabled,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
    });
  } catch (err) {
    res.json({ connected: false });
  }
});

// ── Groomer: disconnect Stripe account ───────────────────────────────────────
// DELETE /api/payments/connect
router.delete('/connect', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const profile = await GroomerProfile.findOne({ user: req.user.id });
    if (profile?.stripeAccountId) {
      // Delete the connected Express account from Stripe
      await stripe.accounts.del(profile.stripeAccountId).catch(() => {});
      profile.stripeAccountId = '';
      await profile.save();
    }
    res.json({ message: 'Stripe account disconnected' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Internal: charge customer when booking is completed ───────────────────────
// Called internally by the bookings route — NOT a public endpoint
async function chargeBooking(booking) {
  console.log('[payments] chargeBooking called for booking', booking._id, {
    hasPaymentMethod: !!booking.stripePaymentMethodId,
    hasCustomerId: !!booking.stripeCustomerId,
    totalAmount: booking.totalAmount,
  });

  if (!booking.stripePaymentMethodId || !booking.stripeCustomerId) {
    console.warn('[payments] Booking missing stripe fields — skipping charge', booking._id);
    return null;
  }

  const profile = await GroomerProfile.findOne({ user: booking.groomer }).select('stripeAccountId');
  console.log('[payments] Groomer stripe account:', profile?.stripeAccountId);
  if (!profile?.stripeAccountId) {
    console.warn('[payments] Groomer has no Stripe account — skipping charge', booking._id);
    return null;
  }

  const amountCents = Math.round((booking.totalAmount || 0) * 100);
  console.log('[payments] Charging', amountCents, 'cents');
  if (amountCents <= 0) return null;

  const feeCents = Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: booking.stripeCustomerId,
    payment_method: booking.stripePaymentMethodId,
    confirm: true,
    off_session: true, // card-on-file, no 3DS redirect
    application_fee_amount: feeCents,
    transfer_data: { destination: profile.stripeAccountId },
    metadata: { bookingId: booking._id.toString() },
  });

  console.log('[payments] PaymentIntent created:', paymentIntent.id, 'status:', paymentIntent.status);

  // Save payment ID on booking
  booking.stripePaymentId = paymentIntent.id;
  booking.paymentStatus = 'paid';
  await booking.save();

  return paymentIntent;
}

// ── Stripe webhook ────────────────────────────────────────────────────────────
// POST /api/payments/webhook  (raw body — mounted separately in index.js)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    const bookingId = pi.metadata?.bookingId;
    if (bookingId) {
      await Booking.findByIdAndUpdate(bookingId, { paymentStatus: 'unpaid' });
      console.warn('[payments] Payment failed for booking', bookingId);
    }
  }

  res.json({ received: true });
});

module.exports = router;
module.exports.chargeBooking = chargeBooking;
