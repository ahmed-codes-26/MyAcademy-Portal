import { useState, useEffect, useRef, useCallback } from 'react';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { ChevronLeft, ChevronRight, Check, Edit2, Calendar, HelpCircle, Loader2, Trash2 } from 'lucide-react';

export default function TeacherAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [students, setStudents] = useState([]);
  const [attendanceDates, setAttendanceDates] = useState([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingAttendance, setDeletingAttendance] = useState(false);

  const toast = useToast();

  // Format date to local YYYY-MM-DD
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleResetAttendance = async () => {
    const dateStr = formatLocalDate(selectedDate);
    if (
      !window.confirm(
        `Are you sure you want to delete and reset the attendance record for ${dateStr}? This will clear all recorded entries for this date so you can take attendance fresh.`
      )
    ) {
      return;
    }

    setDeletingAttendance(true);
    try {
      await api.delete(`/teacher/attendance?date=${dateStr}`);
      toast.success('Attendance record reset successfully!');
      setIsSubmitted(false);
      setIsEditing(true);
      fetchAttendanceDates();
      fetchAttendance();
    } catch {
      toast.error('Failed to reset attendance record.');
    } finally {
      setDeletingAttendance(false);
    }
  };

  // Fetch dates with submitted attendance
  const fetchAttendanceDates = useCallback(async () => {
    try {
      const res = await api.get('/teacher/attendance-dates');
      setAttendanceDates(res.data);
    } catch {
      toast.error('Failed to load attendance dates.');
    }
  }, [toast]);

  // Fetch daily attendance record
  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    const dateStr = formatLocalDate(selectedDate);
    try {
      const res = await api.get(`/teacher/attendance?date=${dateStr}`);
      setStudents(res.data.students);
      setIsSubmitted(res.data.isSubmitted);
      setIsEditing(!res.data.isSubmitted); // If not submitted, default to edit mode
    } catch {
      toast.error('Failed to load student list.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

  useEffect(() => {
    fetchAttendanceDates();
  }, [fetchAttendanceDates]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Toggles the Present/Absent switch
  const handleToggleStatus = (studentId) => {
    if (!isEditing) return;
    setStudents((prev) =>
      prev.map((s) => {
        if (s._id === studentId) {
          // Toggle between present and absent (or reset from leave)
          const nextStatus = s.status === 'present' ? 'absent' : 'present';
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  // Marks a student on leave
  const handleMarkLeave = (studentId) => {
    if (!isEditing) return;
    setStudents((prev) =>
      prev.map((s) => {
        if (s._id === studentId) {
          // If already on leave, toggle back to present
          const nextStatus = s.status === 'leave' ? 'present' : 'leave';
          return { ...s, status: nextStatus };
        }
        return s;
      })
    );
  };

  // Submits daily attendance
  const handleSaveAttendance = async () => {
    setSubmitting(true);
    const dateStr = formatLocalDate(selectedDate);
    const records = students.map((s) => ({
      studentId: s._id,
      status: s.status,
    }));

    try {
      await api.post('/teacher/attendance', { date: dateStr, records });
      toast.success('Attendance saved successfully!');
      setIsEditing(false);
      setIsSubmitted(true);
      fetchAttendanceDates();
      fetchAttendance();
    } catch {
      toast.error('Failed to save attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Calendar Grid Generation ----------

  const handlePrevMonth = () => {
    setCurrentCalendarMonth(
      new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() - 1, 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentCalendarMonth(
      new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 1)
    );
  };

  const year = currentCalendarMonth.getFullYear();
  const month = currentCalendarMonth.getMonth();

  // First day of current calendar month
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Total days in current calendar month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Total days in previous calendar month (for padding)
  const totalPrevDays = new Date(year, month, 0).getDate();

  const calendarDays = [];

  // Padding days from previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, totalPrevDays - i);
    calendarDays.push({ date: prevDate, isCurrentMonth: false });
  }

  // Days in current month
  for (let i = 1; i <= totalDays; i++) {
    const currDate = new Date(year, month, i);
    calendarDays.push({ date: currDate, isCurrentMonth: true });
  }

  // Padding days from next month to fill grid
  const remainingCells = 42 - calendarDays.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextDate = new Date(year, month + 1, i);
    calendarDays.push({ date: nextDate, isCurrentMonth: false });
  }

  const monthName = currentCalendarMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedDateFormatted = selectedDate.toLocaleDateString('en-PK', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const isTodaySelected = formatLocalDate(selectedDate) === formatLocalDate(new Date());

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
          <h2 className="text-lg font-bold text-slate-800">Attendance Management</h2>
          <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 min-w-0">
          {/* Calendar and Header Controls Row */}
          <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
            {/* Left Header Info */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selected Date</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-900 leading-none">
                  {isTodaySelected ? 'Today' : selectedDateFormatted}
                  {!isTodaySelected && (
                    <span className="text-sm font-semibold text-slate-400 block sm:inline sm:ml-2">
                      ({selectedDate.toLocaleDateString('en-PK')})
                    </span>
                  )}
                </h1>

                {/* Action Buttons when Submitted */}
                {isSubmitted && (
                  <div className="flex flex-wrap items-center gap-2">
                    {!isEditing && (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold rounded-lg transition-colors shadow-sm w-fit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit Attendance
                      </button>
                    )}
                    <button
                      onClick={handleResetAttendance}
                      disabled={deletingAttendance}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors shadow-sm w-fit disabled:opacity-50"
                    >
                      {deletingAttendance ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      Reset Attendance
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Calendar Widget (Top Right) */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 w-full lg:w-[320px] shrink-0">
              <div className="flex justify-between items-center mb-3">
                <button
                  onClick={handlePrevMonth}
                  className="p-1 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h4 className="text-sm font-bold text-slate-700">{monthName}</h4>
                <button
                  onClick={handleNextMonth}
                  className="p-1 hover:bg-slate-50 rounded-lg text-slate-500 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                  <div key={day} className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {day}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium">
                {calendarDays.map(({ date, isCurrentMonth }, index) => {
                  const dateStr = formatLocalDate(date);
                  const isSelected = formatLocalDate(selectedDate) === dateStr;
                  const hasAttendance = attendanceDates.includes(dateStr);
                  const isToday = formatLocalDate(new Date()) === dateStr;

                  return (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedDate(date);
                        // Shift calendar view month if padding date clicked
                        if (!isCurrentMonth) {
                          setCurrentCalendarMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                        }
                      }}
                      className={`relative aspect-square rounded-full flex flex-col items-center justify-center p-1 transition-all ${
                        !isCurrentMonth ? 'text-slate-300' : 'text-slate-700 hover:bg-slate-100'
                      } ${
                        isSelected
                          ? 'bg-amber-500 text-white font-bold hover:bg-amber-600 shadow-sm'
                          : isToday
                          ? 'border border-amber-500 text-amber-600 font-semibold'
                          : ''
                      }`}
                    >
                      <span>{date.getDate()}</span>
                      {hasAttendance && (
                        <span
                          className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                            isSelected ? 'bg-white' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Student List Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800">Student List</h3>
              <span className="bg-amber-50 text-amber-700 border border-amber-100 px-3 py-1 rounded-full text-xs font-semibold shadow-sm">
                Total Class Students: {students.length}
              </span>
            </div>

            <div className="overflow-x-auto max-w-full w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-3.5 w-12 text-center">#</th>
                    <th className="px-6 py-3.5">Student Details</th>
                    <th className="px-6 py-3.5 text-center w-40">Status</th>
                    <th className="px-6 py-3.5 text-right w-48">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10">
                        <div className="flex items-center justify-center gap-2 text-slate-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Loading student rosters...</span>
                        </div>
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-slate-400 font-medium">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, index) => {
                      const isPresent = student.status === 'present';
                      const isLeave = student.status === 'leave';

                      return (
                        <tr key={student._id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-3.5 text-center font-mono text-xs text-slate-400 font-bold">
                            {index + 1}
                          </td>
                          {/* Student Info */}
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm border border-amber-100">
                                {getInitials(student.name)}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{student.name}</p>
                                <p className="text-xs text-slate-400 font-mono mt-0.5">{student.rollNumber}</p>
                              </div>
                            </div>
                          </td>

                          {/* Present/Absent Status Switch */}
                          <td className="px-6 py-3.5 text-center">
                            <button
                              disabled={!isEditing || isLeave}
                              onClick={() => handleToggleStatus(student._id)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                isLeave
                                  ? 'bg-blue-200'
                                  : isPresent
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  isPresent && !isLeave ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                              {isLeave ? 'On Leave' : isPresent ? 'Present' : 'Absent'}
                            </span>
                          </td>

                          {/* Action Button */}
                          <td className="px-6 py-3.5 text-right">
                            <button
                              disabled={!isEditing}
                              onClick={() => handleMarkLeave(student._id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                isLeave
                                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {isLeave ? 'Unmark Leave' : 'Mark on Leave'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Submission Footer */}
            {isEditing && students.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={handleSaveAttendance}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-bold px-6 py-2.5 rounded-lg transition-colors shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving Attendance...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Attendance
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
