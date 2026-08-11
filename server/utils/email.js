const nodemailer = require('nodemailer');

// ── Transporter ───────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 5000,  // fail fast if Gmail is unreachable
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

// ── Base template ─────────────────────────────────────────────────────────────
const wrap = (title, body) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#9333ea,#d946ef);padding:24px 32px;">
            <span style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">🐾 Groomie</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1f2937;font-size:18px;">${title}</h2>
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This message was sent by Groomie. Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

const p = (text) => `<p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">${text}</p>`;
const strong = (text) => `<strong style="color:#1f2937;">${text}</strong>`;
const btn = (label, url) => `
  <table cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background:#9333ea;border-radius:8px;padding:12px 24px;">
        <a href="${url}" style="color:#fff;font-size:15px;font-weight:600;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;
const divider = () => `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />`;
const infoBox = (lines) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ff;border-radius:8px;margin:16px 0;">
    <tr><td style="padding:16px;">
      ${lines.map(l => `<p style="margin:0 0 6px;font-size:14px;color:#374151;">${l}</p>`).join('')}
    </td></tr>
  </table>`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (t) => { const [h, m] = t.split(':').map(Number); const ap = h < 12 ? 'AM' : 'PM'; return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ap}`; };

// ── Send helper ───────────────────────────────────────────────────────────────
const PLACEHOLDER = ['your.gmail', 'your_app_password', 'REPLACE'];
const emailConfigured = () =>
  process.env.EMAIL_USER &&
  process.env.EMAIL_PASS &&
  !PLACEHOLDER.some(p => (process.env.EMAIL_USER + process.env.EMAIL_PASS).includes(p));

async function sendEmail({ to, subject, html }) {
  if (!emailConfigured()) {
    console.log(`[email] Not configured — skipping "${subject}" to ${to}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Groomie" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    // Never crash the app over a failed email
    console.error('[email] Failed to send:', err.message);
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';

// 1. Customer → groomer: new booking request
function newBookingRequest({ groomerEmail, groomerName, customerName, service, date, time, petName, customerNote }) {
  return sendEmail({
    to: groomerEmail,
    subject: `New booking request from ${customerName}`,
    html: wrap('New Booking Request', [
      p(`Hi ${strong(groomerName)}, you have a new booking request!`),
      infoBox([
        `👤 <strong>Customer:</strong> ${customerName}`,
        `✂️ <strong>Service:</strong> ${service}`,
        `📅 <strong>Date:</strong> ${fmtDate(date)}`,
        `🕐 <strong>Time:</strong> ${fmtTime(time)}`,
        `🐾 <strong>Pet:</strong> ${petName || '—'}`,
        customerNote ? `💬 <strong>Note:</strong> ${customerNote}` : '',
      ].filter(Boolean)),
      p('Log in to confirm or decline this request.'),
      btn('View Booking', `${CLIENT}/groomer/bookings`),
    ].join('')),
  });
}

// 2. Groomer → customer: booking confirmed
function bookingConfirmed({ customerEmail, customerName, groomerName, service, date, time }) {
  return sendEmail({
    to: customerEmail,
    subject: `Your ${service} appointment is confirmed!`,
    html: wrap('Appointment Confirmed ✅', [
      p(`Hi ${strong(customerName)}, great news!`),
      p(`${strong(groomerName)} has confirmed your appointment.`),
      infoBox([
        `✂️ <strong>Service:</strong> ${service}`,
        `📅 <strong>Date:</strong> ${fmtDate(date)}`,
        `🕐 <strong>Time:</strong> ${fmtTime(time)}`,
        `💳 <strong>Payment:</strong> Your card will be charged after the service is complete.`,
      ]),
      p('We\'ll see you soon!'),
      btn('View My Bookings', `${CLIENT}/my-bookings?tab=confirmed`),
    ].join('')),
  });
}

