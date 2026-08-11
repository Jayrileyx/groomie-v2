import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

export default function GroomerReviews() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const highlightRef = useRef(null);

  useEffect(() => {
    axios.get('/api/reviews/my', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setReviews(r.data))
      .finally(() => setLoading(false));
  }, []);

  // Scroll to highlighted review after load
  useEffect(() => {
    if (!loading && highlight && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 200);
    }
  }, [loading, highlight]);

  const avg = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  if (loading) return <p className="text-center mt-10 text-gray-400">Loading reviews...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: '24px',
          }}
        >
          <img src={lightbox} alt="review"
            style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '12px', objectFit: 'contain' }} />
          <p style={{ position: 'absolute', bottom: '24px', color: '#aaa', fontSize: '12px' }}>Click to close</p>
        </div>
      )}

      <h2 className="text-2xl font-bold text-purple-600 mb-1">My Reviews</h2>

      {reviews.length === 0 ? (
        <p className="text-gray-400 mt-6">No reviews yet — they'll show up here once customers submit them.</p>
      ) : (
        <>
          {/* Summary bar */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{avg}</p>
              <p className="text-yellow-500 text-lg leading-none">
                {'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}
              </p>
            </div>
            <div className="border-l border-purple-200 pl-4">
              <p className="text-sm text-gray-600">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
              {[5, 4, 3, 2, 1].map(n => {
                const count = reviews.filter(r => r.rating === n).length;
                const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0;
                return (
                  <div key={n} className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-3 text-right">{n}</span>
                    <span className="text-yellow-400">★</span>
                    <div className="w-24 bg-gray-200 rounded-full h-1.5">
                      <div className="bg-yellow-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {reviews.map(r => (
              <div
                key={r._id}
                ref={r._id === highlight ? highlightRef : null}
                className={`border rounded-xl p-4 transition-all duration-500 ${r._id === highlight ? 'border-purple-400 ring-2 ring-purple-200 bg-purple-50' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {r.customer?.avatar ? (
                    <img src={r.customer.avatar} alt="reviewer"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 font-bold flex-shrink-0 mt-0.5">
                      {(r.customer?.firstName?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center flex-wrap gap-1">
                      <p className="font-semibold text-gray-800">
                        {r.customer?.firstName} {r.customer?.lastName}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">{'★'.repeat(r.rating)}</span>
                        <span className="text-gray-300">{'☆'.repeat(5 - r.rating)}</span>
                      </div>
                    </div>
                    {r.comment && (
                      <p className="text-gray-600 text-sm mt-1">{r.comment}</p>
                    )}
                    {r.photos?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {r.photos.map((url, i) => (
                          <img key={i} src={url} alt={`photo ${i + 1}`}
                            onClick={() => setLightbox(url)}
                            className="w-24 h-24 object-cover rounded-lg border border-gray-200 cursor-zoom-in hover:opacity-90 transition" />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
