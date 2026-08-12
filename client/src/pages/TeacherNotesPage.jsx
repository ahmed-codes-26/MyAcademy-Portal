import { useState, useEffect, useRef, useCallback } from 'react';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { Upload, FileText, FileSpreadsheet, Presentation, File, Download, Loader2, HelpCircle, AlertCircle, Trash2 } from 'lucide-react';

const CLASS_OPTIONS = ['9th', '10th', '11th', '12th'];
const SUBJECT_OPTIONS = ['Computer Science', 'Mathematics', 'Physics', 'Chemistry', 'English'];

export default function TeacherNotesPage() {
  const { admin } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload Form State
  const [file, setFile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);
  const toast = useToast();

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this study note? This will permanently remove the file from storage.')) {
      return;
    }

    try {
      await api.delete(`/notes/${noteId}`);
      toast.success('Note deleted successfully.');
      setNotes((prev) => prev.filter((n) => n._id !== noteId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete the study note.');
    }
  };

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notes');
      setNotes(res.data);
    } catch {
      toast.error('Failed to load notes library.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Handle file select
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Limit to 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds the 10MB limit.');
        return;
      }

      setFile(selectedFile);
      // Auto-populate displayName with file name minus extension
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setDisplayName(baseName);
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('File size exceeds the 10MB limit.');
        return;
      }
      setFile(selectedFile);
      const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');
      setDisplayName(baseName);
    }
  };

  // Handle Note Submission
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a file to upload.');
      return;
    }
    if (!displayName || !grade || !subject) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('displayName', displayName);
    formData.append('class', grade);
    formData.append('subject', subject);
    formData.append('description', description);

    try {
      const res = await api.post('/notes', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Note uploaded and shared successfully!');
      
      // Update state immediately without refresh
      setNotes((prev) => [res.data, ...prev]);

      // Reset Form State
      setFile(null);
      setDisplayName('');
      setGrade('');
      setSubject('');
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload study note.');
    } finally {
      setUploading(false);
    }
  };

  // Group notes by "Subject - Class Grade"
  const getGroupedNotes = () => {
    const groups = {};
    notes.forEach((note) => {
      const key = `${note.subject} - ${note.class} Grade`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(note);
    });
    return groups;
  };

  // Map file extension to color & icon
  const getFileIconProps = (type) => {
    const cleanType = type.toLowerCase();
    if (cleanType === 'pdf') {
      return { icon: FileText, bg: 'bg-red-50', text: 'text-red-500', label: 'PDF' };
    }
    if (['doc', 'docx'].includes(cleanType)) {
      return { icon: File, bg: 'bg-blue-50', text: 'text-blue-500', label: 'DOCX' };
    }
    if (['ppt', 'pptx'].includes(cleanType)) {
      return { icon: Presentation, bg: 'bg-orange-50', text: 'text-orange-500', label: 'PPTX' };
    }
    if (['xls', 'xlsx', 'csv'].includes(cleanType)) {
      return { icon: FileSpreadsheet, bg: 'bg-emerald-50', text: 'text-emerald-500', label: 'SHEET' };
    }
    return { icon: File, bg: 'bg-slate-50', text: 'text-slate-500', label: type.toUpperCase() };
  };

  const groupedNotes = getGroupedNotes();

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
          <h2 className="text-lg font-bold text-slate-800">Study Notes Repository</h2>
          <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 space-y-6 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Course Notes & Resources</h1>
            <p className="text-sm text-slate-500 mt-1">Manage and distribute study materials across your classes.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            
            {/* Left Column: Note Upload Form (4/12 cols) */}
            <div className="xl:col-span-4 flex flex-col">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col h-fit sticky top-20">
                <div className="flex items-center gap-2 mb-6">
                  <Upload className="w-5 h-5 text-amber-500 shrink-0" />
                  <h3 className="text-lg font-bold text-slate-800">Upload New Note</h3>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {/* Drag and Drop Zone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                      dragActive
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-slate-200 hover:bg-slate-50/50'
                    }`}
                  >
                    <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-amber-500' : 'text-slate-400'}`} />
                    {file ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-800 truncate max-w-[220px]">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-700">
                          Click to upload or drag & drop
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          PDF, DOCX, PPTX, or Sheets (max 10MB)
                        </p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                    />
                  </div>

                  {/* Note Title */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      File Name to Show
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Algorithms Lecture 1"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:border-amber-500 focus:bg-white outline-none transition-colors"
                    />
                  </div>

                  {/* Class and Subject */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Class
                      </label>
                      <select
                        required
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                      >
                        <option value="">Select...</option>
                        {CLASS_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c} Grade</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Subject
                      </label>
                      <select
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                      >
                        <option value="">Select...</option>
                        {SUBJECT_OPTIONS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      placeholder="Brief details about the resource..."
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:border-amber-500 focus:bg-white outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading to Storage...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Note
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Column: Shared Notes Directory (8/12 cols) */}
            <div className="xl:col-span-8 flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 bg-slate-50">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Shared Notes Repository
                </h3>
              </div>

              {loading ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 flex items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Loading notes directory...</span>
                </div>
              ) : Object.keys(groupedNotes).length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center flex flex-col items-center gap-2">
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                  <h4 className="font-bold text-slate-800">No Shared Notes Found</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    No documents have been uploaded to the study pool yet. Be the first to share resources with other teachers!
                  </p>
                </div>
              ) : (
                Object.keys(groupedNotes).map((groupName) => (
                  <div key={groupName} className="space-y-3">
                    {/* Group Header */}
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                        {groupName}
                      </h4>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupedNotes[groupName].map((note) => {
                        const iconProps = getFileIconProps(note.fileType);
                        const IconComponent = iconProps.icon;

                        return (
                          <div
                            key={note._id}
                            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start gap-4 hover:border-amber-500/50 transition-all group"
                          >
                            {/* File Type Color Indicator Icon */}
                            <div className={`w-10 h-10 rounded-lg ${iconProps.bg} ${iconProps.text} flex items-center justify-center shrink-0`}>
                              <IconComponent className="w-5 h-5" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <h5 className="font-bold text-slate-800 truncate group-hover:text-amber-600 transition-colors leading-snug">
                                {note.displayName}
                              </h5>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                Uploaded by: {note.uploadedBy?.name || 'Instructor'}
                              </p>
                              {note.description && (
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">
                                  {note.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded tracking-wide">
                                  {iconProps.label}
                                </span>
                                <span className="text-[9px] font-semibold text-slate-400">
                                  {note.fileSize}
                                </span>
                              </div>
                            </div>

                             {/* Actions Container */}
                             <div className="flex items-center gap-1 shrink-0">
                               {/* Download Action Trigger */}
                               <a
                                 href={`/api/notes/${note._id}/download`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="text-slate-400 hover:text-amber-500 p-2 rounded-full hover:bg-slate-50 transition-colors"
                                 title="Download note"
                               >
                                 <Download className="w-4 h-4" />
                               </a>

                               {/* Conditional Delete Trigger */}
                               {admin && note.uploadedBy && (note.uploadedBy._id === admin._id || note.uploadedBy === admin._id) && (
                                 <button
                                   type="button"
                                   onClick={() => handleDeleteNote(note._id)}
                                   className="text-slate-400 hover:text-rose-600 p-2 rounded-full hover:bg-slate-50 transition-colors"
                                   title="Delete note"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               )}
                             </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
