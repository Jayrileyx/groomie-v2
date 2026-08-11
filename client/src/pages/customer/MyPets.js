import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ImageUpload from '../../components/ImageUpload';

const SIZE_LABELS = {
  small: 'Small (under 25 lbs)',
  medium: 'Medium (25–50 lbs)',
  large: 'Large (50–90 lbs)',
  'extra-large': 'Extra Large (90+ lbs)',
};

const BLANK = { name: '', breed: '', size: 'medium', notes: '', photo: '' };

export default function MyPets() {
  const { token } = useAuth();
  const [pets, setPets] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const fetchPets = () =>
    axios.get('/api/pets', { headers }).then(r => setPets(r.data));

  useEffect(() => { fetchPets(); }, []);

  const startAdd = () => { setForm(BLANK); setEditingId(null); setShowForm(true); setError(''); };
  const startEdit = (pet) => {
    setForm({ name: pet.name, breed: pet.breed, size: pet.size, notes: pet.notes || '', photo: pet.photo || '' });
    setEditingId(pet._id);
    setShowForm(true);
    setError('');
  };
  const cancel = () => { setShowForm(false); setEditingId(null); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Strip any dataUrl placeholder if background upload hasn't completed yet
      const payload = { ...form, photo: (form.photo && !form.photo.startsWith('data:')) ? form.photo : '' };
      if (editingId) {
        await axios.put(`/api/pets/${editingId}`, payload, { headers });
      } else {
        await axios.post('/api/pets', payload, { headers });
      }
      fetchPets();
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save pet');
    }
  };

  const remove = async (id, name) => {
    if (!window.confirm(`Remove ${name}?`)) return;
    await axios.delete(`/api/pets/${id}`, { headers });
    fetchPets();
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-purple-600">My Pets</h2>
        {!showForm && (
          <button onClick={startAdd}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm font-medium">
            + Add Pet
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="border rounded-xl p-5 mb-6 flex flex-col gap-3 bg-purple-50">
          <h3 className="font-semibold text-purple-600">{editingId ? 'Edit Pet' : 'Add a Pet'}</h3>

          <div className="flex justify-center">
            <ImageUpload
              currentUrl={form.photo}
              onUpload={url => setForm(f => ({ ...f, photo: url }))}
              shape="circle"
              size="88px"
              label="Pet photo"
            />
          </div>

          <input placeholder="Pet name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
            className="border rounded px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <input placeholder="Breed *" value={form.breed} onChange={e => setForm({...form, breed: e.target.value})} required
            className="border rounded px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300" />
          <select value={form.size} onChange={e => setForm({...form, size: e.target.value})}
            className="border rounded px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="small">Small (under 25 lbs)</option>
            <option value="medium">Medium (25–50 lbs)</option>
            <option value="large">Large (50–90 lbs)</option>
            <option value="extra-large">Extra Large (90+ lbs)</option>
          </select>
          <textarea placeholder="Notes (temperament, allergies, etc.)" value={form.notes}
            onChange={e => setForm({...form, notes: e.target.value})} rows={2}
            className="border rounded px-4 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-300" />

          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={cancel}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded hover:bg-gray-50 text-sm">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 bg-purple-500 text-white py-2 rounded hover:bg-purple-600 text-sm font-medium">
              {editingId ? 'Save Changes' : 'Add Pet'}
            </button>
          </div>
        </form>
      )}

      {pets.length === 0 && !showForm ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🐾</p>
          <p className="text-gray-500 mb-4">No pets saved yet.</p>
          <button onClick={startAdd}
            className="bg-purple-500 text-white px-6 py-2 rounded hover:bg-purple-600 font-medium">
            Add Your First Pet
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pets.map(p => (
            <div key={p._id} className="border rounded-xl p-4 flex items-center gap-4">
              {p.photo ? (
                <img src={p.photo} alt={p.name} className="w-14 h-14 rounded-full object-cover border-2 border-purple-100 flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-purple-50 flex items-center justify-center text-2xl flex-shrink-0">🐾</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{p.name}</p>
                <p className="text-sm text-gray-500">{p.breed} · {SIZE_LABELS[p.size]}</p>
                {p.notes && <p className="text-sm text-gray-400 mt-0.5 italic">"{p.notes}"</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(p)}
                  className="text-sm border border-gray-300 text-gray-600 px-3 py-1 rounded hover:bg-gray-50">
                  Edit
                </button>
                <button onClick={() => remove(p._id, p.name)}
                  className="text-sm border border-red-300 text-red-500 px-3 py-1 rounded hover:bg-red-50">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
