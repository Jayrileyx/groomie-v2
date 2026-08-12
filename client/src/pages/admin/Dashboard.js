import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatTime } from '../../utils/format';

const STATUS_BADGE = {
  pending:  'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const BOOKING_BADGE = {
  pending:   'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  declined:  'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const formatDuration = (mins) => {
  if (!mins) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
};

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-gray-600 font-medium">{title}</p>
      {subtitle && <p className="text-gray-400 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Groomer slide-in drawer ───────────────────────────────────────────────────
function GroomerDrawer({ profile, onClose, onVerify, onSuspend, onDelete }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { setRejectMode(false); setRejectReason(''); }, [profile]);

  if (!profile) return null;
  const u = profile.user || {};

  const handleReject = () => {
    onVerify(profile._id, 'rejected', rejectReason);
    setRejectMode(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-purple-600">Groomer Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        {/* Identity */}
        <div className="mb-4">
          {u.avatar && <img src={u.avatar} alt="avatar" className="w-16 h-16 rounded-full object-cover border mb-2" />}
          <p className="font-semibold text-gray-800 text-lg">{u.firstName} {u.lastName}</p>
          <p className="text-sm text-gray-500">{u.email}</p>
          {u.phone && <p className="text-sm text-gray-500">{u.phone}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_BADGE[profile.verificationStatus]}`}>
              {profile.verificationStatus?.charAt(0).toUpperCase() + profile.verificationStatus?.slice(1)}
            </span>
            {u.isSuspended && <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-200 text-gray-700">Suspended</span>}
          </div>
          {profile.rejectionReason && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 rounded px-2 py-1">
              Rejection reason: {profile.rejectionReason}
            </p>
          )}
        </div>

        {/* Details */}
        {profile.bio && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Bio</p>
            <p className="text-sm text-gray-700">{profile.bio}</p>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-1 text-sm text-gray-600">
          {profile.city && <p>📍 {profile.city}{profile.address ? `, ${profile.address}` : ''}</p>}
          {profile.yearsExperience > 0 && <p>🏆 {profile.yearsExperience} yrs experience</p>}
          {profile.specialties?.length > 0 && <p>✂️ {profile.specialties.join(', ')}</p>}
          <p>⭐ {profile.rating || 0} ({profile.reviewCount || 0} reviews)</p>
          <p>🕐 {profile.cancellationWindowHours || 24}h cancellation window</p>
        </div>

        {/* Services */}
        {profile.services?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Services</p>
            <div className="flex flex-col gap-2">
              {profile.services.map((s, i) => (
                <div key={i} className="border rounded px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-purple-600 font-bold">${s.price}</span>
                  </div>
                  {s.description && <p className="text-gray-500 text-xs mt-0.5">{s.description}</p>}
                  {s.duration > 0 && <p className="text-gray-400 text-xs mt-0.5">Approx. {formatDuration(s.duration)}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gallery */}
        {profile.photos?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Gallery ({profile.photos.length})</p>
            <div className="grid grid-cols-3 gap-1">
              {profile.photos.map((url, i) => (
                <img key={i} src={url} alt={`gallery ${i}`}
                  className="w-full aspect-square object-cover rounded cursor-zoom-in"
                  onClick={() => window.open(url, '_blank')} />
              ))}
            </div>
          </div>
        )}

        {/* Verification Documents */}
        {profile.verificationDocs?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Verification Documents ({profile.verificationDocs.length})</p>
            <div className="flex flex-col gap-2">
              {profile.verificationDocs.map((url, i) => {
                const name = url.split('/').pop();
                const isPdf = url.toLowerCase().endsWith('.pdf');
                return (
                  <a key={i} href={url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 border rounded px-3 py-2 text-sm text-purple-600 hover:bg-purple-50">
                    {isPdf ? '📄' : '🖼️'} {name}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t pt-4 flex flex-col gap-2">
          {!rejectMode && (
            <>
              {profile.verificationStatus !== 'approved' && (
                <button onClick={() => onVerify(profile._id, 'approved')}
                  className="bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700">
                  Approve
                </button>
              )}
              {profile.verificationStatus !== 'rejected' && (
                <button onClick={() => setRejectMode(true)}
                  className="border border-red-300 text-red-500 py-2 rounded text-sm hover:bg-red-50">
                  {profile.verificationStatus === 'approved' ? 'Revoke Approval' : 'Reject'}
                </button>
              )}
              {profile.verificationStatus === 'rejected' && (
                <button onClick={() => onVerify(profile._id, 'approved')}
                  className="bg-green-600 text-white py-2 rounded text-sm hover:bg-green-700">Approve</button>
              )}
            </>
          )}

          {rejectMode && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-700">Reason for rejection <span className="text-gray-400 font-normal">(sent to groomer)</span></p>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Missing service descriptions, incomplete profile, invalid location..."
                rows={3}
                className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button onClick={handleReject}
                  className="flex-1 bg-red-500 text-white py-2 rounded text-sm hover:bg-red-600">
                  Confirm Rejection
                </button>
                <button onClick={() => setRejectMode(false)}
                  className="text-gray-500 px-4 py-2 rounded text-sm hover:bg-gray-100">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button onClick={() => onSuspend(u._id, !u.isSuspended)}
            className={`py-2 rounded text-sm border ${u.isSuspended ? 'border-green-400 text-green-600 hover:bg-green-50' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'}`}>
            {u.isSuspended ? 'Unsuspend Account' : 'Suspend Account'}
          </button>
          <button onClick={() => onDelete(u._id, `${u.firstName} ${u.lastName}`)}
            className="border border-red-400 text-red-600 py-2 rounded text-sm hover:bg-red-50">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Customer slide-in drawer ──────────────────────────────────────────────────
function CustomerDrawer({ userId, onClose, onSuspend, onDelete, token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    axios.get(`/api/admin/users/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;
  const u = data?.user || {};
  const bookings = data?.bookings || [];
  const flags = u.cancellationFlags?.length || 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex justify-end">
      <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-purple-600">Customer Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
          <>
            <div className="mb-4">
              {u.avatar && <img src={u.avatar} alt="avatar" className="w-14 h-14 rounded-full object-cover border mb-2" />}
              <p className="font-semibold text-gray-800 text-lg">{u.firstName} {u.lastName}</p>
              <p className="text-sm text-gray-500">{u.email}</p>
              {u.phone && <p className="text-sm text-gray-500">{u.phone}</p>}
              <p className="text-xs text-gray-400 mt-1">Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {u.isSuspended && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Suspended</span>}
                {flags >= 2 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">🚩 {flags} late cancellations</span>}
                {flags === 1 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⚠️ 1 late cancellation</span>}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Recent Bookings ({bookings.length})</p>
              {bookings.length === 0
                ? <p className="text-sm text-gray-400">No bookings yet.</p>
                : (
                  <div className="flex flex-col gap-2">
                    {bookings.map(b => (
                      <div key={b._id} className="border rounded px-3 py-2 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">{b.service?.name}</p>
                            <p className="text-gray-500 text-xs">with {b.groomer?.firstName} {b.groomer?.lastName}</p>
                            <p className="text-gray-400 text-xs">{formatDate(b.date)} at {formatTime(b.time)}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BOOKING_BADGE[b.status]}`}>{b.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>

            <div className="border-t pt-4 flex flex-col gap-2">
              <button onClick={() => onSuspend(u._id, !u.isSuspended)}
                className={`py-2 rounded text-sm border ${u.isSuspended ? 'border-green-400 text-green-600 hover:bg-green-50' : 'border-yellow-400 text-yellow-600 hover:bg-yellow-50'}`}>
                {u.isSuspended ? 'Unsuspend Account' : 'Suspend Account'}
              </button>
              <button onClick={() => onDelete(u._id, `${u.firstName} ${u.lastName}`)}
                className="border border-red-400 text-red-600 py-2 rounded text-sm hover:bg-red-50">Delete Account</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [tab, setTab] = useState('pending');
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [allGroomers, setAllGroomers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [unpaidBookings, setUnpaidBookings] = useState([]);
  const [supportConvos, setSupportConvos] = useState([]);
  const [chargingId, setChargingId] = useState(null);
  const [refundingId, setRefundingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedGroomer, setSelectedGroomer] = useState(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [message, setMessage] = useState('');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      axios.get('/api/admin/stats', { headers }).then(r => setStats(r.data)),
      axios.get('/api/admin/groomers/pending', { headers }).then(r => setPending(r.data)),
      axios.get('/api/admin/groomers', { headers }).then(r => setAllGroomers(r.data)),
      axios.get('/api/admin/users', { headers }).then(r => setCustomers(r.data.filter(u => u.role === 'customer'))),
      axios.get('/api/admin/bookings', { headers }).then(r => setBookings(r.data)),
      axios.get('/api/admin/reviews', { headers }).then(r => setReviews(r.data)),
      axios.get('/api/admin/bookings/unpaid', { headers }).then(r => setUnpaidBookings(r.data)),
      axios.get('/api/admin/support/conversations', { headers }).then(r => setSupportConvos(r.data)),
    ]);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchAll(); }, []);

  const flash = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); };

  const verify = async (profileId, status, rejectionReason) => {
    await axios.patch(`/api/admin/groomers/${profileId}/verify`, { status, rejectionReason }, { headers });
    flash(`Groomer ${status}`);
    setSelectedGroomer(null);
    fetchAll();
  };

  const suspend = async (userId, doSuspend) => {
    await axios.patch(`/api/admin/users/${userId}/suspend`, { suspend: doSuspend }, { headers });
    setSelectedGroomer(null);
    setSelectedCustomerId(null);
    fetchAll();
  };

  const deleteUser = async (userId, name) => {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    await axios.delete(`/api/admin/users/${userId}`, { headers });
    setSelectedGroomer(null);
    setSelectedCustomerId(null);
    flash(`${name} deleted`);
    fetchAll();
  };

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Remove this review? The customer will be able to leave a new one.')) return;
    await axios.delete(`/api/admin/reviews/${reviewId}`, { headers });
    flash('Review removed');
    fetchAll();
  };

  // Filtered lists
  const filteredGroomers = useMemo(() => {
    const q = search.toLowerCase();
    return allGroomers.filter(p =>
      !q ||
      `${p.user?.firstName} ${p.user?.lastName}`.toLowerCase().includes(q) ||
      p.user?.email?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q)
    );
  }, [allGroomers, search]);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter(u =>
      !q ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const filteredBookings = useMemo(() => {
    const q = search.toLowerCase();
    return bookings
      .filter(b => bookingFilter === 'all' || b.status === bookingFilter)
      .filter(b => {
        if (!dateFrom && !dateTo) return true;
        const d = new Date(b.date);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo)) return false;
        return true;
      })
      .filter(b =>
        !q ||
        `${b.customer?.firstName} ${b.customer?.lastName}`.toLowerCase().includes(q) ||
        `${b.groomer?.firstName} ${b.groomer?.lastName}`.toLowerCase().includes(q) ||
        b.service?.name?.toLowerCase().includes(q)
      );
  }, [bookings, bookingFilter, search, dateFrom, dateTo]);

  const filteredReviews = useMemo(() => {
    const q = search.toLowerCase();
    return reviews.filter(r =>
      !q ||
      `${r.customer?.firstName} ${r.customer?.lastName}`.toLowerCase().includes(q) ||
      `${r.groomer?.firstName} ${r.groomer?.lastName}`.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    );
  }, [reviews, search]);

  const retryCharge = async (bookingId) => {
    setChargingId(bookingId);
    try {
      await axios.post(`/api/admin/bookings/${bookingId}/charge`, {}, { headers });
      setMessage('✅ Charge successful!');
      setUnpaidBookings(prev => prev.filter(b => b._id !== bookingId));
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.message || 'Charge failed'}`);
    }
    setChargingId(null);
  };

  const refundBooking = async (bookingId) => {
    if (!window.confirm('Issue a full refund for this booking? This cannot be undone.')) return;
    setRefundingId(bookingId);
    try {
      await axios.post(`/api/admin/bookings/${bookingId}/refund`, {}, { headers });
      setMessage('✅ Refund issued successfully.');
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, paymentStatus: 'refunded' } : b));
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.message || 'Refund failed'}`);
    }
    setRefundingId(null);
  };

  const unreadSupport = supportConvos.reduce((sum, c) => sum + (c.unread || 0), 0);

  const tabs = [
    { id: 'pending',   label: `Pending`, count: pending.length, alert: pending.length > 0 },
    { id: 'groomers',  label: `Groomers`, count: allGroomers.length },
    { id: 'customers', label: `Customers`, count: customers.length },
    { id: 'bookings',  label: `Bookings`, count: bookings.length },
    { id: 'reviews',   label: `Reviews`, count: reviews.length },
    { id: 'unpaid',    label: `Unpaid`, count: unpaidBookings.length, alert: unpaidBookings.length > 0 },
    { id: 'support',   label: `Support`, count: supportConvos.length, alert: unreadSupport > 0 },
  ];

  return (
    <div>
      {/* Header with refresh */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-purple-600">Admin Dashboard</h2>
        <button
          onClick={fetchAll}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1.5 hover:border-purple-400 hover:text-purple-600 transition disabled:opacity-40"
        >
          <span className={refreshing ? 'animate-spin inline-block' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2 rounded-lg mb-4">
          {message}
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Groomers', value: stats.totalGroomers, sub: `${stats.approvedGroomers} approved · ${stats.pendingGroomers} pending`, color: 'text-purple-600' },
            { label: 'Customers', value: stats.totalCustomers, color: 'text-blue-600' },
            { label: 'Bookings', value: stats.totalBookings, sub: `${stats.completedBookings} completed`, color: 'text-green-600' },
            { label: 'Reviews', value: stats.totalReviews, color: 'text-yellow-600' },
            { label: 'Revenue', value: `$${Number(stats.revenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: 'from completed bookings', color: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className="border rounded-xl p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
              {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setDateFrom(''); setDateTo(''); }}
            className={`relative px-4 py-2 rounded-full text-sm font-medium border transition ${tab === t.id ? 'bg-purple-500 text-white border-purple-400' : 'border-gray-300 text-gray-600 hover:border-purple-400'}`}>
            {t.label} ({t.count})
            {t.alert && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      {['groomers', 'customers', 'bookings', 'reviews'].includes(tab) && (
        <div className="mb-4 flex gap-2 flex-wrap items-center">
          <input
            type="text"
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 w-full max-w-xs"
          />
          {tab === 'bookings' && (
            <>
              <select value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}
                className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                {['all', 'pending', 'confirmed', 'completed', 'declined', 'cancelled'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                title="From date" />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                title="To date" />
              {(dateFrom || dateTo) && (
                <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline">
                  Clear dates
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Pending groomers */}
      {tab === 'pending' && (
        pending.length === 0
          ? <EmptyState icon="✅" title="No pending groomers" subtitle="All groomer applications have been reviewed." />
          : <div className="flex flex-col gap-3">
              {pending.map(p => (
                <div key={p._id} className="border rounded-xl p-4 flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{p.user?.firstName} {p.user?.lastName}</p>
                    <p className="text-sm text-gray-500">{p.user?.email}</p>
                    <p className="text-sm text-gray-500">{p.city || 'No city set'}</p>
                    <p className="text-xs text-gray-400 mt-1">{p.services?.length || 0} services listed</p>
                  </div>
                  <button onClick={() => setSelectedGroomer(p)}
                    className="text-sm border border-purple-400 text-purple-600 px-3 py-1.5 rounded hover:bg-purple-50">
                    Review
                  </button>
                </div>
              ))}
            </div>
      )}

      {/* All groomers */}
      {tab === 'groomers' && (
        filteredGroomers.length === 0
          ? <EmptyState icon="✂️" title="No groomers found" subtitle={search ? 'Try a different search term.' : 'No groomers have signed up yet.'} />
          : <div className="flex flex-col gap-3">
              {filteredGroomers.map(p => (
                <div key={p._id} className="border rounded-xl p-4 flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{p.user?.firstName} {p.user?.lastName}</p>
                    <p className="text-sm text-gray-500">{p.user?.email}</p>
                    <p className="text-sm text-gray-500">{p.city || 'No city'}</p>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.verificationStatus]}`}>
                        {p.verificationStatus}
                      </span>
                      {p.user?.isSuspended && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">suspended</span>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedGroomer(p)}
                    className="text-sm border border-purple-400 text-purple-600 px-3 py-1.5 rounded hover:bg-purple-50">
                    View
                  </button>
                </div>
              ))}
            </div>
      )}

      {/* Customers */}
      {tab === 'customers' && (
        filteredCustomers.length === 0
          ? <EmptyState icon="👤" title="No customers found" subtitle={search ? 'Try a different search term.' : 'No customers have signed up yet.'} />
          : <div className="flex flex-col gap-3">
              {filteredCustomers.map(u => {
                const flags = u.cancellationFlags?.length || 0;
                return (
                  <div key={u._id} className="border rounded-xl p-4 flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{u.firstName} {u.lastName}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                      {u.phone && <p className="text-sm text-gray-500">{u.phone}</p>}
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {u.isSuspended && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">suspended</span>}
                        {flags >= 2 && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">🚩 {flags} late cancels</span>}
                        {flags === 1 && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">⚠️ 1 late cancel</span>}
                      </div>
                    </div>
                    <button onClick={() => setSelectedCustomerId(u._id)}
                      className="text-sm border border-purple-400 text-purple-600 px-3 py-1.5 rounded hover:bg-purple-50">
                      View
                    </button>
                  </div>
                );
              })}
            </div>
      )}

      {/* All bookings */}
      {tab === 'bookings' && (
        filteredBookings.length === 0
          ? <EmptyState icon="📅" title="No bookings found" subtitle="Try adjusting your filters." />
          : <div className="flex flex-col gap-3">
              {filteredBookings.map(b => (
                <div key={b._id} className="border rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{b.service?.name} — ${b.service?.price}</p>
                      <p className="text-sm text-gray-600">Customer: {b.customer?.firstName} {b.customer?.lastName}</p>
                      <p className="text-sm text-gray-600">Groomer: {b.groomer?.firstName} {b.groomer?.lastName}</p>
                      <p className="text-sm text-gray-400">{formatDate(b.date)} at {formatTime(b.time)}</p>
                      {b.cancelledBy && (
                        <p className="text-xs text-gray-400 mt-0.5">Cancelled by: {b.cancelledBy}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${BOOKING_BADGE[b.status]}`}>
                        {b.status}
                      </span>
                      {b.paymentStatus === 'paid' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">✅ Paid</span>
                      )}
                      {b.paymentStatus === 'refunded' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">↩️ Refunded</span>
                      )}
                      {b.paymentStatus === 'paid' && (
                        <button
                          onClick={() => refundBooking(b._id)}
                          disabled={refundingId === b._id}
                          className="text-xs border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          {refundingId === b._id ? 'Refunding...' : 'Issue Refund'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* Reviews */}
      {tab === 'reviews' && (
        filteredReviews.length === 0
          ? <EmptyState icon="⭐" title="No reviews found" subtitle={search ? 'Try a different search term.' : 'No reviews yet.'} />
          : <div className="flex flex-col gap-3">
              {filteredReviews.map(r => (
                <div key={r._id} className="border rounded-xl p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{r.customer?.firstName} {r.customer?.lastName}</p>
                        <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">For: {r.groomer?.firstName} {r.groomer?.lastName}</p>
                      {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
                      {r.photos?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {r.photos.map((url, i) => (
                            <img key={i} src={url} alt="review"
                              className="w-16 h-16 object-cover rounded border cursor-zoom-in"
                              onClick={() => window.open(url, '_blank')} />
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => deleteReview(r._id)}
                      className="text-xs border border-red-300 text-red-500 px-2 py-1 rounded hover:bg-red-50 flex-shrink-0">
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
      )}

      {/* Unpaid completed bookings */}
      {tab === 'unpaid' && (
        unpaidBookings.length === 0
          ? <EmptyState icon="💳" title="No unpaid bookings" subtitle="All completed bookings have been charged." />
          : <div className="flex flex-col gap-3">
              {unpaidBookings.map(b => (
                <div key={b._id} className="border rounded-xl p-4 flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm">{b.service?.name || 'Service'} — ${b.totalAmount?.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Customer: {b.customer?.firstName} {b.customer?.lastName} ({b.customer?.email})</p>
                    <p className="text-xs text-gray-500">Groomer: {b.groomer?.firstName} {b.groomer?.lastName}</p>
                    <p className="text-xs text-gray-400">{formatDate(b.date)} at {formatTime(b.time)}</p>
                  </div>
                  <button
                    onClick={() => retryCharge(b._id)}
                    disabled={chargingId === b._id}
                    className="bg-purple-500 text-white px-4 py-2 rounded text-sm hover:bg-purple-600 disabled:opacity-50 whitespace-nowrap"
                  >
                    {chargingId === b._id ? 'Charging...' : 'Charge Now'}
                  </button>
                </div>
              ))}
            </div>
      )}

      {/* Support inbox */}
      {tab === 'support' && (
        supportConvos.length === 0
          ? <EmptyState icon="💬" title="No support conversations" subtitle="Users haven't reached out yet." />
          : <div className="flex flex-col gap-3">
              {supportConvos.map(c => {
                const other = c.participants?.find(p => String(p._id) !== String(user?.id || user?._id)) || {};
                const timeLabel = (dateStr) => {
                  const d = new Date(dateStr);
                  const diff = (Date.now() - d) / 1000;
                  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                  if (diff < 86400) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                };
                return (
                  <div key={c._id} className="border rounded-xl p-4 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {other.avatar ? (
                        <img src={other.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 font-bold flex-shrink-0">
                          {(other.firstName?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm">{other.firstName} {other.lastName}</p>
                          <span className="text-xs text-gray-400 capitalize bg-gray-100 px-1.5 py-0.5 rounded">{other.role}</span>
                          {c.unread > 0 && (
                            <span className="bg-purple-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{c.unread} new</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{c.lastMessage || 'No messages yet'}</p>
                        <p className="text-xs text-gray-400">{timeLabel(c.lastMessageAt)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/messages?with=${other._id}`)}
                      className="text-sm bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 whitespace-nowrap flex-shrink-0"
                    >
                      Reply
                    </button>
                  </div>
                );
              })}
            </div>
      )}

      {/* Drawers */}
      <GroomerDrawer
        profile={selectedGroomer}
        onClose={() => setSelectedGroomer(null)}
        onVerify={verify}
        onSuspend={suspend}
        onDelete={deleteUser}
      />
      <CustomerDrawer
        userId={selectedCustomerId}
        token={token}
        onClose={() => setSelectedCustomerId(null)}
        onSuspend={suspend}
        onDelete={deleteUser}
      />
    </div>
  );
}
