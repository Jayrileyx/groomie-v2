import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const TYPE_ICON = {
  new_booking:  '📅',
  confirmed:    '✅',
  declined:     '❌',
  completed:    '🏁',
  cancelled:    '🚫',
  rescheduled:  '🔄',
  review:       '⭐',
};

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Map notification type + recipient role → destination URL with tab
function getRoute(n, role) {
  const { type, reviewId } = n;
  if (role === 'groomer') {
    if (type === 'new_booking' || type === 'rescheduled') return '/groomer/bookings?tab=pending';
    if (type === 'cancelled')                               return '/groomer/bookings?tab=cancelled';
    if (type === 'review')                                  return `/groomer/reviews${reviewId ? `?highlight=${reviewId}` : ''}`;
    return '/groomer/bookings';
  }
  // customer
  if (type === 'confirmed')  return '/my-bookings?tab=confirmed';
  if (type === 'declined')   return '/my-bookings?tab=declined';
  if (type === 'completed')  return '/my-bookings?tab=completed';
  if (type === 'cancelled')  return '/my-bookings?tab=cancelled';
  return '/my-bookings';
}

export default function NotificationBell() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef();

  const fetchNotifications = useCallback(() => {
    axios.get('/api/notifications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setNotes(r.data))
      .catch(() => {});
  }, [token]);

  // Initial fetch + poll every 30 s
  useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 30000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const unread = notes.filter(n => !n.read).length;

  const markAllRead = async () => {
    await axios.patch('/api/notifications/read-all', {}, { headers: { Authorization: `Bearer ${token}` } });
    setNotes(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markRead = async (id) => {
    await axios.patch(`/api/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
    setNotes(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
  };

  const handleNoteClick = async (n) => {
    setOpen(false);
    if (!n.read) await markRead(n._id);
    navigate(getRoute(n, user?.role));
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) fetchNotifications(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          position: 'relative', padding: '6px 8px', lineHeight: 1,
          fontSize: '22px', color: '#fff',
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px',
            background: '#ef4444', color: '#fff',
            borderRadius: '999px', fontSize: '10px', fontWeight: 700,
            minWidth: '16px', height: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px', lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: '320px', maxHeight: '420px',
          background: '#fff', borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          zIndex: 1000, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', borderBottom: '1px solid #f3f4f6',
            background: '#fafafa',
          }}>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>
              Notifications {unread > 0 && <span style={{ color: '#a855f7' }}>({unread} new)</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '11px', color: '#a855f7', fontWeight: 600,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notes.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', padding: '24px' }}>
                No notifications yet
              </p>
            ) : (
              notes.map(n => (
                <div
                  key={n._id}
                  onClick={() => handleNoteClick(n)}
                  style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f9fafb',
                    background: n.read ? '#fff' : '#faf5ff',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>
                    {TYPE_ICON[n.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      margin: 0, fontSize: '13px',
                      color: '#111827', lineHeight: '1.4',
                      fontWeight: n.read ? 400 : 500,
                    }}>
                      {n.message}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#9ca3af' }}>
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  {!n.read && (
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: '#a855f7', flexShrink: 0, marginTop: '5px',
                    }} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
