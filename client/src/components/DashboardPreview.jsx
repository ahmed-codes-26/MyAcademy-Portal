import { useState } from 'react';
const dashboards = [
  ['teacher', 'Teacher', 'Teacher dashboard with attendance, fee summaries, class statistics, and teaching tools. Private records are masked.'],
  ['student', 'Student', 'Student dashboard with attendance summary, fee status, and study-note access. Private records are masked.'],
  ['admin', 'Administrator', 'Administrator dashboard with student and teacher account management. Private records are masked.'],
];
export default function DashboardPreview() {
  const [selected, setSelected] = useState('teacher');
  const [role, label, description] = dashboards.find(([key]) => key === selected);
  return <div className="hero-visual dashboard-preview" id="preview">
    <div className="preview-label"><span className="preview-dot" /> A LOOK INSIDE <span>The real portal</span></div>
    <div className="preview-controls" role="group" aria-label="Choose a dashboard preview">
      {dashboards.map(([key, title]) => <button key={key} type="button" aria-pressed={selected === key} aria-controls="dashboard-preview-image" onClick={() => setSelected(key)}>{title}</button>)}
    </div>
    <figure>
      <a href={`/previews/${role}-1920.webp`} target="_blank" rel="noopener noreferrer" aria-label={`View full-size ${label.toLowerCase()} dashboard screenshot (opens in a new tab)`}>
        <img key={role} id="dashboard-preview-image" src={`/previews/${role}-1280.webp`} srcSet={`/previews/${role}-640.webp 640w, /previews/${role}-1280.webp 1280w, /previews/${role}-1920.webp 1918w`} sizes="(max-width: 700px) calc(100vw - 76px), (max-width: 1000px) 50vw, 660px" width="1918" height="874" alt={description} fetchPriority={role === 'teacher' ? 'high' : 'auto'} decoding="async" />
      </a>
      <figcaption className="preview-caption"><span aria-live="polite">{label} workspace</span><a href={`/previews/${role}-1920.webp`} target="_blank" rel="noopener noreferrer">View full size ↗<span className="sr-only"> (opens in a new tab)</span></a></figcaption>
    </figure>
    <p className="preview-disclaimer">Actual dashboard screenshots. Personal details and private records are masked.</p>
  </div>;
}
