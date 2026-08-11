import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function GroomerDashboard() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    axios.get('/api/bookings/groomer', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setBookings(res.data));
    axios.get('/api/groomers/me/profile', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setProfile(res.data));
    axios.get('/api/reviews/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setReviews(res.data))
      .catch(() => {});
  }, []);

  const pending   = bookings.filter(b => b.status === 'pending');
  const confirmed = bookings.filter(b => b.status === 'confirmed');

  return (
    <div>
      <h2 className="text-2xl font-bold text-purple-600 mb-2">Groomer Dashboard</h2>

      {profile && (
        <div className={`mb-6 p-4 rounded-lg border ${profile.verificationStatus === 'approved' ? 'bg-green-50 border-green-200' : profile.verificationStatus === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className="font-medium">
            {profile.verificationStatus === 'approved' && '✅ Your profile is verified and visible to customers.'}
            {profile.verificationStatus === 'pending' && '⏳ Your profile is pending admin verification.'}
            {profile.verificationStatus === 'rejected' && (
              <>
                ❌ Your profile was rejected. Please update your profile and contact support.
                {profile.rejectionReason && (
                  <span className="block text-sm font-normal mt-1 text-red-700">Reason: {profile.rejectionReason}</span>
                )}
              </>
            )}
          </p>
          <Link to="/groomer/profile" className="text-purple-600 text-sm hover:underline mt-1 inline-block">
            Edit Profile
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pending.length}</p>
          <p className="text-sm text-gray-500">Pending</p>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{confirmed.length}</p>
          <p className="text-sm text-gray-500">Confirmed</p>
        </div>
        <div className="border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-600">{bookings.length}</p>
          <p className="text-sm text-gray-500">Total Bookings</p>
        </div>
        <Link to="/groomer/reviews" className="border rounded-xl p-4 text-center hover:bg-purple-50 transition block">
          <p className="text-2xl font-bold text-yellow-500">
            {reviews.length > 0
              ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
              : '—'}
          </p>
          <p className="text-sm text-gray-500">
            {reviews.length > 0 ? `★ ${reviews.length} Review${reviews.length !== 1 ? 's' : ''}` : 'No Reviews Yet'}
          </p>
        </Link>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link to="/groomer/bookings" className="bg-purple-500 text-white px-6 py-3 rounded hover:bg-purple-600 font-medium inline-block">
          Manage Bookings
        </Link>
        <Link to="/groomer/reviews" className="border border-purple-300 text-purple-600 px-6 py-3 rounded hover:bg-purple-50 font-medium inline-block">
          View Reviews
        </Link>
      </div>
    </div>
  );
}
