const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['new_booking', 'confirmed', 'declined', 'completed', 'cancelled', 'rescheduled', 'review', 'new_message'],
    required: true,
  },
  message:   { type: String, required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  reviewId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Review' },
  read:      { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
