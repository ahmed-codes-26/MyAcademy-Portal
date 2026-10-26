import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowRight, BookOpen, CalendarCheck, Wallet, Users, GraduationCap, ShieldCheck } from 'lucide-react';
import logo from '../assets/logo.svg';
import { startPublicAnalytics, trackPortalAccess } from '../utils/publicAnalytics';
import './HomePage.css';
import PublicAnalyticsConsent from '../components/PublicAnalyticsConsent';
import DashboardPreview from '../components/DashboardPreview';
import HomeFaq from '../components/HomeFaq';

const features = [
  [CalendarCheck, 'Attendance, kept in order', 'Teachers record attendance for their classes. Students can look back at their own attendance history.'],
  [Wallet, 'A clearer view of monthly fees', 'Teachers manage monthly fee records and payments. Students can check their fee status from their dashboard.'],
  [BookOpen, 'Study materials in one place', 'Teachers share class materials by subject, so students can find and download the notes available to them.'],
  [Users, 'Accounts with the right access', 'Administrators manage student and teacher accounts, assignments, and password-reset requests. Each role has its own workspace.'],
];
const roles = [
  ['student', GraduationCap, 'For students', 'Stay connected to your learning.', 'Check attendance, review fee status, and find your class study notes.', 'Use your registration number and password.'],
  ['teacher', BookOpen, 'For teachers', 'Keep the everyday work together.', 'Record attendance, manage monthly fees, share study materials, and review class statistics.', 'Use your teacher email and password.'],
  ['admin', ShieldCheck, 'For administrators', 'Give your academy a clear structure.', 'Manage student and teacher accounts, teacher assignments, and password-reset requests.', 'Use your administrator email and password.'],
];
const faqs = [
  ['What is MyAcademy Portal?', 'MyAcademy Portal is a tuition-center management portal for administrators, teachers, and students. It brings account management, attendance, monthly fees, and class study materials into role-specific dashboards.'],
  ['How do I get an account?', 'Accounts are managed by your academy’s administrator. Ask them for your account details. There is no public self-registration.'],
  ['How do I sign in?', 'Open the portal and select Student, Teacher, or Admin. Students sign in with a registration number and password. Teachers and administrators use their email address and password.'],
  ['What if I forget my password?', 'Choose “Forgot Password?” on the login page and submit your registration number or email address. An administrator reviews the request and helps restore access.'],
  ['Can students see other students’ records?', 'The student dashboard shows the signed-in student’s own attendance and fee information. Study materials are made available according to class access.'],
  ['Does the portal support WhatsApp alerts?', 'Teachers can connect a WhatsApp account from their dashboard for attendance alerts. A linked, connected account is required for alerts to work.'],
];

function PortalLink({ children, role, placement, className = '' }) {
  return <a className={className} href={role ? `/login?role=${role}` : '/login'} onClick={() => trackPortalAccess(placement, role)}>{children}<ArrowUpRight size={18} aria-hidden="true" /></a>;
}

