const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  booking:        { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  customer:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groomer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  groomerProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'GroomerProfile', required: true },
  rating:         { type: Number, required: true, min: 1, max: 5 },
  comment:        { type: String },
  photos:         [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
