import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function Home() {
  const [cities, setCities] = useState([]);
  const [cityInput, setCityInput] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    axios.get('/api/groomers/cities').then(res => setCities(res.data)).catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    const val = cityInput.trim();
    if (val) navigate(`/search?city=${encodeURIComponent(val)}`);
  };

  return (
    <div className="text-center mt-12">
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-3xl px-8 py-14 mb-10 shadow-sm">
        <img src="/icon-192.png" alt="Groomie" className="mx-auto mb-4" style={{ width: 120, height: 120, borderRadius: 28 }} />
        <h1 className="text-5xl font-bold text-purple-700 mb-3 leading-tight">
          Your pup deserves<br />the best groom.
        </h1>
        <p className="text-purple-500 text-lg mb-8 font-medium">Book trusted, reviewed groomers near you — in seconds.</p>

        <form onSubmit={handleSearch} className="flex flex-col items-center gap-3">
          <div className="flex gap-2 w-full max-w-sm">
            <input
              type="text"
              list="city-suggestions"
              placeholder="Enter your city..."
              value={cityInput}
              onChange={e => setCityInput(e.target.value)}
              required
              className="border-2 border-purple-200 rounded-full px-5 py-3 w-full focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400 text-gray-700 bg-white font-medium"
            />
            <datalist id="city-suggestions">
              {cities.map(c => <option key={c} value={c} />)}
            </datalist>
            <button type="submit"
              className="bg-purple-500 text-white px-6 py-3 rounded-full hover:bg-purple-600 font-semibold whitespace-nowrap shadow-md transition-all hover:shadow-lg">
              Search
            </button>
          </div>
        </form>

        {cities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {cities.slice(0, 6).map(c => (
              <button key={c} onClick={() => navigate(`/search?city=${encodeURIComponent(c)}`)}
                className="text-xs border border-purple-300 text-purple-600 px-4 py-1.5 rounded-full hover:bg-purple-200 font-semibold transition-colors">
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-3 gap-5 text-center">
        <div className="p-6 bg-white border border-purple-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="text-4xl mb-3">✅</div>
          <h3 className="font-bold text-purple-700">Verified Groomers</h3>
          <p className="text-sm text-gray-500 mt-1">Every groomer is reviewed and approved by our team</p>
        </div>
        <div className="p-6 bg-white border border-purple-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="text-4xl mb-3">⭐</div>
          <h3 className="font-bold text-purple-700">Rated & Reviewed</h3>
          <p className="text-sm text-gray-500 mt-1">Real reviews from real pet owners like you</p>
        </div>
        <div className="p-6 bg-white border border-purple-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="font-bold text-purple-700">Easy Booking</h3>
          <p className="text-sm text-gray-500 mt-1">Pick a time, confirm, done — no phone calls needed</p>
        </div>
      </div>
    </div>
  );
}
