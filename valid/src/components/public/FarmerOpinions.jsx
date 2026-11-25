import React, { useEffect, useState } from 'react';
import { ImagePlus, MessageCircle, Send, X } from 'lucide-react';
import { readImageFile } from '../../utils/imageUpload';

async function requestJson(response) {
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'অনুরোধ সম্পন্ন করা যায়নি।');
  return result;
}

export default function FarmerOpinions() {
  const [posts, setPosts] = useState({ active: [], gallery: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [form, setForm] = useState({
    farmerName: '',
    district: '',
    opinion: '',
    showNamePublicly: false,
    photoDataUrl: ''
  });

  useEffect(() => {
    let cancelled = false;
    const loadPosts = async () => {
      try {
        const response = await fetch('/api/farmer-opinions', { cache: 'no-store' });
        const result = await requestJson(response);
        if (!cancelled) {
          setPosts({
            active: Array.isArray(result.active) ? result.active : [],
            gallery: Array.isArray(result.gallery) ? result.gallery : []
          });
          setLoadError('');
        }
      } catch (requestError) {
        if (!cancelled) setLoadError(requestError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPosts();
    const timer = window.setInterval(loadPosts, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const changePhoto = async (event) => {
    setPhotoError('');
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const photoDataUrl = await readImageFile(file);
      setForm((previous) => ({ ...previous, photoDataUrl }));
    } catch (uploadError) {
      setForm((previous) => ({ ...previous, photoDataUrl: '' }));
      setPhotoError(uploadError.message);
    }
  };

  const submitOpinion = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await requestJson(await fetch('/api/farmer-opinions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      }));
      setMessage(result.message);
      setForm({
        farmerName: '',
        district: '',
        opinion: '',
        showNamePublicly: false,
        photoDataUrl: ''
      });
      setShowForm(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderPost = (post) => (
    <article key={post.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {post.photoDataUrl && <img src={post.photoDataUrl} alt="কৃষকের জমির ছবি" loading="lazy" className="h-48 w-full object-cover" />}
      <div className="space-y-2 p-4">
        <p className="text-sm leading-6 text-slate-700">{post.opinion}</p>
        <p className="text-xs font-bold text-emerald-800">
          {post.farmerName || 'একজন কৃষক'}{post.district ? ` • ${post.district}` : ''}
        </p>
      </div>
    </article>
  );

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">কৃষকের অভিজ্ঞতা</span>
          <h2 className="mt-1 text-2xl font-black text-slate-900">কৃষকের মতামত ও মাঠের গল্প</h2>
          <p className="mt-1 text-sm text-slate-500">প্রকাশিত মতামত অনুমোদনের পর এক সপ্তাহ সক্রিয় থাকে এবং গ্যালারিতে সংরক্ষিত হয়।</p>
        </div>
        <button type="button" onClick={() => { setShowForm(true); setMessage(''); }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800">
          <MessageCircle className="h-4 w-4" /> মতামত / ছবি জমা দিন
        </button>
      </div>

      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
      {loadError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">{loadError}</p>}

      <div className="space-y-3">
        <h3 className="font-bold text-slate-800">এই সপ্তাহের অভিজ্ঞতা</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.active.map(renderPost)}
          {!loading && posts.active.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">অনুমোদিত নতুন মতামত এখনো নেই।</p>}
        </div>
      </div>
      {posts.gallery.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800">কৃষক অভিজ্ঞতা গ্যালারি</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{posts.gallery.map(renderPost)}</div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
          <form onSubmit={submitOpinion} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">আপনার অভিজ্ঞতা জানান</h3>
                <p className="text-xs text-slate-500">প্রকাশের আগে অ্যাডমিন অনুমোদন করবেন।</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="বন্ধ করুন" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-bold text-slate-700">নাম
                <input required minLength={2} maxLength={100} value={form.farmerName} onChange={(event) => setForm((previous) => ({ ...previous, farmerName: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">জেলা
                <input required minLength={2} maxLength={80} value={form.district} onChange={(event) => setForm((previous) => ({ ...previous, district: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </div>
            <label className="block space-y-1 text-xs font-bold text-slate-700">মতামত
              <textarea required minLength={10} maxLength={2000} rows={4} value={form.opinion} onChange={(event) => setForm((previous) => ({ ...previous, opinion: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={form.showNamePublicly} onChange={(event) => setForm((previous) => ({ ...previous, showNamePublicly: event.target.checked }))} />
              অনুমোদিত হলে আমার নাম প্রকাশ করা যাবে
            </label>
            <label className="block space-y-2 text-xs font-bold text-slate-700">
              <span className="inline-flex items-center gap-1"><ImagePlus className="h-4 w-4" /> জমির ছবি (ঐচ্ছিক, সর্বোচ্চ ১.৫ এমবি)</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={changePhoto} className="block w-full text-xs" />
            </label>
            {photoError && <p role="alert" className="text-xs font-semibold text-rose-700">{photoError}</p>}
            {form.photoDataUrl && <img src={form.photoDataUrl} alt="আপলোডের জন্য নির্বাচিত ছবি" className="h-32 rounded-lg object-cover" />}
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">বাতিল</button>
              <button disabled={submitting || Boolean(photoError)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                <Send className="h-4 w-4" /> {submitting ? 'জমা হচ্ছে…' : 'অনুমোদনের জন্য জমা দিন'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
