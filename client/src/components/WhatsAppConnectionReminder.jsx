import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import api from '../api/axios';

// One monitor across teacher pages, so navigating does not repeat the same warning.
export default function WhatsAppConnectionReminder() {
  const { admin } = useAuth();
  const toast = useToast();
  const teacherId = admin?.role === 'teacher' ? admin._id : null;

  useEffect(() => {
    if (!teacherId) return;
    let active = true, pending = false, previousStatus = null, lastReminder = 0, notification;
    const controller = new AbortController();
    const check = async (returning = false) => {
      if (!active || pending || document.visibilityState !== 'visible') return;
      pending = true;
      try {
        const { data } = await api.get('/teacher/whatsapp/status', { signal: controller.signal });
        if (!active) return;
        if (data.status === 'connected') {
          toast.dismiss(notification);
        } else if (data.status === 'disconnected' &&
            (previousStatus !== 'disconnected' || (returning && Date.now() - lastReminder >= 60000))) {
          toast.dismiss(notification);
          notification = toast.warning(<span>WhatsApp is disconnected. Attendance alerts cannot be sent.{' '}
            <Link className="underline font-bold" to="/teacher/whatsapp" onClick={() => toast.dismiss(notification)}>Connect WhatsApp</Link>
          </span>, 10000);
          lastReminder = Date.now();
        }
        previousStatus = data.status;
      } catch {
        // A network error is not proof that WhatsApp disconnected. Retry on the next check.
      } finally { pending = false; }
    };
    const returned = () => check(true);
    check(true);
    const interval = setInterval(() => check(false), 30000);
    window.addEventListener('focus', returned);
    document.addEventListener('visibilitychange', returned);
    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('focus', returned);
      document.removeEventListener('visibilitychange', returned);
      toast.dismiss(notification);
    };
  }, [teacherId, toast]);

  return null;
}