// 3. Groomer → customer: booking declined
function bookingDeclined({ customerEmail, customerName, groomerName, service, date, reason }) {
  return sendEmail({
    to: customerEmail,
    subject: `Update on your ${service} request`,
    html: wrap('Booking Request Declined', [
      p(`Hi ${strong(customerName)},`),
      p(`Unfortunately, ${strong(groomerName)} is unable to accommodate your ${strong(service)} request on ${strong(fmtDate(date))}.`),
      reason ? infoBox([`💬 <strong>Reason:</strong> ${reason}`]) : '',
      p('Don\'t worry — there are other great groomers available.'),
      btn('Find Another Groomer', `${CLIENT}/search`),
    ].join('')),
  });
}

// 4. Groomer → customer: appointment completed, leave a review
function appointmentCompleted({ customerEmail, customerName, groomerName, service }) {
  return sendEmail({
    to: customerEmail,
    subject: `How did ${groomerName} do? Leave a review`,
    html: wrap('Appointment Complete!', [
      p(`Hi ${strong(customerName)}, your ${strong(service)} appointment with ${strong(groomerName)} is complete!`),
      p('We\'d love to hear how it went. Your review helps other pet owners find great groomers.'),
      btn('Leave a Review', `${CLIENT}/my-bookings?tab=completed`),
      divider(),
      p(`<span style="color:#9ca3af;font-size:13px;">Your card will be charged the amount shown in your booking. If you have any issues, please contact us.</span>`),
    ].join('')),
  });
}

// 5. Groomer → customer: groomer cancelled
function groomercancelled({ customerEmail, customerName, groomerName, service, date, reason }) {
  return sendEmail({
    to: customerEmail,
    subject: `Your ${service} appointment was cancelled`,
    html: wrap('Appointment Cancelled', [
      p(`Hi ${strong(customerName)},`),
      p(`${strong(groomerName)} has cancelled your ${strong(service)} appointment on ${strong(fmtDate(date))}.`),
      reason ? infoBox([`💬 <strong>Reason:</strong> ${reason}`]) : '',
      p('We\'re sorry for the inconvenience. You can search for another groomer below.'),
      btn('Find Another Groomer', `${CLIENT}/search`),
    ].join('')),
  });
}

// 6. Customer → groomer: customer cancelled
function customerCancelled({ groomerEmail, groomerName, customerName, service, date }) {
  return sendEmail({
    to: groomerEmail,
    subject: `${customerName} cancelled their ${service} appointment`,
    html: wrap('Booking Cancelled by Customer', [
      p(`Hi ${strong(groomerName)},`),
      p(`${strong(customerName)} has cancelled their ${strong(service)} appointment on ${strong(fmtDate(date))}.`),
      p('Your calendar has been updated.'),
      btn('View Bookings', `${CLIENT}/groomer/bookings`),
    ].join('')),
  });
}

// 7. Customer → groomer: rescheduled
function bookingRescheduled({ groomerEmail, groomerName, customerName, service, newDate, newTime }) {
  return sendEmail({
    to: groomerEmail,
    subject: `${customerName} rescheduled their ${service} appointment`,
    html: wrap('Appointment Rescheduled', [
      p(`Hi ${strong(groomerName)},`),
      p(`${strong(customerName)} has rescheduled their ${strong(service)} appointment.`),
      infoBox([
        `📅 <strong>New date:</strong> ${fmtDate(newDate)}`,
        `🕐 <strong>New time:</strong> ${fmtTime(newTime)}`,
      ]),
      p('Please confirm or decline the new time.'),
      btn('View Booking', `${CLIENT}/groomer/bookings`),
    ].join('')),
  });
}

