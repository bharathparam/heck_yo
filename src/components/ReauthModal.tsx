import React, { useState } from 'react';
import { ShieldAlert, Key, Mail, RefreshCw, CheckCircle2 } from 'lucide-react';
import { apiLogin } from '../services/api';
import type { ConductorUser } from '../types';

interface ReauthModalProps {
  isOpen: boolean;
  queuedCount: number;
  onSuccess: (user: ConductorUser) => void;
}

export const ReauthModal: React.FC<ReauthModalProps> = ({ isOpen, queuedCount, onSuccess }) => {
  const [email, setEmail] = useState('conductor@railbus.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiLogin(email, password);
      onSuccess(res.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Authentication failed. Check your password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-sky-500/60 rounded-3xl w-full max-w-sm p-6 sm:p-7 shadow-2xl space-y-5 my-auto">
        {/* Shield Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg ring-8 ring-amber-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Session Expired Mid-Trip
          </h2>
          <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl p-2.5 flex items-center justify-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>
              <strong>{queuedCount}</strong> offline {queuedCount === 1 ? 'scan is' : 'scans are'} safe in local storage!
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed pt-1">
            Sign in again to refresh your security token and automatically resume background sync.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Re-auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Conductor Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">Password</label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                placeholder="Enter password"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full tap-target bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-950/60 active-press transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Re-Authenticating & Resuming...' : 'Re-Login & Resume Sync'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
