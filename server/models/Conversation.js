const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  booking:      { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  lastMessage:  { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  unreadCount:  {
    type: Map,
    of: Number,
    default: {},
  },
}, { timestamps: true });

// Ensure we don't create duplicate conversations between the same two users
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
