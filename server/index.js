const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes        = require('./routes/auth');
const groomerRoutes     = require('./routes/groomers');
const bookingRoutes     = require('./routes/bookings');
const reviewRoutes      = require('./routes/reviews');
const adminRoutes       = require('./routes/admin');
const petRoutes         = require('./routes/pets');
const uploadRoutes        = require('./routes/upload');
const notificationRoutes  = require('./routes/notifications');
const paymentRoutes       = require('./routes/payments');
const messageRoutes       = require('./routes/messages');

const app = express();

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Strict limit on auth endpoints to prevent brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { message: 'Too many attempts, please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: { message: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
}));

// Stripe webhook needs raw body — mount BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api',          apiLimiter);
app.use('/api/groomers', groomerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews',  reviewRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/pets',     petRoutes);
// /api/upload  → new uploads + serve new URLs
// /api/uploads → backwards-compat for any URLs already saved in the DB
app.use('/api/upload',        uploadRoutes);
app.use('/api/uploads',       uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments',     paymentRoutes);
app.use('/api/messages',     messageRoutes);

const PORT = process.env.PORT || 5001;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error(err));
