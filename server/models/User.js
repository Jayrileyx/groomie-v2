const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  email:        { type: String, required: true, unique: true },
  password:     { type: String, required: true },
  role:         { type: String, enum: ['customer', 'groomer', 'admin'], default: 'customer' },
  firstName:    { type: String },
  lastName:     { type: String },
  phone:        { type: String },
  avatar:       { type: String },
  isVerified:   { type: Boolean, default: false },
  isSuspended:       { type: Boolean, default: false },
  stripeCustomerId:  { type: String }, // Stripe customer ID for saved card
  cancellationFlags: [{
    bookingId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    groomerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    flaggedAt:  { type: Date, default: Date.now },
  }],
  agreedToTerms:   { type: Boolean, default: false },
  agreedToTermsAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
