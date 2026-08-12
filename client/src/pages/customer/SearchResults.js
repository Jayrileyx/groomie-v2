import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SORT_OPTIONS = [
  { value: 'rating',     label: 'Highest Rated' },
  { value: 'reviews',    label: 'Most Reviews' },
  { value: 'price_asc',  label: 'Lowest Price' },
  { value: 'price_desc', label: 'Highest Price' },
  { value: 'experience', label: 'Most Experienced' },
];

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const city = searchParams.get('city') || '';

  const [groomers, setGroomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [serviceQuery, setServiceQuery] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [maxPrice, setMaxPrice] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [minExperience, setMinExperience] = useState(0);
  const [sort, setSort] = useState('rating');

  useEffect(() => {
    setLoading(true);
    axios.get(`/api/groomers?city=${encodeURIComponent(city)}`)
      .then(res => setGroomers(res.data))
      .catch(() => setGroomers([]))
      .finally(() => setLoading(false));
  }, [city]);

  // All unique specialties from loaded groomers
  const allSpecialties = useMemo(() => {
    const set = new Set();
    groomers.forEach(g => (g.specialties || []).forEach(s => set.add(s)));
    return Array.from(set).sort();
  }, [groomers]);

  const filtered = useMemo(() => {
    let list = [...groomers];

    if (serviceQuery.trim()) {
      const q = serviceQuery.trim().toLowerCase();
      list = list.filter(g => g.services?.some(s => s.name.toLowerCase().includes(q)));
    }

    if (minRating > 0) {
      list = list.filter(g => (g.rating || 0) >= minRating);
    }

    if (maxPrice !== '') {
      const max = Number(maxPrice);
      list = list.filter(g => g.services?.some(s => s.price <= max));
    }

    if (specialty) {
      list = list.filter(g => g.specialties?.some(s => s.toLowerCase() === specialty.toLowerCase()));
    }

    if (minExperience > 0) {
      list = list.filter(g => (g.yearsExperience || 0) >= minExperience);
    }

    list.sort((a, b) => {
      if (sort === 'rating')     return (b.rating || 0) - (a.rating || 0);
      if (sort === 'reviews')    return (b.reviewCount || 0) - (a.reviewCount || 0);
      if (sort === 'experience') return (b.yearsExperience || 0) - (a.yearsExperience || 0);
      if (sort === 'price_asc') {
        const aMin = Math.min(...(a.services?.map(s => s.price) || [Infinity]));
        const bMin = Math.min(...(b.services?.map(s => s.price) || [Infinity]));
        return aMin - bMin;
      }
      if (sort === 'price_desc') {
        const aMax = Math.max(...(a.services?.map(s => s.price) || [0]));
        const bMax = Math.max(...(b.services?.map(s => s.price) || [0]));
        return bMax - aMax;
      }
      return 0;
    });

    return list;
  }, [groomers, serviceQuery, minRating, maxPrice, specialty, minExperience, sort]);

  const clearFilters = () => {
    setServiceQuery('');
    setMinRating(0);
    setMaxPrice('');
    setSpecialty('');
    setMinExperience(0);
    setSort('rating');
  };

  const activeFilterCount = [
    serviceQuery,
    minRating > 0,
    maxPrice !== '',
    specialty,
    minExperience > 0,
    sort !== 'rating',
  ].filter(Boolean).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-purple-600">
          Groomers in {city}
          {!loading && <span className="text-base font-normal text-gray-400 ml-2">({filtered.length} found)</span>}
        </h2>
        <div className="flex items-center gap-3">
          {/* Mobile filter toggle */}
          <button
            onClick={() => setFiltersOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm border border-gray-300 rounded-lg px-3 py-1.5 text-gray-600 hover:border-purple-400 hover:text-purple-600 transition sm:hidden"
          >
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
            <span>{filtersOpen ? '▲' : '▼'}</span>
          </button>
          <button onClick={() => navigate('/')} className="text-sm text-purple-600 hover:underline">
            ← Change city
          </button>
        </div>
      </div>

      {/* Filter bar — always visible on sm+, toggle on mobile */}
      <div className={`bg-gray-50 border rounded-xl px-4 py-3 mb-6 gap-3 items-end flex-wrap ${filtersOpen ? 'flex' : 'hidden sm:flex'}`}>
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs font-medium text-gray-500">Service type</label>
          <input
            type="text"
            placeholder="e.g. Bath, Haircut..."
            value={serviceQuery}
            onChange={e => setServiceQuery(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        {allSpecialties.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Specialty</label>
            <select value={specialty} onChange={e => setSpecialty(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700">
              <option value="">Any</option>
              {allSpecialties.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Min rating</label>
          <select value={minRating} onChange={e => setMinRating(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700">
            <option value={0}>Any</option>
            <option value={3}>3+ stars</option>
            <option value={4}>4+ stars</option>
            <option value={4.5}>4.5+ stars</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Max price</label>
          <input
            type="number"
            placeholder="Any"
            min={0}
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Min experience</label>
          <select value={minExperience} onChange={e => setMinExperience(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700">
            <option value={0}>Any</option>
            <option value={1}>1+ years</option>
            <option value={3}>3+ years</option>
            <option value={5}>5+ years</option>
            <option value={10}>10+ years</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Sort by</label>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 text-gray-700">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {activeFilterCount > 0 && (
          <button onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-red-500 hover:underline self-end pb-1.5">
            Clear all ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {serviceQuery && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Service: "{serviceQuery}"
              <button onClick={() => setServiceQuery('')} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
          {specialty && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Specialty: {specialty}
              <button onClick={() => setSpecialty('')} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
          {minRating > 0 && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              {minRating}+ stars
              <button onClick={() => setMinRating(0)} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
          {maxPrice !== '' && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              Max ${maxPrice}
              <button onClick={() => setMaxPrice('')} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
          {minExperience > 0 && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              {minExperience}+ yrs experience
              <button onClick={() => setMinExperience(0)} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
          {sort !== 'rating' && (
            <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
              {SORT_OPTIONS.find(o => o.value === sort)?.label}
              <button onClick={() => setSort('rating')} className="ml-1 hover:text-red-500">✕</button>
            </span>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <p className="text-center mt-10 text-gray-400">Searching...</p>
      ) : groomers.length === 0 ? (
        <div className="text-center mt-10">
          <div className="text-5xl mb-3">🐾</div>
          <p className="text-gray-500 mb-3">No verified groomers found in "{city}" yet.</p>
          <button onClick={() => navigate('/')} className="text-purple-600 hover:underline text-sm">
            Try another city
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center mt-10">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-gray-500 mb-2">No groomers match your filters.</p>
          <button onClick={clearFilters} className="text-purple-600 hover:underline text-sm">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(g => {
            const minSvcPrice = g.services?.length
              ? Math.min(...g.services.map(s => s.price))
              : null;

            const bioSnippet = g.bio ? g.bio.split('\n')[0].slice(0, 100) + (g.bio.length > 100 ? '…' : '') : null;

            return (
              <div key={g._id} className="border rounded-xl p-5 flex justify-between items-start hover:shadow-md transition gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  {g.user?.avatar ? (
                    <img src={g.user.avatar} alt="groomer"
                      className="w-14 h-14 rounded-full object-cover border-2 border-purple-100 flex-shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-purple-400 text-2xl flex-shrink-0 mt-0.5">👤</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold">{g.user?.firstName} {g.user?.lastName}</h3>
                      {g.yearsExperience > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {g.yearsExperience} yr{g.yearsExperience !== 1 ? 's' : ''} exp
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{g.city}{g.address ? ` · ${g.address}` : ''}</p>
                    <p className="text-sm text-yellow-500">
                      {g.reviewCount > 0
                        ? `${'★'.repeat(Math.round(g.rating))}${'☆'.repeat(5 - Math.round(g.rating))} ${g.rating.toFixed(1)} (${g.reviewCount} review${g.reviewCount !== 1 ? 's' : ''})`
                        : '☆☆☆☆☆ No reviews yet'}
                    </p>
                    {bioSnippet && (
                      <p className="text-xs text-gray-500 mt-1 italic">"{bioSnippet}"</p>
                    )}
                    {g.specialties?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {g.specialties.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {g.services?.slice(0, 3).map((s, i) => (
                        <span key={i} className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded-full">
                          {s.name} — ${s.price}
                        </span>
                      ))}
                      {g.services?.length > 3 && (
                        <span className="text-xs text-gray-400 px-1 py-1">+{g.services.length - 3} more</span>
                      )}
                    </div>
                    {minSvcPrice !== null && (
                      <p className="text-xs text-gray-400 mt-1">Starting from ${minSvcPrice}</p>
                    )}
                  </div>
                </div>
                <Link to={`/groomers/${g._id}`}
                  className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm font-medium whitespace-nowrap flex-shrink-0 mt-1">
                  View Profile
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
