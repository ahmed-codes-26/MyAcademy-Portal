import { useState, useEffect, useCallback } from 'react';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { CreditCard, Calendar, Check, Loader2, HelpCircle } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = [2025, 2026, 2027, 2028];

export default function TeacherFeePage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const toast = useToast();

  const fetchFees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/teacher/fee?month=${selectedMonth}&year=${selectedYear}`);
      setStudents(res.data);
    } catch {
      toast.error('Failed to load student fee statuses.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, toast]);

  useEffect(() => {
    fetchFees();
  }, [fetchFees]);

  const handleMarkPaid = async (studentId) => {
    setUpdatingId(studentId);
    try {
      await api.post('/teacher/fee/pay', {
        studentId,
        month: selectedMonth,
        year: selectedYear,
      });
      toast.success('Fee marked as paid successfully!');
      // Update local state instead of full refetch for smoother experience
      setStudents((prev) =>
        prev.map((s) => (s._id === studentId ? { ...s, status: 'submitted' } : s))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update fee status.');
    } finally {
      setUpdatingId(null);
    }
  };

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
          <h2 className="text-lg font-bold text-slate-800">Fee Management</h2>
          <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 min-w-0">
          {/* Header & Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">Monthly Fee Overview</h1>
              <p className="text-sm text-slate-500 mt-1">Track and collect tuition payments for your class.</p>
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm self-start sm:self-auto">
              <div className="flex items-center gap-1.5 px-2 text-slate-400">
                <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Period:</span>
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer transition-colors"
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer transition-colors"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Fee Status List Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Assigned Student Billing</h3>
              <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                Billing Month: {MONTHS[selectedMonth]} {selectedYear}
              </span>
            </div>

            <div className="overflow-x-auto max-w-full w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Student Name</th>
                    <th className="px-6 py-4">Registration No.</th>
                    <th className="px-6 py-4 text-center w-40">Fee Status</th>
                    <th className="px-6 py-4 text-right w-48">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12">
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Loading billing records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                        No students enrolled prior to or during {MONTHS[selectedMonth]} {selectedYear}.
                      </td>
                    </tr>
                  ) : (
                    students.map((student) => {
                      const isPaid = student.status === 'submitted';
                      const isUpdating = updatingId === student._id;

                      return (
                        <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-800">
                            {student.name}
                          </td>
                          <td className="px-6 py-4 text-slate-500 font-mono">
                            {student.rollNumber}
                          </td>
                          <td className="px-6 py-4 text-center">
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
                          <td className="px-6 py-4 text-right">
                            <button
                              disabled={isPaid || isUpdating}
                              onClick={() => handleMarkPaid(student._id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                isPaid
                                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                  : 'bg-amber-500 text-white border-transparent hover:bg-amber-600 active:scale-95 shadow-sm'
                              }`}
                            >
                              {isUpdating ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Updating...
                                </>
                              ) : isPaid ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Paid
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Mark as Paid
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
