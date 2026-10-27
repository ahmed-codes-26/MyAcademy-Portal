import { Navigate } from 'react-router-dom';
import DashboardSkeleton from './DashboardSkeleton';
import { useAuth } from '../context/auth';
import { dashboardPath } from '../utils/dashboardPath';

export default function ProtectedRoute({ children, role }) {
  const { isAuthenticated, loading, admin } = useAuth();

  if (loading) {
    return <DashboardSkeleton variant={role || admin?.role || 'student'} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && admin?.role !== role) {
    return <Navigate to={dashboardPath(admin?.role)} replace />;
  }

  return children;
}
