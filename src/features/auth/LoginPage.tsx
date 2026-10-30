import React, { useState } from 'react';
import { Train, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { authService } from './authService';
import type { AuthUser } from '../../types';

interface LoginPageProps {
  onSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('operator@railbus.com');
  const [password, setPassword] = useState('Operator@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await authService.login(email, password);
      onSuccess(user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const setRole = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0B1F33] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#112942] border border-[#1E3A52] rounded-2xl p-6 sm:p-8 shadow-2xl text-white">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#F5A524] text-[#0B1F33] flex items-center justify-center font-bold">
            <Train className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">RailBus Operations</h1>
            <p className="text-xs text-[#A0B0C0]">Dispatch &amp; Fleet Management Console</p>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#A0B0C0] mb-1.5">Staff Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#6A829A] absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0B1F33] border border-[#1E3A52] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A524]"
                placeholder="staff@railbus.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#A0B0C0] mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#6A829A] absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0B1F33] border border-[#1E3A52] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#F5A524]"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#F5A524] hover:bg-[#e0941d] text-[#0B1F33] font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In to Console'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#1E3A52]">
          <p className="text-[11px] font-medium text-[#A0B0C0] mb-2">Quick Sign-in Presets:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('operator@railbus.com', 'Operator@123')}
              className="p-2 rounded-lg bg-[#0B1F33] border border-[#1E3A52] text-[11px] font-semibold text-[#E2E8F0] hover:border-[#F5A524] text-left transition-colors"
            >
              <div className="font-bold text-white">Dispatcher</div>
              <div className="text-[10px] text-[#A0B0C0]">operator@railbus.com</div>
            </button>
            <button
              type="button"
              onClick={() => setRole('admin@railbus.com', 'Admin@123')}
              className="p-2 rounded-lg bg-[#0B1F33] border border-[#1E3A52] text-[11px] font-semibold text-[#E2E8F0] hover:border-[#F5A524] text-left transition-colors"
            >
              <div className="font-bold text-white">Administrator</div>
              <div className="text-[10px] text-[#A0B0C0]">admin@railbus.com</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
