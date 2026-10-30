import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { ArrowRight, AlertCircle, Loader2, Train } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const { t, loginUser, registerUser } = useApp();
  const [registering, setRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (registering) await registerUser(fullName.trim(), email.trim(), phone.trim(), password);
      else await loginUser(email.trim(), password);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : registering ? 'Registration failed. Please retry.' : 'Sign in failed. Please retry.');
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[#F3F6FA] flex flex-col justify-between p-6 max-w-md mx-auto pt-safe pb-safe">
      <div className="space-y-6 pt-6">
        <div className="w-12 h-12 rounded-2xl bg-[#0B1F33] flex items-center justify-center text-[#F5A524] shadow-md"><Train className="w-6 h-6" /></div>
        <div className="space-y-1"><h1 className="font-bold text-2xl text-[#0B1F33] tracking-tight">{registering ? 'Create passenger account' : 'Passenger sign in'}</h1><p className="text-sm text-[#74777d]">{registering ? 'Register once, then book Mysuru feeder bus tickets.' : 'Sign in to book and view your RailBus tickets.'}</p></div>
        <form onSubmit={submit} className="bg-white rounded-2xl p-5 border border-[#D9E1EA] shadow-sm space-y-4">
          {registering && <>
            <div className="space-y-1.5"><label htmlFor="passenger-name" className="block text-xs font-bold text-[#0B1F33] uppercase tracking-wider">Full name</label><input id="passenger-name" autoComplete="name" required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full h-[52px] rounded-xl border border-[#D9E1EA] px-3.5 text-sm" /></div>
            <div className="space-y-1.5"><label htmlFor="passenger-phone" className="block text-xs font-bold text-[#0B1F33] uppercase tracking-wider">Phone number</label><input id="passenger-phone" type="tel" autoComplete="tel" required minLength={7} value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full h-[52px] rounded-xl border border-[#D9E1EA] px-3.5 text-sm" /></div>
          </>}
          <div className="space-y-1.5"><label htmlFor="passenger-email" className="block text-xs font-bold text-[#0B1F33] uppercase tracking-wider">Email</label><input id="passenger-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full h-[52px] rounded-xl bg-white border border-[#D9E1EA] px-3.5 text-sm font-semibold text-[#0B1F33] focus:outline-none focus:border-[#0B1F33]" /></div>
          <div className="space-y-1.5"><label htmlFor="passenger-password" className="block text-xs font-bold text-[#0B1F33] uppercase tracking-wider">Password</label><input id="passenger-password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={registering ? 8 : 1} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={registering ? 'At least 8 characters' : 'Enter your password'} className="w-full h-[52px] rounded-xl bg-white border border-[#D9E1EA] px-3.5 text-sm font-semibold text-[#0B1F33] focus:outline-none focus:border-[#0B1F33]" /></div>
          {error && <div role="alert" className="p-3 rounded-xl bg-[#FDE8E8] text-xs font-semibold text-[#D32F2F] flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
          <button type="submit" disabled={busy} className="w-full h-[52px] rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all bg-[#F5A524] text-[#0B1F33] disabled:opacity-50 shadow-sm active:scale-95">{busy ? <><Loader2 className="w-4 h-4 animate-spin"/>{registering ? 'Creating account…' : 'Signing in…'}</> : <>{registering ? 'Create account' : 'Sign in'}<ArrowRight className="w-4 h-4"/></>}</button>
          <button type="button" onClick={() => { setRegistering(!registering); setError(''); }} className="w-full text-xs font-semibold text-[#0B1F33] underline">{registering ? 'Already have an account? Sign in' : 'New to RailBus? Create an account'}</button>
        </form>
      </div>
      <div className="text-center pb-4 text-xs text-[#74777d]">{t.common.ksrtcPartner}</div>
    </div>
  );
};
