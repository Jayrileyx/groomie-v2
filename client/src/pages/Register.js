import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = pick role, 2 = fill form
  const [role, setRole] = useState('');
  const [form, setForm] = useState({ username: '', email: '', password: '', firstName: '', lastName: '', phone: '' });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    // Require a 10-digit phone number (area code + 7 digits)
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Please enter a valid phone number including area code (e.g. 555-867-5309).');
      return;
    }
    if (!agreedToTerms) {
      setError('You must agree to the Terms of Service and Privacy Policy to register.');
      return;
    }
    try {
      const res = await axios.post('/api/auth/register', { ...form, role, agreedToTerms });
      if (res.data.token) {
        // Auto-login and redirect
        login(res.data.token, res.data.user);
        navigate(role === 'groomer' ? '/groomer/profile?setup=true' : '/');
      } else {
        navigate('/login?registered=true');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  if (step === 1) return (
    <div className="max-w-md mx-auto mt-12 text-center">
      <p className="text-5xl mb-3">🐾</p>
      <h2 className="text-3xl font-bold text-purple-700 mb-2">Join Groomie</h2>
      <p className="text-gray-400 mb-8 font-medium">Are you looking for a groomer, or are you a groomer?</p>
      <div className="flex gap-4 justify-center">
        <button onClick={() => { setRole('customer'); setStep(2); }}
          className="border-2 border-purple-200 bg-white text-purple-600 rounded-2xl px-10 py-8 hover:bg-purple-50 hover:border-purple-400 font-bold shadow-sm hover:shadow-md transition-all">
          <div className="text-4xl mb-3">🐶</div>
          I need a groomer
        </button>
        <button onClick={() => { setRole('groomer'); setStep(2); }}
          className="border-2 border-purple-200 bg-white text-purple-600 rounded-2xl px-10 py-8 hover:bg-purple-50 hover:border-purple-400 font-bold shadow-sm hover:shadow-md transition-all">
          <div className="text-4xl mb-3">✂️</div>
          I'm a groomer
        </button>
      </div>
      <p className="mt-6 text-sm text-gray-400">
        Already have an account? <Link to="/login" className="text-purple-600 hover:underline font-semibold">Login</Link>
      </p>
    </div>
  );

  const inputClass = "border-2 border-purple-100 rounded-xl px-4 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 bg-purple-50 text-gray-700 font-medium";

  return (
    <div className="max-w-sm mx-auto mt-10">
      <div className="bg-white border border-purple-100 rounded-3xl shadow-sm px-8 py-8">
        <div className="mb-5">
          <button onClick={() => setStep(1)} className="text-purple-400 hover:text-purple-600 text-sm font-semibold">← Back</button>
          <h2 className="text-2xl font-bold text-purple-700 mt-2">
            {role === 'groomer' ? '✂️ Register as a Groomer' : '🐶 Create your account'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input placeholder="First name" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required className={inputClass} />
            <input placeholder="Last name" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required className={inputClass} />
          </div>
          <input placeholder="Username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} required className={inputClass} />
          <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className={inputClass} />
          <input placeholder="Phone (e.g. 555-867-5309)" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required className={inputClass} />
          <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required className={inputClass} />
          <label className="flex items-start gap-2 cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-600 flex-shrink-0"
            />
            <span className="text-sm text-gray-500">
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline font-semibold">Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline font-semibold">Privacy Policy</a>
            </span>
          </label>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={!agreedToTerms} className="bg-purple-500 text-white py-2.5 rounded-xl hover:bg-purple-600 font-bold mt-1 shadow-md hover:shadow-lg transition-all disabled:opacity-50">
            {role === 'groomer' ? 'Register & Set Up Profile' : 'Create Account'}
          </button>
        </form>

        <p className="mt-5 text-sm text-gray-400 text-center">
          Already have an account? <Link to="/login" className="text-purple-600 hover:underline font-semibold">Login</Link>
        </p>
      </div>
    </div>
  );
}
