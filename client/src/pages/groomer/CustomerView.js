import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const SIZE_LABELS = {
  small: 'Small (under 25 lbs)',
  medium: 'Medium (25–50 lbs)',
  large: 'Large (50–90 lbs)',
  'extra-large': 'Extra Large (90+ lbs)',
};

export default function CustomerView() {
  const { customerId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`/api/bookings/customer/${customerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load customer profile'));
  }, [customerId]);

  if (error) return (
    <div className="max-w-xl mx-auto mt-10 text-center">
      <p className="text-red-500 mb-4">{error}</p>
      <button onClick={() => navigate(-1)} className="text-purple-600 hover:underline text-sm">← Back</button>
    </div>
  );

  if (!data) return <p className="text-center mt-10 text-gray-400">Loading...</p>;

  const { customer, pets } = data;

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="text-purple-600 hover:underline text-sm mb-6 inline-block">
        ← Back to bookings
      </button>

      {/* Customer card */}
      <div className="border rounded-xl p-6 mb-6 flex items-center gap-5">
        {customer.avatar ? (
          <img src={customer.avatar} alt="customer"
            className="w-20 h-20 rounded-full object-cover border-2 border-purple-200 flex-shrink-0" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 text-3xl flex-shrink-0">
            👤
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-purple-600">
            {customer.firstName} {customer.lastName}
          </h2>
          {customer.phone && (
            <p className="text-sm text-gray-500 mt-0.5">📞 {customer.phone}</p>
          )}
          {customer.email && (
            <p className="text-sm text-gray-500 mt-0.5">✉️ {customer.email}</p>
          )}
        </div>
      </div>

      {/* Pets */}
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        {pets.length > 0 ? `Pets (${pets.length})` : 'Pets'}
      </h3>

      {pets.length === 0 ? (
        <p className="text-gray-400 text-sm">No pets on file.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pets.map(p => (
            <div key={p._id} className="border rounded-xl p-4 flex items-center gap-4">
              {p.photo ? (
                <img src={p.photo} alt={p.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-purple-100 flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center text-2xl flex-shrink-0">
                  🐾
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-800">{p.name}</p>
                <p className="text-sm text-gray-500">{p.breed} · {SIZE_LABELS[p.size]}</p>
                {p.notes && (
                  <p className="text-sm text-gray-400 mt-0.5 italic">"{p.notes}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
