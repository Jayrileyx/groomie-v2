import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatTime } from '../../utils/format';

const STATUS_COLORS = {
  pending:   'bg-yellow-100 text-yellow-800 font-bold',
  confirmed: 'bg-green-100 text-green-800 font-bold',
  declined:  'bg-red-100 text-red-800 font-bold',
  completed: 'bg-blue-100 text-blue-800 font-bold',
  cancelled: 'bg-gray-100 text-gray-700 font-bold',
};

const TIME_SLOTS = (() => {
  const slots = [];
  for (let h = 8; h <= 18; h++) {
    for (let m of [0, 30]) {
      if (h === 18 && m === 30) break;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${m === 0 ? '00' : '30'} ${ampm}`;
      const value = `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`;
      slots.push({ label, value });
    }
  }
  return slots;
})();

export default function MyBookings() {
  const { token } = useAuth();
  const { state } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const justBooked = state?.booked === true;

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Derive directly from URL — always in sync when navigate() changes the query string
  const filter = searchParams.get('tab') || 'pending';

  const [reviewForm, setReviewForm] = useState({ bookingId: null, rating: 5, comment: '', photos: [] });
  const [reviewUploading, setReviewUploading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // Reschedule state
  const [reschedulingId, setReschedulingId] = useState(null);
  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '' });
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchBookings = () => {
    axios.get('/api/bookings/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBookings(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, []);

  // Hours until appointment
  const hoursUntil = (b) => {
    const dt = new Date(`${b.date}T${b.time}:00`);
    return (dt - Date.now()) / (1000 * 60 * 60);
  };

  // Is the customer within the groomer's cancellation window?
  const withinWindow = (b) => {
    const window = b.groomerProfile?.cancellationWindowHours ?? 24;
    return hoursUntil(b) < window;
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setCancellingId(id);
    try {
      await axios.patch(`/api/bookings/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchBookings();
    } finally {
      setCancellingId(null);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/reviews', reviewForm, { headers: { Authorization: `Bearer ${token}` } });
      setReviewMessage('Review submitted!');
      setReviewForm({ bookingId: null, rating: 5, comment: '', photos: [] });
      fetchBookings(); // refresh so b.reviewed flips and button hides
    } catch (err) {
      setReviewMessage(err.response?.data?.message || 'Failed to submit review');
    }
  };

  const handleReviewPhoto = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const remaining = 3 - (reviewForm.photos?.length ?? 0);
    const toUpload = files.slice(0, remaining);
    setReviewUploading(true);
    try {
      const urls = await Promise.all(toUpload.map(async (file) => {
        const fd = new FormData();
        fd.append('image', file);
        const res = await axios.post('/api/upload', fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
        });
        return res.data.url;
      }));
      setReviewForm(f => ({ ...f, photos: [...(f.photos || []), ...urls] }));
    } catch {
      // silently ignore individual upload failures
    } finally {
      setReviewUploading(false);
      e.target.value = '';
    }
  };

  const removeReviewPhoto = (idx) => {
    setReviewForm(f => ({ ...f, photos: (f.photos || []).filter((_, i) => i !== idx) }));
  };

  const openReschedule = (booking) => {
    setReschedulingId(booking._id);
    setRescheduleForm({ date: '', time: '' });
    setRescheduleSlots([]);
    setRescheduleError('');
  };

  const handleRescheduleDate = async (booking, date) => {
    setRescheduleForm(f => ({ ...f, date, time: '' }));
    if (!date) return;
    setLoadingSlots(true);
    try {
      const dur = booking.service?.duration || 30;
      const profileId = booking.groomerProfile?._id;
      const res = await axios.get(
        `/api/groomers/${profileId}/booked-slots?date=${date}&duration=${dur}`
      );
      setRescheduleSlots(res.data);
    } catch {
      setRescheduleSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const submitReschedule = async (bookingId) => {
    setRescheduling(true);
    setRescheduleError('');
    try {
      await axios.patch(
        `/api/bookings/${bookingId}/reschedule`,
        { date: rescheduleForm.date, time: rescheduleForm.time },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReschedulingId(null);
      fetchBookings();
    } catch (err) {
      setRescheduleError(err.response?.data?.message || 'Reschedule failed.');
    } finally {
      setRescheduling(false);
    }
  };

  if (loading) return <p className="text-center mt-10">Loading...</p>;

  const filtered = bookings
    .filter(b => b.status === filter)
    .sort((a, b) => {
      if (filter === 'cancelled') {
        // Most recently cancelled first (updatedAt reflects when status changed)
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
      return 0; // keep server order (createdAt desc) for all other tabs
    });

  return (
    <div>
      <h2 className="text-2xl font-bold text-purple-600 mb-4">My Bookings</h2>

      {justBooked && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-5 text-sm text-green-800">
          Booking request sent! The groomer will confirm shortly.
        </div>
      )}

      {bookings.length === 0 ? (
        <div>
          <p className="text-gray-500 mb-3">No bookings yet.</p>
          <Link to="/" className="text-purple-600 hover:underline">Find a groomer</Link>
        </div>
      ) : (
        <>
          {/* Status tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {['pending', 'confirmed', 'declined', 'completed', 'cancelled'].map(s => {
              const count = bookings.filter(b => b.status === s).length;
              return (
                <button key={s} onClick={() => setSearchParams({ tab: s })}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition ${filter === s ? 'bg-purple-500 text-white border-purple-400' : 'border-gray-300 text-gray-600 hover:border-purple-400'}`}>
                  {s === 'declined' ? 'Denied' : s.charAt(0).toUpperCase() + s.slice(1)} ({count})
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <p className="text-gray-400">No {filter === 'declined' ? 'denied' : filter} bookings.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map(b => {
                const locked = withinWindow(b);
                const windowHours = b.groomerProfile?.cancellationWindowHours ?? 24;
                const groomerPhone = b.groomer?.phone;
                const isRescheduling = reschedulingId === b._id;

                return (
                  <div key={b._id} className="border rounded-xl p-5">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{b.groomer?.firstName} {b.groomer?.lastName}</p>
                        <p className="text-sm text-gray-500">{b.service?.name} — ${b.service?.price}</p>
                        <p className="text-sm text-gray-500">{formatDate(b.date)} at {formatTime(b.time)}</p>
                        {b.petInfo?.name && (
                          <p className="text-sm text-gray-400 mt-1">Pet: {b.petInfo.name} ({b.petInfo.breed})</p>
                        )}
                        {b.status === 'declined' && b.groomerNote && (
                          <p className="text-sm text-red-500 mt-1">Reason: {b.groomerNote}</p>
                        )}
                        {b.status === 'cancelled' && b.cancelledBy === 'groomer' && b.groomerNote && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-2 text-sm text-gray-600">
                            <span className="font-medium">Groomer's reason: </span>{b.groomerNote}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>
                          {b.status === 'declined' ? 'Denied' : b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                        </span>
                        {b.paymentStatus === 'paid' ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✅ Paid</span>
                        ) : b.stripePaymentMethodId ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">💳 Card saved</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Actions for active bookings */}
                    {['pending', 'confirmed'].includes(b.status) && (
                      <div className="mt-3">
                        {locked ? (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-800">
                            Within the {windowHours}-hour cancellation window — to reschedule or cancel, contact your groomer directly
                            {groomerPhone && (
                              <span className="font-semibold"> at {groomerPhone}</span>
                            )}.
                          </div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => isRescheduling ? setReschedulingId(null) : openReschedule(b)}
                              className="text-sm border border-purple-400 text-purple-600 px-3 py-1 rounded hover:bg-purple-50">
                              {isRescheduling ? 'Close' : 'Reschedule'}
                            </button>
                            <button onClick={() => cancel(b._id)} disabled={cancellingId === b._id}
                              className="text-sm border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                              {cancellingId === b._id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline reschedule form */}
                    {isRescheduling && (
                      <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
                        <p className="text-sm font-medium text-gray-700">Choose a new date and time</p>
                        <input
                          type="date"
                          value={rescheduleForm.date}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={e => handleRescheduleDate(b, e.target.value)}
                          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                        />
                        <select
                          value={rescheduleForm.time}
                          onChange={e => setRescheduleForm(f => ({ ...f, time: e.target.value }))}
                          disabled={!rescheduleForm.date || loadingSlots}
                          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-100 disabled:text-gray-400">
                          <option value="">
                            {!rescheduleForm.date ? '— Pick a date first —' : loadingSlots ? 'Checking availability...' : '— Select a time —'}
                          </option>
                          {TIME_SLOTS.map(s => {
                            const booked = rescheduleSlots.includes(s.value);
                            const isPast = (() => {
                              if (!rescheduleForm.date) return false;
                              const today = new Date().toISOString().split('T')[0];
                              if (rescheduleForm.date !== today) return false;
                              const [h, m] = s.value.split(':').map(Number);
                              const slotTime = new Date();
                              slotTime.setHours(h, m, 0, 0);
                              return slotTime <= new Date();
                            })();
                            const unavailable = booked || isPast;
                            return (
                              <option key={s.value} value={s.value} disabled={unavailable}>
                                {s.label}{booked ? ' — Unavailable' : isPast ? ' — Past' : ''}
                              </option>
                            );
                          })}
                        </select>
                        {rescheduleError && <p className="text-sm text-red-500">{rescheduleError}</p>}
                        <div className="flex gap-2">
                          <button
                            disabled={!rescheduleForm.date || !rescheduleForm.time || rescheduling}
                            onClick={() => submitReschedule(b._id)}
                            className="bg-purple-500 text-white px-4 py-2 rounded text-sm hover:bg-purple-600 disabled:opacity-50">
                            {rescheduling ? 'Saving...' : 'Confirm Reschedule'}
                          </button>
                          <button onClick={() => setReschedulingId(null)}
                            className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100">
                            Cancel
                          </button>
                        </div>
                        <p className="text-xs text-gray-400">Rescheduled appointments return to pending and need groomer confirmation.</p>
                      </div>
                    )}

                    {/* Book again / review */}
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {b.groomerProfile?._id && (
                        <Link to={`/groomers/${b.groomerProfile._id}`}
                          className="text-sm border border-purple-300 text-purple-600 px-3 py-1 rounded hover:bg-purple-50">
                          Book Again
                        </Link>
                      )}
                      {b.status === 'completed' && b.reviewed && (
                        <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                          ✓ Reviewed
                        </span>
                      )}
                      {b.status === 'completed' && !b.reviewed && (
                        <button onClick={() => setReviewForm({ bookingId: b._id, rating: 5, comment: '', photos: [] })}
                          className="text-sm bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600">
                          Leave a Review
                        </button>
                      )}
                    </div>

                    {reviewForm.bookingId === b._id && (
                      <form onSubmit={submitReview} className="mt-4 flex flex-col gap-2">
                        {/* Star rating */}
                        <select value={reviewForm.rating}
                          onChange={e => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                          className="border rounded px-3 py-2 text-sm">
                          {[5, 4, 3, 2, 1].map(n => (
                            <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)} — {n} star{n !== 1 ? 's' : ''}</option>
                          ))}
                        </select>

                        {/* Comment */}
                        <textarea placeholder="Share your experience..." rows={2} value={reviewForm.comment}
                          onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
                          className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />

                        {/* Photo upload */}
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Photos <span className="text-gray-400">(optional · up to 3)</span></p>
                          <div className="flex gap-2 flex-wrap items-center">
                            {(reviewForm.photos || []).map((url, i) => (
                              <div key={i} className="relative w-20 h-20 flex-shrink-0">
                                <img src={url} alt={`review ${i + 1}`}
                                  className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                                <button
                                  type="button"
                                  onClick={() => removeReviewPhoto(i)}
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none"
                                >×</button>
                              </div>
                            ))}
                            {(reviewForm.photos || []).length < 3 && (
                              <label className={`w-20 h-20 border-2 border-dashed border-purple-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50 transition text-purple-400 text-xs ${reviewUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                <span className="text-2xl leading-none mb-0.5">📷</span>
                                <span>{reviewUploading ? 'Uploading…' : 'Add photo'}</span>
                                <input type="file" accept="image/*" multiple className="hidden"
                                  onChange={handleReviewPhoto} disabled={reviewUploading} />
                              </label>
                            )}
                          </div>
                        </div>

                        <button type="submit" disabled={reviewUploading}
                          className="bg-purple-500 text-white py-2 rounded text-sm disabled:opacity-50">
                          Submit Review
                        </button>
                        {reviewMessage && <p className="text-sm text-green-600">{reviewMessage}</p>}
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
