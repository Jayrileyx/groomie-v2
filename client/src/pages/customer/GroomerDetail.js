import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function GroomerDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [groomer, setGroomer] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    axios.get(`/api/groomers/${id}`).then(res => setGroomer(res.data));
    axios.get(`/api/reviews/${id}`).then(res => setReviews(res.data));
  }, [id]);

  if (!groomer) return <p className="text-center mt-10">Loading...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Lightbox for review photos */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: '24px',
          }}
        >
          <img src={lightbox} alt="review"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }} />
          <p style={{ position: 'absolute', bottom: '24px', color: '#aaa', fontSize: '12px' }}>Click to close</p>
        </div>
      )}
      <div className="border rounded-xl p-6 mb-6">
        {/* Avatar + name row */}
        <div className="flex items-center gap-4 mb-4">
          {groomer.user?.avatar ? (
            <img src={groomer.user.avatar} alt="groomer"
              className="w-20 h-20 rounded-full object-cover border-2 border-purple-200 flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 text-3xl flex-shrink-0">👤</div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-purple-600">{groomer.user?.firstName} {groomer.user?.lastName}</h2>
            <p className="text-gray-500 text-sm">{groomer.city}{groomer.address ? ` · ${groomer.address}` : ''}</p>
            <p className="text-yellow-500 mt-0.5">
              {groomer.reviewCount > 0
                ? `${'★'.repeat(Math.round(groomer.rating))}${'☆'.repeat(5 - Math.round(groomer.rating))} ${groomer.rating} (${groomer.reviewCount} reviews)`
                : '☆☆☆☆☆ No reviews yet'}
            </p>
          </div>
        </div>

        {groomer.bio && <p className="text-gray-700">{groomer.bio}</p>}
        {groomer.yearsExperience && <p className="text-sm text-gray-500 mt-1">{groomer.yearsExperience} years of experience</p>}
        {groomer.specialties?.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {groomer.specialties.map((s, i) => <span key={i} className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">{s}</span>)}
          </div>
        )}
      </div>

      <h3 className="text-lg font-semibold mb-3">Services</h3>
      <div className="flex flex-col gap-3 mb-6">
        {groomer.services?.map((s, i) => (
          <div key={i} className="border rounded-lg p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="text-sm text-gray-500">{s.description}</p>
              {s.duration > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Approx. {s.duration >= 60 ? `${Math.floor(s.duration/60)} hr${s.duration % 60 ? ` ${s.duration % 60} min` : ''}` : `${s.duration} min`} &mdash; estimated, may vary by pet
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="font-bold text-purple-600">${s.price}</p>
              {token && user?.role === 'customer' && (
                <button onClick={() => navigate(`/book/${groomer._id}`, { state: { service: s, groomer } })}
                  className="mt-1 text-sm bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600">
                  Book
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {token && user?.role === 'customer' && groomer.user?._id && (
        <div className="mb-6">
          <button
            onClick={() => navigate(`/messages?with=${groomer.user._id}`)}
            className="border border-purple-400 text-purple-600 px-4 py-2 rounded hover:bg-purple-50 text-sm font-medium"
          >
            💬 Message {groomer.user.firstName}
          </button>
        </div>
      )}

      {!token && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-center">
          <p className="text-purple-600 font-medium">Sign in to book an appointment</p>
          <Link to="/login" className="text-purple-600 hover:underline text-sm">Login or create an account</Link>
        </div>
      )}

      {/* Gallery */}
      {groomer.photos?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Gallery</h3>
          <div className="grid grid-cols-3 gap-2">
            {groomer.photos.map((url, i) => (
              <img key={i} src={url} alt={`gallery ${i + 1}`}
                className="w-full aspect-square object-cover rounded-lg border" />
            ))}
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold mb-3">Reviews ({reviews.length})</h3>
      {reviews.length === 0 ? (
        <p className="text-gray-400 text-sm">No reviews yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map(r => (
            <div key={r._id} className="border rounded-lg p-4">
              <div className="flex items-start gap-3">
                {r.customer?.avatar ? (
                  <img src={r.customer.avatar} alt="reviewer"
                    className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0 mt-0.5" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 text-base flex-shrink-0 mt-0.5">
                    {(r.customer?.firstName?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">{r.customer?.firstName} {r.customer?.lastName}</p>
                    <p className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
                  </div>
                  {r.comment && <p className="text-gray-600 text-sm mt-1">{r.comment}</p>}
                  {r.photos?.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {r.photos.map((url, i) => (
                        <img key={i} src={url} alt={`review photo ${i + 1}`}
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-90 transition"
                          onClick={() => setLightbox(url)} />
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">{new Date(r.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
