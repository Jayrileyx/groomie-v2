const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name:        { type: String, required: true }, // e.g. "Bath & Brush", "Full Groom"
  description: { type: String },
  price:       { type: Number, required: true },
  duration:    { type: Number }, // minutes
});

const groomerProfileSchema = new mongoose.Schema({
  user:               { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  bio:                { type: String },
  city:               { type: String, default: '' },
  address:            { type: String },
  serviceRadius:      { type: Number, default: 10 }, // miles
  services:           [serviceSchema],
  yearsExperience:    { type: Number },
  specialties:        [String], // e.g. ["Large Dogs", "Puppies", "Doodles"]
  photos:             [String], // URLs
  rating:             { type: Number, default: 0 },
  reviewCount:        { type: Number, default: 0 },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectionReason:    { type: String },
  verificationDocs:   [String], // URLs to submitted documents
  cancellationWindowHours: { type: Number, default: 24 }, // hours before appt customer can reschedule/cancel
  stripeAccountId:    { type: String }, // for payouts
  availability: [{
    dayOfWeek: { type: Number }, // 0 = Sunday, 6 = Saturday
    startTime:  { type: String }, // "09:00"
    endTime:    { type: String }, // "17:00"
  }],
  blockedDates:     [String], // YYYY-MM-DD dates groomer is unavailable (vacation, holidays)
  serviceAgreement: { type: String }, // groomer's own cancellation policy / liability terms
}, { timestamps: true });

module.exports = mongoose.model('GroomerProfile', groomerProfileSchema);
