import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import GroomieLogo from './GroomieLogo';

export default function Navbar() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [adminContactId, setAdminContactId] = useState(null);

  useEffect(() => {
    if (!token) return;
    const fetchUnread = () => {
      axios.get('/api/messages/unread/count', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => setUnreadMessages(r.data.count))
        .catch(() => {});
    };
    fetchUnread();
    const id = setInterval(fetchUnread, 30000);
    return () => clearInterval(id);
  }, [token, user]);

  const handleContactSupport = async () => {
    try {
      let contactId = adminContactId;
      if (!contactId) {
        const res = await axios.get('/api/admin/support-contact', { headers: { Authorization: `Bearer ${token}` } });
        contactId = res.data.id;
        setAdminContactId(contactId);
      }
      navigate(`/messages?with=${contactId}`);
    } catch {
      alert('Support is unavailable right now. Please try again later.');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const MessagesLink = () => (
    <Link to="/messages" className="hover:underline relative inline-flex items-center gap-1">
      💬 Messages
      {unreadMessages > 0 && (
        <span style={{
          background: '#ef4444', color: '#fff', borderRadius: '999px',
          fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px',
        }}>
          {unreadMessages > 9 ? '9+' : unreadMessages}
        </span>
      )}
    </Link>
  );

  const roleLinks = () => {
    if (!user) return null;
    if (user.role === 'groomer') return (
      <>
        <Link to="/groomer/dashboard" className="hover:underline">Dashboard</Link>
        <Link to="/groomer/bookings" className="hover:underline">Bookings</Link>
        <Link to="/groomer/reviews" className="hover:underline">Reviews</Link>
        <MessagesLink />
        <Link to="/groomer/profile" className="hover:underline">My Profile</Link>
        <button onClick={handleContactSupport} className="hover:underline opacity-80 text-sm">Support</button>
      </>
    );
    if (user.role === 'admin') return (
      <>
        <Link to="/admin" className="hover:underline">Admin</Link>
        <MessagesLink />
      </>
    );
    return (
      <>
        <Link to="/my-bookings" className="hover:underline">My Bookings</Link>
        <Link to="/" className="hover:underline">Find a Groomer</Link>
        <Link to="/my-pets" className="hover:underline">My Pets</Link>
        <MessagesLink />
        <Link to="/profile" className="hover:underline">Profile</Link>
        <button onClick={handleContactSupport} className="hover:underline opacity-80 text-sm">Support</button>
      </>
    );
  };

  return (
    <>
    <nav style={{background:'linear-gradient(135deg, #9333ea 0%, #a855f7 50%, #d946ef 100%)'}} className="text-white px-6 py-4 flex justify-between items-center shadow-md">
      <Link to="/"><GroomieLogo height={60} light /></Link>
      <div className="flex gap-4 items-center text-sm">
        {token ? (
          <>
            {roleLinks()}
            <NotificationBell />
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-white opacity-90" />
            ) : (
              <span className="w-7 h-7 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-xs font-bold">
                {(user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()}
              </span>
            )}
            <span className="opacity-70">Hi, {user?.firstName || user?.username}</span>
            <button onClick={handleLogout} className="bg-white text-purple-600 px-3 py-1 rounded-full font-semibold text-sm hover:bg-purple-50 transition-colors">
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:underline">Login</Link>
            <Link to="/register" className="bg-white text-purple-600 px-3 py-1 rounded-full font-semibold text-sm hover:bg-purple-50 transition-colors">Register</Link>
          </>
        )}
      </div>
    </nav>
    <div className="text-center text-xs text-purple-400 py-2 border-t border-purple-100 bg-purple-50">
      <Link to="/terms" className="hover:text-purple-600 mx-2 transition-colors">Terms of Service</Link>
      ·
      <Link to="/privacy" className="hover:text-purple-600 mx-2 transition-colors">Privacy Policy</Link>
    </div>
    </>
  );
}
