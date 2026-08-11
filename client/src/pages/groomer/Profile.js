import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/ImageUpload';

const formatDuration = (mins) => {
  if (!mins) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
};

export default function GroomerProfile() {
  const { token, user, login } = useAuth();
  const [searchParams] = useSearchParams();
  const isSetup = searchParams.get('setup') === 'true';
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ bio: '', city: '', address: '', yearsExperience: '', specialties: '', cancellationWindowHours: 24, serviceAgreement: '' });
  const [services, setServices] = useState([]);
  const [gallery, setGallery] = useState([]); // groomer work photos
  const [newService, setNewService] = useState({ name: '', description: '', price: '', hours: '', minutes: '' });
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(isSetup);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [stripeStatus, setStripeStatus] = useState(searchParams.get('stripe') || '');
  const [stripeConnected, setStripeConnected] = useState(null); // null = loading
  const [submitReviewLoading, setSubmitReviewLoading] = useState(false);
  const [submitReviewDone, setSubmitReviewDone] = useState(false);
  const [verificationDocs, setVerificationDocs] = useState([]); // { url, name }
  const [docUploading, setDocUploading] = useState(false);

  // Availability
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const defaultDay = () => ({ open: false, startTime: '09:00', endTime: '17:00' });
  const [avail, setAvail] = useState(Array.from({ length: 7 }, defaultDay));
  const [blockedDates, setBlockedDates] = useState([]);
  const [blockFrom, setBlockFrom] = useState('');
  const [blockTo, setBlockTo] = useState('');
  const [availSaving, setAvailSaving] = useState(false);
  const [availSaved, setAvailSaved] = useState(false);

  useEffect(() => {
    // Load current avatar from user record
    axios.get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setAvatarUrl(res.data.avatar || ''))
      .catch(() => {});
    axios.get('/api/payments/connect/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setStripeConnected(res.data))
      .catch(() => setStripeConnected({ connected: false }));

    axios.get('/api/groomers/me/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        const p = res.data || {};
        setProfile(p);
        setForm({
          bio: p.bio || '',
          city: p.city || '',
          address: p.address || '',
          yearsExperience: p.yearsExperience || '',
          specialties: (p.specialties || []).join(', '),
          cancellationWindowHours: p.cancellationWindowHours ?? 24,
          serviceAgreement: p.serviceAgreement || '',
        });
        setServices(p.services || []);
        setGallery(p.photos || []);
        setVerificationDocs((p.verificationDocs || []).map(url => ({ url, name: url.split('/').pop() })));
        // Load availability
        const dbAvail = p.availability || [];
        setAvail(Array.from({ length: 7 }, (_, i) => {
          const d = dbAvail.find(a => a.dayOfWeek === i);
          return d ? { open: true, startTime: d.startTime, endTime: d.endTime } : { open: false, startTime: '09:00', endTime: '17:00' };
        }));
        setBlockedDates(p.blockedDates || []);
        // If no bio/city yet, start in edit mode
        if (!p.bio || !p.city) setEditing(true);
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Failed to load profile');
        setProfile({});
        setEditing(true);
      });
  }, []);

  const saveProfile = async () => {
    if (services.length === 0) {
      setError('Please add at least one service before saving.');
      return false;
    }
    if (!avail.some(d => d.open)) {
      setError('Please set your availability for at least one day before saving.');
      return false;
    }
    try {
      const updated = await axios.put('/api/groomers/me', {
        ...form,
        specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean),
        cancellationWindowHours: Number(form.cancellationWindowHours),
        services,
        photos: gallery.filter(u => u && !u.startsWith('data:')),
        verificationDocs: verificationDocs.map(d => d.url),
      }, { headers: { Authorization: `Bearer ${token}` } });
      const p = updated.data;
      setProfile(p);
      setForm(f => ({
        ...f,
        bio: p.bio || '',
        city: p.city || '',
        address: p.address || '',
        yearsExperience: p.yearsExperience || '',
        specialties: (p.specialties || []).join(', '),
        cancellationWindowHours: p.cancellationWindowHours ?? 24,
        serviceAgreement: p.serviceAgreement || '',
      }));
      return true;
    } catch {
      setError('Failed to save profile');
      return false;
    }
  };

  const save = async (e) => {
    e.preventDefault();
    const ok = await saveProfile();
    if (ok) setEditing(false);
  };

  const saveAvailability = async () => {
    setAvailSaving(true);
    try {
      const availability = avail
        .map((d, i) => d.open ? { dayOfWeek: i, startTime: d.startTime, endTime: d.endTime } : null)
        .filter(Boolean);
      await axios.patch('/api/groomers/me/availability', { availability, blockedDates }, { headers: { Authorization: `Bearer ${token}` } });
      setEditing(false);
    } catch {
      setError('Failed to save availability');
    }
    setAvailSaving(false);
  };

  const handleAvatarUpload = async (url, prevUrl) => {
    setAvatarUrl(url);
    // Only auto-save to server once we have a real server URL — not a base64 placeholder
    if (url && !url.startsWith('data:')) {
      try {
        const res = await axios.put('/api/auth/me', { avatar: url }, { headers: { Authorization: `Bearer ${token}` } });
        login(token, { ...user, ...res.data });
      } catch { /* non-critical */ }
    }
  };

  const handleGalleryUpload = (url, prevUrl) => {
    if (prevUrl) {
      // Replace the placeholder (dataUrl) with the new URL (could be server URL or updated dataUrl)
      setGallery(prev => prev.map(u => u === prevUrl ? url : u));
    } else {
      setGallery(prev => [...prev, url]);
    }
  };

  const removeGalleryPhoto = (url) => {
    setGallery(prev => prev.filter(u => u !== url));
  };

  const addService = () => {
    if (!newService.name && !newService.price) {
      setError('Please enter a service name and price.');
      return;
    }
    if (!newService.name) {
      setError('Please enter a service name.');
      return;
    }
    if (!newService.price) {
      setError('Please enter a price for this service.');
      return;
    }
    const totalMins = (Number(newService.hours) || 0) * 60 + (Number(newService.minutes) || 0);
    setServices([...services, { name: newService.name, description: newService.description, price: Number(newService.price), duration: totalMins }]);
    setNewService({ name: '', description: '', price: '', hours: '', minutes: '' });
    setError('');
  };

  const removeService = (i) => setServices(services.filter((_, idx) => idx !== i));

  if (!profile) return <p className="text-center mt-10 text-gray-400">Loading profile...</p>;

  // --- VIEW MODE ---
  if (!editing) {
    const specialties = form.specialties
      ? form.specialties.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    return (
      <div className="max-w-xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-purple-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 text-2xl">👤</div>
            )}
            <h2 className="text-2xl font-bold text-purple-600">My Profile</h2>
          </div>
          <button onClick={() => setEditing(true)}
            className="border border-purple-400 text-purple-600 px-4 py-2 rounded hover:bg-purple-50 text-sm font-medium">
            Edit Profile
          </button>
        </div>

        {profile.verificationStatus && (
          <div className={`mb-5 px-4 py-3 rounded-lg border text-sm ${
            profile.verificationStatus === 'approved' ? 'bg-green-50 border-green-200 text-green-800' :
            profile.verificationStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
            'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            {profile.verificationStatus === 'approved' && '✅ Profile approved — visible to customers'}
            {profile.verificationStatus === 'pending' && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span>⏳ Pending admin verification</span>
                {submitReviewDone ? (
                  <span className="text-xs text-yellow-700 font-medium">✓ Review request sent</span>
                ) : (
                  <button
                    onClick={async () => {
                      setSubmitReviewLoading(true);
                      try {
                        await axios.post('/api/groomers/me/submit-review', {}, { headers: { Authorization: `Bearer ${token}` } });
                        setSubmitReviewDone(true);
                      } catch (e) {}
                      setSubmitReviewLoading(false);
                    }}
                    disabled={submitReviewLoading}
                    className="text-xs bg-yellow-700 text-white px-3 py-1 rounded hover:bg-yellow-800 disabled:opacity-50"
                  >
                    {submitReviewLoading ? 'Sending...' : 'Notify Admin for Review'}
                  </button>
                )}
              </div>
            )}
            {profile.verificationStatus === 'rejected' && (
              <div>
                <p>❌ Profile rejected{profile.rejectionReason ? ` — ${profile.rejectionReason}` : ' — please update and resubmit'}</p>
                <button
                  onClick={async () => {
                    setSubmitReviewLoading(true);
                    try {
                      await axios.post('/api/groomers/me/submit-review', {}, { headers: { Authorization: `Bearer ${token}` } });
                      setProfile(prev => ({ ...prev, verificationStatus: 'pending' }));
                      setSubmitReviewDone(true);
                    } catch (e) {}
                    setSubmitReviewLoading(false);
                  }}
                  disabled={submitReviewLoading}
                  className="mt-2 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {submitReviewLoading ? 'Submitting...' : 'Resubmit for Review'}
                </button>
              </div>
            )}
          </div>
        )}

        {form.bio && <p className="text-gray-700 mb-4">{form.bio}</p>}

        <div className="flex flex-col gap-1 text-sm text-gray-600 mb-5">
          {form.city && <p>📍 {form.city}{form.address ? `, ${form.address}` : ''}</p>}
          {form.yearsExperience && <p>🏆 {form.yearsExperience} years of experience</p>}
          {specialties.length > 0 && (
            <p>✂️ {specialties.join(', ')}</p>
          )}
          <p className="text-gray-400 text-xs mt-1">
            Cancellation/reschedule window: {form.cancellationWindowHours}h before appointment
          </p>
        </div>

        {services.length > 0 && (
          <>
            <h3 className="font-semibold text-gray-800 mb-3">Services</h3>
            <div className="flex flex-col gap-3">
              {services.map((s, i) => (
                <div key={i} className="border rounded-lg px-4 py-3">
                  <div className="flex justify-between">
                    <p className="font-medium">{s.name}</p>
                    <p className="font-bold text-purple-600">${s.price}</p>
                  </div>
                  {s.description && <p className="text-sm text-gray-500 mt-0.5">{s.description}</p>}
                  {s.duration > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Approx. {formatDuration(s.duration)} — estimated, may vary by pet</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {gallery.length > 0 && (
          <>
            <h3 className="font-semibold text-gray-800 mb-3 mt-6">Gallery</h3>
            <div className="grid grid-cols-3 gap-2">
              {gallery.map((url, i) => (
                <img key={i} src={url} alt={`gallery ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg border" />
              ))}
            </div>
          </>
        )}

        {form.serviceAgreement && (
          <>
            <h3 className="font-semibold text-gray-800 mb-2 mt-6">Service Agreement</h3>
            <div className="bg-gray-50 border rounded-lg px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
              {form.serviceAgreement}
            </div>
          </>
        )}

        {!form.bio && !form.city && services.length === 0 && (
          <p className="text-gray-400 text-sm mt-4">Your profile is empty. Click Edit Profile to get started.</p>
        )}

        {/* Stripe Connect section */}
        <div className="mt-6 border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">💳</span>
            <h3 className="font-semibold text-gray-800">Payouts</h3>
          </div>

          {stripeStatus === 'connected' && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2 mb-3">
              ✅ Stripe account connected successfully! You'll receive payouts after each completed appointment.
            </div>
          )}
          {stripeStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">
              Something went wrong connecting your Stripe account. Please try again.
            </div>
          )}

          {stripeConnected === null ? (
            <p className="text-sm text-gray-400">Checking status...</p>
          ) : stripeConnected.connected ? (
            <div>
              <p className="text-sm text-green-700 font-medium mb-1">✅ Stripe account connected</p>
              <p className="text-xs text-gray-500 mb-3">
                Payments are automatically transferred to your account after each completed appointment (minus the platform fee).
              </p>
              <button
                onClick={async () => {
                  if (!window.confirm('Disconnect your Stripe account? You won\'t receive payouts until you reconnect.')) return;
                  await axios.delete('/api/payments/connect', { headers: { Authorization: `Bearer ${token}` } });
                  window.location.reload();
                }}
                className="text-xs border border-red-300 text-red-500 px-3 py-1.5 rounded hover:bg-red-50"
              >
                Disconnect Stripe
              </button>
            </div>
          ) : stripeConnected.detailsSubmitted && !stripeConnected.connected ? (
            <div>
              <p className="text-sm text-yellow-700 font-medium mb-1">⏳ Setup incomplete</p>
              <p className="text-xs text-gray-500 mb-3">Your Stripe account needs a bit more information before payouts can be enabled.</p>
              <button
                onClick={async () => {
                  const res = await axios.get('/api/payments/connect/url', { headers: { Authorization: `Bearer ${token}` } });
                  window.location.href = res.data.url;
                }}
                className="bg-yellow-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-yellow-700"
              >
                Complete Setup
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-1">Connect your Stripe account to receive payouts.</p>
              <p className="text-xs text-gray-400 mb-3">
                Customers are charged when you mark an appointment complete. Funds are transferred to your Stripe account automatically.
              </p>
              <button
                onClick={async () => {
                  const res = await axios.get('/api/payments/connect/url', { headers: { Authorization: `Bearer ${token}` } });
                  window.location.href = res.data.url;
                }}
                className="bg-purple-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-purple-600"
              >
                Connect with Stripe
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- EDIT MODE ---
  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-purple-600 mb-2">
        {isSetup ? 'Set Up Your Profile' : 'Edit Profile'}
      </h2>

      {isSetup && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4 text-sm text-purple-700">
          Welcome! Complete your profile so customers can find and book you. Fill in at least your bio, city, and one service to go live.
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {/* Avatar upload outside the form so it auto-saves */}
      <div className="flex justify-center mb-4">
        <ImageUpload
          currentUrl={avatarUrl}
          onUpload={handleAvatarUpload}
          shape="circle"
          size="100px"
          label="Profile photo"
        />
      </div>

      <form onSubmit={save} className="flex flex-col gap-4">
        <textarea placeholder="Bio - tell customers about yourself" value={form.bio}
          onChange={e => setForm({...form, bio: e.target.value})} rows={3}
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <input placeholder="City" value={form.city} onChange={e => setForm({...form, city: e.target.value})} required
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <div className="flex flex-col gap-1">
          <input placeholder="Address (required)" value={form.address} onChange={e => setForm({...form, address: e.target.value})} required
            className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <p className="text-xs text-gray-400">Mobile groomer? Just enter your city — customers will contact you to arrange a location.</p>
        </div>
        <input type="number" placeholder="Years of experience" value={form.yearsExperience}
          onChange={e => setForm({...form, yearsExperience: e.target.value})}
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <input placeholder="Specialties (comma separated, e.g. Doodles, Large Dogs)"
          value={form.specialties} onChange={e => setForm({...form, specialties: e.target.value})}
          className="border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-300" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cancellation / Reschedule Window
          </label>
          <select value={form.cancellationWindowHours}
            onChange={e => setForm({...form, cancellationWindowHours: e.target.value})}
            className="border rounded px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700">
            {[4, 8, 12, 24, 48, 72].map(h => (
              <option key={h} value={h}>{h} hours before appointment</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Customers cannot reschedule or cancel after this window. They'll be directed to contact you.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Agreement / Policies <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={form.serviceAgreement}
            onChange={e => setForm({...form, serviceAgreement: e.target.value})}
            placeholder="Describe your cancellation policy, liability terms, what's included, requirements for your services, etc. Customers will be asked to agree to this before booking."
            rows={5}
            className="border rounded px-4 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            If provided, customers must check "I agree" before sending a booking request.
          </p>
        </div>

        <h3 className="font-semibold text-gray-700 mt-2">Services</h3>
        {services.map((s, i) => (
          <div key={i} className="flex justify-between items-center border rounded px-3 py-2 text-sm">
            <span>{s.name} — ${s.price} {s.duration ? `(approx. ${formatDuration(s.duration)})` : ''}</span>
            <button type="button" onClick={() => removeService(i)} className="text-red-400 hover:text-red-600">Remove</button>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Service name" value={newService.name}
            onChange={e => setNewService({...newService, name: e.target.value})}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <input placeholder="Description" value={newService.description}
            onChange={e => setNewService({...newService, description: e.target.value})}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <input type="number" placeholder="Price ($)" value={newService.price}
            onChange={e => setNewService({...newService, price: e.target.value})}
            className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <div className="col-span-2">
            <p className="text-xs text-gray-400 mb-1">Estimated duration (optional — times may vary by pet)</p>
            <div className="flex gap-1">
              <input type="number" placeholder="Hours" min="0" value={newService.hours}
                onChange={e => setNewService({...newService, hours: e.target.value})}
                className="border rounded px-3 py-2 text-sm w-1/2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
              <input type="number" placeholder="Min" min="0" max="59" value={newService.minutes}
                onChange={e => setNewService({...newService, minutes: e.target.value})}
                className="border rounded px-3 py-2 text-sm w-1/2 focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
          </div>
        </div>
        <button type="button" onClick={addService}
          className="border border-purple-400 text-purple-600 py-2 rounded hover:bg-purple-50 text-sm">
          + Add Service
        </button>

        <h3 className="font-semibold text-gray-700 mt-2">Work Gallery</h3>
        <p className="text-xs text-gray-400 -mt-2">Show off pets you've groomed. Photos appear on your public profile.</p>

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt={`gallery ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border" />
                <button
                  type="button"
                  onClick={() => removeGalleryPhoto(url)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <ImageUpload
          currentUrl={null}
          onUpload={handleGalleryUpload}
          shape="square"
          size="72px"
          label="Add photo"
        />

        {/* Verification Documents */}
        <h3 className="font-semibold text-gray-700 mt-2">Verification Documents</h3>
        <p className="text-xs text-gray-400 -mt-2">Upload certifications, licenses, or other credentials for admin review. You can also include a PDF summarizing your experience and references. PDFs and images accepted.</p>

        {verificationDocs.length > 0 && (
          <div className="flex flex-col gap-2">
            {verificationDocs.map((doc, i) => (
              <div key={i} className="flex items-center justify-between border rounded px-3 py-2 text-sm bg-gray-50">
                <a href={doc.url} target="_blank" rel="noreferrer"
                  className="text-purple-600 hover:underline truncate max-w-xs">
                  📄 {doc.name}
                </a>
                <button type="button"
                  onClick={() => setVerificationDocs(prev => prev.filter((_, j) => j !== i))}
                  className="text-red-400 hover:text-red-600 ml-2 text-xs">Remove</button>
              </div>
            ))}
          </div>
        )}

        <label className={`flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-purple-400 text-sm text-gray-500 ${docUploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setDocUploading(true);
              try {
                const fd = new FormData();
                fd.append('file', file);
                const res = await axios.post('/api/upload/doc', fd, {
                  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
                });
                setVerificationDocs(prev => [...prev, { url: res.data.url, name: res.data.name || file.name }]);
              } catch {
                setError('Failed to upload document. Max 10 MB, PDF or image only.');
              }
              setDocUploading(false);
              e.target.value = '';
            }}
          />
          {docUploading ? '⏳ Uploading...' : '+ Upload document (PDF or image)'}
        </label>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          {!isSetup && (
            <button type="button" onClick={() => setEditing(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-3 rounded hover:bg-gray-50 font-medium">
              Cancel
            </button>
          )}
          <button type="submit" className="flex-1 bg-purple-500 text-white py-3 rounded hover:bg-purple-600 font-medium">
            Save Profile
          </button>
        </div>
      </form>

      {/* ── Availability ─────────────────────────────────────── */}
      <div className="mt-8 border rounded-xl p-6">
        <h3 className="text-lg font-bold text-purple-600 mb-1">Availability</h3>
        <p className="text-xs text-gray-400 mb-5">Set the days and hours you accept bookings. Customers will only see slots within these hours.</p>

        <div className="flex flex-col gap-3 mb-6">
          {DAYS.map((day, i) => (
            <div key={i} className={`border rounded-lg p-3 transition ${avail[i].open ? 'border-purple-300 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={avail[i].open}
                    onChange={e => setAvail(prev => prev.map((d, j) => j === i ? { ...d, open: e.target.checked } : d))}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <span className={`text-sm font-medium ${avail[i].open ? 'text-purple-600' : 'text-gray-500'}`}>{day}</span>
                </label>

                {avail[i].open && (
                  <div className="flex items-center gap-2 text-sm">
                    <input
                      type="time"
                      value={avail[i].startTime}
                      onChange={e => setAvail(prev => prev.map((d, j) => j === i ? { ...d, startTime: e.target.value } : d))}
                      className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                    <span className="text-gray-400">to</span>
                    <input
                      type="time"
                      value={avail[i].endTime}
                      onChange={e => setAvail(prev => prev.map((d, j) => j === i ? { ...d, endTime: e.target.value } : d))}
                      className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                )}

                {!avail[i].open && (
                  <span className="text-xs text-gray-400">Unavailable</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Blocked dates */}
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Blocked Dates</h4>
        <p className="text-xs text-gray-400 mb-3">Block a single day or a range (vacation, holidays, etc.). All dates in the range will be marked unavailable.</p>

        {blockedDates.length > 0 && (() => {
          // Group consecutive dates into ranges for display
          const sorted = [...blockedDates].sort();
          const ranges = [];
          let rangeStart = sorted[0], rangeEnd = sorted[0];
          for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1] + 'T00:00:00');
            const curr = new Date(sorted[i] + 'T00:00:00');
            const diffDays = (curr - prev) / 86400000;
            if (diffDays === 1) {
              rangeEnd = sorted[i];
            } else {
              ranges.push({ start: rangeStart, end: rangeEnd });
              rangeStart = sorted[i];
              rangeEnd = sorted[i];
            }
          }
          ranges.push({ start: rangeStart, end: rangeEnd });

          const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

          return (
            <div className="flex flex-col gap-2 mb-3">
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-red-700 font-medium">
                    {r.start === r.end ? fmt(r.start) : `${fmt(r.start)} – ${fmt(r.end)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const toRemove = new Set();
                      const cur = new Date(r.start + 'T00:00:00');
                      const end = new Date(r.end + 'T00:00:00');
                      while (cur <= end) { toRemove.add(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }
                      setBlockedDates(prev => prev.filter(x => !toRemove.has(x)));
                    }}
                    className="text-red-400 hover:text-red-600 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          );
        })()}

        <div className="flex flex-wrap gap-2 items-end mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">From</label>
            <input
              type="date"
              value={blockFrom}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => { setBlockFrom(e.target.value); if (!blockTo || e.target.value > blockTo) setBlockTo(e.target.value); }}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">To</label>
            <input
              type="date"
              value={blockTo}
              min={blockFrom || new Date().toISOString().split('T')[0]}
              onChange={e => setBlockTo(e.target.value)}
              className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <button
            type="button"
            disabled={!blockFrom || !blockTo}
            onClick={() => {
              const dates = [];
              const cur = new Date(blockFrom + 'T00:00:00');
              const end = new Date(blockTo + 'T00:00:00');
              while (cur <= end) {
                const str = cur.toISOString().split('T')[0];
                if (!blockedDates.includes(str)) dates.push(str);
                cur.setDate(cur.getDate() + 1);
              }
              setBlockedDates(prev => [...prev, ...dates]);
              setBlockFrom('');
              setBlockTo('');
            }}
            className="border border-red-300 text-red-600 px-4 py-2 rounded text-sm hover:bg-red-50 disabled:opacity-40"
          >
            Block
          </button>
        </div>

        <button
          type="button"
          onClick={saveAvailability}
          disabled={availSaving}
          className="w-full bg-purple-500 text-white py-3 rounded hover:bg-purple-600 font-medium disabled:opacity-50"
        >
          {availSaving ? 'Saving...' : availSaved ? '✅ Availability Saved' : 'Save Availability'}
        </button>
      </div>
    </div>
  );
}