// 8. Customer → groomer: new review
function newReview({ groomerEmail, groomerName, customerName, rating, comment }) {
  const stars = '⭐'.repeat(rating);
  return sendEmail({
    to: groomerEmail,
    subject: `${customerName} left you a ${rating}-star review`,
    html: wrap('New Review Received', [
      p(`Hi ${strong(groomerName)}, you have a new review!`),
      infoBox([
        `${stars} <strong>${rating}/5 stars</strong>`,
        `👤 <strong>From:</strong> ${customerName}`,
        comment ? `💬 "${comment}"` : '',
      ].filter(Boolean)),
      btn('View My Reviews', `${CLIENT}/groomer/reviews`),
    ].join('')),
  });
}

// 9. Admin → customer: refund issued
function refundIssued({ customerEmail, customerName, groomerName, service, amount }) {
  return sendEmail({
    to: customerEmail,
    subject: `Your refund of $${Number(amount).toFixed(2)} has been issued`,
    html: wrap('Refund Issued 💸', [
      p(`Hi ${strong(customerName)},`),
      p(`A refund has been issued for your ${strong(service)} appointment with ${strong(groomerName)}.`),
      infoBox([
        `💰 <strong>Refund amount:</strong> $${Number(amount).toFixed(2)}`,
        `⏱️ <strong>Processing time:</strong> 5–10 business days depending on your bank`,
      ]),
      p('If you have any questions, please contact us.'),
    ].join('')),
  });
}

// 10. Admin → groomer: profile approved
function groomerApproved({ groomerEmail, groomerName }) {
  return sendEmail({
    to: groomerEmail,
    subject: 'Your Groomie profile has been approved! 🎉',
    html: wrap('You\'re approved!', [
      p(`Hi ${strong(groomerName)}, great news!`),
      p('Your groomer profile has been reviewed and approved. You\'re now visible to customers and can start accepting bookings.'),
      btn('View My Profile', `${CLIENT}/groomer/profile`),
      divider(),
      p(`<span style="color:#9ca3af;font-size:13px;">Make sure your profile is complete with services, availability, and a great bio to attract customers.</span>`),
    ].join('')),
  });
}

// 10. Admin → groomer: profile rejected
function groomerRejected({ groomerEmail, groomerName, reason }) {
  return sendEmail({
    to: groomerEmail,
    subject: 'Update on your Groomie application',
    html: wrap('Profile Review Update', [
      p(`Hi ${strong(groomerName)},`),
      p('Thank you for applying to Groomie. After reviewing your profile, we\'re unable to approve it at this time.'),
      reason ? infoBox([`💬 <strong>Reason:</strong> ${reason}`]) : '',
      p('You can update your profile and it will be re-reviewed by our team.'),
      btn('Update My Profile', `${CLIENT}/groomer/profile`),
    ].join('')),
  });
}

// 11. Groomer → admin: new groomer awaiting review
function newGroomerPendingReview({ adminEmail, groomerName, groomerEmail }) {
  return sendEmail({
    to: adminEmail,
    subject: `New groomer pending review: ${groomerName}`,
    html: wrap('New Groomer Application', [
      p(`A new groomer has submitted their profile for review.`),
      infoBox([
        `👤 <strong>Name:</strong> ${groomerName}`,
        `📧 <strong>Email:</strong> ${groomerEmail}`,
      ]),
      btn('Review in Admin Dashboard', `${CLIENT}/admin`),
    ].join('')),
  });
}

// 12. New message notification
function newMessage({ recipientEmail, recipientName, senderName, preview }) {
  return sendEmail({
    to: recipientEmail,
    subject: `New message from ${senderName}`,
    html: wrap(`New message from ${senderName}`, [
      p(`Hi ${strong(recipientName)}, you have a new message!`),
      infoBox([`💬 "${preview}"`]),
      btn('View Message', `${CLIENT}/messages`),
    ].join('')),
  });
}

module.exports = {
  refundIssued,
  newBookingRequest,
  bookingConfirmed,
  bookingDeclined,
  appointmentCompleted,
  newMessage,
  groomercancelled,
  customerCancelled,
  bookingRescheduled,
  newReview,
  groomerApproved,
  groomerRejected,
  newGroomerPendingReview,
};
