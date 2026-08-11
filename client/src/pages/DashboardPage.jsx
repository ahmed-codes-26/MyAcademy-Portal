import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/Toast';
import Navbar from '../components/Navbar';
import PasswordRequestCard from '../components/PasswordRequestCard';
import UserTable from '../components/UserTable';
import StudentForm from '../components/StudentForm';
import TeacherForm from '../components/TeacherForm';
import ConfirmDialog from '../components/ConfirmDialog';
import api from '../api/axios';
import { Plus, KeyRound, Users, GraduationCap, BookOpen } from 'lucide-react';

export default function DashboardPage() {
  // View toggle
  const [activeView, setActiveView] = useState('students');

  // Data
  const [passwordRequests, setPasswordRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);

  // Loading states
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  // Modal states
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [showTeacherForm, setShowTeacherForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const toast = useToast();

  // ---------- Data Fetching ----------

  const fetchPasswordRequests = useCallback(async () => {
    try {
      const res = await api.get('/admin/password-requests');
      setPasswordRequests(res.data);
    } catch {
      toast.error('Failed to load password requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [toast]);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await api.get('/students');
      setStudents(res.data);
    } catch {
      toast.error('Failed to load students.');
    }
  }, [toast]);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await api.get('/teachers');
      setTeachers(res.data);
    } catch {
      toast.error('Failed to load teachers.');
    }
  }, [toast]);

  useEffect(() => {
    fetchPasswordRequests();
    Promise.all([fetchStudents(), fetchTeachers()]).finally(() =>
      setLoadingData(false)
    );
  }, [fetchPasswordRequests, fetchStudents, fetchTeachers]);

  // ---------- Password Requests ----------

  const handleResolveRequest = async (id) => {
    try {
      await api.put(`/admin/password-requests/${id}/resolve`);
      toast.success('Request marked as resolved.');
      fetchPasswordRequests();
    } catch {
      toast.error('Failed to resolve request.');
    }
  };

  const handleDeleteRequest = async (id) => {
    try {
      await api.delete(`/admin/password-requests/${id}`);
      toast.success('Request deleted.');
      fetchPasswordRequests();
    } catch {
      toast.error('Failed to delete request.');
    }
  };

  // ---------- Student CRUD ----------

  const handleCreateStudent = async (data) => {
    try {
      const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
      await api.post('/students', data, config);
      toast.success('Student added successfully!');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create student.');
      throw err;
    }
  };

  const handleUpdateStudent = async (data) => {
    try {
      const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
      await api.put(`/students/${editingStudent._id}`, data, config);
      toast.success('Student updated successfully!');
      fetchStudents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update student.');
      throw err;
    }
  };

  // ---------- Teacher CRUD ----------

  const handleCreateTeacher = async (data) => {
    try {
      await api.post('/teachers', data);
      toast.success('Teacher added successfully!');
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create teacher.');
      throw err;
    }
  };

  const handleUpdateTeacher = async (data) => {
    try {
      await api.put(`/teachers/${editingTeacher._id}`, data);
      toast.success('Teacher updated successfully!');
      fetchTeachers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update teacher.');
      throw err;
    }
  };

  // ---------- Delete ----------

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    const { type, item } = deleteTarget;
    try {
      if (type === 'student') {
        await api.delete(`/students/${item._id}`);
        toast.success('Student deleted.');
        fetchStudents();
      } else {
        await api.delete(`/teachers/${item._id}`);
        toast.success('Teacher deleted.');
        fetchTeachers();
      }
    } catch {
      toast.error(`Failed to delete ${type}.`);
    } finally {
      setDeleteTarget(null);
    }
  };

  // ---------- Table Columns ----------

  const studentColumns = [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'name', label: 'Name' },
    {
      key: 'studentClass',
      label: 'Class',
      render: (row) => `Class ${row.studentClass}`,
    },
    {
      key: 'assignedTeacher',
      label: 'Teacher',
      render: (row) => row.assignedTeacher?.name || '—',
    },
    {
      key: 'fees',
      label: 'Fees',
      render: (row) => `PKR ${row.fees?.toLocaleString('en-PK')}`,
    },
    { key: 'phone', label: 'Phone' },
  ];

  const teacherColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'batchName', label: 'Batch' },
  ];

  const pendingRequests = passwordRequests.filter((r) => r.status === 'pending');

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your academy from one place</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ---------- Password Requests Column ---------- */}
          <section className="lg:col-span-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h2 className="text-base font-semibold text-slate-900">Password Requests</h2>
              </div>
              {pendingRequests.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>

            <div className="space-y-3">
              {loadingRequests ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-32" />
                        <div className="h-3 bg-slate-100 rounded w-24" />
                      </div>
                    </div>
                  </div>
                ))
              ) : pendingRequests.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <KeyRound className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-600">All clear!</p>
                  <p className="text-xs text-slate-400 mt-1">No pending password requests</p>
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <PasswordRequestCard
                    key={req._id}
                    request={req}
                    onResolve={handleResolveRequest}
                    onDelete={handleDeleteRequest}
                  />
                ))
              )}
            </div>
          </section>

          {/* ---------- User Management Column ---------- */}
          <section className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Header with toggle */}
              <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  <h2 className="text-base font-semibold text-slate-900">User Management</h2>
                </div>

                <div className="flex items-center gap-3">
                  {/* Toggle */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                      id="toggle-students-btn"
                      onClick={() => setActiveView('students')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        activeView === 'students'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      Students
                    </button>
                    <button
                      id="toggle-teachers-btn"
                      onClick={() => setActiveView('teachers')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        activeView === 'teachers'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Teachers
                    </button>
                  </div>

                  {/* Add button */}
                  <button
                    id="add-user-btn"
                    onClick={() => {
                      if (activeView === 'students') {
                        setEditingStudent(null);
                        setShowStudentForm(true);
                      } else {
                        setEditingTeacher(null);
                        setShowTeacherForm(true);
                      }
                    }}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add {activeView === 'students' ? 'Student' : 'Teacher'}
                  </button>
                </div>
              </div>

              {/* Table */}
              {activeView === 'students' ? (
                <UserTable
                  columns={studentColumns}
                  data={students}
                  loading={loadingData}
                  onEdit={(row) => {
                    setEditingStudent(row);
                    setShowStudentForm(true);
                  }}
                  onDelete={(row) =>
                    setDeleteTarget({ type: 'student', item: row })
                  }
                />
              ) : (
                <UserTable
                  columns={teacherColumns}
                  data={teachers}
                  loading={loadingData}
                  onEdit={(row) => {
                    setEditingTeacher(row);
                    setShowTeacherForm(true);
                  }}
                  onDelete={(row) =>
                    setDeleteTarget({ type: 'teacher', item: row })
                  }
                />
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ---------- Modals ---------- */}

      {showStudentForm && (
        <StudentForm
          student={editingStudent}
          teachers={teachers}
          onSubmit={editingStudent ? handleUpdateStudent : handleCreateStudent}
          onClose={() => {
            setShowStudentForm(false);
            setEditingStudent(null);
          }}
        />
      )}

      {showTeacherForm && (
        <TeacherForm
          teacher={editingTeacher}
          onSubmit={editingTeacher ? handleUpdateTeacher : handleCreateTeacher}
          onClose={() => {
            setShowTeacherForm(false);
            setEditingTeacher(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.type === 'student' ? 'Student' : 'Teacher'}`}
          message={`Are you sure you want to delete "${deleteTarget.item.name}"? This action cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
