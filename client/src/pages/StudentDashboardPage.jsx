import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import api from '../api/axios';
import {
  FileText,
  LogOut,
  Calendar,
  Wallet,
  TrendingUp,
  FolderOpen,
  Megaphone,
  Download,
  Loader2,
  File,
  FileSpreadsheet,
  Presentation,
  GraduationCap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StudentDashboardPage() {
  const { admin, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Filter state
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'monthly'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStudentDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/student/dashboard', {
        params: {
          viewMode,
          month: selectedMonth,
          year: selectedYear,
        },
      });
      setDashboardData(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load student dashboard.');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedMonth, selectedYear, toast]);

  useEffect(() => {
    fetchStudentDashboard();
  }, [fetchStudentDashboard]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const scrollToNotes = () => {
    const el = document.getElementById('recent-notes-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading Student Portal...</p>
        </div>
      </div>
    );
  }

  const { student, attendance, fee, attendanceTrends = [], recentNotes = [], notices = [] } = dashboardData || {};

  const initials = student?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'ST';

  // Format Date for Trend Chart X-Axis
  const formatXAxis = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Helper to pick note type icon
  const getNoteIcon = (fileType) => {
    const type = (fileType || '').toUpperCase();
    if (['PDF'].includes(type)) return <FileText className="w-5 h-5 text-red-500" />;
    if (['DOC', 'DOCX'].includes(type)) return <File className="w-5 h-5 text-blue-500" />;
    if (['XLS', 'XLSX'].includes(type)) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (['PPT', 'PPTX'].includes(type)) return <Presentation className="w-5 h-5 text-orange-500" />;
    return <File className="w-5 h-5 text-amber-500" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* 1. Top Navigation Bar (No Sidebar) */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm w-full">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left Logo */}
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-sans font-bold text-xl text-slate-900 tracking-tight">
              My<span className="text-amber-500">Academy</span>
            </span>
            <span className="font-bold text-slate-800 text-base hidden sm:inline border-l border-slate-200 pl-3">
              Student Portal
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={scrollToNotes}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors"
            >
              <FileText className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Notes</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Student Avatar */}
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              {student?.profilePicture ? (
                <img src={student.profilePicture} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-amber-700">{initials}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <main className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1">
        {/* Hero Section */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {student?.name || admin?.name || 'Student'} 👋
            </h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 font-mono">
                Reg No: {student?.rollNumber || 'N/A'}
              </span>
              <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-semibold border border-amber-200">
                Class: Class {student?.studentClass || 'N/A'}
              </span>
              <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200">
                Teacher: {student?.assignedTeacher?.name || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Global Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto pt-2 md:pt-0">
            <div className="flex items-center gap-2">
              <label htmlFor="record-filter" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                View Record:
              </label>
              <select
                id="record-filter"
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-amber-500 outline-none shadow-sm"
              >
                <option value="all">All-Time Record</option>
                <option value="monthly">Monthly Record</option>
              </select>
            </div>

            {viewMode === 'monthly' && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-amber-500 outline-none shadow-sm"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-amber-500 outline-none shadow-sm"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* 3. Bento Grid Layout */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Card 1: Attendance Summary (Bento Cell: 4 cols) */}
          <article className="col-span-1 md:col-span-4 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Attendance Summary</h2>
            </div>

            <div className="flex items-center justify-between gap-4 my-2">
              {/* Circular SVG Donut */}
              <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="transparent" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    fill="transparent"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeDasharray={`${attendance?.percentage || 0} ${100 - (attendance?.percentage || 0)}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold text-slate-900">{attendance?.percentage || 0}%</span>
                </div>
              </div>

              {/* Text Breakdown */}
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Presents
                  </span>
                  <span className="font-bold text-slate-900">{attendance?.presents || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    Absents
                  </span>
                  <span className="font-bold text-slate-900">{attendance?.absents || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Leaves
                  </span>
                  <span className="font-bold text-slate-900">{attendance?.leaves || 0}</span>
                </div>
              </div>
            </div>
          </article>

          {/* Card 2: Fee Status & History (Bento Cell: 4 cols) */}
          <article className="col-span-1 md:col-span-4 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:border-amber-300 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">Fee Status</h2>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  fee?.status === 'PAID'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}
              >
                {fee?.status || 'PENDING'}
              </span>
            </div>

            <div>
              <p className="text-3xl font-black text-slate-900 tracking-tight">
                Rs. {(fee?.amount || 0).toLocaleString('en-PK')}
              </p>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {fee?.status === 'PAID'
                  ? `Paid: Rs. ${(fee?.paidAmount || 0).toLocaleString('en-PK')}`
                  : `Pending: Rs. ${((fee?.amount || 0) - (fee?.paidAmount || 0)).toLocaleString('en-PK')}`}
              </p>
            </div>
          </article>

          {/* Card 5: Academy Notice Board (Bento Cell: 4 cols, row-span-2) */}
          <article className="col-span-1 md:col-span-4 md:row-span-2 bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col hover:border-amber-300 transition-colors overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Notice Board</h2>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4 max-h-[360px]">
              {notices.map((notice) => (
                <div key={notice.id} className="pb-3 border-b border-slate-100 border-dashed last:border-0 last:pb-0">
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{notice.date}</span>
                  <h3 className="text-xs font-bold text-slate-900 mt-0.5">{notice.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{notice.description}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Card 3: Attendance Trend (Bento Cell: 8 cols) */}
          <article className="col-span-1 md:col-span-8 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col hover:border-amber-300 transition-colors min-h-[280px]">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Attendance Trend</h2>
            </div>

            <div className="flex-1 w-full h-full min-h-[180px]">
              {attendanceTrends.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                  No attendance records found for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={attendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatXAxis}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                      }}
                      labelFormatter={(label) => `Date: ${label}`}
                      formatter={(value) => [`${value}%`, 'Present Rate']}
                    />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      activeDot={{ r: 6 }}
                      dot={{ r: 4, strokeWidth: 1 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          {/* Card 4: Recent Study Notes Shortcut (Bento Cell: 12 cols) */}
          <article
            id="recent-notes-section"
            className="col-span-1 md:col-span-12 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 hover:border-amber-300 transition-colors"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">Recent Study Notes</h2>
              </div>
            </div>

            {recentNotes.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-xl">
                No study materials uploaded for your class level yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentNotes.map((note) => (
                  <div
                    key={note._id}
                    className="border border-slate-200 rounded-xl p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                        {getNoteIcon(note.fileType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xs font-bold text-slate-900 truncate">{note.displayName}</h3>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                          {note.subject} • {note.fileSize}
                        </p>
                      </div>
                    </div>

                    <a
                      href={`/api/notes/${note._id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-full transition-colors shrink-0"
                      title="Download Note"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-6 bg-white border-t border-slate-200 text-center text-xs text-slate-400 mt-auto">
        © 2026 MyAcademy Student Portal. All rights reserved.
      </footer>
    </div>
  );
}
