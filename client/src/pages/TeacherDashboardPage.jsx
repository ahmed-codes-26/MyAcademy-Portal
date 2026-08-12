import { useState, useEffect } from 'react';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { Users, Clock, TrendingUp, HelpCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function TeacherDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { admin } = useAuth();
  const toast = useToast();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const res = await api.get('/teacher/dashboard');
        setData(res.data);
      } catch {
        toast.error('Failed to load dashboard statistics.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [toast]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center lg:pl-[260px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const { metrics, monthlyPresentPct, attendanceTrends, students } = data || {
    metrics: { feeReceived: 0, feeRemaining: 0, totalStudents: 0 },
    monthlyPresentPct: 100,
    attendanceTrends: [],
    students: [],
  };

  // Pie/Donut Chart Setup
  const pieData = [
    { name: 'Present', value: monthlyPresentPct },
    { name: 'Absent', value: 100 - monthlyPresentPct },
  ];
  const PIE_COLORS = ['#f59e0b', '#e2e8f0']; // Amber-500, Slate-200

  // Format Date for X-Axis (e.g. "Aug 11")
  const formatXAxis = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Attendance badge color selector
  const getBadgeClass = (pct) => {
    if (pct > 85) return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    if (pct >= 70) return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-red-50 text-red-700 border border-red-200';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex w-full max-w-full overflow-x-hidden">
      {/* Sidebar Navigation */}
      <TeacherSidebar />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[260px] max-w-full">
        {/* Mobile Header */}
        <MobileHeader />

        {/* Desktop Top bar header */}
        <header className="bg-white sticky top-0 z-30 w-full border-b border-slate-200 shadow-sm hidden lg:flex justify-between items-center px-6 h-16">
          <h2 className="text-lg font-bold text-slate-800">Teacher Dashboard</h2>
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
              <HelpCircle className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-900 leading-none">{admin?.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{admin?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 min-w-0">
          {/* Summary Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Fee Received */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fee Received</span>
              <span className="text-2xl font-bold text-slate-900">PKR {metrics.feeReceived.toLocaleString('en-PK')}</span>
              <div className="flex items-center gap-1 text-emerald-600 mt-3 text-xs font-semibold">
                <TrendingUp className="w-4 h-4" />
                <span>Collected directly</span>
              </div>
            </div>

            {/* Fee Remaining */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fee Remaining</span>
              <span className="text-2xl font-bold text-slate-900">PKR {metrics.feeRemaining.toLocaleString('en-PK')}</span>
              <div className="flex items-center gap-1 text-amber-600 mt-3 text-xs font-semibold">
                <Clock className="w-4 h-4" />
                <span>Pending collection</span>
              </div>
            </div>

            {/* Total Students */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Students</span>
              <span className="text-2xl font-bold text-slate-900">{metrics.totalStudents}</span>
              <div className="flex items-center gap-1 text-slate-500 mt-3 text-xs font-semibold">
                <Users className="w-4 h-4" />
                <span>Assigned in my class</span>
              </div>
            </div>
          </section>

          {/* Analytics Graphs */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Donut Present Chart */}
            <div className="lg:col-span-4 bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col items-center justify-center min-h-[320px]">
              <h3 className="text-sm font-semibold text-slate-800 self-start mb-4">Monthly Present %</h3>
              <div className="relative w-44 h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={75}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-slate-900">{monthlyPresentPct}%</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">Present</span>
                </div>
              </div>
            </div>

            {/* Attendance Trends Line Chart */}
            <div className="lg:col-span-8 bg-white rounded-xl p-5 shadow-sm border border-slate-200 flex flex-col min-h-[320px]">
              <h3 className="text-sm font-semibold text-slate-800 mb-4">Monthly Attendance Trends</h3>
              <div className="flex-1 w-full h-full min-h-[220px]">
                {attendanceTrends.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium">
                    No attendance records for the current month yet.
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
                        labelFormatter={(label) => `Date: ${new Date(label).toLocaleDateString('en-PK')}`}
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
            </div>
          </section>

          {/* Student Overview Table */}
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800">Student Overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3.5 w-12 text-center">#</th>
                    <th className="px-6 py-3.5">Student Name</th>
                    <th className="px-6 py-3.5">Registration Number</th>
                    <th className="px-6 py-3.5 text-right">Overall Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">
                        No students assigned to you.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, index) => (
                      <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-center font-mono text-xs text-slate-400 font-bold">{index + 1}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">{student.name}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono whitespace-nowrap">{student.rollNumber}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getBadgeClass(student.attendancePercentage)}`}>
                            {student.attendancePercentage}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
