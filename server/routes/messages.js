const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const notify = require('../utils/notify');
const email = require('../utils/email');

// GET /api/messages — list all conversations for current user
router.get('/', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id })
      .populate('participants', 'firstName lastName avatar role')
      .sort({ lastMessageAt: -1 });

    // Attach unread count for this user
    const result = conversations.map(c => {
      const obj = c.toObject();
      obj.unread = c.unreadCount?.get?.(req.user.id.toString()) || 0;
      return obj;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/start — start or retrieve a conversation with another user
router.post('/start', protect, async (req, res) => {
  const { recipientId, bookingId } = req.body;
  if (!recipientId) return res.status(400).json({ message: 'recipientId is required' });
  if (recipientId === req.user.id.toString()) return res.status(400).json({ message: 'Cannot message yourself' });

  try {
    // Check recipient exists
    const recipient = await User.findById(recipientId).select('firstName lastName');
    if (!recipient) return res.status(404).json({ message: 'User not found' });

    // Find existing conversation between these two users
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user.id, recipientId], $size: 2 },
    }).populate('participants', 'firstName lastName avatar role');

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user.id, recipientId],
        booking: bookingId || undefined,
      });
      conversation = await Conversation.findById(conversation._id)
        .populate('participants', 'firstName lastName avatar role');
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/:conversationId — get messages in a conversation
router.get('/:conversationId', protect, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user.id,
    });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const messages = await Message.find({ conversation: req.params.conversationId })
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: 1 });

    // Mark all messages from the other person as read
    await Message.updateMany(
      { conversation: req.params.conversationId, sender: { $ne: req.user.id }, read: false },
      { read: true }
    );

    // Reset unread count for this user
    conversation.unreadCount.set(req.user.id.toString(), 0);
    await conversation.save();

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/messages/:conversationId — send a message
router.post('/:conversationId', protect, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ message: 'Message cannot be empty' });

  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      participants: req.user.id,
    });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' });

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      content: content.trim(),
    });

    // Update conversation metadata + increment unread for the OTHER participant
    const otherId = conversation.participants.find(p => p.toString() !== req.user.id.toString());
    const currentUnread = conversation.unreadCount?.get?.(otherId.toString()) || 0;
    conversation.unreadCount.set(otherId.toString(), currentUnread + 1);
    conversation.lastMessage = content.trim().slice(0, 100);
    conversation.lastMessageAt = new Date();
    await conversation.save();

    const populated = await message.populate('sender', 'firstName lastName avatar');

    // Notify the recipient
    const sender = await User.findById(req.user.id).select('firstName lastName');
    const recipient = await User.findById(otherId).select('firstName lastName email');
    const senderName = `${sender.firstName} ${sender.lastName}`;
    const preview = content.trim().slice(0, 80);

    notify(otherId, 'new_message', `New message from ${senderName}: "${preview}"`);
    if (recipient?.email) {
      email.newMessage({
        recipientEmail: recipient.email,
        recipientName: recipient.firstName,
        senderName,
        preview,
      });
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/messages/unread/count — total unread messages for badge
router.get('/unread/count', protect, async (req, res) => {
  try {
    const conversations = await Conversation.find({ participants: req.user.id });
    const total = conversations.reduce((sum, c) => {
      return sum + (c.unreadCount?.get?.(req.user.id.toString()) || 0);
    }, 0);
    res.json({ count: total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
