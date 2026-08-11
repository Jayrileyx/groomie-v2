const express = require('express');
const router = express.Router();
const User = require('../models/User');
const GroomerProfile = require('../models/GroomerProfile');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { protect, restrictTo } = require('../middleware/auth');

const adminOnly = [protect, restrictTo('admin')];
const email = require('../utils/email');
const Conversation = require('../models/Conversation');

// GET /api/admin/support-contact — returns admin user info for support messaging (any authenticated user)
router.get('/support-contact', protect, async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('firstName lastName _id');
    if (!admin) return res.status(404).json({ message: 'No support contact found' });
    res.json({ id: admin._id, firstName: admin.firstName, lastName: admin.lastName });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/support/conversations — all conversations involving any admin (for support inbox)
router.get('/support/conversations', ...adminOnly, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'firstName lastName avatar role')
      .sort({ lastMessageAt: -1 });

    const result = conversations.map(c => {
      const obj = c.toObject();
      obj.unread = c.unreadCount?.get?.(req.user.id.toString()) || 0;
      return obj;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/stats — platform overview numbers
router.get('/stats', ...adminOnly, async (req, res) => {
  try {
    const [totalGroomers, approvedGroomers, pendingGroomers, totalCustomers,
           totalBookings, completedBookings, cancelledBookings, totalReviews] = await Promise.all([
      GroomerProfile.countDocuments(),
      GroomerProfile.countDocuments({ verificationStatus: 'approved' }),
      GroomerProfile.countDocuments({ verificationStatus: 'pending' }),
      User.countDocuments({ role: 'customer' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'cancelled' }),
      Review.countDocuments(),
    ]);

    // Revenue = sum of totalAmount on completed bookings
    const revenueAgg = await Booking.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const revenue = revenueAgg[0]?.total || 0;

    res.json({
      totalGroomers, approvedGroomers, pendingGroomers,
      totalCustomers, totalBookings, completedBookings,
      cancelledBookings, totalReviews, revenue,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/bookings — all bookings with optional status filter
router.get('/bookings', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { status } : {};
    const bookings = await Booking.find(query)
      .populate('customer', 'firstName lastName email')
      .populate('groomer', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/reviews — all reviews
router.get('/reviews', ...adminOnly, async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('customer', 'firstName lastName email')
      .populate('groomer', 'firstName lastName email')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/reviews/:id — remove a review
router.delete('/reviews/:id', ...adminOnly, async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // Recalculate groomer rating
    const remaining = await Review.find({ groomerProfile: review.groomerProfile });
    const avgRating = remaining.length
      ? remaining.reduce((s, r) => s + r.rating, 0) / remaining.length
      : 0;
    await GroomerProfile.findByIdAndUpdate(review.groomerProfile, {
      rating: remaining.length ? Math.round(avgRating * 10) / 10 : 0,
      reviewCount: remaining.length,
    });

    // Un-mark the booking as reviewed so the customer can re-submit
    await Booking.findByIdAndUpdate(review.booking, { reviewed: false });

    res.json({ message: 'Review removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/groomers — list all groomers, optionally filtered by status
router.get('/groomers', ...adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const query = status ? { verificationStatus: status } : {};
    const profiles = await GroomerProfile.find(query)
      .populate('user', 'firstName lastName email phone username isSuspended')
      .sort({ createdAt: -1 });
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/groomers/pending — list groomers awaiting verification
router.get('/groomers/pending', ...adminOnly, async (req, res) => {
  try {
    const profiles = await GroomerProfile.find({ verificationStatus: 'pending' })
      .populate('user', 'firstName lastName email phone username isSuspended');
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/groomers/:id/verify — approve or reject a groomer
router.patch('/groomers/:id/verify', ...adminOnly, async (req, res) => {
  const { status, rejectionReason } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const update = { verificationStatus: status };
    if (status === 'rejected' && rejectionReason) update.rejectionReason = rejectionReason;
    if (status === 'approved') update.rejectionReason = '';
    const profile = await GroomerProfile.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('user', 'email firstName lastName');

    // Email the groomer
    if (profile?.user?.email) {
      const groomerName = `${profile.user.firstName} ${profile.user.lastName}`.trim();
      if (status === 'approved') {
        email.groomerApproved({ groomerEmail: profile.user.email, groomerName });
      } else {
        email.groomerRejected({ groomerEmail: profile.user.email, groomerName, reason: rejectionReason || '' });
      }
    }

    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/bookings/unpaid — completed bookings that were never charged
router.get('/bookings/unpaid', ...adminOnly, async (req, res) => {
  try {
    const bookings = await Booking.find({ status: 'completed', paymentStatus: 'unpaid' })
      .populate('customer', 'firstName lastName email')
      .populate('groomer', 'firstName lastName')
      .sort({ updatedAt: -1 });
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/bookings/:id/charge — retry charge on a completed/unpaid booking
router.post('/bookings/:id/charge', ...adminOnly, async (req, res) => {
  try {
    const { chargeBooking } = require('./payments');
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.status !== 'completed') return res.status(400).json({ message: 'Booking is not completed' });
    if (booking.paymentStatus === 'paid') return res.status(400).json({ message: 'Booking is already paid' });

    const result = await chargeBooking(booking);
    if (!result) return res.status(400).json({ message: 'Charge failed — groomer may not have Stripe connected or booking is missing payment details.' });

    res.json({ message: 'Charge successful', paymentIntentId: result.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/bookings/:id/refund — issue a full Stripe refund
router.post('/bookings/:id/refund', ...adminOnly, async (req, res) => {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const booking = await Booking.findById(req.params.id)
      .populate('customer', 'firstName lastName email')
      .populate('groomer', 'firstName lastName');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.paymentStatus !== 'paid') return res.status(400).json({ message: 'Booking has not been charged.' });
    if (booking.paymentStatus === 'refunded') return res.status(400).json({ message: 'Booking is already refunded.' });
    if (!booking.stripePaymentId) return res.status(400).json({ message: 'No payment ID on record for this booking.' });

    const refund = await stripe.refunds.create({ payment_intent: booking.stripePaymentId });

    booking.paymentStatus = 'refunded';
    await booking.save();

    // Email customer
    if (booking.customer?.email) {
      const groomerName = `${booking.groomer?.firstName} ${booking.groomer?.lastName}`.trim();
      email.refundIssued({
        customerEmail: booking.customer.email,
        customerName: `${booking.customer.firstName} ${booking.customer.lastName}`.trim(),
        groomerName,
        service: booking.service?.name || 'appointment',
        amount: booking.totalAmount,
      });
    }

    res.json({ message: 'Refund issued successfully.', refundId: refund.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/users — list all users
router.get('/users', ...adminOnly, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/users/:id — get a single user with their booking history
router.get('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const bookings = await Booking.find({ customer: req.params.id })
      .populate('groomer', 'firstName lastName')
      .select('service date time status createdAt')
      .sort({ createdAt: -1 })
      .limit(10);
    res.json({ user, bookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/suspend — suspend or unsuspend a user
router.patch('/users/:id/suspend', ...adminOnly, async (req, res) => {
  const { suspend } = req.body;
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isSuspended: suspend },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/users/:id — delete a user and their groomer profile if applicable
router.delete('/users/:id', ...adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete groomer profile if they are a groomer
    if (user.role === 'groomer') {
      await GroomerProfile.findOneAndDelete({ user: user._id });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
