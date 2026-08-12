import { useState, useEffect } from 'react';
import { X, Camera, User } from 'lucide-react';

export default function StudentForm({ student, teachers, onSubmit, onClose }) {
  const isEditing = !!student;
  const [form, setForm] = useState({
    name: '',
    studentClass: '',
    assignedTeacher: '',
    fees: '',
    phone: '',
    password: '',
    enrollmentDate: new Date().toISOString().split('T')[0],
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setForm({
        name: student.name || '',
        studentClass: student.studentClass || '',
        assignedTeacher: student.assignedTeacher?._id || student.assignedTeacher || '',
        fees: student.fees?.toString() || '',
        phone: student.phone || '',
        password: '',
        enrollmentDate: student.enrollmentDate ? new Date(student.enrollmentDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      });
      setPreview(student.profilePicture || '');
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('studentClass', form.studentClass.padStart(2, '0'));
      formData.append('assignedTeacher', form.assignedTeacher);
      formData.append('fees', form.fees);
      formData.append('phone', form.phone);
      formData.append('enrollmentDate', form.enrollmentDate);

      if (form.password) {
        formData.append('password', form.password);
      }
      if (file) {
        formData.append('profilePicture', file);
      }

      await onSubmit(formData);
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  // Format fees as PKR for display
  const formatPKR = (value) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return '';
    return `PKR ${num.toLocaleString('en-PK')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-enter" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg modal-enter max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditing ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Profile Picture Upload Avatar */}
          <div className="flex flex-col items-center justify-center pb-2">
            <div className="relative group">
              <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-amber-200 flex items-center justify-center overflow-hidden shadow-sm">
                {preview ? (
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <label
                htmlFor="student-photo-input"
                className="absolute bottom-0 right-0 p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full cursor-pointer shadow-md transition-transform hover:scale-105"
                title="Upload Photo"
              >
                <Camera className="w-4 h-4" />
                <input
                  id="student-photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 mt-2 uppercase tracking-wider">
              Profile Photo (Optional)
            </span>
          </div>

          {/* Roll Number (read-only on edit) */}
          {isEditing && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Roll Number
              </label>
              <input
                type="text"
                value={student.rollNumber}
                disabled
                className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="Enter student name"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
            />
          </div>

          {/* Class and Teacher — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Class <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="studentClass"
                value={form.studentClass}
                onChange={handleChange}
                required
                placeholder="e.g. 09"
                maxLength={2}
                pattern="\d{1,2}"
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Assigned Teacher <span className="text-red-500">*</span>
              </label>
              <select
                name="assignedTeacher"
                value={form.assignedTeacher}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              >
                <option value="">Select teacher</option>
                {teachers.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} — {t.batchName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fees (PKR) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Fees (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="fees"
              value={form.fees}
              onChange={handleChange}
              required
              min="0"
              placeholder="e.g. 5000"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
            />
            {form.fees && (
              <p className="text-xs text-slate-400 mt-1">{formatPKR(form.fees)}</p>
            )}
          </div>

          {/* Phone and Password — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                placeholder="03XX-XXXXXXX"
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Password {isEditing ? <span className="text-slate-400 font-normal normal-case">(leave blank)</span> : <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                required={!isEditing}
                minLength={6}
                placeholder={isEditing ? "Keep current" : "Enter password"}
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Enrollment Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Enrollment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="enrollmentDate"
              value={form.enrollmentDate}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {submitting ? 'Saving...' : isEditing ? 'Update Student' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
