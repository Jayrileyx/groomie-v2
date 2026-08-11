import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get('registered') === 'true';
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', form);
      login(res.data.token, res.data.user);
      const { role } = res.data.user;
      const token = res.data.token;

      if (role === 'groomer') {
        const profileRes = await axios.get('/api/groomers/me/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profile = profileRes.data;
        const isIncomplete = !profile || !profile.bio || !profile.city;
        navigate(isIncomplete ? '/groomer/profile?setup=true' : '/groomer/dashboard');
      } else if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-12">
      <div className="bg-white border border-purple-100 rounded-3xl shadow-sm px-8 py-10">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🐾</p>
          <h2 className="text-2xl font-bold text-purple-700">Welcome back!</h2>
          <p className="text-sm text-gray-400 mt-1">Log in to your Groomie account</p>
        </div>

        {justRegistered && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-sm text-green-800">
            Account created! Log in to continue.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username or Email"
            value={form.username}
            onChange={e => setForm({...form, username: e.target.value})}
            required
            className="border-2 border-purple-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 bg-purple-50 text-gray-700 font-medium"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              required
              className="border-2 border-purple-100 rounded-xl px-4 py-2.5 w-full focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-300 bg-purple-50 text-gray-700 font-medium pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-500 hover:text-purple-600 font-semibold"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-purple-500 text-white py-2.5 rounded-xl hover:bg-purple-600 font-bold mt-1 shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <p className="mt-5 text-sm text-gray-400 text-center">
          Don't have an account? <Link to="/register" className="text-purple-600 hover:underline font-semibold">Register</Link>
        </p>
      </div>
    </div>
  );
}
