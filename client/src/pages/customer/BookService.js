import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const to12h = (val) => {
  const [h, m] = val.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export default function BookService() {
  const { groomerProfileId } = useParams();
  return <BookServiceForm groomerProfileId={groomerProfileId} />;
}

function BookServiceForm({ groomerProfileId }) {
  const { state } = useLocation();
  const { token } = useAuth();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [groomer, setGroomer] = useState(state?.groomer || null);
  const [service, setService] = useState(state?.service || null);
  const [savedPets, setSavedPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [form, setForm] = useState({ date: '', time: '', petName: '', breed: '', size: 'medium', notes: '', petPhoto: '', customerNote: '' });
  const [availableSlots, setAvailableSlots] = useState([]);
  const [worksToday, setWorksToday] = useState(null); // null=unknown, true/false
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [cardError, setCardError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [petWarning, setPetWarning] = useState(null); // { existingDate, existingService }
  const [bypassWarning, setBypassWarning] = useState(false);
  const [agreedToGroomerTerms, setAgreedToGroomerTerms] = useState(false);

  // If navigated directly (no state), fetch the groomer profile
  useEffect(() => {
    if (!groomer) {
      axios.get(`/api/groomers/${groomerProfileId}`)
        .then(res => setGroomer(res.data))
        .catch(() => navigate('/'));
    }
  }, [groomerProfileId]);

  // Load saved pets
  useEffect(() => {
    axios.get('/api/pets', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setSavedPets(r.data))
      .catch(() => {});
  }, []);

  // If no service was passed, redirect back to groomer's page to pick one
  useEffect(() => {
    if (groomer && !service) {
      navigate(`/groomers/${groomerProfileId}`);
    }
  }, [groomer, service]);

  // Fetch available slots when date changes
  const handleDateChange = async (date) => {
    setForm(f => ({ ...f, date, time: '' }));
    setAvailableSlots([]);
    setWorksToday(null);
    if (!date) return;
    setLoadingSlots(true);
    try {
      const dur = service?.duration || 60;
      const res = await axios.get(`/api/groomers/${groomerProfileId}/available-slots?date=${date}&duration=${dur}`);
      setAvailableSlots(res.data.slots || []);
      setWorksToday(res.data.worksToday);
    } catch {
      setAvailableSlots([]);
      setWorksToday(null);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.time) { setError('Please select an available time slot.'); return; }
    if (groomer?.serviceAgreement && !agreedToGroomerTerms) { setError("Please agree to the groomer's service agreement before booking."); return; }

    // Check for same-pet booking within 3 days (unless user already confirmed)
    if (!bypassWarning && form.petName && form.date) {
      try {
        const check = await axios.get(
          `/api/bookings/pet-check?petName=${encodeURIComponent(form.petName)}&date=${form.date}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (check.data.hasRecent) {
          setPetWarning({ existingDate: check.data.existingDate, existingService: check.data.existingService });
          return; // stop here — show warning first
        }
      } catch { /* non-blocking, proceed */ }
    }

    // Card is required — guard before async work
    if (!stripe || !elements) {
      setCardError('Payment system is still loading. Please wait a moment and try again.');
      return;
    }
    if (!cardComplete) {
      setCardError('Please enter your complete card details before submitting.');
      return;
    }

    setSubmitting(true);
    setCardError('');
    try {
      // 1. Save card via SetupIntent (always required)
      const { data: { clientSecret, stripeCustomerId: custId } } = await axios.post(
        '/api/payments/setup-intent', {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const stripeCustomerId = custId;

      const cardEl = elements.getElement(CardElement);
      const { setupIntent, error: stripeErr } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl },
      });

      if (stripeErr) {
        setCardError(stripeErr.message);
        setSubmitting(false);
        return;
      }
      const stripePaymentMethodId = setupIntent.payment_method;

      // 2. Create booking with saved card info
      const groomerId = groomer?.user?._id || groomer?.user;
      await axios.post('/api/bookings', {
        groomerId,
        groomerProfileId,
        service: { name: service.name, price: service.price, duration: service.duration },
        date: form.date,
        time: form.time,
        petInfo: { name: form.petName, breed: form.breed, size: form.size, notes: form.notes, photo: form.petPhoto },
        customerNote: form.customerNote,
        stripePaymentMethodId,
        stripeCustomerId,
        agreedToGroomerTerms,
      }, { headers: { Authorization: `Bearer ${token}` } });

      navigate('/my-bookings', { state: { booked: true } });
    } catch (err) {
      if (err.response?.status === 401) navigate('/login');
      else setError(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!groomer || !service) return <p className="text-center mt-10 text-gray-400">Loading...</p>;

  return (
    <div className="max-w-md mx-auto">
      <button onClick={() => navigate(-1)} className="text-purple-600 text-sm hover:underline mb-4 inline-block">
        ← Back
      </button>

      <h2 className="text-2xl font-bold text-purple-600 mb-1">Book Appointment</h2>
      <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-6">
        <p className="font-semibold text-purple-700">{service.name} — ${service.price}</p>
        <p className="text-sm text-purple-600">
          with {groomer.user?.firstName} {groomer.user?.lastName} · {groomer.city}
        </p>
      </div>

      <form onSubmit={handleBook} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} required
            min={new Date().toISOString().split('T')[0]}
            className="border rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-purple-300" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Available Times
            {loadingSlots && <span className="text-gray-400 text-xs font-normal ml-2">Checking availability...</span>}
          </label>

          {!form.date && (
            <p className="text-sm text-gray-400">Pick a date to see available times.</p>
          )}

          {form.date && !loadingSlots && worksToday === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              This groomer is not available on {new Date(form.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Please choose a different date.
            </div>
          )}

          {form.date && !loadingSlots && worksToday === true && availableSlots.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              No available slots on this date — the groomer is fully booked. Please try another day.
            </div>
          )}

          {form.date && !loadingSlots && availableSlots.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {availableSlots.map(slot => {
                const isPast = (() => {
                  const today = new Date().toISOString().split('T')[0];
                  if (form.date !== today) return false;
                  const [h, m] = slot.split(':').map(Number);
                  const t = new Date(); t.setHours(h, m, 0, 0);
                  return t <= new Date();
                })();
                if (isPast) return null;
                const selected = form.time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, time: slot }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                      selected
                        ? 'bg-purple-500 text-white border-purple-400'
                        : 'border-gray-300 text-gray-700 hover:border-purple-400 hover:text-purple-600'
                    }`}
                  >
                    {to12h(slot)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hidden required input to trigger form validation */}
          <input type="hidden" value={form.time} required />
        </div>

        <hr className="my-1" />
        <h3 className="font-semibold text-gray-700">Pet Info</h3>

        {savedPets.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select a saved pet</label>
            <select
              value={selectedPetId}
              onChange={e => {
                const id = e.target.value;
                setSelectedPetId(id);
                setPetWarning(null); setBypassWarning(false);
                if (id === '') {
                  setForm(f => ({ ...f, petName: '', breed: '', size: 'medium', notes: '' }));
                } else {
                  const pet = savedPets.find(p => p._id === id);
                  if (pet) setForm(f => ({ ...f, petName: pet.name, breed: pet.breed, size: pet.size, notes: pet.notes || '', petPhoto: pet.photo || '' }));
                }
              }}
              className="border rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700"
            >
              <option value="">-- Enter pet info manually --</option>
              {savedPets.map(p => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.breed}, {p.size})
                </option>
              ))}
            </select>
          </div>
        )}

        <input placeholder="Pet name *" value={form.petName} onChange={e => setForm({...form, petName: e.target.value})} required
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <input placeholder="Breed *" value={form.breed} onChange={e => setForm({...form, breed: e.target.value})} required
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
          <select value={form.size} onChange={e => setForm({...form, size: e.target.value})}
            className="border rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="small">Small (under 25 lbs)</option>
            <option value="medium">Medium (25–50 lbs)</option>
            <option value="large">Large (50–90 lbs)</option>
            <option value="extra-large">Extra Large (90+ lbs)</option>
          </select>
        </div>

        <textarea placeholder="Notes about your pet (temperament, allergies, etc.)" value={form.notes}
          onChange={e => setForm({...form, notes: e.target.value})}
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" rows={2} />

        <div>
          <textarea placeholder="Message to groomer (optional)" value={form.customerNote}
            onChange={e => setForm({...form, customerNote: e.target.value})}
            className="border rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-purple-300" rows={3} />
          <p className="text-xs text-gray-400 mt-1">
            If you'd like a specific cut or style, please describe it here — include length preferences, breed-specific cuts, or any reference styles you have in mind.
          </p>
        </div>

        {petWarning && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-3 text-sm text-yellow-800">
            <p className="font-semibold mb-1">⚠️ Recent booking for {form.petName}</p>
            <p>
              {form.petName} already has a <strong>{petWarning.existingService || 'grooming'}</strong> appointment
              on <strong>{new Date(petWarning.existingDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</strong>,
              which is within 3 days of this booking.
            </p>
            <div className="flex gap-3 mt-3">
              <button
                type="button"
                onClick={() => { setBypassWarning(true); setPetWarning(null); }}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-yellow-700"
              >
                Book Anyway
              </button>
              <button
                type="button"
                onClick={() => setPetWarning(null)}
                className="text-yellow-700 px-3 py-1 rounded text-sm hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Groomer service agreement */}
        {groomer?.serviceAgreement && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <p className="text-sm font-semibold text-gray-700 mb-2">Groomer's Service Agreement</p>
            <div className="text-sm text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto border border-gray-200 rounded p-3 bg-white mb-3">
              {groomer.serviceAgreement}
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToGroomerTerms}
                onChange={e => setAgreedToGroomerTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-purple-600 flex-shrink-0"
              />
              <span className="text-sm text-gray-700">I have read and agree to this groomer's service agreement and policies.</span>
            </label>
          </div>
        )}

        {/* Card details — required */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method <span className="text-red-500">*</span>
          </label>
          <div className={`border rounded px-4 py-3 focus-within:ring-2 focus-within:ring-purple-300 ${cardError ? 'border-red-400' : ''}`}>
            <CardElement
              onChange={e => {
                setCardComplete(e.complete);
                setCardError(e.error ? e.error.message : '');
              }}
              options={{
                style: {
                  base: { fontSize: '14px', color: '#374151', '::placeholder': { color: '#9ca3af' } },
                  invalid: { color: '#ef4444' },
                },
              }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            A valid card is required to request an appointment. You won't be charged until after your service is complete.
          </p>
          {cardError && <p className="text-sm text-red-500 mt-1">{cardError}</p>}
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button type="submit" disabled={submitting || !stripe || !cardComplete}
          className="bg-purple-500 text-white py-3 rounded hover:bg-purple-600 font-medium disabled:opacity-50">
          {submitting ? 'Saving card & sending request...' : 'Send Booking Request'}
        </button>
        <p className="text-xs text-gray-400 text-center">
          By sending this request you agree to Groomie's{' '}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline">Terms of Service</a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>.
          Payment is collected only after the service is complete.
        </p>
      </form>
    </div>
  );
}

