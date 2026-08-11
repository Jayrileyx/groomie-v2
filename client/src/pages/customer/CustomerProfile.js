import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/ImageUpload';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ── Card brand display helper ─────────────────────────────────────────────────
const BRAND_LABEL = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' };
function brandLabel(brand) {
  return BRAND_LABEL[brand] || brand.charAt(0).toUpperCase() + brand.slice(1);
}

function CardManager({ token }) {
  const stripe = useStripe();
  const elements = useElements();

  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [addError, setAddError] = useState('');
  const [removeError, setRemoveError] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const fetchCards = async () => {
    try {
      const res = await axios.get('/api/payments/cards', { headers: { Authorization: `Bearer ${token}` } });
      setCards(res.data);
    } catch {
      setCards([]);
    } finally {
      setLoadingCards(false);
    }
  };

  useEffect(() => { fetchCards(); }, []);

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || !cardComplete) return;
    setAdding(true);
    setAddError('');
    try {
      const { data: { clientSecret } } = await axios.post(
        '/api/payments/setup-intent', {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const cardEl = elements.getElement(CardElement);
      const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl },
      });
      if (stripeErr) { setAddError(stripeErr.message); return; }
      // Card saved — re-fetch list and reset
      await fetchCards();
      setShowAdd(false);
      setCardComplete(false);
      cardEl.clear();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add card.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (pmId) => {
    setRemoveError('');
    setRemovingId(pmId);
    try {
      await axios.delete(`/api/payments/cards/${pmId}`, { headers: { Authorization: `Bearer ${token}` } });
      setCards(prev => prev.filter(c => c.id !== pmId));
    } catch (err) {
      setRemoveError(err.response?.data?.message || 'Failed to remove card.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Payment Methods</h3>

      {loadingCards ? (
        <p className="text-sm text-gray-400">Loading cards...</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map(card => (
            <div key={card.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700">{brandLabel(card.brand)}</span>
                <span className="text-sm text-gray-500">•••• {card.last4}</span>
                <span className="text-xs text-gray-400">{card.expMonth}/{card.expYear}</span>
              </div>
              <button
                onClick={() => handleRemove(card.id)}
                disabled={cards.length === 1 || removingId === card.id}
                title={cards.length === 1 ? 'Add another card before removing this one' : 'Remove card'}
                className="text-red-400 hover:text-red-600 text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {removingId === card.id ? 'Removing...' : '✕ Remove'}
              </button>
            </div>
          ))}

          {cards.length === 0 && (
            <p className="text-sm text-gray-400">No cards saved yet.</p>
          )}

          {removeError && <p className="text-sm text-red-500">{removeError}</p>}

          {/* Add card toggle */}
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="mt-1 text-sm text-purple-600 hover:underline text-left"
            >
              + Add a new card
            </button>
          ) : (
            <form onSubmit={handleAddCard} className="border rounded-lg px-4 py-4 bg-white mt-2 flex flex-col gap-3">
              <p className="text-sm font-medium text-gray-700">New card</p>
              {!stripe ? (
                <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  ⚠️ Payment system not configured. Make sure <code>REACT_APP_STRIPE_PUBLISHABLE_KEY</code> is set in <code>client/.env</code> and restart the dev server.
                </p>
              ) : (
              <div className={`border rounded px-4 py-3 focus-within:ring-2 focus-within:ring-purple-300 ${addError ? 'border-red-400' : ''}`}>
                <CardElement
                  onChange={e => {
                    setCardComplete(e.complete);
                    setAddError(e.error ? e.error.message : '');
                  }}
                  options={{
                    style: {
                      base: { fontSize: '14px', color: '#374151', '::placeholder': { color: '#9ca3af' } },
                      invalid: { color: '#ef4444' },
                    },
                  }}
                />
              </div>
              )}
              {addError && <p className="text-sm text-red-500">{addError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding || !cardComplete}
                  className="bg-purple-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-600 disabled:opacity-50"
                >
                  {adding ? 'Saving...' : 'Save Card'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddError(''); setCardComplete(false); }}
                  className="text-gray-500 px-4 py-2 rounded text-sm hover:underline"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {cards.length === 1 && (
        <p className="text-xs text-gray-400 mt-2">
          You must always have at least one card on file. Add a new card to remove the current one.
        </p>
      )}
    </div>
  );
}

// ── Password change section ───────────────────────────────────────────────────
function PasswordChange({ token }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    try {
      await axios.put('/api/auth/me/password',
        { currentPassword: form.currentPassword, newPassword: form.newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMsg('Password updated successfully.');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Change Password</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password" placeholder="Current password" value={form.currentPassword}
          onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} required
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <input
          type="password" placeholder="New password (min 6 characters)" value={form.newPassword}
          onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} required
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <input
          type="password" placeholder="Confirm new password" value={form.confirmPassword}
          onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {msg && <p className="text-green-600 text-sm">{msg}</p>}
        <button type="submit" disabled={saving}
          className="bg-purple-500 text-white py-2 rounded hover:bg-purple-600 font-medium disabled:opacity-50">
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

// ── Main profile page ─────────────────────────────────────────────────────────
export default function CustomerProfile() {
  const { token, user, login } = useAuth();

  // Pre-populate from cached auth context immediately so fields aren't blank on load
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName:  user?.lastName  || '',
    phone:     user?.phone     || '',
    avatar:    user?.avatar    || '',
    email:     user?.email     || '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Refresh with latest data from server (picks up any changes made elsewhere)
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const u = res.data;
        setForm({ firstName: u.firstName || '', lastName: u.lastName || '', phone: u.phone || '', avatar: u.avatar || '', email: u.email || '' });
      })
      .catch(() => {/* keep the pre-filled values on error */});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    if (form.phone) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 10) {
        setError('Please enter a valid phone number including area code.');
        return;
      }
    }
    try {
      const payload = { ...form, avatar: (form.avatar && !form.avatar.startsWith('data:')) ? form.avatar : undefined };
      const res = await axios.put('/api/auth/me', payload, { headers: { Authorization: `Bearer ${token}` } });
      login(token, { ...user, ...res.data });
      setSaved(true);
    } catch {
      setError('Failed to save. Please try again.');
    }
  };

  const handleAvatarUpload = async (url) => {
    setForm(f => ({ ...f, avatar: url }));
    if (url && !url.startsWith('data:')) {
      try {
        const res = await axios.put('/api/auth/me', { avatar: url }, { headers: { Authorization: `Bearer ${token}` } });
        login(token, { ...user, ...res.data });
      } catch { /* non-critical */ }
    }
  };

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="text-2xl font-bold text-purple-600 mb-6">My Profile</h2>

      <div className="flex justify-center mb-6">
        <ImageUpload
          currentUrl={form.avatar}
          onUpload={handleAvatarUpload}
          shape="circle"
          size="112px"
          label="Change photo"
        />
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="First name" value={form.firstName}
            onChange={e => setForm({ ...form, firstName: e.target.value })}
            className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <input placeholder="Last name" value={form.lastName}
            onChange={e => setForm({ ...form, lastName: e.target.value })}
            className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        </div>
        <input type="email" placeholder="Email" value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <input placeholder="Phone (e.g. 555-867-5309)" value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {saved && <p className="text-green-600 text-sm">Profile saved!</p>}

        <button type="submit" className="bg-purple-500 text-white py-2 rounded hover:bg-purple-600 font-medium">
          Save Changes
        </button>
      </form>

      <hr className="my-6" />

      <PasswordChange token={token} />

      <hr className="my-6" />

      <CardManager token={token} />
    </div>
  );
}
