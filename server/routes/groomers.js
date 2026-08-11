const express = require('express');
const router = express.Router();
const GroomerProfile = require('../models/GroomerProfile');
const User = require('../models/User');
const { protect, restrictTo } = require('../middleware/auth');
const email = require('../utils/email');

// GET /api/groomers/cities
router.get('/cities', async (req, res) => {
  try {
    const cities = await GroomerProfile.distinct('city', { verificationStatus: 'approved' });
    res.json(cities.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groomers?city=Houston
router.get('/', async (req, res) => {
  const { city } = req.query;
  try {
    const query = { verificationStatus: 'approved' };
    if (city) query.city = { $regex: new RegExp(`^${city}$`, 'i') };
    const groomers = await GroomerProfile.find(query).populate('user', 'firstName lastName avatar');
    res.json(groomers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groomers/me/profile — groomer gets their own profile (creates one if missing)
router.get('/me/profile', protect, restrictTo('groomer'), async (req, res) => {
  try {
    let profile = await GroomerProfile.findOne({ user: req.user.id });
    if (!profile) {
      profile = await GroomerProfile.create({ user: req.user.id, city: '' });
    }
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/groomers/me/submit-review — groomer submits profile for admin review
router.post('/me/submit-review', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const profile = await GroomerProfile.findOneAndUpdate(
      { user: req.user.id },
      { verificationStatus: 'pending' },
      { new: true }
    );
    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    // Email admin
    const groomer = await User.findById(req.user.id).select('firstName lastName email');
    const adminUsers = await User.find({ role: 'admin' }).select('email');
    const groomerName = `${groomer?.firstName} ${groomer?.lastName}`.trim();
    adminUsers.forEach(admin => {
      email.newGroomerPendingReview({
        adminEmail: admin.email,
        groomerName,
        groomerEmail: groomer?.email,
      });
    });

    res.json({ message: 'Profile submitted for review.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/groomers/me — groomer updates their own profile
router.put('/me', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const profile = await GroomerProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/groomers/me/availability — save availability settings
router.patch('/me/availability', protect, restrictTo('groomer'), async (req, res) => {
  try {
    const { availability, blockedDates } = req.body;
    const profile = await GroomerProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: { availability, blockedDates } },
      { new: true }
    );
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groomers/:id/available-slots?date=YYYY-MM-DD&duration=60
// Returns { slots: ["09:00", ...], worksToday: bool }
// slots = available (not booked) times the groomer can take this service
router.get('/:id/available-slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: 'Date required' });

  const requestedDur = parseInt(req.query.duration, 10) || 60;

  try {
    const Booking = require('../models/Booking');
    const profile = await GroomerProfile.findById(req.params.id)
      .select('user availability blockedDates');
    if (!profile) return res.status(404).json({ message: 'Groomer not found' });

    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toStr  = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

    // Check blocked dates
    if (profile.blockedDates?.includes(date)) {
      return res.json({ slots: [], worksToday: false, reason: 'blocked' });
    }

    // Get day of week (0=Sun … 6=Sat) for the requested date
    // Parse as local date to avoid UTC offset shifting the day
    const [y, mo, d] = date.split('-').map(Number);
    const dayOfWeek = new Date(y, mo - 1, d).getDay();

    // Find groomer's hours for that day
    const dayConfig = profile.availability?.find(a => a.dayOfWeek === dayOfWeek);
    if (!dayConfig || !dayConfig.startTime || !dayConfig.endTime) {
      return res.json({ slots: [], worksToday: false, reason: 'day-off' });
    }

    const workStart = toMins(dayConfig.startTime);
    const workEnd   = toMins(dayConfig.endTime);

    // Generate all 30-min slots that fit the service within working hours
    const allSlots = [];
    for (let mins = workStart; mins + requestedDur <= workEnd; mins += 30) {
      allSlots.push(mins);
    }

    if (allSlots.length === 0) {
      return res.json({ slots: [], worksToday: true });
    }

    // Fetch existing bookings for this groomer on this date
    const bookings = await Booking.find({
      groomer: profile.user,
      date,
      status: { $in: ['pending', 'confirmed'] },
    }).select('time service');

    const windows = bookings.map(b => ({
      start: toMins(b.time),
      dur: b.service?.duration || 60,
    }));

    // Keep only slots that don't overlap any existing booking
    const available = allSlots.filter(slotStart => {
      const slotEnd = slotStart + requestedDur;
      return !windows.some(w => slotStart < w.start + w.dur && slotEnd > w.start);
    });

    res.json({ slots: available.map(toStr), worksToday: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groomers/:id/booked-slots — legacy, kept for backward compat
router.get('/:id/booked-slots', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ message: 'Date required' });
  const requestedDur = parseInt(req.query.duration, 10) || 30;
  try {
    const Booking = require('../models/Booking');
    const profile = await GroomerProfile.findById(req.params.id).select('user');
    if (!profile) return res.status(404).json({ message: 'Groomer not found' });
    const bookings = await Booking.find({
      groomer: profile.user, date, status: { $in: ['pending', 'confirmed'] },
    }).select('time service');
    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const toStr  = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const windows = bookings.map(b => ({ start: toMins(b.time), dur: b.service?.duration || 30 }));
    const allSlots = [];
    for (let mins = 8 * 60; mins < 18 * 60; mins += 30) allSlots.push(mins);
    const blocked = allSlots.filter(s => {
      const e = s + requestedDur;
      return windows.some(w => s < w.start + w.dur && e > w.start);
    });
    res.json(blocked.map(toStr));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/groomers/:id
router.get('/:id', async (req, res) => {
  try {
    const profile = await GroomerProfile.findById(req.params.id).populate('user', 'firstName lastName avatar');
    if (!profile) return res.status(404).json({ message: 'Groomer not found' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
