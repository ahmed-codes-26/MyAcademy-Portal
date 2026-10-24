import profileImage from '../utils/profileImage';
import logoUrl from '../assets/logo.svg';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import api from '../api/axios';
import {
  FileText,
  LogOut,
  Calendar,
  Wallet,
  TrendingUp,
  FolderOpen,
  Download,
  Loader2,
  File,
  FileSpreadsheet,
  Presentation,
  Flame,
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
  const [downloadingId, setDownloadingId] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [revision, setRevision] = useState(0);

  const handleDownloadNote = async (note) => {
    setDownloadingId(note._id);
    try {
      const res = await api.get(`/notes/${note._id}/download`);
      const downloadUrl = res.data?.downloadUrl;
      if (!downloadUrl) {
        throw new Error('Download URL not available.');
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const ext = (note.fileType || 'pdf').toLowerCase();
      const rawName = note.displayName || `note_${note._id}`;
      const fileName = rawName.toLowerCase().endsWith(`.${ext}`)
        ? rawName
        : `${rawName}.${ext}`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Download note error:', err);
      toast.error('Failed to download study note.');
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setDashboardError('');
    api.get('/student/dashboard', { signal: controller.signal,
      params: { viewMode, month: selectedMonth, year: selectedYear },
    }).then((res) => { if (!controller.signal.aborted) setDashboardData(res.data); })
      .catch((err) => { if (!controller.signal.aborted) setDashboardError(err.response?.data?.message || 'Could not load your records. Please retry.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [viewMode, selectedMonth, selectedYear, revision]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const scrollToNotes = () => {
    const el = document.getElementById('recent-notes-section');
    if (el) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
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

  if (!dashboardData && dashboardError) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md text-center shadow-sm">
        <h1 className="font-bold text-xl text-slate-900">Student Portal</h1>
        <p role="alert" className="text-sm text-slate-500 mt-3">{dashboardError}</p>
        <div className="flex justify-center gap-3 mt-5">
          <button onClick={() => setRevision((value) => value + 1)} className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg px-4 py-2 transition-colors">Retry</button>
          <button onClick={handleLogout} className="text-slate-600 hover:bg-slate-100 text-sm rounded-lg px-4 py-2 transition-colors">Logout</button>
        </div>
      </div>
    </div>;
  }

  const { student, attendance, fee, attendanceTrends = [], attendanceTrendWindow, recentNotes = [] } = dashboardData || {};
  const streak = attendance?.streak || 0;
  const groupedNotes = Object.entries(recentNotes.reduce((groups, note) => {
    const subject = note.subject?.trim() || 'Other materials';
    (groups[subject] ||= []).push(note);
    return groups;
  }, Object.create(null))).sort(([a], [b]) => a.localeCompare(b));

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
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans w-full max-w-full overflow-x-hidden">
      {/* 1. Top Navigation Bar (No Sidebar) */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm w-full">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Left Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden shrink-0 shadow-xs border border-slate-200/80 bg-white flex items-center justify-center p-0.5">
              <img
                src={logoUrl}
              width={42}
                height={42}
                alt="MyAcademy Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <span className="font-sans font-bold text-xl sm:text-2xl text-slate-900 tracking-tight">
              My<span className="text-amber-500">Academy</span>
            </span>
            <span className="font-bold text-slate-800 text-base hidden sm:inline border-l border-slate-200 pl-3">
              Student Portal
            </span>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={scrollToNotes}
              aria-label="Study notes"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors"
            >
              <FileText className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">Notes</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <button
              onClick={handleLogout}
              aria-label="Logout"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Logout</span>
            </button>

            {/* Student Avatar */}
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
              {student?.profilePicture ? (
                <img src={profileImage(student.profilePicture, 80)} width={36} height={36} alt={student.name || 'Student'} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-amber-700">{initials}</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {dashboardError && <div role="alert" className="mx-auto w-[calc(100%-32px)] max-w-[1392px] mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{dashboardError} <button className="underline font-semibold ml-2" onClick={() => setRevision((value) => value + 1)}>Retry</button></div>}
      {/* 2. Main Content Area */}
      <main className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-6 space-y-6 flex-1 min-w-0">
        {/* Hero Section */}
        <section className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Student Profile Picture */}
            {student?.profilePicture ? (
              <img
                src={profileImage(student.profilePicture, 80)}
                width={80}
                height={80}
                alt={student.name || 'Student'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-amber-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-100 border-2 border-amber-200 flex items-center justify-center shadow-sm shrink-0">
                <span className="text-xl sm:text-2xl font-bold text-amber-700">{initials}</span>
              </div>
            )}

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back, {student?.name || admin?.name || 'Student'}
              </h1>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200 font-mono">
                  Reg No: {student?.rollNumber || 'N/A'}
                </span>
                <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-semibold border border-amber-200">
                  Class: {student?.studentClass || 'N/A'}
                </span>
                <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-semibold border border-slate-200">
                  Teacher: {student?.assignedTeacher?.name || 'Unassigned'}
                </span>

              </div>
            </div>
          </div>

          {/* Global Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 self-stretch xl:self-auto bg-slate-50 border border-slate-200 rounded-xl p-3">
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
                  aria-label="Record month"
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
                  aria-label="Record year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-amber-500 outline-none shadow-sm"
                >
                  {Array.from({ length: new Date().getFullYear() - 2024 + 3 }, (_, i) => 2024 + i).map((yr) => (
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
          <article className="col-span-1 md:col-span-6 min-w-0 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:border-amber-300 transition-colors">
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

            {/* Attendance Streak Banner */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                  <Flame className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Attendance Streak</p>
                  <p className="text-xs font-extrabold text-slate-800">
                    {streak > 0
                      ? `${streak}-Day Streak!`
                      : "Show up tomorrow to start your streak"}
                  </p>
                </div>
              </div>
            </div>
          </article>

          {/* Card 2: Fee Status & History (Bento Cell: 4 cols) */}
          <article className="col-span-1 md:col-span-6 min-w-0 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col justify-between hover:border-amber-300 transition-colors">
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

          {/* Card 3: Attendance Trend (Bento Cell: 8 cols) */}
          <article className="col-span-1 md:col-span-12 min-w-0 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col hover:border-amber-300 transition-colors min-h-[280px]">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-amber-500" />
              <div><h2 className="text-base font-bold text-slate-900">Attendance Trend</h2><p className="text-xs text-slate-500 mt-1">Latest 15 calendar days{attendanceTrendWindow ? ` · ${formatXAxis(attendanceTrendWindow.start)} – ${formatXAxis(attendanceTrendWindow.end)}` : ' in the selected period'}</p></div>
            </div>

            <div className="w-full min-w-0 h-[240px]">
              {attendanceTrends.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs font-medium">
                  No attendance records found for this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240} minWidth={0}>
                  <LineChart data={attendanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatXAxis}
                      tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={28}
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
                      isAnimationActive={false}
                      activeDot={{ r: 4 }}
                      dot={attendanceTrends.length === 1 ? { r: 3 } : false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </article>

          {/* Card 4: Recent Study Notes Shortcut (Bento Cell: 12 cols) */}
          <article
            id="recent-notes-section"
            aria-labelledby="study-notes-heading"
            className="col-span-1 md:col-span-12 bg-white border border-slate-200 shadow-sm rounded-2xl p-5 hover:border-amber-300 transition-colors scroll-mt-20"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-amber-500" />
                <h2 id="study-notes-heading" className="text-base font-bold text-slate-900">Study Notes</h2>
              </div>
            </div>

            {recentNotes.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium bg-slate-50 rounded-xl">
                No study materials uploaded for your class level yet.
              </div>
            ) : (
              <div className="space-y-6">
                {groupedNotes.map(([subject, notes], index) => (
                  <section key={subject} aria-labelledby={`subject-${index}`} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 id={`subject-${index}`} className="text-xs font-bold text-slate-600 uppercase tracking-wider">{subject}</h3>
                      <span className="text-[10px] font-semibold text-slate-400">{notes.length} {notes.length === 1 ? 'file' : 'files'}</span>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {notes.map((note) => (
                        <div key={note._id} className="border border-slate-200 rounded-xl p-4 flex items-start gap-3 hover:border-amber-300 hover:bg-slate-50 transition-colors min-w-0">
                          <div className="p-2 bg-slate-100 rounded-lg shrink-0">{getNoteIcon(note.fileType)}</div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-slate-900 break-words">{note.displayName}</h4>
                            <p className="text-[11px] text-slate-500 mt-1 break-words">Uploaded by: {note.uploadedBy?.name || 'Instructor'}</p>
                            {note.description && <p className="text-xs text-slate-500 mt-1 break-words line-clamp-2">{note.description}</p>}
                            <p className="text-[10px] text-slate-400 mt-2">{note.fileType} · {note.fileSize}</p>
                          </div>
                          <button type="button" disabled={downloadingId === note._id} onClick={() => handleDownloadNote(note)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                            aria-label={`Download ${note.displayName}`} title="Download note">
                            {downloadingId === note._id ? <Loader2 className="w-4 h-4 animate-spin text-amber-500" /> : <Download className="w-4 h-4" />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>
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