export default function HomePage() {
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    document.documentElement.classList.add('public-home-scroll');
    return () => document.documentElement.classList.remove('public-home-scroll');
  }, []);
  useEffect(() => {
    // Only decide whether to offer a shortcut; /portal validates the actual session.
    try { setReturning(Boolean(localStorage.getItem('token'))); } catch { /* Storage may be unavailable. */ }
    return startPublicAnalytics();
  }, []);
  return <div className="public-home">
    <a className="home-skip" href="#main-content">Skip to content</a>
    <header className="home-header home-wrap">
      <a href="/" className="home-brand" aria-label="MyAcademy Portal home"><img src={logo} width="44" height="44" alt="" /><span>MyAcademy<span className="brand-sub">PORTAL</span></span></a>
      <nav aria-label="Main navigation"><a href="#features">Features</a><a href="#roles">Who it’s for</a><a href="#about">About</a><a href="#faq">FAQs</a></nav>
      {returning ? <a className="home-button small" href="/portal" onClick={() => trackPortalAccess('header', 'returning')}>My dashboard <ArrowUpRight size={17} aria-hidden="true" /></a> : <PortalLink className="home-button small" placement="header">Open portal</PortalLink>}
    </header>
    <main id="main-content">
      <section className="home-hero home-wrap">
        <div className="hero-copy"><p className="home-eyebrow"><span /> ONE ACADEMY. THREE CONNECTED WORKSPACES.</p>
          <h1>Less admin.<br />More room<br />for <span>learning.</span></h1>
          <p className="hero-description">Your academy’s everyday work, brought together. Manage attendance, monthly fees, and study materials in a portal built for administrators, teachers, and students.</p>
          <div className="hero-actions"><PortalLink className="home-button" placement="hero">Enter your portal</PortalLink><a className="home-text-link" href="#preview">Take a look inside <ArrowRight size={17} aria-hidden="true" /></a></div>
          <p className="hero-note"><ShieldCheck size={16} aria-hidden="true" /> Your role. Your workspace. Your academy.</p>
        </div>
        <DashboardPreview />
      </section>
      <div className="home-strip"><div className="home-wrap"><span>THE EVERYDAY ESSENTIALS</span><p><CalendarCheck size={19} /> Attendance</p><p><Wallet size={19} /> Monthly fees</p><p><BookOpen size={19} /> Study materials</p><p><Users size={19} /> Account management</p></div></div>
      <section id="features" className="home-section home-wrap"><div className="section-heading"><div><p className="home-eyebrow">01 / MADE FOR THE EVERYDAY</p><h2>A clearer way to<br />run the school day.</h2></div><p>From the first attendance check to the next set of class notes, keep the essentials in a shared system with access for each role.</p></div><div className="feature-grid">{features.map(([Icon, title, description], i) => <article className="feature-card" key={title}><div className="feature-top"><Icon size={25} aria-hidden="true" /><span>0{i + 1}</span></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section id="roles" className="roles-section"><div className="home-wrap home-section"><div className="section-heading"><div><p className="home-eyebrow">02 / FIND YOUR WORKSPACE</p><h2>Different roles.<br />One connected portal.</h2></div><p>Choose your role to open the existing sign-in flow. Your account determines what you can access.</p></div><div className="role-grid">{roles.map(([role, Icon, title, tagline, description, login]) => <article className="role-card" key={role}><Icon size={30} aria-hidden="true" /><h3>{title}</h3><h4>{tagline}</h4><p>{description}</p><div className="role-access"><p>{login}</p><PortalLink placement="role" role={role}>{role === 'admin' ? 'Administrator' : role === 'teacher' ? 'Teacher' : 'Student'} login</PortalLink></div></article>)}</div><p className="account-note">Need an account? Contact your academy’s administrator for access.</p></div></section>
      <section id="about" className="home-section home-wrap about-section"><div><p className="home-eyebrow">03 / ABOUT THE PROJECT</p><h2>More clarity.<br />From class to class.</h2></div><div><p className="about-lead">MyAcademy Portal brings the practical parts of running a tuition center into one place.</p><p>Created by Ahmed Ali, the project gives administrators a place to manage accounts, teachers tools for their daily class work, and students a way to keep up with their own records and study materials.</p><div className="creator-credit"><span>AA</span><div><strong>Ahmed Ali</strong><small>Creator, MyAcademy Portal</small></div></div></div></section>
      <section id="faq" className="home-section home-wrap faq-section"><div><p className="home-eyebrow">04 / A FEW HELPFUL ANSWERS</p><h2>Before you<br />step inside.</h2><p>Getting started with your academy’s portal.</p></div><div className="faq-list">{faqs.map(([question, answer]) => <HomeFaq key={question} question={question} answer={answer} />)}</div></section>
      <section className="home-wrap"><div className="home-cta"><div><p className="home-eyebrow">YOUR WORKSPACE IS READY WHEN YOU ARE</p><h2>Let’s get back to learning.</h2><p>Sign in with the account provided by your academy.</p></div><PortalLink className="home-button" placement="footer">Open MyAcademy Portal</PortalLink></div></section>
    </main>
    <footer className="home-footer home-wrap"><a href="/" className="home-brand"><img src={logo} width="36" height="36" alt="" /><span>MyAcademy Portal</span></a><p>Created by Ahmed Ali</p><a href="#main-content">Back to top ↑</a></footer>
    <PublicAnalyticsConsent />
  </div>;
}
