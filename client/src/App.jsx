import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AccountPage from './pages/AccountPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import TeacherAttendancePage from './pages/TeacherAttendancePage';
import TeacherFeePage from './pages/TeacherFeePage';
import TeacherStatsPage from './pages/TeacherStatsPage';
import TeacherNotesPage from './pages/TeacherNotesPage';
import TeacherWhatsAppPage from './pages/TeacherWhatsAppPage';
import StudentDashboardPage from './pages/StudentDashboardPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Admin Panel Routes */}
            <Route
              path="/"
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

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
