const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customer:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groomer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groomerProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'GroomerProfile', required: true },
  service:        {
    name:     String,
    price:    Number,
    duration: Number,
  },
  date:           { type: String, required: true }, // "2026-08-15"
  time:           { type: String, required: true }, // "10:00"
  status:         {
    type: String,
    enum: ['pending', 'confirmed', 'declined', 'completed', 'cancelled'],
    default: 'pending'
  },
  petInfo: {
    name:   String,
    breed:  String,
    size:   { type: String, enum: ['small', 'medium', 'large', 'extra-large'] },
    notes:  String,
    photo:  String,
  },
  totalAmount:    { type: Number },
  paymentStatus:  { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
  stripePaymentId:       { type: String }, // PaymentIntent ID after charge
  stripePaymentMethodId: { type: String }, // saved card for charging at completion
  stripeCustomerId:      { type: String }, // Stripe customer ID
  customerNote:   { type: String },
  groomerNote:    { type: String },
  cancelledBy:    { type: String, enum: ['customer', 'groomer'] },
  reviewed:             { type: Boolean, default: false },
  agreedToGroomerTerms: { type: Boolean, default: false },
  waiver: {
    signedName: { type: String },
    signedAt:   { type: Date },
  },
}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
