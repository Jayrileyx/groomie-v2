import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ErrorBoundary from './components/ErrorBoundary';
import { Elements } from '@stripe/react-stripe-js';
import stripePromise from './stripe';

// Auth pages
import Register from './pages/Register';
import Login from './pages/Login';

// Customer pages
import Home from './pages/customer/Home';
import SearchResults from './pages/customer/SearchResults';
import GroomerDetail from './pages/customer/GroomerDetail';
import BookService from './pages/customer/BookService';
import MyBookings from './pages/customer/MyBookings';
import MyPets from './pages/customer/MyPets';
import CustomerProfile from './pages/customer/CustomerProfile';

// Groomer pages
import GroomerDashboard from './pages/groomer/Dashboard';
import GroomerProfile from './pages/groomer/Profile';
import GroomerBookings from './pages/groomer/Bookings';
import CustomerView from './pages/groomer/CustomerView';
import GroomerReviews from './pages/groomer/Reviews';

// Shared pages
import Messages from './pages/Messages';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';

function PrivateRoute({ children, role }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" />;
  if (role && user?.role !== role) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Elements stripe={stripePromise}>
      <BrowserRouter>
        <ErrorBoundary>
        <div style={{ background: 'linear-gradient(135deg,#9333ea,#d946ef)', color: '#fff', textAlign: 'center', padding: '8px 16px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em' }}>
          🐾 Groomie is in beta — groomers coming soon!
        </div>
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/groomers/:id" element={<GroomerDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />

            {/* Customer */}
            <Route path="/book/:groomerProfileId" element={<PrivateRoute role="customer"><BookService /></PrivateRoute>} />
            <Route path="/my-bookings" element={<PrivateRoute role="customer"><MyBookings /></PrivateRoute>} />
            <Route path="/my-pets" element={<PrivateRoute role="customer"><MyPets /></PrivateRoute>} />
            <Route path="/profile" element={<PrivateRoute role="customer"><CustomerProfile /></PrivateRoute>} />

            {/* Groomer */}
            <Route path="/groomer/dashboard" element={<PrivateRoute role="groomer"><GroomerDashboard /></PrivateRoute>} />
            <Route path="/groomer/profile" element={<PrivateRoute role="groomer"><GroomerProfile /></PrivateRoute>} />
            <Route path="/groomer/bookings" element={<PrivateRoute role="groomer"><GroomerBookings /></PrivateRoute>} />
            <Route path="/groomer/customer/:customerId" element={<PrivateRoute role="groomer"><CustomerView /></PrivateRoute>} />
            <Route path="/groomer/reviews" element={<PrivateRoute role="groomer"><GroomerReviews /></PrivateRoute>} />

            {/* Messages — accessible to both customers and groomers */}
            <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<PrivateRoute role="admin"><AdminDashboard /></PrivateRoute>} />
          </Routes>
        </main>
        </ErrorBoundary>
      </BrowserRouter>
      </Elements>
    </AuthProvider>
  );
}
