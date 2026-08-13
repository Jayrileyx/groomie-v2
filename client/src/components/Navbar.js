import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import GroomieLogo from './GroomieLogo';

export default function Navbar() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [adminContactId, setAdminContactId] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();

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

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleContactSupport = async () => {
    setMenuOpen(false);
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

  const handleLogout = () => { logout(); navigate('/login'); setMenuOpen(false); };

  const close = () => setMenuOpen(false);

  const MessagesLink = ({ mobile }) => (
    <Link to="/messages" onClick={close}
      className={mobile ? 'block py-2 border-b border-purple-400 border-opacity-30' : 'hover:underline relative inline-flex items-center gap-1'}>
      💬 Messages
      {unreadMessages > 0 && (
        <span style={{
          background: '#ef4444', color: '#fff', borderRadius: '999px',
          fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 3px', marginLeft: 4,
        }}>
          {unreadMessages > 9 ? '9+' : unreadMessages}
        </span>
      )}
    </Link>
  );

  const desktopLinks = () => {
    if (!user) return null;
    if (user.role === 'groomer') return (
      <>
        <Link to="/groomer/dashboard" className="hover:underline">Dashboard</Link>
        <Link to="/groomer/bookings" className="hover:underline">Bookings</Link>
        <Link to="/groomer/reviews" className="hover:underline">Reviews</Link>
        <MessagesLink />
        <Link to="/groomer/profile" className="hover:underline">My Profile</Link>
        <button onClick={handleContactSupport} className="hover:underline opacity-80">Support</button>
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
        <button onClick={handleContactSupport} className="hover:underline opacity-80">Support</button>
      </>
    );
  };

  const mobileLinks = () => {
    if (!user) return (
      <>
        <Link to="/login" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Login</Link>
        <Link to="/register" onClick={close} className="block py-2">Register</Link>
      </>
    );
    if (user.role === 'groomer') return (
      <>
        <Link to="/groomer/dashboard" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Dashboard</Link>
        <Link to="/groomer/bookings" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Bookings</Link>
        <Link to="/groomer/reviews" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Reviews</Link>
        <MessagesLink mobile />
        <Link to="/groomer/profile" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">My Profile</Link>
        <button onClick={handleContactSupport} className="block w-full text-left py-2 border-b border-purple-400 border-opacity-30">Support</button>
        <button onClick={handleLogout} className="block w-full text-left py-2 text-red-200">Logout</button>
      </>
    );
    if (user.role === 'admin') return (
      <>
        <Link to="/admin" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Admin</Link>
        <MessagesLink mobile />
        <button onClick={handleLogout} className="block w-full text-left py-2 text-red-200">Logout</button>
      </>
    );
    return (
      <>
        <Link to="/my-bookings" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">My Bookings</Link>
        <Link to="/" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Find a Groomer</Link>
        <Link to="/my-pets" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">My Pets</Link>
        <MessagesLink mobile />
        <Link to="/profile" onClick={close} className="block py-2 border-b border-purple-400 border-opacity-30">Profile</Link>
        <button onClick={handleContactSupport} className="block w-full text-left py-2 border-b border-purple-400 border-opacity-30">Support</button>
        <button onClick={handleLogout} className="block w-full text-left py-2 text-red-200">Logout</button>
      </>
    );
  };

  return (
    <nav ref={menuRef} style={{background:'linear-gradient(135deg, #9333ea 0%, #a855f7 50%, #d946ef 100%)'}}
      className="text-white px-6 py-4 shadow-md relative">
      <div className="flex justify-between items-center">
        <Link to="/" onClick={close}><GroomieLogo height={60} light /></Link>

        <div className="flex items-center gap-3">
          {/* Always visible: bell + hi name on desktop */}
          {token && (
            <>
              <NotificationBell />
              <span className="opacity-70 text-sm hidden sm:inline">Hi, {user?.firstName || user?.username}</span>
            </>
          )}

          {/* Desktop links */}
          <div className="hidden sm:flex gap-4 items-center text-sm">
            {token ? (
              <>
                {desktopLinks()}
                <button onClick={handleLogout}
                  className="bg-white text-purple-600 px-3 py-1 rounded-full font-semibold text-sm hover:bg-purple-50 transition-colors">
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="sm:hidden flex flex-col gap-1.5 p-1"
            aria-label="Menu"
          >
            <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-0.5 bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden absolute left-0 right-0 top-full z-50 text-sm font-medium px-6 py-3"
          style={{background:'linear-gradient(135deg, #9333ea 0%, #a855f7 50%, #d946ef 100%)', boxShadow:'0 8px 24px rgba(0,0,0,0.2)'}}>
          {token && <p className="text-xs opacity-60 mb-2">Hi, {user?.firstName || user?.username}</p>}
          {mobileLinks()}
          {!token && (
            <Link to="/register" onClick={close}
              className="block mt-3 text-center bg-white text-purple-600 px-4 py-2 rounded-full font-semibold">
              Register
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
