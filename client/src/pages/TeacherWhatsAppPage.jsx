import { useState, useEffect, useCallback } from 'react';
import TeacherSidebar from '../components/TeacherSidebar';
import MobileHeader from '../components/MobileHeader';
import api from '../api/axios';
import { useToast } from '../components/Toast';
import { Link, AlertTriangle, CheckCircle, RefreshCw, LogOut, HelpCircle, Loader2 } from 'lucide-react';

export default function TeacherWhatsAppPage() {
  const [status, setStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected'
  const [qrCode, setQrCode] = useState(null);
  const [phone, setPhone] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  const toast = useToast();

  // Fetch connection status
  const fetchStatus = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      const res = await api.get('/teacher/whatsapp/status');
      setStatus(res.data.status);
      setQrCode(res.data.qrCode);
      setPhone(res.data.phone);
    } catch {
      toast.error('Failed to load WhatsApp connection status.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [toast]);

  // Set up 5-second short polling to track QR scan success or auto-refresh
  useEffect(() => {
    fetchStatus(true); // Initial load with spinner

    const interval = setInterval(() => {
      fetchStatus(false); // Background updates without spinner
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Trigger manual disconnect/logout
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect WhatsApp? This will log you out of your current session.')) {
      return;
    }

    setDisconnecting(true);
    try {
      await api.post('/teacher/whatsapp/disconnect');
      toast.success('WhatsApp disconnected successfully.');
      setStatus('disconnected');
      setQrCode(null);
      setPhone(null);
      // Immediately trigger a status check to start generating a new QR code
      fetchStatus(false);
    } catch {
      toast.error('Failed to disconnect WhatsApp session.');
    } finally {
      setDisconnecting(false);
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
          <h2 className="text-lg font-bold text-slate-800">WhatsApp Connectivity</h2>
          <button className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-50 transition-colors">
            <HelpCircle className="w-5 h-5" />
          </button>
        </header>

        {/* Content Canvas */}
        <main className="flex-1 p-4 sm:p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full min-w-0">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">WhatsApp Setup</h1>
            <p className="text-sm text-slate-500 mt-1">Link your personal WhatsApp account to send alerts directly from the portal.</p>
          </div>

          {/* Connection Status Card */}
          <div className="w-full bg-white rounded-xl border border-slate-200 shadow-md p-8 flex flex-col items-center justify-center text-center">
            {loading ? (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                <p className="text-sm font-semibold">Checking connection status...</p>
              </div>
            ) : (
              <div className="w-full space-y-6">
                
                {/* 1. Status Badges */}
                <div className="flex justify-center">
                  {status === 'connected' && (
                    <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 uppercase tracking-wide">
                      <CheckCircle className="w-4 h-4" />
                      Connected
                    </span>
                  )}
                  {status === 'connecting' && (
                    <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200 uppercase tracking-wide animate-pulse">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connecting...
                    </span>
                  )}
                  {status === 'disconnected' && (
                    <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold border border-slate-200 uppercase tracking-wide">
                      <AlertTriangle className="w-4 h-4" />
                      Disconnected
                    </span>
                  )}
                </div>

                {/* 2. Main Interface States */}

                {/* State A: Connected */}
                {status === 'connected' && (
                  <div className="space-y-6 py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto shadow-sm">
                      <Link className="w-8 h-8" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-slate-800">WhatsApp Linked Successfully</h3>
                      <p className="text-xs text-slate-400 font-medium">All automated messages will now be dispatched from your linked number.</p>
                      {phone && (
                        <p className="text-sm font-bold text-slate-700 bg-slate-50 border border-slate-150 inline-block px-4 py-1.5 rounded-lg mt-2">
                          +{phone}
                        </p>
                      )}
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={disconnecting}
                        onClick={handleDisconnect}
                        className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs py-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {disconnecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <LogOut className="w-4 h-4" />
                            Disconnect WhatsApp
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* State B: Connecting (Initialising socket) */}
                {status === 'connecting' && (
                  <div className="space-y-4 py-8">
                    <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-800">Starting WhatsApp Socket</h4>
                      <p className="text-xs text-slate-400 max-w-xs mx-auto">
                        Setting up a secure instance in the cloud. This might take a few moments...
                      </p>
                    </div>
                  </div>
                )}

                {/* State C: Disconnected - QR Scan screen */}
                {status === 'disconnected' && (
                  <div className="space-y-6">
                    {qrCode ? (
                      <div className="space-y-6">
                        {/* QR Code Container */}
                        <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl inline-block shadow-inner">
                          <img
                            src={qrCode}
                            alt="WhatsApp Link QR Code"
                            className="w-48 h-48 mx-auto"
                          />
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-slate-800">Scan QR Code</h4>
                          <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                            Open WhatsApp on your phone, navigate to <strong>Settings &gt; Linked Devices</strong>, click <strong>Link a Device</strong>, and point your camera at the QR code.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 py-8">
                        <Loader2 className="w-10 h-10 animate-spin text-amber-500 mx-auto" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-800">Generating QR Code</h4>
                          <p className="text-xs text-slate-400 max-w-xs mx-auto">
                            Waiting for the server to dispatch a fresh QR code connection string...
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
