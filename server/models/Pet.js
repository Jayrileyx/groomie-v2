const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  owner:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:   { type: String, required: true },
  breed:  { type: String, required: true },
  size:   { type: String, enum: ['small', 'medium', 'large', 'extra-large'], default: 'medium' },
  notes:  { type: String },
  photo:  { type: String }, // URL
}, { timestamps: true });

module.exports = mongoose.model('Pet', petSchema);
