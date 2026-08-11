import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
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

export default function GroomerBookings() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [stripeConnected, setStripeConnected] = useState(null);

  // Derive directly from URL — always in sync when navigate() changes the query string
  const filter = searchParams.get('tab') || 'pending';

  const [decliningId, setDecliningId] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const [lightbox, setLightbox] = useState(null); // { src, label }
  const [cancellingId, setCancellingId] = useState(null);
  const [cancellingAs, setCancellingAs]   = useState(null); // 'customer' | 'groomer'
  const [cancelNote, setCancelNote]       = useState('');

  const fetchBookings = () => {
    axios.get('/api/bookings/groomer', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBookings(res.data));
  };

  useEffect(() => {
    fetchBookings();
    axios.get('/api/payments/connect/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStripeConnected(res.data.connected))
      .catch(() => setStripeConnected(false));
  }, []);

  const updateStatus = async (id, status, groomerNote) => {
    await axios.patch(
      `/api/bookings/${id}/status`,
      { status, groomerNote },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    fetchBookings();
  };

  const handleCancel = async (id, cancelledBy, note) => {
    await axios.patch(
      `/api/bookings/${id}/status`,
      { status: 'cancelled', cancelledBy, groomerNote: note || undefined },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    setCancellingId(null);
    setCancellingAs(null);
    setCancelNote('');
    fetchBookings();
  };

  const resetCancel = () => {
    setCancellingId(null);
    setCancellingAs(null);
    setCancelNote('');
  };

  const handleDeclineClick = (id) => {
    setDecliningId(id);
    setDeclineReason('');
  };

  const handleDeclineSubmit = async (id) => {
    await updateStatus(id, 'declined', declineReason);
    setDecliningId(null);
    setDeclineReason('');
  };

  const filtered = bookings
    .filter(b => b.status === filter)
    .sort((a, b) => {
      if (filter === 'confirmed') {
        // Soonest appointment first
        return new Date(`${a.date}T${a.time}:00`) - new Date(`${b.date}T${b.time}:00`);
      }
      return 0; // all other tabs keep server order (oldest received first)
    });

  // Warn if the same pet (same customer + pet name) has another active booking within 3 days
  const petWarningIds = new Set();
  const active = bookings.filter(b => ['pending', 'confirmed'].includes(b.status));
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j];
      const samePet =
        a.customer?._id === b.customer?._id &&
        a.petInfo?.name && b.petInfo?.name &&
        a.petInfo.name.toLowerCase() === b.petInfo.name.toLowerCase();
      if (samePet) {
        const diff = Math.abs(new Date(a.date) - new Date(b.date)) / (1000 * 60 * 60 * 24);
        if (diff <= 3) {
          petWarningIds.add(a._id);
          petWarningIds.add(b._id);
        }
      }
    }
  }

  return (
    <div>
      {/* Stripe not connected warning */}
      {stripeConnected === false && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Stripe account not connected</p>
            <p className="text-xs text-amber-700 mt-0.5">You must connect Stripe before you can confirm or complete bookings and receive payouts.</p>
            <a href="/groomer/profile" className="text-xs text-purple-600 font-medium hover:underline mt-1 inline-block">Go to Profile → Connect Stripe</a>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: '24px',
          }}
        >
          <img
            src={lightbox.src}
            alt={lightbox.label}
            style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
          />
          {lightbox.label && (
            <p style={{ color: '#fff', marginTop: '12px', fontSize: '14px', opacity: 0.8 }}>{lightbox.label}</p>
          )}
          <p style={{ color: '#aaa', marginTop: '6px', fontSize: '12px' }}>Click anywhere to close</p>
        </div>
      )}

      <h2 className="text-2xl font-bold text-purple-600 mb-6">Booking Requests</h2>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['pending','confirmed','completed','declined','cancelled'].map(s => (
          <button key={s} onClick={() => setSearchParams({ tab: s })}
            className={`px-4 py-2 rounded-full text-sm font-medium border transition ${filter === s ? 'bg-purple-500 text-white border-purple-400' : 'border-gray-300 text-gray-600 hover:border-purple-400'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)} ({bookings.filter(b => b.status === s).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400">No {filter} bookings.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(b => {
            const flagCount = b.customer?.cancellationFlags?.length || 0;
            return (
            <div key={b._id} className={`border rounded-xl p-5 ${petWarningIds.has(b._id) || flagCount >= 2 ? 'border-red-400' : ''}`}>

              {/* Late-cancellation flag warning */}
              {flagCount >= 2 && (
                <div className="bg-red-50 border border-red-300 rounded-lg px-3 py-2 mb-3 text-xs text-red-800 flex items-start gap-2">
                  <span className="text-base leading-none">🚩</span>
                  <div>
                    <strong>Repeat late canceller</strong> — {b.customer?.firstName} has cancelled {flagCount} appointment{flagCount > 1 ? 's' : ''} within the notice window. Proceed with caution.
                  </div>
                </div>
              )}

              {petWarningIds.has(b._id) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-3 text-xs text-yellow-800">
                  ⚠️ <strong>{b.petInfo?.name}</strong> has another appointment within 3 days of this booking.
                </div>
              )}

              <div className="flex justify-between items-start mb-3">
                <div className="flex items-start gap-3">
                  {/* Photos: customer avatar + pet photo — click to enlarge */}
                  <div className="flex gap-2 flex-shrink-0 mt-0.5">
                    {b.customer?.avatar ? (
                      <img
                        src={b.customer.avatar}
                        alt="customer"
                        title="Click to enlarge"
                        onClick={() => setLightbox({ src: b.customer.avatar, label: `${b.customer.firstName} ${b.customer.lastName}` })}
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 cursor-zoom-in hover:opacity-90 transition"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 text-xl">👤</div>
                    )}
                    {b.petInfo?.photo ? (
                      <img
                        src={b.petInfo.photo}
                        alt={b.petInfo.name}
                        title="Click to enlarge"
                        onClick={() => setLightbox({ src: b.petInfo.photo, label: b.petInfo.name })}
                        className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 cursor-zoom-in hover:opacity-90 transition"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-xl">🐾</div>
                    )}
                  </div>
                <div>
                  <Link
                    to={`/groomer/customer/${b.customer?._id}`}
                    className="font-semibold text-purple-600 hover:underline"
                  >
                    {b.customer?.firstName} {b.customer?.lastName}
                  </Link>
                  <p className="text-sm text-gray-500">{b.customer?.phone}</p>
                  <p className="text-sm text-gray-500">{b.service?.name} — ${b.service?.price}</p>
                  <p className="text-sm text-gray-500">{formatDate(b.date)} at {formatTime(b.time)}</p>
                  {b.petInfo?.name && (
                    <p className="text-sm text-gray-400 mt-1">
                      Pet: {b.petInfo.name}, {b.petInfo.breed}, {b.petInfo.size}
                    </p>
                  )}
                  {b.customerNote && (
                    <p className="text-sm italic text-gray-400 mt-1">"{b.customerNote}"</p>
                  )}
                  <p className="text-xs text-gray-300 mt-2">Received {new Date(b.createdAt).toLocaleString()}</p>
                  {b.customer?._id && (
                    <button
                      onClick={() => navigate(`/messages?with=${b.customer._id}`)}
                      className="mt-2 text-xs border border-purple-300 text-purple-600 px-3 py-1 rounded hover:bg-purple-50"
                    >
                      💬 Message Customer
                    </button>
                  )}
                </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLORS[b.status]}`}>
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </span>
                  {b.paymentStatus === 'paid' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✅ Paid</span>
                  ) : b.stripePaymentMethodId ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">💳 Card on file</span>
                  ) : null}
                </div>
              </div>

              {/* Decline reason — shown on declined bookings */}
              {b.status === 'declined' && b.groomerNote && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-1 text-sm text-red-700">
                  <span className="font-medium">Reason: </span>{b.groomerNote}
                </div>
              )}

              {/* Pending actions */}
              {b.status === 'pending' && decliningId !== b._id && cancellingId !== b._id && (
                <div className="flex gap-2 mt-1 flex-wrap">
                  <button onClick={() => {
                    if (!stripeConnected) {
                      alert('⚠️ You must connect your Stripe account before confirming bookings.\n\nGo to your Profile page to connect Stripe and receive payouts.');
                      return;
                    }
                    updateStatus(b._id, 'confirmed');
                  }}
                    className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                    Confirm
                  </button>
                  <button onClick={() => handleDeclineClick(b._id)}
                    className="border border-red-300 text-red-500 px-4 py-2 rounded text-sm hover:bg-red-50">
                    Decline
                  </button>
                  <button onClick={() => { setCancellingId(b._id); setCancellingAs(null); setCancelNote(''); }}
                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50">
                    Cancel
                  </button>
                </div>
              )}

              {/* Inline decline reason input */}
              {b.status === 'pending' && decliningId === b._id && cancellingId !== b._id && (
                <div className="mt-3 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Reason for declining <span className="text-gray-400 font-normal">(optional)</span></label>
                  <textarea
                    value={declineReason}
                    onChange={e => setDeclineReason(e.target.value)}
                    placeholder="e.g. Fully booked that day, unable to accommodate pet size..."
                    rows={2}
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleDeclineSubmit(b._id)}
                      className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600">
                      Confirm Decline
                    </button>
                    <button onClick={() => setDecliningId(null)}
                      className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {b.status === 'confirmed' && (
                <div className="flex gap-2 mt-1 flex-wrap">
                  <button onClick={() => {
                    if (!stripeConnected) {
                      alert('⚠️ You must connect your Stripe account before marking appointments complete.\n\nGo to your Profile page to connect Stripe and receive payouts.');
                      return;
                    }
                    const amount = b.totalAmount ? `$${b.totalAmount.toFixed(2)}` : 'the full amount';
                    if (window.confirm(`Mark this appointment as complete?\n\nThis will immediately charge the customer's card on file ${amount} for the ${b.service?.name || 'service'}. This action cannot be undone.`)) {
                      updateStatus(b._id, 'completed');
                    }
                  }}
                    className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    Mark Complete
                  </button>
                  <button onClick={() => { setCancellingId(b._id); setCancellingAs(null); setCancelNote(''); }}
                    className="border border-gray-300 text-gray-600 px-4 py-2 rounded text-sm hover:bg-gray-50">
                    Cancel Appointment
                  </button>
                </div>
              )}

              {/* Who-cancelled prompt */}
              {['pending', 'confirmed'].includes(b.status) && cancellingId === b._id && (
                <div className="mt-3 border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col gap-3">

                  {/* Step 1 — pick who cancelled */}
                  {!cancellingAs && (
                    <>
                      <p className="text-sm font-medium text-gray-700">Who is cancelling this appointment?</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => handleCancel(b._id, 'customer')}
                          className="bg-red-500 text-white px-4 py-2 rounded text-sm hover:bg-red-600 font-medium"
                        >
                          Customer cancelled
                        </button>
                        <button
                          onClick={() => setCancellingAs('groomer')}
                          className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 font-medium"
                        >
                          I'm cancelling
                        </button>
                        <button onClick={resetCancel}
                          className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100">
                          Never mind
                        </button>
                      </div>
                      <p className="text-xs text-gray-400">
                        If the customer cancelled within your notice window, a flag will be added to their profile.
                      </p>
                    </>
                  )}

                  {/* Step 2 — groomer cancellation note */}
                  {cancellingAs === 'groomer' && (
                    <>
                      <p className="text-sm font-medium text-gray-700">
                        Reason for cancelling <span className="text-gray-400 font-normal">(optional — visible to customer)</span>
                      </p>
                      <textarea
                        value={cancelNote}
                        onChange={e => setCancelNote(e.target.value)}
                        placeholder="e.g. Emergency came up, equipment issue, illness..."
                        rows={3}
                        className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancel(b._id, 'groomer', cancelNote)}
                          className="bg-gray-700 text-white px-4 py-2 rounded text-sm hover:bg-gray-800 font-medium"
                        >
                          Confirm Cancellation
                        </button>
                        <button onClick={() => setCancellingAs(null)}
                          className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100">
                          Back
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Show who cancelled + groomer note on cancelled bookings */}
              {b.status === 'cancelled' && (
                <div className="mt-2">
                  {b.cancelledBy && (
                    <p className="text-xs text-gray-400">
                      Cancelled by: <span className="font-medium">{b.cancelledBy === 'customer' ? 'Customer' : 'Groomer'}</span>
                    </p>
                  )}
                  {b.cancelledBy === 'groomer' && b.groomerNote && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm text-gray-600">
                      <span className="font-medium">Reason: </span>{b.groomerNote}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
