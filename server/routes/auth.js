const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const GroomerProfile = require('../models/GroomerProfile');

const signToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, role, firstName, lastName, phone, agreedToTerms } = req.body;

  if (!['customer', 'groomer'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  if (!agreedToTerms) {
    return res.status(400).json({ message: 'You must agree to the Terms of Service and Privacy Policy to register.' });
  }

  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'Username or email already in use' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username, email, password: hashed, role, firstName, lastName, phone,
      agreedToTerms: true, agreedToTermsAt: new Date(),
    });

    // If registering as groomer, create an empty profile
    if (role === 'groomer') {
      await GroomerProfile.create({ user: user._id, city: '' });
    }

    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, username, email, role, firstName, lastName } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Accept username OR email in the username field
    const user = await User.findOne({
      $or: [{ username }, { email: username }],
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (user.isSuspended) return res.status(403).json({ message: 'Account suspended' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role, firstName: user.firstName }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me
const { protect } = require('../middleware/auth');
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/auth/me — update own profile (name, phone, avatar, email) — only sets provided fields
router.put('/me', protect, async (req, res) => {
  const allowed = ['firstName', 'lastName', 'phone', 'avatar', 'email'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) update[key] = req.body[key];
  }
  try {
    // Check email uniqueness if changing email
    if (update.email) {
      const existing = await User.findOne({ email: update.email, _id: { $ne: req.user.id } });
      if (existing) return res.status(400).json({ message: 'That email is already in use.' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/auth/me/password — change own password
router.put('/me/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters.' });
  }
  try {
    const user = await User.findById(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
