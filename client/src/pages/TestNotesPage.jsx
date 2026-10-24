import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Pin, PinOff, Trash2, LayoutGrid, List, X, StickyNote, RefreshCw } from 'lucide-react';
import { useToast } from '../context/toast';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import './TestNotesPage.css';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const displayDate = (date) => date.split('-').reverse().join('-');
const blankNote = () => ({ date: today(), title: '', content: '', pinned: false });

function NoteEditor({ note, onClose, onSaved }) {
  const dialog = useRef(null);
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current.showModal(); }, []);
  const change = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));
  const close = () => {
    if (saving) return;
    if (JSON.stringify(note) !== JSON.stringify(draft) && !window.confirm('Discard unsaved changes?')) return;
    onClose();
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const body = { date: draft.date, title: draft.title, content: draft.content, pinned: draft.pinned };
      if (note._id) await api.put(`/test-notes/${note._id}`, body);
      else await api.post('/test-notes', body);
      onSaved();
    } catch (err) { setError(err.response?.data?.message || 'Could not save. Your text is still here; please try again.'); }
    finally { setSaving(false); }
  };
  return (
    <dialog ref={dialog} className="test-note-editor" aria-labelledby="note-editor-heading"
      onCancel={(event) => { event.preventDefault(); close(); }}>
      <form onSubmit={save}>
        <div className="test-note-editor-top">
          <h2 id="note-editor-heading">{note._id ? 'Edit note' : 'New note'}</h2>
          <button type="button" className="note-icon" aria-label="Close editor" onClick={close} disabled={saving}><X size={22} /></button>
        </div>
        <div className="test-note-date-row">
          <label>Date <input type="date" aria-label="Note date" required value={draft.date}
            onChange={(e) => change('date', e.target.value)} /></label>
          <button type="button" className="note-icon" aria-label={draft.pinned ? 'Unpin note' : 'Pin note'}
            aria-pressed={draft.pinned} onClick={() => change('pinned', !draft.pinned)}><Pin size={23} fill={draft.pinned ? 'currentColor' : 'none'} /></button>
        </div>
        <input className="test-note-title-input" aria-label="Note title" placeholder={displayDate(draft.date || today())}
          maxLength={120} value={draft.title} onChange={(e) => change('title', e.target.value)} />
        <textarea aria-label="Note text" autoFocus placeholder="Take a note…" maxLength={20000}
          value={draft.content} onChange={(e) => change('content', e.target.value)} />
        {error && <p className="test-note-error" role="alert">{error}</p>}
        <div className="test-note-editor-actions">
          <span>{draft.content.length.toLocaleString()} / 20,000</span>
          <button type="button" onClick={close} disabled={saving}>Cancel</button>
          <button type="submit" disabled={saving || !(draft.title.trim() || draft.content.trim())}>{saving ? 'Saving…' : 'Save note'}</button>
        </div>
      </form>
    </dialog>
  );
}

