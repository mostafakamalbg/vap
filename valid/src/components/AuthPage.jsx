import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react';
import { useAgro } from '../context/AgroContext';
import { useUiPreferences } from '../context/UiPreferencesContext';

export default function AuthPage({ initialRole = 'admin', onNavigate, onLoginSuccess }) {
  const { login, registerOfficer } = useAgro();
  const { t } = useUiPreferences();
  const [role, setRole] = useState(initialRole.startsWith('officer') ? 'officer' : 'admin');
  const [isRegistering, setIsRegistering] = useState(initialRole === 'officer-register');
  const [showAdminHelp, setShowAdminHelp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    officerCode: '',
    phone: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const changeForm = (event) => {
    setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (isRegistering) {
        const result = await registerOfficer(form);
        setMessage(result.message);
        setIsRegistering(false);
        setRole('officer');
      } else {
        const user = await login({ email: form.email, password: form.password, expectedRole: role });
        onLoginSuccess(user);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const selectRole = (nextRole) => {
    setRole(nextRole);
    setIsRegistering(false);
    setShowAdminHelp(false);
    setError('');
    setMessage('');
  };

  return (
    <section className="min-h-[65vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
        <button
          type="button"
          onClick={() => onNavigate('website-home')}
          className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" /> {t('auth.home')}
        </button>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
            {isRegistering ? <UserRoundPlus className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {isRegistering ? t('auth.register') : showAdminHelp ? 'অ্যাডমিন সহায়তা' : t('auth.secureLogin')}
            </h1>
            <p className="text-xs text-slate-500">{t('auth.management')}</p>
          </div>
        </div>

        {!isRegistering && !showAdminHelp && (
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => selectRole('admin')}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                role === 'admin' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              <ShieldCheck className="h-4 w-4" /> {t('auth.adminLogin')}
            </button>
            <button
              type="button"
              onClick={() => selectRole('officer')}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                role === 'officer' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500'
              }`}
            >
              <UserRound className="h-4 w-4" /> {t('auth.officerLogin')}
            </button>
          </div>
        )}

        {showAdminHelp ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <p className="font-bold">পাসওয়ার্ড রিসেটের জন্য অ্যাডমিনের সাহায্য নিন</p>
              <p className="mt-1">অফিসার অ্যাকাউন্ট হলে অ্যাডমিনকে আপনার ইমেইল বা অফিসার কোড জানান। পরিচয় যাচাই করে অ্যাডমিন প্যানেল থেকে নতুন পাসওয়ার্ড সেট করতে পারবেন। অ্যাডমিন অ্যাকাউন্টের জন্য অন্য অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
            </div>
            <button type="button" onClick={() => setShowAdminHelp(false)} className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              লগইনে ফিরে যান
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-slate-700">{t('auth.officerName')}</span>
                <input required name="name" value={form.name} onChange={changeForm} autoComplete="name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-700">{t('auth.officerCode')}</span>
                  <input required name="officerCode" value={form.officerCode} onChange={changeForm} placeholder="যেমন: SO-09" autoCapitalize="characters" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-slate-700">{t('auth.phone')}</span>
                  <input required name="phone" value={form.phone} onChange={changeForm} autoComplete="tel" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
                </label>
              </div>
            </>
          )}

          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-700">{t('auth.email')}</span>
            <input required type="email" name="email" value={form.email} onChange={changeForm} autoComplete="email" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-700">{t('auth.password')} {isRegistering && `(${t('auth.minimumPassword')})`}</span>
            <span className="relative block">
              <input required minLength={isRegistering ? 10 : undefined} type={showPassword ? 'text' : 'password'} name="password" value={form.password} onChange={changeForm} autoComplete={isRegistering ? 'new-password' : 'current-password'} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-emerald-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{message}</p>}

          <button disabled={busy} className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
            {busy ? t('auth.wait') : isRegistering ? t('auth.registerSubmit') : t('auth.loginSubmit')}
          </button>
          </form>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 text-center">
          {showAdminHelp ? null : isRegistering ? (
            <button type="button" onClick={() => { setIsRegistering(false); setMessage(''); setError(''); }} className="text-sm font-bold text-emerald-700 hover:underline">
              {t('auth.existingOfficer')}
            </button>
          ) : (
            <div className="flex flex-wrap justify-center gap-4">
              {role === 'officer' && (
                <button type="button" onClick={() => { setIsRegistering(true); setMessage(''); setError(''); }} className="text-sm font-bold text-emerald-700 hover:underline">
                  {t('auth.newOfficer')}
                </button>
              )}
              <button type="button" onClick={() => setShowAdminHelp(true)} className="text-sm font-bold text-slate-600 hover:underline">
                পাসওয়ার্ড ভুলে গেছেন? অ্যাডমিনের সাহায্য নিন
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
