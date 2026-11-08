import React, { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, KeyRound, RefreshCw, ShieldX, Users } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { formatOfficerCode } from '../../../shared/codes';

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'অনুরোধ সম্পন্ন করা যায়নি।');
  return result;
}

export default function AdminAccess() {
  const { refreshSharedRecords } = useAgro();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [resettingUserId, setResettingUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [users, officers, allOrders] = await Promise.all([
        requestJson('/api/users'),
        requestJson('/api/users?status=active'),
        requestJson('/api/orders')
      ]);
      setPendingUsers(users);
      setActiveUsers(officers);
      setOrders(allOrders);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const updateOfficer = async (userId, status) => {
    setBusyId(userId);
    setError('');
    setMessage('');
    try {
      const result = await requestJson('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status })
      });
      if (status === 'active') await refreshSharedRecords('officers');
      setMessage(result.message);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const resetOfficerPassword = async (event, userId) => {
    event.preventDefault();
    setBusyId(userId);
    setError('');
    setMessage('');
    try {
      const result = await requestJson('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset-password', userId, password: newPassword })
      });
      setMessage(result.message);
      setNewPassword('');
      setResettingUserId('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const updateOrder = async (orderId, status) => {
    setBusyId(orderId);
    setError('');
    setMessage('');
    try {
      await requestJson('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status,
          decisionNote: status === 'approved' ? 'অ্যাডমিন অনুমোদন করেছেন।' : 'অর্ডারটি অনুমোদন করা হয়নি।'
        })
      });
      if (status === 'approved') await refreshSharedRecords('products');
      setMessage(status === 'approved' ? 'অর্ডার অনুমোদিত হয়েছে।' : 'অর্ডার প্রত্যাখ্যান করা হয়েছে।');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const pendingOrders = orders.filter((order) => order.status === 'pending');

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">অ্যাডমিন নিয়ন্ত্রণ</p>
          <h1 className="mt-1 text-2xl font-black">অফিসার অ্যাকাউন্ট ও অর্ডার</h1>
          <p className="mt-1 text-xs text-slate-300">অফিসার অ্যাকাউন্ট অনুমোদন করুন এবং পণ্যের অর্ডার দেখুন।</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/20 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> হালনাগাদ
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-700" /><div><h2 className="font-black text-slate-900">অনুমোদনের অপেক্ষায় থাকা অফিসার</h2><p className="text-xs text-slate-500">{pendingUsers.length}টি আবেদন</p></div></div>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingUsers.map((user) => (
            <div key={user.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email} • অফিসার কোড {formatOfficerCode(user.officerCode)} • {user.phone}</p>
              </div>
              <div className="flex gap-2">
                <button disabled={busyId === user.id} onClick={() => updateOfficer(user.id, 'active')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> অনুমোদন</button>
                <button disabled={busyId === user.id} onClick={() => updateOfficer(user.id, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><ShieldX className="h-4 w-4" /> বাতিল</button>
              </div>
            </div>
          ))}
          {!loading && pendingUsers.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">নতুন কোনো অফিসার আবেদন নেই।</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <KeyRound className="h-5 w-5 text-emerald-700" />
          <div><h2 className="font-black text-slate-900">অফিসার পাসওয়ার্ড রিসেট</h2><p className="text-xs text-slate-500">পরিচয় যাচাই করে নতুন পাসওয়ার্ড সেট করুন এবং ব্যক্তিগতভাবে জানান।</p></div>
        </div>
        <div className="divide-y divide-slate-100">
          {activeUsers.map((user) => (
            <div key={user.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email} • অফিসার কোড {formatOfficerCode(user.officerCode)} • {user.phone}</p>
              </div>
              {resettingUserId === user.id ? (
                <form onSubmit={(event) => resetOfficerPassword(event, user.id)} className="flex flex-wrap items-center gap-2">
                  <input
                    required
                    minLength={10}
                    maxLength={128}
                    type="password"
                    autoComplete="new-password"
                    aria-label={`${user.name} এর নতুন পাসওয়ার্ড`}
                    placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ১০ অক্ষর)"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="min-w-60 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button disabled={busyId === user.id} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">সেট করুন</button>
                  <button type="button" onClick={() => { setResettingUserId(''); setNewPassword(''); }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">বাতিল</button>
                </form>
              ) : (
                <button type="button" onClick={() => setResettingUserId(user.id)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                  <KeyRound className="h-4 w-4" /> পাসওয়ার্ড রিসেট
                </button>
              )}
            </div>
          ))}
          {!loading && activeUsers.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">সক্রিয় অফিসার অ্যাকাউন্ট নেই।</p>}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <ClipboardCheck className="h-5 w-5 text-emerald-700" />
          <div><h2 className="font-black text-slate-900">পণ্যের অর্ডার অনুমোদন</h2><p className="text-xs text-slate-500">{pendingOrders.length}টি অর্ডার অপেক্ষায়</p></div>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingOrders.map((order) => (
            <article key={order.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <p className="font-bold text-slate-900">{order.officerName} <span className="text-xs font-medium text-slate-500">• কোড {formatOfficerCode(order.officerCode)}</span></p>
                  <p className="text-xs text-slate-500">{order.id} • {new Date(order.createdAt).toLocaleString('bn-BD')}</p>
                </div>
                <span className="h-fit rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">অনুমোদনের অপেক্ষায়</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(order.items || []).map((item) => (
                  <span key={`${order.id}-${item.sku}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {item.productName} • {item.size} • {item.cartons} কার্টুন • ৳{(Number(item.cartonPrice) * Number(item.cartons)).toLocaleString('bn-BD')}
                  </span>
                ))}
              </div>
              {order.note && <p className="text-xs text-slate-600">নোট: {order.note}</p>}
              <div className="flex gap-2">
                <button disabled={busyId === order.id} onClick={() => updateOrder(order.id, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> অর্ডার অনুমোদন</button>
                <button disabled={busyId === order.id} onClick={() => updateOrder(order.id, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><ShieldX className="h-4 w-4" /> প্রত্যাখ্যান</button>
              </div>
            </article>
          ))}
          {!loading && pendingOrders.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">নতুন কোনো অর্ডার অনুমোদনের অপেক্ষায় নেই।</p>}
        </div>
      </section>
    </div>
  );
}
