import React, { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardCheck, KeyRound, Pencil, Plus, RefreshCw, ShieldX, Trash2, Users } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import { formatOfficerCode } from '../../../shared/codes';
import {
  ASM_ROLE,
  LOGISTIC_OFFICER_ROLE,
  OFFICER_ROLE,
  RSM_ROLE,
  SO_ROLE,
  SUPER_ADMIN_ROLE,
  isAdminRole
} from '../../../shared/roles';

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'অনুরোধ সম্পন্ন করা যায়নি।');
  return result;
}

export default function AdminAccess({ onInvoiceCreated }) {
  const { products, refreshSharedRecords, currentUser } = useAgro();
  const isSuperAdmin = currentUser?.role === SUPER_ADMIN_ROLE || currentUser?.isSuperAdmin;
  const canManageUsers = isAdminRole(currentUser?.role);
  const canApproveOrders = isSuperAdmin
    || currentUser?.role === LOGISTIC_OFFICER_ROLE
    || currentUser?.role === ASM_ROLE;
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [approvalRequests, setApprovalRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [editingOrderId, setEditingOrderId] = useState('');
  const [editedItems, setEditedItems] = useState([]);
  const [resettingUserId, setResettingUserId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [users, officers, allOrders, requests] = await Promise.all([
        canManageUsers ? requestJson('/api/users') : Promise.resolve([]),
        canManageUsers ? requestJson('/api/users?status=active') : Promise.resolve([]),
        requestJson('/api/orders'),
        isSuperAdmin ? requestJson('/api/approvals') : Promise.resolve([])
      ]);
      setPendingUsers(users);
      setActiveUsers(officers);
      setOrders(allOrders);
      setApprovalRequests(requests);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [canManageUsers, isSuperAdmin]);

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

  const updateHierarchy = async (user, field, value) => {
    setBusyId(user.id);
    setError('');
    setMessage('');
    try {
      const result = await requestJson('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'hierarchy',
          userId: user.id,
          ...(field === 'role' ? { role: value } : {}),
          rsmId: field === 'rsmId' ? value : user.rsmId,
          asmId: field === 'asmId' ? value : user.asmId
        })
      });
      setMessage(result.message);
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const editOrder = (order) => {
    setEditingOrderId(order.id);
    setEditedItems((order.items || []).map((item) => ({
      productId: item.productId,
      sku: item.sku,
      cartons: Number(item.cartons) || 1
    })));
    setError('');
  };

  const updateEditedItem = (index, changes) => {
    setEditedItems((previous) => previous.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...changes } : item
    )));
  };

  const updateOrder = async (orderId, status) => {
    setBusyId(orderId);
    setError('');
    setMessage('');
    try {
      const result = await requestJson('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          status,
          ...(status === 'approved' && editingOrderId === orderId ? { items: editedItems } : {}),
          decisionNote: status === 'approved' ? `${currentUser?.role || 'অনুমোদনকারী'} অনুমোদন করেছেন।` : 'অর্ডারটি অনুমোদন করা হয়নি।'
        })
      });
      if (status === 'approved') {
        await Promise.all([
          refreshSharedRecords('products'),
          refreshSharedRecords('invoices')
        ]);
        setEditingOrderId('');
        setEditedItems([]);
        setMessage(`অর্ডার অনুমোদিত হয়েছে এবং ইনভয়েস ${result.invoice?.id || ''} তৈরি হয়েছে।`);
        await refresh();
        if (result.invoice) onInvoiceCreated?.(result.invoice);
      } else {
        setMessage('অর্ডার প্রত্যাখ্যান করা হয়েছে।');
        await refresh();
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const decideApprovalRequest = async (request, decision) => {
    const reason = decision === 'rejected'
      ? window.prompt('প্রত্যাখ্যানের কারণ লিখুন:')
      : '';
    if (decision === 'rejected' && !reason?.trim()) return;
    setBusyId(request.id);
    setError('');
    setMessage('');
    try {
      await requestJson('/api/approvals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, decision, reason })
      });
      if (decision === 'approved') {
        await Promise.all(['products', 'invoices', 'payments', 'stockInLogs'].map(
          (type) => refreshSharedRecords(type)
        ));
      }
      setMessage(decision === 'approved' ? 'পরিবর্তন অনুমোদিত ও সংরক্ষিত হয়েছে।' : 'অনুরোধ প্রত্যাখ্যান করা হয়েছে।');
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyId('');
    }
  };

  const pendingOrders = orders.filter((order) => ['pending', 'pending_approval'].includes(order.status));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <header className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            {isSuperAdmin ? 'SuperAdmin' : currentUser?.role} • অ্যাডমিন নিয়ন্ত্রণ
          </p>
          <h1 className="mt-1 text-2xl font-black">অফিসার অ্যাকাউন্ট ও অর্ডার</h1>
          <p className="mt-1 text-xs text-slate-300">অফিসার অ্যাকাউন্ট অনুমোদন করুন এবং পণ্যের অর্ডার দেখুন।</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-xs font-bold hover:bg-white/20 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> হালনাগাদ
        </button>
      </header>

      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      {canManageUsers && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2"><Users className="h-5 w-5 text-emerald-700" /><div><h2 className="font-black text-slate-900">অনুমোদনের অপেক্ষায় থাকা অফিসার</h2><p className="text-xs text-slate-500">{pendingUsers.length}টি আবেদন</p></div></div>
        </div>
        <div className="divide-y divide-slate-100">
          {pendingUsers.map((user) => (
            <div key={user.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email} • {user.role} • কোড {formatOfficerCode(user.officerCode)} • {user.phone}</p>
                {user.officerPhoneMismatch && (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    ফোন নম্বর মেলেনি — নিবন্ধিত নম্বর: {user.registeredOfficerPhone || 'পাওয়া যায়নি'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button disabled={busyId === user.id} onClick={() => updateOfficer(user.id, 'active')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> অনুমোদন</button>
                <button disabled={busyId === user.id} onClick={() => updateOfficer(user.id, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><ShieldX className="h-4 w-4" /> বাতিল</button>
              </div>
            </div>
          ))}
          {!loading && pendingUsers.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">নতুন কোনো অফিসার আবেদন নেই।</p>}
        </div>
      </section>}

      {canManageUsers && <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <KeyRound className="h-5 w-5 text-emerald-700" />
          <div><h2 className="font-black text-slate-900">অফিসার পাসওয়ার্ড রিসেট</h2><p className="text-xs text-slate-500">পরিচয় যাচাই করে নতুন পাসওয়ার্ড সেট করুন এবং ব্যক্তিগতভাবে জানান।</p></div>
        </div>
        <div className="divide-y divide-slate-100">
          {activeUsers.map((user) => (
            <div key={user.id} className="flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <p className="font-bold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email} • {user.role} • কোড {formatOfficerCode(user.officerCode)} • {user.phone}</p>
                {user.role !== 'General Admin' && (
                  <label className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                    পদবি
                    <select
                      value={user.role}
                      disabled={busyId === user.id}
                      onChange={(event) => updateHierarchy(user, 'role', event.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1"
                    >
                      <option value={RSM_ROLE}>RSM</option>
                      <option value={ASM_ROLE}>ASM</option>
                      <option value={SO_ROLE}>SO</option>
                      <option value={OFFICER_ROLE}>Legacy SO</option>
                      <option value={LOGISTIC_OFFICER_ROLE}>Logistic Officer</option>
                    </select>
                  </label>
                )}
                {[ASM_ROLE, SO_ROLE, OFFICER_ROLE].includes(user.role) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {user.role === ASM_ROLE ? (
                      <label className="text-[11px] font-semibold text-slate-600">
                        RSM
                        <select
                          value={user.rsmId || ''}
                          disabled={busyId === user.id}
                          onChange={(event) => updateHierarchy(user, 'rsmId', event.target.value)}
                          className="ml-2 rounded border border-slate-300 bg-white px-2 py-1"
                        >
                          <option value="">RSM নির্বাচন</option>
                          {activeUsers.filter((entry) => entry.role === RSM_ROLE).map((entry) => (
                            <option key={entry.id} value={entry.id}>{entry.name}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <label className="text-[11px] font-semibold text-slate-600">
                          ASM
                          <select
                            value={user.asmId || ''}
                            disabled={busyId === user.id}
                            onChange={(event) => updateHierarchy(user, 'asmId', event.target.value)}
                            className="ml-2 rounded border border-slate-300 bg-white px-2 py-1"
                          >
                            <option value="">ASM নির্বাচন</option>
                            {activeUsers.filter((entry) => entry.role === ASM_ROLE).map((entry) => (
                              <option key={entry.id} value={entry.id}>{entry.name}</option>
                            ))}
                          </select>
                        </label>
                        <span className="text-[11px] text-slate-500">
                          RSM: {activeUsers.find((entry) => entry.id === user.rsmId)?.name || 'নির্ধারিত নয়'}
                        </span>
                      </>
                    )}
                  </div>
                )}
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
      </section>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
          <ClipboardCheck className="h-5 w-5 text-emerald-700" />
          <div><h2 className="font-black text-slate-900">পণ্যের অর্ডার অনুমোদন</h2><p className="text-xs text-slate-500">{pendingOrders.length}টি অর্ডার অপেক্ষায়</p></div>
        </div>
        {!canApproveOrders && pendingOrders.length > 0 && (
          <p className="border-b border-slate-100 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-800">
            এই অর্ডারগুলোর অনুমোদন আপনার জন্য উপলভ্য নয়।
          </p>
        )}
        <div className="divide-y divide-slate-100">
          {pendingOrders.map((order) => (
            <article key={order.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row">
                <div>
                  <p className="font-bold text-slate-900">{order.officerName} <span className="text-xs font-medium text-slate-500">• কোড {formatOfficerCode(order.officerCode)}</span></p>
                  <p className="text-xs text-slate-500">{order.id} • {new Date(order.createdAt).toLocaleString('bn-BD')}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">ইনভয়েস: {order.invoiceNo || '—'} • ডিলার কোড {order.dealerCode || '—'} — {order.dealerName || 'ডিলার নির্বাচন নেই'}</p>
                </div>
                <span className="h-fit rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">অনুমোদনের অপেক্ষায়</span>
              </div>
              {canApproveOrders && editingOrderId === order.id ? (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  {editedItems.map((item, index) => {
                    const selectedVariant = products.find((product) => product.id === item.productId)
                      ?.variants.find((variant) => variant.sku === item.sku);
                    return (
                      <div key={`${order.id}-${index}`} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                        <label className="text-[11px] font-semibold text-slate-600">
                          পণ্য ও প্যাক সাইজ
                          <select
                            value={item.productId && item.sku ? `${item.productId}::${item.sku}` : ''}
                            onChange={(event) => {
                              const [productId, sku] = event.target.value.split('::');
                              updateEditedItem(index, { productId, sku, cartons: item.cartons || 1 });
                            }}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs"
                          >
                            <option value="">পণ্য নির্বাচন</option>
                            {products.flatMap((product) => product.variants.map((variant) => (
                              <option key={`${product.id}::${variant.sku}`} value={`${product.id}::${variant.sku}`}>
                                {product.name} • {variant.size} • মজুদ {Number(variant.stockCartons) || 0} কার্টুন
                              </option>
                            )))}
                          </select>
                          {selectedVariant && (
                            <span className="mt-1 block text-slate-500">
                              ডিপোতে আছে {Number(selectedVariant.stockCartons) || 0} কার্টুন
                            </span>
                          )}
                        </label>
                        <label className="text-[11px] font-semibold text-slate-600">
                          কার্টুন সংখ্যা
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.cartons}
                            onChange={(event) => updateEditedItem(index, { cartons: event.target.value })}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
                          />
                        </label>
                        <button
                          type="button"
                          aria-label="পণ্য সরান"
                          onClick={() => setEditedItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}
                          className="mt-4 rounded-lg p-2 text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setEditedItems((previous) => [...previous, { productId: '', sku: '', cartons: 1 }])}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800"
                  >
                    <Plus className="h-4 w-4" /> পণ্য যোগ করুন
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(order.items || []).map((item) => {
                    const product = products.find((entry) => entry.id === item.productId);
                    const variant = product?.variants.find((entry) => entry.sku === item.sku);
                    return (
                      <span key={`${order.id}-${item.sku}`} className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                        {item.productName} • {item.size} • {item.cartons} কার্টুন • ডিপোতে {Number(variant?.stockCartons) || 0} • ৳{(Number(item.cartonPrice) * Number(item.cartons)).toLocaleString('bn-BD')}
                      </span>
                    );
                  })}
                </div>
              )}
              {order.note && <p className="text-xs text-slate-600">নোট: {order.note}</p>}
              {canApproveOrders && (
                <div className="flex gap-2">
                  {editingOrderId !== order.id && <button type="button" onClick={() => editOrder(order)} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"><Pencil className="h-4 w-4" /> এডিট</button>}
                  <button disabled={busyId === order.id || (editingOrderId === order.id && !editedItems.length)} onClick={() => updateOrder(order.id, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check className="h-4 w-4" /> {editingOrderId === order.id ? 'এডিট করে অনুমোদন' : 'অর্ডার অনুমোদন'}</button>
                  <button disabled={busyId === order.id} onClick={() => updateOrder(order.id, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50"><ShieldX className="h-4 w-4" /> প্রত্যাখ্যান</button>
                  {editingOrderId === order.id && <button type="button" onClick={() => { setEditingOrderId(''); setEditedItems([]); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">বাতিল</button>}
                </div>
              )}
            </article>
          ))}
          {!loading && pendingOrders.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">নতুন কোনো অর্ডার অনুমোদনের অপেক্ষায় নেই।</p>}
        </div>
      </section>

      {isSuperAdmin && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-amber-700" />
              <div>
                <h2 className="font-black text-slate-900">সুপার অ্যাডমিন অনুমোদন কিউ</h2>
                <p className="text-xs text-slate-500">{approvalRequests.length}টি পরিবর্তন পর্যালোচনার অপেক্ষায়</p>
              </div>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {approvalRequests.map((request) => (
              <article key={request.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">
                      {request.requestType === 'invoice_update' ? 'ইনভয়েস সংশোধন'
                        : request.requestType === 'payment_update' ? 'পেমেন্ট সংশোধন'
                          : 'স্টক-ইন চালান সংশোধন'} • {request.targetId}
                    </p>
                    <p className="text-xs text-slate-500">
                      জমাদানকারী: {request.submittedBy} ({request.submittedByRole}) •{' '}
                      {request.submittedAt ? new Date(request.submittedAt).toLocaleString('bn-BD') : 'তারিখ নেই'}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800">অনুমোদন অপেক্ষমাণ</span>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {[
                    ['মূল তথ্য', request.original],
                    ['প্রস্তাবিত পরিবর্তন', request.proposed]
                  ].map(([label, values]) => (
                    <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <h3 className="mb-2 text-xs font-black text-slate-700">{label}</h3>
                      <dl className="space-y-1">
                        {Object.entries(values || {}).filter(([key]) => !['_id', '__v', 'createdAt', 'updatedAt'].includes(key)).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[minmax(5rem,auto)_1fr] gap-2 text-[11px]">
                            <dt className="break-all font-semibold text-slate-500">{key}</dt>
                            <dd className="break-all text-slate-800">{value != null && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button disabled={busyId === request.id} onClick={() => decideApprovalRequest(request, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    <Check className="h-4 w-4" /> অনুমোদন ও প্রয়োগ
                  </button>
                  <button disabled={busyId === request.id} onClick={() => decideApprovalRequest(request, 'rejected')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">
                    <ShieldX className="h-4 w-4" /> প্রত্যাখ্যান
                  </button>
                </div>
              </article>
            ))}
            {!loading && approvalRequests.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">কোনো পরিবর্তন অনুমোদনের অপেক্ষায় নেই।</p>}
          </div>
        </section>
      )}
    </div>
  );
}
