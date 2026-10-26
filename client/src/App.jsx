import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import WhatsAppConnectionReminder from './components/WhatsAppConnectionReminder';
import { useAuth } from './context/auth';
import { dashboardPath } from './utils/dashboardPath';

function PortalRedirect() {
  const { admin } = useAuth();
  return <Navigate to={dashboardPath(admin?.role)} replace />;
}

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const TeacherDashboardPage = lazy(() => import('./pages/TeacherDashboardPage'));
const TeacherAttendancePage = lazy(() => import('./pages/TeacherAttendancePage'));
const TeacherFeePage = lazy(() => import('./pages/TeacherFeePage'));
const TeacherStatsPage = lazy(() => import('./pages/TeacherStatsPage'));
const TeacherNotesPage = lazy(() => import('./pages/TeacherNotesPage'));
const TeacherWhatsAppPage = lazy(() => import('./pages/TeacherWhatsAppPage'));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage'));
const TestNotesPage = lazy(() => import('./pages/TestNotesPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <WhatsAppConnectionReminder />
          <Suspense fallback={<div role="status" className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Loading portal…</div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/portal" element={<ProtectedRoute><PortalRedirect /></ProtectedRoute>} />
            <Route path="/teacher/test-notes" element={<ProtectedRoute role="teacher"><TestNotesPage /></ProtectedRoute>} />

            {/* Admin Panel Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute role="admin">
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute role="admin">
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            {/* Teacher Panel Routes */}
            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/attendance"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/fee"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherFeePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/stats"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherStatsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/notes"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherNotesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/whatsapp"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherWhatsAppPage />
                </ProtectedRoute>
              }
            />

            {/* Student Panel Routes */}
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboardPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<main className="min-h-screen grid place-content-center text-center gap-4 p-8"><h1 className="text-4xl font-bold">Page not found</h1><p>This page does not exist.</p><a className="underline" href="/">Return to MyAcademy Portal</a></main>} />
          </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
