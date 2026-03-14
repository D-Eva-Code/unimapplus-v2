import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import StudentDashboard from './pages/StudentDashboard';
import VendorDashboard from './pages/VendorDashboard';
import RiderDashboard from './pages/RiderDashboard';
import PaymentVerify from './pages/PaymentVerify';

function ProtectedRoute({ children, role }) {
  const { user, isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (role && user?.role !== role) {
    const routes = { student: '/student', vendor: '/vendor', driver: '/rider' };
    return <Navigate to={routes[user?.role] || '/login'} replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, isLoggedIn } = useAuth();

  const homeRedirect = () => {
    if (!isLoggedIn) return <Navigate to="/login" />;
    const routes = { student: '/student', vendor: '/vendor', driver: '/rider' };
    return <Navigate to={routes[user?.role] || '/login'} />;
  };

  return (
    <Routes>
      <Route path="/" element={homeRedirect()} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/payment/verify" element={<PaymentVerify />} />
      <Route path="/student" element={
        <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
      } />
      <Route path="/vendor" element={
        <ProtectedRoute role="vendor"><VendorDashboard /></ProtectedRoute>
      } />
      <Route path="/rider" element={
        <ProtectedRoute role="driver"><RiderDashboard /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