export default function TestNotesPage() {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [list, setList] = useState(false);
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const reload = useCallback(() => { setPage(1); setRevision((value) => value + 1); }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/test-notes', { params: { q: search, ...(date ? { date } : {}), page }, signal: controller.signal });
        setNotes((prev) => page === 1 ? response.data.notes : [...prev, ...response.data.notes]);
        setHasMore(response.data.hasMore);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.response?.data?.message || 'Could not load your notes. Please retry.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, date, page, revision]);

  const pin = async (note) => {
    setBusy(note._id);
    try { await api.put(`/test-notes/${note._id}`, { pinned: !note.pinned }); reload(); }
    catch { toast.error('Could not update note. Please retry.'); }
    finally { setBusy(''); }
  };
  const remove = async (note) => {
    if (!window.confirm(`Delete note “${note.title || displayDate(note.date)}”? This cannot be undone.`)) return;
    setBusy(note._id);
    try { await api.delete(`/test-notes/${note._id}`); reload(); toast.success('Note deleted.'); }
    catch { toast.error('Could not delete note. Please retry.'); }
    finally { setBusy(''); }
  };

  const card = (note) => (
    <article className="test-note-card" key={note._id} data-note-id={note._id}>
      <button className="test-note-open" aria-label={`Edit ${note.title || displayDate(note.date)}`} onClick={() => setEditor(note)}>
        <h2>{note.title || displayDate(note.date)}</h2>
        {note.title && <time dateTime={note.date}>{displayDate(note.date)}</time>}
        <p>{note.content}</p>
      </button>
      <button className="note-icon test-note-pin" aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
        disabled={busy === note._id} aria-pressed={note.pinned} onClick={() => pin(note)}>
        {note.pinned ? <PinOff size={23} /> : <Pin size={23} />}
      </button>
      <div className="test-note-card-actions"><button className="note-icon" aria-label={`Delete ${note.title || displayDate(note.date)}`}
        disabled={busy === note._id} onClick={() => remove(note)}><Trash2 size={19} /></button></div>
    </article>
  );
  const pinned = notes.filter((note) => note.pinned);
  const others = notes.filter((note) => !note.pinned);

  return (
    <div className="min-h-screen bg-slate-50">
      <TeacherSidebar />
      <div className="lg:ml-[260px]">
        <MobileHeader />
        <header className="hidden lg:flex h-16 sticky top-0 z-30 items-center bg-white border-b border-slate-200 px-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Test notes</h2>
        </header>
        <main className="test-notes-workspace">
          <header className="test-notes-toolbar">
            <div className="test-notes-heading"><h1><StickyNote size={25} /> Test notes</h1><p>Plan student tests and keep every assignment in order.</p></div>
            <div className="test-notes-search"><Search size={21} /><input aria-label="Search notes" placeholder="Search notes or date (DD-MM-YYYY)"
              maxLength={120} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
            <label className="test-notes-filter">Date <input type="date" aria-label="Filter by date" value={date}
              onChange={(e) => { setDate(e.target.value); setPage(1); }} /></label>
            {(date || search) && <button className="note-icon" aria-label="Clear filters" onClick={() => { setSearch(''); setDate(''); setPage(1); }}><X size={21} /></button>}
            <button className="note-icon" aria-label={list ? 'Grid view' : 'List view'} onClick={() => setList(!list)}>{list ? <LayoutGrid size={23} /> : <List size={23} />}</button>
          </header>
          <button className="test-notes-composer" onClick={() => setEditor(blankNote())}><span>Take a note…</span><StickyNote size={25} /></button>
          <div className="test-notes-status" role="status">{loading ? 'Loading notes…' : error ? '' : `${notes.length}${hasMore ? '+' : ''} notes · Newest dates first`}</div>
          {error && <div className="test-note-error" role="alert">{error} <button onClick={reload}><RefreshCw size={16} /> Retry</button></div>}
          {!error && !loading && notes.length === 0 && <div className="test-notes-empty"><StickyNote size={55} /><p>{search || date ? 'No notes match your search.' : 'Your test notes will appear here.'}</p></div>}
          {pinned.length > 0 && <><h2 className="test-notes-section">PINNED</h2><div className={`test-notes-grid ${list ? 'is-list' : ''}`}>{pinned.map(card)}</div></>}
          {others.length > 0 && <>{pinned.length > 0 && <h2 className="test-notes-section">OTHERS</h2>}<div className={`test-notes-grid ${list ? 'is-list' : ''}`}>{others.map(card)}</div></>}
          {hasMore && !error && <button className="test-notes-more" disabled={loading} onClick={() => setPage((value) => value + 1)}>{loading ? 'Loading…' : 'Load more notes'}</button>}
        </main>
      </div>
      {editor && <NoteEditor note={editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); reload(); toast.success('Note saved.'); }} />}
    </div>
  );
}
