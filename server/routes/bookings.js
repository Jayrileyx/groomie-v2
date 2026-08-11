const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const GroomerProfile = require('../models/GroomerProfile');
const { protect, restrictTo } = require('../middleware/auth');
const notify = require('../utils/notify');
const email = require('../utils/email');
const { chargeBooking } = require('./payments');

// Convert "HH:MM" to total minutes
const toMins = t => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

// Check if two time windows overlap
// [aStart, aStart+aDur) vs [bStart, bStart+bDur)
const overlaps = (aStart, aDur, bStart, bDur) => {
  const aEnd = aStart + (aDur || 30);
  const bEnd = bStart + (bDur || 30);
  return aStart < bEnd && aEnd > bStart;
};

// POST /api/bookings — customer creates a booking request
router.post('/', protect, restrictTo('customer'), async (req, res) => {
  const { groomerProfileId, service, date, time, petInfo, customerNote,
          stripePaymentMethodId, stripeCustomerId,
          agreedToGroomerTerms, waiverSignedName } = req.body;
  try {
    // Card on file is required to request a booking
    if (!stripePaymentMethodId || !stripeCustomerId) {
      return res.status(400).json({ message: 'A valid payment method is required to request a booking.' });
    }

    // Reject bookings in the past
    const apptDateTime = new Date(`${date}T${time}:00`);
    if (apptDateTime <= new Date()) {
      return res.status(400).json({ message: 'Cannot book a time that has already passed.' });
    }

    const profile = await GroomerProfile.findById(groomerProfileId).select('user');
    if (!profile) return res.status(404).json({ message: 'Groomer not found' });

    // Get all pending/confirmed bookings for this groomer on this date
    const existing = await Booking.find({
      groomer: profile.user,
      date,
      status: { $in: ['pending', 'confirmed'] },
    }).select('time service');

    const newStart = toMins(time);
    const newDur = service?.duration || 30;

    const conflict = existing.find(b =>
      overlaps(newStart, newDur, toMins(b.time), b.service?.duration || 30)
    );

    if (conflict) {
      return res.status(409).json({ message: 'This time slot is no longer available. Please choose another time.' });
    }

    const booking = await Booking.create({
      customer: req.user.id,
      groomer: profile.user,
      groomerProfile: profile._id,
      service,
      date,
      time,
      petInfo,
      customerNote,
      totalAmount: service.price,
      status: 'pending',
      stripePaymentMethodId: stripePaymentMethodId || undefined,
      stripeCustomerId: stripeCustomerId || undefined,
      paymentStatus: 'unpaid',
      agreedToGroomerTerms: !!agreedToGroomerTerms,
      waiver: waiverSignedName ? { signedName: waiverSignedName, signedAt: new Date() } : undefined,
    });

    // Notify groomer of the new request
    const User = require('../models/User');
    const customer = await User.findById(req.user.id).select('firstName lastName');
    const cName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'A customer';
    notify(profile.user, 'new_booking',
      `New booking request from ${cName} — ${service.name} on ${date} at ${time}.`,
      booking._id
    );

    // Email groomer
    const groomerUser = await User.findById(profile.user).select('email firstName lastName');
    if (groomerUser?.email) {
      email.newBookingRequest({
        groomerEmail: groomerUser.email,
        groomerName: `${groomerUser.firstName} ${groomerUser.lastName}`.trim(),
        customerName: cName,
        service: service.name,
        date,
        time,
        petName: petInfo?.name,
        customerNote,
      });
    }

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bookings/pet-check?petName=Buddy&date=2026-08-10
// Returns whether this customer already has a booking for the same pet within 3 days
router.get('/pet-check', protect, restrictTo('customer'), async (req, res) => {
  const { petName, date } = req.query;
  if (!petName || !date) return res.json({ hasRecent: false });
  try {
    const checkDate = new Date(date + 'T00:00:00');
    const pad = d => d.toISOString().split('T')[0];
    const minus3 = new Date(checkDate); minus3.setDate(minus3.getDate() - 3);
    const plus3  = new Date(checkDate); plus3.setDate(plus3.getDate() + 3);

    const existing = await Booking.findOne({
      customer: req.user.id,
      'petInfo.name': { $regex: new RegExp(`^${petName}$`, 'i') },
      date: { $gte: pad(minus3), $lte: pad(plus3) },
      status: { $in: ['pending', 'confirmed'] },
    }).select('date service');

    if (existing) {
      return res.json({ hasRecent: true, existingDate: existing.date, existingService: existing.service?.name });
    }
    res.json({ hasRecent: false });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bookings/my — customer gets their bookings
router.get('/my', protect, restrictTo('customer'), async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate('groomer', 'firstName lastName phone')
      .populate('groomerProfile', '_id city address cancellationWindowHours')
      .sort({ createdAt: -1 });

    // Cross-check Review collection so `reviewed` is accurate even for
    // bookings that pre-date the reviewed field (or if the flag write failed).
    const Review = require('../models/Review');
    const completedIds = bookings
      .filter(b => b.status === 'completed')
      .map(b => b._id);

    const reviewed = new Set();
    if (completedIds.length) {
      const reviews = await Review.find(
        { booking: { $in: completedIds }, customer: req.user.id },
        'booking'
      );
      reviews.forEach(r => reviewed.add(r.booking.toString()));
    }

    const result = bookings.map(b => {
      const obj = b.toObject();
      if (obj.status === 'completed') {
        obj.reviewed = reviewed.has(obj._id.toString());
      }
      return obj;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bookings/groomer — groomer sees their incoming bookings
router.get('/groomer', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const bookings = await Booking.find({ groomer: req.user.id })
      .populate('customer', 'firstName lastName phone avatar cancellationFlags')
      .sort({ createdAt: 1 });

    // Enrich petInfo with the current pet photo from the Pet collection.
    // This covers bookings created before petInfo.photo was added to the schema.
    const Pet = require('../models/Pet');
    const enriched = await Promise.all(bookings.map(async (b) => {
      const obj = b.toObject();
      if (obj.petInfo?.name && obj.customer?._id && !obj.petInfo.photo) {
        const pet = await Pet.findOne({
          owner: obj.customer._id,
          name: { $regex: new RegExp(`^${obj.petInfo.name}$`, 'i') },
        }).select('photo');
        if (pet?.photo) obj.petInfo.photo = pet.photo;
      }
      return obj;
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bookings/customer/:customerId — groomer views a customer's profile + pets
// Only accessible if the groomer has at least one booking with this customer
router.get('/customer/:customerId', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const hasBooking = await Booking.exists({ groomer: req.user.id, customer: req.params.customerId });
    if (!hasBooking) return res.status(403).json({ message: 'Access denied' });

    const User = require('../models/User');
    const Pet  = require('../models/Pet');

    const customer = await User.findById(req.params.customerId)
      .select('firstName lastName avatar phone email');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const pets = await Pet.find({ owner: req.params.customerId }).sort({ name: 1 });

    res.json({ customer, pets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/bookings/:id/status — groomer confirms, declines, completes, or cancels
// cancelledBy: 'groomer' | 'customer' — only relevant when status === 'cancelled'
router.patch('/:id/status', protect, restrictTo('groomer'), async (req, res) => {
  const { status, groomerNote, cancelledBy } = req.body;
  if (!['confirmed', 'declined', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }
  try {
    const booking = await Booking.findOne({ _id: req.params.id, groomer: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Require Stripe to be connected before confirming or completing
    if (['confirmed', 'completed'].includes(status)) {
      const profile = await GroomerProfile.findOne({ user: req.user.id }).select('stripeAccountId');
      if (!profile?.stripeAccountId) {
        return res.status(400).json({
          message: 'You must connect your Stripe account before confirming or completing bookings. Go to your Profile page to set up payouts.',
          stripeRequired: true,
        });
      }
    }

    booking.status = status;
    if (groomerNote !== undefined) booking.groomerNote = groomerNote;
    if (status === 'cancelled' && cancelledBy) booking.cancelledBy = cancelledBy;
    await booking.save();

    const User = require('../models/User');
    const svc   = booking.service?.name || 'appointment';
    const dt    = `${booking.date} at ${booking.time}`;

    if (status === 'confirmed') {
      const groomer = await User.findById(req.user.id).select('firstName lastName');
      const gName = groomer ? `${groomer.firstName} ${groomer.lastName}`.trim() : 'Your groomer';
      notify(booking.customer, 'confirmed',
        `${gName} confirmed your ${svc} on ${dt}!`, booking._id);

      // Email customer
      const custUser = await User.findById(booking.customer).select('email firstName lastName');
      if (custUser?.email) {
        email.bookingConfirmed({
          customerEmail: custUser.email,
          customerName: `${custUser.firstName} ${custUser.lastName}`.trim(),
          groomerName: gName,
          service: svc,
          date: booking.date,
          time: booking.time,
        });
      }
    }

    if (status === 'declined') {
      const reason = groomerNote ? ` Reason: "${groomerNote}"` : '';
      notify(booking.customer, 'declined',
        `Your ${svc} on ${dt} was declined.${reason}`, booking._id);

      // Email customer
      const groomer = await User.findById(req.user.id).select('firstName lastName');
      const gName = groomer ? `${groomer.firstName} ${groomer.lastName}`.trim() : 'Your groomer';
      const custUser = await User.findById(booking.customer).select('email firstName lastName');
      if (custUser?.email) {
        email.bookingDeclined({
          customerEmail: custUser.email,
          customerName: `${custUser.firstName} ${custUser.lastName}`.trim(),
          groomerName: gName,
          service: svc,
          date: booking.date,
          reason: groomerNote || '',
        });
      }
    }

    if (status === 'completed') {
      // Charge the saved card — await so paymentStatus is updated before we respond
      console.log('[bookings] Marking complete, triggering charge for booking', booking._id);
      try {
        await chargeBooking(booking);
      } catch (err) {
        console.error('[payments] chargeBooking error:', err.message, err.code, err.type, err.raw);
      }
      notify(booking.customer, 'completed',
        `Your ${svc} is complete! How did it go? Leave a review.`, booking._id);

      // Email customer
      const groomer = await User.findById(req.user.id).select('firstName lastName');
      const gName = groomer ? `${groomer.firstName} ${groomer.lastName}`.trim() : 'Your groomer';
      const custUser = await User.findById(booking.customer).select('email firstName lastName');
      if (custUser?.email) {
        email.appointmentCompleted({
          customerEmail: custUser.email,
          customerName: `${custUser.firstName} ${custUser.lastName}`.trim(),
          groomerName: gName,
          service: svc,
        });
      }
    }

    if (status === 'cancelled') {
      if (cancelledBy === 'groomer') {
        notify(booking.customer, 'cancelled',
          `Your ${svc} on ${dt} was cancelled by your groomer.`, booking._id);

        // Email customer
        const groomer = await User.findById(req.user.id).select('firstName lastName');
        const gName = groomer ? `${groomer.firstName} ${groomer.lastName}`.trim() : 'Your groomer';
        const custUser = await User.findById(booking.customer).select('email firstName lastName');
        if (custUser?.email) {
          email.groomercancelled({
            customerEmail: custUser.email,
            customerName: `${custUser.firstName} ${custUser.lastName}`.trim(),
            groomerName: gName,
            service: svc,
            date: booking.date,
            reason: groomerNote || '',
          });
        }
      } else if (cancelledBy === 'customer') {
        // Flag check
        const profile = await GroomerProfile.findById(booking.groomerProfile).select('cancellationWindowHours');
        const windowHours = profile?.cancellationWindowHours ?? 24;
        const apptDateTime = new Date(`${booking.date}T${booking.time}:00`);
        const hoursUntil = (apptDateTime - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < windowHours) {
          await User.findByIdAndUpdate(booking.customer, {
            $push: { cancellationFlags: { bookingId: booking._id, groomerId: req.user.id, flaggedAt: new Date() } },
          });
        }
        const cust = await User.findById(booking.customer).select('firstName lastName email');
        const cName = cust ? `${cust.firstName} ${cust.lastName}`.trim() : 'A customer';
        notify(req.user.id, 'cancelled',
          `${cName} cancelled their ${svc} on ${dt}.`, booking._id);

        // Email groomer
        const groomer = await User.findById(req.user.id).select('email firstName lastName');
        if (groomer?.email) {
          email.customerCancelled({
            groomerEmail: groomer.email,
            groomerName: `${groomer.firstName} ${groomer.lastName}`.trim(),
            customerName: cName,
            service: svc,
            date: booking.date,
          });
        }
      }
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/bookings/:id/cancel-groomer — groomer cancels, recording who initiated it
// If the customer cancelled within the groomer's notice window, adds a flag to the customer's profile
router.patch('/:id/cancel-groomer', protect, restrictTo('groomer'), async (req, res) => {
  const { cancelledBy } = req.body; // 'groomer' | 'customer'
  if (!['groomer', 'customer'].includes(cancelledBy)) {
    return res.status(400).json({ message: 'cancelledBy must be "groomer" or "customer"' });
  }
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.groomer.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: 'Not your booking' });
    }
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ message: 'Booking is already closed' });
    }

    booking.status = 'cancelled';
    booking.cancelledBy = cancelledBy;
    await booking.save();

    // Flag the customer only if THEY cancelled within the groomer's notice window
    if (cancelledBy === 'customer') {
      const profile = await GroomerProfile.findById(booking.groomerProfile).select('cancellationWindowHours');
      const windowHours = profile?.cancellationWindowHours ?? 24;
      const apptDateTime = new Date(`${booking.date}T${booking.time}:00`);
      const hoursUntil = (apptDateTime - Date.now()) / (1000 * 60 * 60);

      if (hoursUntil < windowHours) {
        const User = require('../models/User');
        await User.findByIdAndUpdate(booking.customer, {
          $push: {
            cancellationFlags: {
              bookingId: booking._id,
              groomerId: req.user.id,
              flaggedAt: new Date(),
            },
          },
        });
      }
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/bookings/:id/reschedule — customer reschedules (only outside cancellation window)
router.patch('/:id/reschedule', protect, restrictTo('customer'), async (req, res) => {
  const { date, time } = req.body;
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: 'Cannot reschedule this booking' });
    }

    // Enforce groomer's cancellation window
    const profile = await GroomerProfile.findById(booking.groomerProfile).select('cancellationWindowHours');
    const windowHours = profile?.cancellationWindowHours ?? 24;
    const apptDateTime = new Date(`${booking.date}T${booking.time}:00`);
    const hoursUntil = (apptDateTime - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < windowHours) {
      return res.status(403).json({
        message: `Cannot reschedule within ${windowHours} hours of the appointment. Contact your groomer directly.`,
      });
    }

    // Conflict check for new slot (exclude current booking)
    const existing = await Booking.find({
      groomer: booking.groomer,
      date,
      status: { $in: ['pending', 'confirmed'] },
      _id: { $ne: booking._id },
    }).select('time service');

    const newStart = toMins(time);
    const newDur = booking.service?.duration || 30;
    const conflict = existing.find(b => overlaps(newStart, newDur, toMins(b.time), b.service?.duration || 30));
    if (conflict) {
      return res.status(409).json({ message: 'That time slot is not available. Please choose another.' });
    }

    booking.date = date;
    booking.time = time;
    booking.status = 'pending'; // groomer re-confirms the new time
    await booking.save();

    const User = require('../models/User');
    const cust = await User.findById(req.user.id).select('firstName lastName');
    const cName = cust ? `${cust.firstName} ${cust.lastName}`.trim() : 'A customer';
    notify(booking.groomer, 'rescheduled',
      `${cName} rescheduled their ${booking.service?.name || 'appointment'} to ${date} at ${time}. Please review and confirm.`,
      booking._id
    );

    // Email groomer
    const groomerUser = await User.findById(booking.groomer).select('email firstName lastName');
    if (groomerUser?.email) {
      email.bookingRescheduled({
        groomerEmail: groomerUser.email,
        groomerName: `${groomerUser.firstName} ${groomerUser.lastName}`.trim(),
        customerName: cName,
        service: booking.service?.name || 'appointment',
        newDate: date,
        newTime: time,
      });
    }

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/bookings/:id/cancel — customer cancels
router.patch('/:id/cancel', protect, restrictTo('customer'), async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, customer: req.user.id });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ message: 'Cannot cancel this booking' });
    }
    booking.status = 'cancelled';
    booking.cancelledBy = 'customer';
    await booking.save();

    const User = require('../models/User');
    const cust = await User.findById(req.user.id).select('firstName lastName');
    const cName = cust ? `${cust.firstName} ${cust.lastName}`.trim() : 'A customer';
    notify(booking.groomer, 'cancelled',
      `${cName} cancelled their ${booking.service?.name || 'appointment'} on ${booking.date}.`,
      booking._id
    );

    res.json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
