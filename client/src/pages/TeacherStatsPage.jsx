import { useState, useEffect, useCallback } from 'react';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, CheckCircle2, XCircle, ShieldAlert, Loader2, HelpCircle } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = [2025, 2026, 2027, 2028];

export default function TeacherStatsPage() {
  const currentDate = new Date();
  
  // Single Student Stats State
  const [studentList, setStudentList] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [statsMonth, setStatsMonth] = useState('all'); // 'all' or 0-11
  const [statsYear, setStatsYear] = useState(currentDate.getFullYear());
  const [studentStats, setStudentStats] = useState(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Class Overview Stats State
  const [classMonth, setClassMonth] = useState(currentDate.getMonth()); // 0-11
  const [classYear, setClassYear] = useState(currentDate.getFullYear());
  const [classOverview, setClassOverview] = useState([]);
  const [loadingClass, setLoadingClass] = useState(true);

  const toast = useToast();

  // Fetch student directory for dropdown
  const fetchStudentList = useCallback(async () => {
    try {
      const res = await api.get('/teacher/stats/students');
      setStudentList(res.data);
      if (res.data.length > 0) {
        setSelectedStudentId(res.data[0]._id);
      }
    } catch {
      toast.error('Failed to load student list.');
    }
  }, [toast]);

  // Fetch individual student stats overview
  const fetchStudentStats = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoadingStudent(true);
    try {
      let url = `/teacher/stats/overview?studentId=${selectedStudentId}`;
      if (statsMonth !== 'all') {
        url += `&month=${statsMonth}&year=${statsYear}`;
      }
      const res = await api.get(url);
      setStudentStats(res.data);
    } catch {
      toast.error('Failed to calculate student statistics.');
    } finally {
      setLoadingStudent(false);
    }
  }, [selectedStudentId, statsMonth, statsYear, toast]);

  // Fetch class overview stats table
  const fetchClassOverview = useCallback(async () => {
    setLoadingClass(true);
    try {
      const res = await api.get(`/teacher/stats/class?month=${classMonth}&year=${classYear}`);
      setClassOverview(res.data);
    } catch {
      toast.error('Failed to load class statistics.');
    } finally {
      setLoadingClass(false);
    }
  }, [classMonth, classYear, toast]);

  useEffect(() => {
    fetchStudentList();
  }, [fetchStudentList]);

  useEffect(() => {
    fetchStudentStats();
  }, [fetchStudentStats]);

  useEffect(() => {
    fetchClassOverview();
  }, [fetchClassOverview]);

  // Filter students for search dropdown
  const filteredSearchStudents = studentList.filter((s) =>
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Setup donut chart data
  const pct = studentStats?.attendancePercentage || 0;
  const chartData = [
    { name: 'Present', value: pct },
    { name: 'Absent', value: 100 - pct },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex w-full max-w-full overflow-x-hidden">
      {/* Sidebar Navigation */}
      <TeacherSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-[260px] max-w-full">
        {/* Mobile Header */}
        <MobileHeader />

        {/* Desktop Top Header */}
        <header className="bg-white sticky top-0 z-30 w-full border-b border-slate-200 shadow-sm hidden lg:flex justify-between items-center px-6 h-16">
          <h2 className="text-lg font-bold text-slate-800">Attendance & Fee Stats</h2>
          <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 space-y-8 min-w-0">
          
          {/* Section 1: Single Student Overview (Bento Grid) */}
          <section className="space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Single Student Profile Bento</h2>
            </div>

            {/* Selector Filters Row */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              
              {/* Searchable Dropdown for Student Selection */}
              <div className="w-full lg:w-[350px]">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Select Student
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Type name or roll number..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 outline-none focus:border-amber-500 focus:bg-white transition-all"
                    />
                  </div>
                  
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 outline-none cursor-pointer max-w-[200px]"
                  >
                    {filteredSearchStudents.length === 0 ? (
                      <option value="">No matches</option>
                    ) : (
                      filteredSearchStudents.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} ({s.rollNumber})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Month/Year Period Dropdowns */}
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Month Filter
                  </label>
                  <select
                    value={statsMonth}
                    onChange={(e) => setStatsMonth(e.target.value)}
                    className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer transition-colors"
                  >
                    <option value="all">All Time History</option>
                    {MONTHS.map((m, idx) => (
                      <option key={idx} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>

                {statsMonth !== 'all' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Year
                    </label>
                    <select
                      value={statsYear}
                      onChange={(e) => setStatsYear(Number(e.target.value))}
                      className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer transition-colors"
                    >
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Bento Grid */}
            {loadingStudent ? (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Recalculating profile stats...</span>
              </div>
            ) : studentStats?.notEnrolledYet ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-2">
                <ShieldAlert className="w-10 h-10 text-amber-500" />
                <h3 className="font-bold text-slate-800">Not Enrolled Yet</h3>
                <p className="text-sm text-slate-500 max-w-md">
                  This student's enrollment date occurs after the selected period. In accordance with school rules, their statistics are locked.
                </p>
              </div>
            ) : studentStats ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Large Card 1: Attendance Percentage Donut Chart */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center min-h-[220px]">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-center w-full mb-4">
                    Total Attendance Rate ({statsMonth === 'all' ? 'All Time' : `${MONTHS[statsMonth]} ${statsYear}`})
                  </h3>
                  <div className="relative w-36 h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius={50}
                          outerRadius={65}
                          paddingAngle={0}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill={pct >= 75 ? '#f59e0b' : '#ef4444'} />
                          <Cell fill="#f1f5f9" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-slate-800 leading-none">{pct}%</span>
                    </div>
                  </div>
                </div>

                {/* Small Card 2: Total Presents */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Presents</span>
                  <span className="text-3xl font-extrabold text-slate-800">{studentStats.totalPresents}</span>
                </div>

                {/* Small Card 3: Total Absents */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-3">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Absents</span>
                  <span className="text-3xl font-extrabold text-slate-800">{studentStats.totalAbsents}</span>
                </div>

                {/* Medium Card 4: Fee Status */}
                <div className="md:col-span-2 md:col-start-3 bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Fee Status ({statsMonth === 'all' ? MONTHS[currentDate.getMonth()] : MONTHS[statsMonth]} {statsMonth === 'all' ? currentDate.getFullYear() : statsYear})
                  </span>
                  <span
                    className={`px-6 py-2 rounded-full text-base font-extrabold shadow-sm tracking-wider uppercase ${
                      studentStats.feeStatus === 'submitted'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {studentStats.feeStatus === 'submitted' ? 'SUBMITTED' : 'PENDING'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-slate-400">
                Select a student to display metrics.
              </div>
            )}
          </section>

          {/* Section 2: Class Overview Table */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">All Students Overview</h2>
              
              {/* Dropdown Filters for Class Table */}
              <div className="flex items-center gap-2.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm self-start sm:self-auto">
                <select
                  value={classMonth}
                  onChange={(e) => setClassMonth(Number(e.target.value))}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer transition-colors"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <select
                  value={classYear}
                  onChange={(e) => setClassYear(Number(e.target.value))}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md px-2 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer transition-colors"
                >
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Class Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto max-w-full w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4 w-12 text-center">#</th>
                      <th className="px-6 py-4">Student Name</th>
                      <th className="px-6 py-4">Registration No.</th>
                      <th className="px-6 py-4">Attendance %</th>
                      <th className="px-6 py-4 w-40">Fee Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loadingClass ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12">
                          <div className="flex items-center justify-center gap-2 text-slate-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading class stats...</span>
                          </div>
                        </td>
                      </tr>
                    ) : classOverview.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium">
                          No students enrolled prior to or during {MONTHS[classMonth]} {classYear}.
                        </td>
                      </tr>
                    ) : (
                      classOverview.map((student, index) => {
                        const isPaid = student.feeStatus === 'submitted';
                        const attPct = student.attendancePercentage;

                        return (
                          <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-center font-mono text-xs text-slate-400 font-bold">
                              {index + 1}
                            </td>
                            <td className="px-6 py-4 font-semibold text-slate-800">
                              {student.name}
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono">
                              {student.rollNumber}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <span className="w-8 font-bold text-slate-700">{attPct}%</span>
                                <div className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                      attPct >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${attPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                    : 'bg-rose-50 text-rose-700 border border-rose-100'
                                }`}
                              >
                                {isPaid ? 'Submitted' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
}
