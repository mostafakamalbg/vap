import React, { useEffect, useMemo, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import {
  getInvoiceSessionForDate,
  INVOICE_SESSIONS,
  isCurrentSession,
  sortSessionsNewestFirst
} from '../../../shared/sessions';
import { normalizeOfficerCode } from '../../../shared/codes';
import { roundAmount } from '../../../shared/salesReports';

const amount = (value) => Math.round(Number(value) || 0).toLocaleString('en-US');
const emptyParty = () => ({
  slNo: 1,
  nameOfTheParty: '',
  lastMonthDues: 0,
  presentMonth: { sales: 0, return: 0, netSales: 0 },
  lastAndPresent: { netSales: 0, salary: 0, collection: 0, fare: 0, l_c: 0 },
  presentMonthTotalCollection: 0,
  presentMonthNetDues: 0
});

function createReportDraft() {
  const now = new Date();
  return {
    personName: '',
    designation: '',
    areaName: '',
    mobileNo: '',
    monthOfReport: `${new Intl.DateTimeFormat('en', { month: 'long' }).format(now)}/${String(now.getFullYear()).slice(-2)}`,
    session: getInvoiceSessionForDate(now.toISOString().slice(0, 10)),
    reportingDate: now.toISOString().slice(0, 10),
    officerId: '',
    officerCode: '',
    parties: [emptyParty()]
  };
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'অনুরোধ সম্পন্ন করা যায়নি।');
  return result;
}

function partyTotals(party) {
  const sales = roundAmount(party.presentMonth?.sales);
  const returned = roundAmount(party.presentMonth?.return);
  const netSales = sales - returned;
  const balance = roundAmount(party.lastMonthDues) + netSales;
  const collection = ['salary', 'collection', 'fare', 'l_c'].reduce(
    (sum, field) => sum + roundAmount(party.lastAndPresent?.[field]),
    0
  );
  return { netSales, balance, collection, dues: balance - collection };
}

