const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const GroomerProfile = require('../models/GroomerProfile');
const { protect, restrictTo } = require('../middleware/auth');
const notify = require('../utils/notify');
const email = require('../utils/email');

// POST /api/reviews — customer leaves a review after completed booking
router.post('/', protect, restrictTo('customer'), async (req, res) => {
  const { bookingId, rating, comment, photos } = req.body;
  try {
    const booking = await Booking.findOne({ _id: bookingId, customer: req.user.id, status: 'completed' });
    if (!booking) return res.status(400).json({ message: 'Can only review completed bookings' });

    // Prevent duplicate reviews for the same booking
    const existing = await Review.findOne({ booking: bookingId, customer: req.user.id });
    if (existing) return res.status(400).json({ message: 'You already reviewed this booking' });

    const review = await Review.create({
      booking: bookingId,
      customer: req.user.id,
      groomer: booking.groomer,
      groomerProfile: booking.groomerProfile,
      rating,
      comment,
      photos: Array.isArray(photos) ? photos.filter(p => typeof p === 'string' && p.startsWith('/api/')) : [],
    });

    // Mark booking as reviewed
    booking.reviewed = true;
    await booking.save();

    // Update groomer's average rating
    const reviews = await Review.find({ groomerProfile: booking.groomerProfile });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await GroomerProfile.findByIdAndUpdate(booking.groomerProfile, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
    });

    // Notify the groomer
    const User = require('../models/User');
    const customer = await User.findById(req.user.id).select('firstName lastName');
    const cName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'A customer';
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    notify(booking.groomer, 'review',
      `${cName} left you a ${stars} review: "${(comment || '').slice(0, 80)}${comment?.length > 80 ? '…' : ''}"`,
      booking._id,
      review._id
    );

    // Email groomer
    const groomerUser = await User.findById(booking.groomer).select('email firstName lastName');
    if (groomerUser?.email) {
      email.newReview({
        groomerEmail: groomerUser.email,
        groomerName: `${groomerUser.firstName} ${groomerUser.lastName}`.trim(),
        customerName: cName,
        rating,
        comment,
      });
    }

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reviews/my — groomer fetches their own reviews
router.get('/my', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const profile = await GroomerProfile.findOne({ user: req.user.id }).select('_id');
    if (!profile) return res.json([]);
    const reviews = await Review.find({ groomerProfile: profile._id })
      .populate('customer', 'firstName lastName avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/reviews/:groomerProfileId
router.get('/:groomerProfileId', async (req, res) => {
  try {
    const reviews = await Review.find({ groomerProfile: req.params.groomerProfileId })
      .populate('customer', 'firstName lastName avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
