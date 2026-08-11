const Notification = require('../models/Notification');

/**
 * Fire-and-forget notification helper.
 * Never throws — notification failures are non-critical.
 */
const notify = async (recipientId, type, message, bookingId = null, reviewId = null) => {
  try {
    await Notification.create({ recipient: recipientId, type, message, bookingId, reviewId });
  } catch (err) {
    console.error('[notify] Failed to create notification:', err.message);
  }
};

module.exports = notify;
