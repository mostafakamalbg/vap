import React, { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';

const roleLabels = {
  SuperAdmin: 'সুপার অ্যাডমিন',
  Admin: 'অ্যাডমিন',
  'General Admin': 'জেনারেল অ্যাডমিন',
  'Logistic Officer': 'লজিস্টিক অফিসার',
  RSM: 'RSM',
  ASM: 'ASM',
  SO: 'SO',
  officer: 'অফিসার'
};

export default function LivePresenceBoard() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/presence', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'সক্রিয় ব্যবহারকারী লোড করা যায়নি।');
        if (!cancelled) {
          setUsers(Array.isArray(result) ? result : []);
          setError('');
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError.message);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-700" />
          <div>
            <h2 className="font-black text-slate-900">লাইভ সক্রিয় ব্যবহারকারী</h2>
            <p className="text-xs text-slate-500">শেষ ৫ মিনিটের heartbeat • {users.length} জন</p>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="m-4 rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
      <div className="divide-y divide-slate-100">
        {users.map((user) => (
          <div key={`${user.name}-${user.lastActiveAt}`} className="flex items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="text-sm font-bold text-slate-800">{user.name}</p>
              <p className="text-xs text-slate-500">{roleLabels[user.role] || user.role}</p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold ${user.status === 'online' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {user.status === 'online' ? 'অনলাইন' : 'সক্রিয় ছিলেন'}
              </p>
              <time className="text-[10px] text-slate-500">{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleTimeString('bn-BD') : '—'}</time>
            </div>
          </div>
        ))}
        {!users.length && !error && <p className="px-5 py-6 text-center text-sm text-slate-500">এই মুহূর্তে কোনো সাম্প্রতিক সক্রিয় ব্যবহারকারী নেই।</p>}
      </div>
    </section>
  );
}