function ReportField({ label, value, onChange, type = 'text', required = false, ...props }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        required={required}
        {...props}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

export default function MonthlySalesReports() {
  const { officers } = useAgro();
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [reportDraft, setReportDraft] = useState(createReportDraft);
  const [sessionFilter, setSessionFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  const [selectedReportId, setSelectedReportId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    requestJson('/api/reports')
      .then((records) => { if (!cancelled) setAllReports(records); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams();
    if (sessionFilter !== 'ALL') query.set('session', sessionFilter);
    if (monthFilter !== 'ALL') query.set('month', monthFilter);
    requestJson(`/api/reports?${query}`)
      .then((records) => {
        if (cancelled) return;
        setReports(records);
        if (selectedReportId && !records.some((report) => report._id === selectedReportId)) {
          setSelectedReportId('');
          setReportDraft((current) => (
            current._id === selectedReportId ? createReportDraft() : current
          ));
        }
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [monthFilter, selectedReportId, sessionFilter]);

  const availableMonths = useMemo(() => (
    [...new Set(allReports
      .filter((report) => isCurrentSession(report.session))
      .map((report) => report.monthOfReport)
      .filter(Boolean))]
  ), [allReports]);
  const availableSessions = useMemo(() => sortSessionsNewestFirst([
    ...INVOICE_SESSIONS,
    ...allReports.map((report) => report.session)
  ].filter(isCurrentSession)), [allReports]);
  const selectedReport = reports.find((report) => report._id === selectedReportId);

  const updateParty = (index, path, value) => {
    setReportDraft((current) => ({
      ...current,
      parties: current.parties.map((party, rowIndex) => {
        if (rowIndex !== index) return party;
        const next = structuredClone(party);
        const keys = path.split('.');
        let target = next;
        keys.slice(0, -1).forEach((key) => { target = target[key]; });
        target[keys[keys.length - 1]] = value;
        return next;
      })
    }));
  };

  const updateReportHeader = (field, value) => {
    setReportDraft((current) => ({ ...current, [field]: value }));
  };

  const saveReport = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const editingId = reportDraft._id;
      const saved = await requestJson('/api/reports', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportDraft)
      });
      setAllReports((current) => [
        saved,
        ...current.filter((report) => report._id !== saved._id)
      ]);
      setSelectedReportId(saved._id);
      setReportDraft({ ...saved });
      setMessage('মাসিক বিক্রয় রিপোর্ট সংরক্ষণ হয়েছে।');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const loadReport = (report) => {
    setReportDraft(structuredClone(report));
    setSelectedReportId(report._id);
    setError('');
    setMessage('');
  };

  const deleteReport = async () => {
    if (!selectedReportId || !window.confirm('এই মাসিক রিপোর্টটি মুছে ফেলবেন?')) return;
    setBusy(true);
    setError('');
    try {
      await requestJson(`/api/reports?id=${encodeURIComponent(selectedReportId)}`, { method: 'DELETE' });
      setReports((current) => current.filter((report) => report._id !== selectedReportId));
      setAllReports((current) => current.filter((report) => report._id !== selectedReportId));
      setSelectedReportId('');
      setReportDraft(createReportDraft());
      setMessage('রিপোর্ট মুছে ফেলা হয়েছে।');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">

      {error && <p role="alert" className="no-print rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>}
      {message && <p role="status" className="no-print rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}

      <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="no-print flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-900">মাসিক রিপোর্ট</h2>
            <p className="text-xs text-slate-500">সেশন এবং মাস/তারিখ—দুটি ফিল্টারই সার্ভারে প্রয়োগ হয়।</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs font-semibold text-slate-600">সেশন
              <select value={sessionFilter} onChange={(event) => setSessionFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="ALL">সকল সেশন</option>
                {availableSessions.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">মাস
              <select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="ALL">সকল মাস</option>
                {availableMonths.map((month) => <option key={month} value={month}>{month}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => { setReportDraft(createReportDraft()); setSelectedReportId(''); setError(''); setMessage(''); }} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-800">নতুন রিপোর্ট</button>
          </div>
        </div>

        <label className="no-print block max-w-xl text-xs font-semibold text-slate-600">সংরক্ষিত রিপোর্ট
          <select value={selectedReportId} onChange={(event) => {
            const report = reports.find((item) => item._id === event.target.value);
            if (report) loadReport(report);
          }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
            <option value="">নতুন রিপোর্ট তৈরি করুন</option>
            {reports.map((report) => <option key={report._id} value={report._id}>{report.personName} • {report.monthOfReport} • {report.session}</option>)}
          </select>
        </label>

        <form onSubmit={saveReport} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-semibold text-slate-600">অফিসার
              <select value={reportDraft.officerId || ''} onChange={(event) => {
                const officer = officers.find((item) => item.id === event.target.value);
                setReportDraft((current) => ({
                  ...current,
                  officerId: officer?.id || '',
                  officerCode: normalizeOfficerCode(officer?.code, officer?.designation) || '',
                  personName: officer?.name || current.personName,
                  designation: officer?.designation || current.designation,
                  areaName: officer?.territory || current.areaName,
                  mobileNo: officer?.phone || current.mobileNo
                }));
              }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">অফিসার নির্বাচন করুন</option>
                {officers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name} • {normalizeOfficerCode(officer.code, officer.designation)}</option>)}
              </select>
            </label>
            <ReportField label="অফিসারের নাম *" value={reportDraft.personName} required onChange={(event) => updateReportHeader('personName', event.target.value)} />
            <ReportField label="পদবি" value={reportDraft.designation} onChange={(event) => updateReportHeader('designation', event.target.value)} />
            <ReportField label="এলাকা" value={reportDraft.areaName} onChange={(event) => updateReportHeader('areaName', event.target.value)} />
            <ReportField label="মোবাইল" value={reportDraft.mobileNo} onChange={(event) => updateReportHeader('mobileNo', event.target.value)} />
            <ReportField label="রিপোর্টের মাস *" value={reportDraft.monthOfReport} required onChange={(event) => updateReportHeader('monthOfReport', event.target.value)} placeholder="October/26" />
            <label className="block text-xs font-semibold text-slate-600">সেশন *
              <select required value={reportDraft.session} onChange={(event) => updateReportHeader('session', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                {availableSessions.map((session) => <option key={session} value={session}>{session}</option>)}
              </select>
            </label>
            <ReportField label="রিপোর্টিং তারিখ *" type="date" value={reportDraft.reportingDate} required onChange={(event) => updateReportHeader('reportingDate', event.target.value)} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1740px] text-xs">
              <thead className="bg-slate-50 text-slate-600"><tr>
                {['ক্রম', 'পার্টির নাম', 'গত মাসের বকেয়া', 'বিক্রয়', 'রিটার্ন', 'নিট বিক্রয়', 'বকেয়াসহ নিট বিক্রয়', 'বেতন', 'কালেকশন', 'ভাড়া', 'L.C', 'মোট কালেকশন', 'নিট বকেয়া', ''].map((column, index) => <th key={`${column}-${index}`} className="px-2 py-3 text-right first:text-center">{column}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {reportDraft.parties.map((party, index) => {
                  const totals = partyTotals(party);
                  return (
                    <tr key={index}>
                      <td className="px-2 py-2 text-center">{index + 1}</td>
                      <td className="px-2 py-2"><input required value={party.nameOfTheParty} onChange={(event) => updateParty(index, 'nameOfTheParty', event.target.value)} className="w-48 rounded border border-slate-300 px-2 py-1.5" placeholder="M/s Nowsad traders" /></td>
                        <td className="px-2 py-2"><input type="number" step="1" value={party.lastMonthDues} onChange={(event) => updateParty(index, 'lastMonthDues', event.target.value)} onBlur={(event) => updateParty(index, 'lastMonthDues', String(roundAmount(event.target.value)))} className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right" /></td>
                        <td className="px-2 py-2"><input type="number" step="1" value={party.presentMonth.sales} onChange={(event) => updateParty(index, 'presentMonth.sales', event.target.value)} onBlur={(event) => updateParty(index, 'presentMonth.sales', String(roundAmount(event.target.value)))} className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right" /></td>
                        <td className="px-2 py-2"><input type="number" step="1" value={party.presentMonth.return} onChange={(event) => updateParty(index, 'presentMonth.return', event.target.value)} onBlur={(event) => updateParty(index, 'presentMonth.return', String(roundAmount(event.target.value)))} className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right" /></td>
                      <td className="px-2 py-2 text-right font-bold text-emerald-800">{amount(totals.netSales)}</td>
                      <td className="px-2 py-2 text-right">{amount(totals.balance)}</td>
                      {['salary', 'collection', 'fare', 'l_c'].map((field) => <td key={field} className="px-2 py-2"><input type="number" step="1" value={party.lastAndPresent[field]} onChange={(event) => updateParty(index, `lastAndPresent.${field}`, event.target.value)} onBlur={(event) => updateParty(index, `lastAndPresent.${field}`, String(roundAmount(event.target.value)))} className="w-24 rounded border border-slate-300 px-2 py-1.5 text-right" /></td>)}
                      <td className="px-2 py-2 text-right">{amount(totals.collection)}</td>
                      <td className="px-2 py-2 text-right font-bold">{amount(totals.dues)}</td>
                      <td className="px-2 py-2"><button type="button" aria-label="সারি মুছুন" onClick={() => setReportDraft((current) => ({ ...current, parties: current.parties.filter((_, rowIndex) => rowIndex !== index) }))} className="rounded p-1 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="no-print flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => setReportDraft((current) => ({ ...current, parties: [...current.parties, { ...emptyParty(), slNo: current.parties.length + 1 }] }))} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">+ পার্টি যোগ করুন</button>
            <div className="flex gap-2">
              {reportDraft._id && <button type="button" disabled={busy} onClick={deleteReport} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 disabled:opacity-50">রিপোর্ট মুছুন</button>}
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{busy ? 'সংরক্ষণ হচ্ছে…' : 'রিপোর্ট সংরক্ষণ'}</button>
            </div>
          </div>
        </form>

        {selectedReport && (
          <div className="border-t border-slate-100 pt-4">
            <h3 className="mb-2 font-bold text-slate-800">{selectedReport.personName} • {selectedReport.monthOfReport} • {selectedReport.reportingDate}</h3>
            <p className="mb-3 text-xs text-slate-500">{selectedReport.designation} • {selectedReport.areaName} • {selectedReport.mobileNo} • {selectedReport.session}</p>
          </div>
        )}
      </section>
    </div>
  );
}
