import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  PlusCircle,
  CreditCard,
  Search,
  Printer,
  CheckCircle,
  FileText,
  Phone,
  MapPin,
  TrendingDown,
  TrendingUp,
  X,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { useAgro } from '../../context/AgroContext';
import {
  formatDealerCode,
  formatOfficerCode,
  getNextDealerCode,
  normalizeOfficerCode
} from '../../../shared/codes';
import {
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  LEDGER_PAYMENT_TYPES,
  isDealerBalanceCredit,
  normalizePaymentMethod,
  normalizePaymentType,
  resolvePaymentRecordType
} from '../../../shared/paymentMethods';
import { getDealerLedgerTransactions } from '../../../shared/dealerLedger';
import { getInvoiceSalesAmount, roundCurrency } from '../../../shared/invoiceTotals';
import CompanyLetterhead from './CompanyLetterhead';
import { getBangladeshBusinessDate, getInvoiceSessionForDate, INVOICE_SESSIONS } from '../../../shared/sessions';
import {
  LOGISTIC_OFFICER_ROLE,
  SUPER_ADMIN_ROLE,
  isAdminRole,
  isSalesOfficerRole
} from '../../../shared/roles';
import { readJsonResponse } from '../../utils/api';
import { mergeOfficerRecords } from '../../../shared/officerIdentity';

const createPaymentEntries = () => LEDGER_PAYMENT_TYPES.map(({ value }) => ({
  paymentType: value,
  amount: '0'
}));

const OFFICER_REFERENCE_FIELDS = [
  'userId',
  'hierarchyUserId',
  'officerId',
  'soId',
  'asmId',
  'rsmId',
  'assignedOfficerId',
  'assignedOfficerUserId',
  'ownerOfficerId'
];
const OFFICER_CODE_FIELDS = ['officerCode', 'assignedOfficerCode', 'code'];
const OFFICER_RECORD_CODE_FIELDS = ['officerCode', 'assignedOfficerCode'];
const OFFICER_NAME_FIELDS = ['officerName', 'assignedOfficerName', 'name'];
const OFFICER_IDENTITY_FIELDS = [
  '_id',
  'id',
  'userId',
  'hierarchyUserId',
  'officerId',
  'soId',
  'assignedOfficerId',
  'assignedOfficerUserId',
  'ownerOfficerId'
];

function normalizedReference(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
}

function collectReferenceValues(record, fields) {
  return fields.flatMap((field) => {
    const value = record?.[field];
    if (value == null || value === '') return [];
    if (typeof value === 'object') {
      return [
        ...collectReferenceValues(value, ['_id', 'id', 'userId', 'hierarchyUserId', 'officerId', 'soId', 'asmId', 'rsmId']),
        ...collectReferenceValues(value, OFFICER_CODE_FIELDS),
        ...collectReferenceValues(value, OFFICER_NAME_FIELDS)
      ];
    }
    return [String(value).trim()].filter(Boolean);
  });
}

function getOfficerIds(record, includeIdentity = false) {
  const ids = collectReferenceValues(
    record,
    includeIdentity ? OFFICER_IDENTITY_FIELDS : OFFICER_REFERENCE_FIELDS
  );
  const assignedOfficer = record?.assignedOfficer;
  if (assignedOfficer && typeof assignedOfficer === 'object') {
    ids.push(...collectReferenceValues(assignedOfficer, OFFICER_IDENTITY_FIELDS));
  } else if (assignedOfficer != null && assignedOfficer !== '') {
    ids.push(String(assignedOfficer).trim());
  }
  return ids.map(normalizedReference).filter(Boolean);
}

function getOfficerCodes(record, includeGenericCode = false) {
  const codes = collectReferenceValues(
    record,
    includeGenericCode ? OFFICER_CODE_FIELDS : OFFICER_RECORD_CODE_FIELDS
  );
  const assignedOfficer = record?.assignedOfficer;
  if (assignedOfficer && typeof assignedOfficer === 'object') {
    codes.push(...collectReferenceValues(assignedOfficer, OFFICER_CODE_FIELDS));
  } else if (assignedOfficer && normalizeOfficerCode(assignedOfficer)) {
    codes.push(String(assignedOfficer));
  }
  return codes
    .map((value) => normalizeOfficerCode(value) || normalizedReference(value))
    .filter(Boolean);
}

function getOfficerNames(record) {
  const names = collectReferenceValues(record, OFFICER_NAME_FIELDS);
  const assignedOfficer = record?.assignedOfficer;
  if (assignedOfficer && typeof assignedOfficer === 'object') {
    names.push(...collectReferenceValues(assignedOfficer, OFFICER_NAME_FIELDS));
  } else if (assignedOfficer && !normalizeOfficerCode(assignedOfficer)) {
    names.push(String(assignedOfficer));
  }
  return names
    .map((value) => normalizedReference(value).replace(/\s+/g, ' '))
    .filter(Boolean);
}

function hasOfficerIdReference(record) {
  return OFFICER_REFERENCE_FIELDS.some((field) => (
    record?.[field] != null && record[field] !== ''
  )) || Boolean(record?.assignedOfficer && typeof record.assignedOfficer === 'object'
    && getOfficerIds(record.assignedOfficer, true).length);
}

function officerRecordsMatch(record, officer) {
  if (!record || !officer) return false;
  const recordIds = new Set(getOfficerIds(record));
  const officerIds = getOfficerIds(officer, true);
  if (officerIds.some((id) => recordIds.has(id))) return true;

  const recordCodes = new Set(getOfficerCodes(record));
  const officerCodes = getOfficerCodes(officer, true);
  if (officerCodes.some((code) => recordCodes.has(code))) return true;

  const recordNames = getOfficerNames(record);
  const officerNames = getOfficerNames(officer);
  return Boolean(recordNames.some((name) => officerNames.includes(name))
    && (!hasOfficerIdReference(record) || !officerIds.length)
    && (!recordCodes.size || !officerCodes.length));
}

function hasOfficerReference(record) {
  return hasOfficerIdReference(record)
    || Boolean(record?.assignedOfficer)
    || OFFICER_RECORD_CODE_FIELDS.some((field) => Boolean(record?.[field]))
    || OFFICER_NAME_FIELDS.some((field) => Boolean(record?.[field]));
}

function getOfficerOptionKey(officer) {
  return String(
    officer?.hierarchyUserId
    || officer?.id
    || officer?.officerId
    || officer?._id
    || officer?.code
    || officer?.officerCode
    || officer?.name
    || ''
  );
}

function createOfficerFilteredSummary(summary, officer) {
  const belongsToOfficer = (record) => (
    !hasOfficerReference(record) || officerRecordsMatch(record, officer)
  );
  const invoicesForOfficer = (summary.invoices || []).filter(belongsToOfficer);
  const paymentsForOfficer = (summary.payments || []).filter(belongsToOfficer);
  const regularInvoices = invoicesForOfficer.filter((invoice) => (
    !['dealer_return', 'factory_damage', 'depot_factory_return'].includes(invoice.invoiceType)
  ));
  const returnInvoices = invoicesForOfficer.filter((invoice) => invoice.invoiceType === 'dealer_return');
  const totalPurchases = roundCurrency(regularInvoices.reduce(
    (total, invoice) => total + getInvoiceSalesAmount(invoice),
    0
  ));
  const totalReturnCredits = roundCurrency(returnInvoices.reduce(
    (total, invoice) => total + Math.abs(getInvoiceSalesAmount(invoice)),
    0
  ));
  const totalPaid = roundCurrency(paymentsForOfficer
    .filter(isDealerBalanceCredit)
    .reduce((total, payment) => total + (Number(payment.amount) || 0), 0));
  const previousDueOfficerId = summary.previousDueOfficerId
    || summary.previousDueHistory?.[summary.previousDueHistory.length - 1]?.officerId;
  const openingDue = previousDueOfficerId
    && !officerRecordsMatch({ officerId: previousDueOfficerId }, officer)
    ? 0
    : summary.openingDue;
  return {
    ...summary,
    openingDue,
    lastSessionDue: openingDue,
    totalPurchases,
    totalReturnCredits,
    totalPaid,
    currentDue: openingDue + totalPurchases - totalReturnCredits - totalPaid,
    invoices: invoicesForOfficer,
    payments: paymentsForOfficer
  };
}

const createPaymentForm = (dealerId = '', officerId = '') => ({
  date: getBangladeshBusinessDate(),
  session: getInvoiceSessionForDate(getBangladeshBusinessDate()),
  dealerId,
  officerId,
  paymentMethod: 'cash',
  reference: '',
  receivedBy: 'ক্যাশিয়ার, নিশিন্দারা বগুড়া',
  note: '',
  entries: createPaymentEntries()
});

const createPreviousDueForm = () => {
  const date = getBangladeshBusinessDate();
  return {
    dealerId: '',
    officerId: '',
    session: getInvoiceSessionForDate(date),
    date,
    amount: 0
  };
};

function findDealerOfficer(dealer, officers) {
  const assignedId = String(dealer?.assignedOfficerId || dealer?.officerId || '');
  const officerById = officers.find((officer) => (
    assignedId
    && String(officer.id || officer.officerId || '') === assignedId
  ));
  if (officerById) return officerById;

  return officers.find((officer) => officerRecordsMatch(dealer, officer));
}

function formatBalanceAmount(amount) {
  const balance = Math.round(Number(amount) || 0);
  return `${balance < 0 ? '− ' : ''}৳${Math.abs(balance).toLocaleString()}`;
}

function getBalanceLabel(amount) {
  if (amount < 0) return 'ডিলারের পাওনা / অগ্রিম';
  if (amount > 0) return 'ডিলারের বকেয়া';
  return 'ব্যালেন্স শূন্য';
}

function getTransactionDetails(transaction) {
  if (transaction.sourceType !== 'payment') return transaction.description;
  const payment = transaction.source;
  const paymentType = PAYMENT_TYPES.find(
    (type) => type.value === normalizePaymentType(
      resolvePaymentRecordType(payment) || payment.paymentType
    )
  )?.label;
  const paymentMethod = PAYMENT_METHODS.find(
    (method) => method.value === normalizePaymentMethod(payment.paymentMethod)
  )?.label;
  return [
    paymentType,
    paymentMethod,
    payment.receivedBy && `রিসিভার: ${payment.receivedBy}`
  ].filter(Boolean).join(' • ');
}

export default function DealerLedger() {
  const {
    dealers,
    officers,
    addNewDealer,
    addDealerPayment,
    updatePayment,
    getDealerSummary,
    invoices,
    payments,
    refreshSharedRecords,
    currentUser
  } = useAgro();
  const canSetPreviousDue = currentUser?.role === SUPER_ADMIN_ROLE || currentUser?.isSuperAdmin;
  const canManageLedger = isAdminRole(currentUser?.role);
  const canEditPayments = canManageLedger || currentUser?.role === LOGISTIC_OFFICER_ROLE;
  const canAddDealer = canManageLedger || currentUser?.role === LOGISTIC_OFFICER_ROLE;

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDealerModal, setShowAddDealerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPreviousDueModal, setShowPreviousDueModal] = useState(false);
  const [previousDueForm, setPreviousDueForm] = useState(createPreviousDueForm);
  const [previousDueError, setPreviousDueError] = useState('');
  const [previousDueSaving, setPreviousDueSaving] = useState(false);
  const [previousDueConfirmation, setPreviousDueConfirmation] = useState(null);
  const [hierarchyOfficers, setHierarchyOfficers] = useState([]);
  const [officerOptionsLoaded, setOfficerOptionsLoaded] = useState(false);
  const [officerFilterError, setOfficerFilterError] = useState('');
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [selectedDealerForLedgerId, setSelectedDealerForLedgerId] = useState('');
  const ledgerTriggerRef = useRef(null);
  const wasLedgerOpenRef = useRef(false);
  const officerScopeInitializedRef = useRef(false);
  const officerSelectionTouchedRef = useRef(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [paymentEdit, setPaymentEdit] = useState(null);
  const [paymentEditBusy, setPaymentEditBusy] = useState(false);
  const [paymentEditError, setPaymentEditError] = useState('');

  const officerOptions = useMemo(() => (
    isAdminRole(currentUser?.role) || currentUser?.role === LOGISTIC_OFFICER_ROLE
      ? mergeOfficerRecords([...officers, ...hierarchyOfficers])
      : mergeOfficerRecords([...hierarchyOfficers, currentUser])
  ), [currentUser, hierarchyOfficers, officers]);
  const availableOfficers = officerOptions;
  const selectedOfficer = officerOptions.find(
    (officer) => getOfficerOptionKey(officer) === selectedOfficerId
  ) || null;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/officers')
      .then(readJsonResponse)
      .then((records) => {
        if (cancelled) return;
        if (!Array.isArray(records)) throw new Error('অফিসারের তালিকা সঠিকভাবে পাওয়া যায়নি।');
        setHierarchyOfficers(records);
        setOfficerOptionsLoaded(true);
        setOfficerFilterError('');
      })
      .catch((error) => {
        if (!cancelled) {
          setOfficerOptionsLoaded(true);
          setOfficerFilterError(error.message);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!officerOptionsLoaded || officerScopeInitializedRef.current || !officerOptions.length) return;
    officerScopeInitializedRef.current = true;
    if (officerSelectionTouchedRef.current) return;
    const ownOfficer = isSalesOfficerRole(currentUser?.role)
      ? officerOptions.find((officer) => officerRecordsMatch(currentUser, officer))
      : null;
    if (ownOfficer && isSalesOfficerRole(currentUser?.role)) {
      setSelectedOfficerId(getOfficerOptionKey(ownOfficer));
    } else if (officerOptions.length === 1) {
      setSelectedOfficerId(getOfficerOptionKey(officerOptions[0]));
    }
  }, [currentUser, officerOptions, officerOptionsLoaded]);
  const closeDealerLedger = () => setSelectedDealerForLedgerId('');

  useEffect(() => {
    if (!selectedDealerForLedgerId) return undefined;
    wasLedgerOpenRef.current = true;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedDealerForLedgerId('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDealerForLedgerId]);

  useEffect(() => {
    if (selectedDealerForLedgerId || !wasLedgerOpenRef.current) return;
    wasLedgerOpenRef.current = false;
    ledgerTriggerRef.current?.focus();
  }, [selectedDealerForLedgerId]);

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState(() => (
    createPaymentForm(dealers[0]?.id || '', officers[0]?.id || '')
  ));

  // New Dealer Form State
  const [newDealerForm, setNewDealerForm] = useState({
    code: '',
    shopName: '',
    proprietor: '',
    zone: 'পীরগঞ্জ',
    address: 'পীরগঞ্জ, ঠাকুরগাঁও',
    phone: '',
    officerCode: normalizeOfficerCode(officers[0]?.code, officers[0]?.designation),
    creditLimit: 500000,
    lastSessionDue: 0
  });

  // Calculate summaries without changing the source dealer, invoice, or payment records.
  const dealerSummaries = useMemo(
    () => dealers.map((dealer) => getDealerSummary(dealer.id)).filter(Boolean),
    [dealers, getDealerSummary]
  );
  const officerScopedSummaries = useMemo(() => {
    if (!selectedOfficer) return dealerSummaries;
    return dealerSummaries
      .filter((summary) => officerRecordsMatch(summary, selectedOfficer))
      .map((summary) => createOfficerFilteredSummary(summary, selectedOfficer));
  }, [dealerSummaries, selectedOfficer]);
  const filteredSummaries = officerScopedSummaries.filter((summary) => {
    const normalizedSearch = searchTerm.toLowerCase();
    return (
      summary.shopName.toLowerCase().includes(normalizedSearch) ||
      summary.proprietor.toLowerCase().includes(normalizedSearch) ||
      formatDealerCode(summary.code).toLowerCase().includes(normalizedSearch) ||
      (summary.zone && summary.zone.toLowerCase().includes(normalizedSearch)) ||
      summary.phone.includes(searchTerm) ||
      summary.address.toLowerCase().includes(normalizedSearch)
    );
  });
  const selectedDealerForLedger = officerScopedSummaries.find(
    (summary) => summary.id === selectedDealerForLedgerId
  ) || null;
  useEffect(() => {
    if (selectedDealerForLedgerId && !selectedDealerForLedger) {
      setSelectedDealerForLedgerId('');
    }
  }, [selectedDealerForLedger, selectedDealerForLedgerId]);
  const ledgerTransactions = selectedDealerForLedger
    ? getDealerLedgerTransactions(selectedDealerForLedger)
    : [];
  const previousDueHistory = selectedDealerForLedger
    ? selectedDealerForLedger.previousDueHistory?.length
      ? [...selectedDealerForLedger.previousDueHistory]
        .filter((entry) => !selectedOfficer || !hasOfficerReference(entry) || officerRecordsMatch(entry, selectedOfficer))
        .reverse()
      : selectedDealerForLedger.previousDueDate
        && (!selectedOfficer
          || !selectedDealerForLedger.previousDueOfficerId
          || officerRecordsMatch(
            { officerId: selectedDealerForLedger.previousDueOfficerId },
            selectedOfficer
          ))
        ? [{
            date: selectedDealerForLedger.previousDueDate,
            session: selectedDealerForLedger.previousDueSession,
            amount: selectedDealerForLedger.previousDue ?? selectedDealerForLedger.lastSessionDue,
            officerId: selectedDealerForLedger.previousDueOfficerId
          }]
        : []
    : [];

  // Totals
  const totalSalesToDealers = officerScopedSummaries.reduce((acc, curr) => acc + (curr.totalPurchases || 0), 0);
  const totalReturnCredits = officerScopedSummaries.reduce((acc, curr) => acc + (curr.totalReturnCredits || 0), 0);
  const totalNetSales = totalSalesToDealers - totalReturnCredits;
  const totalPaidByDealers = officerScopedSummaries.reduce((acc, curr) => acc + (curr.totalPaid || 0), 0);
  const totalOutstandingDue = officerScopedSummaries.reduce((acc, curr) => acc + (curr.currentDue || 0), 0);
  const totalLastSessionDue = officerScopedSummaries.reduce((acc, curr) => acc + (curr.lastSessionDue || 0), 0);

  // Open Payment modal for specific dealer
  const handleOpenPayment = (dealerId) => {
    if (!dealerId) return;
    const d = dealers.find((dl) => dl.id === dealerId);
    const form = createPaymentForm(
      dealerId,
      findDealerOfficer(d, availableOfficers)?.id || ''
    );
    form.reference = `MR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    setPaymentForm(form);
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    const invalidEntry = paymentForm.entries.some((entry) => (
      !Number.isFinite(Number(entry.amount)) || Number(entry.amount) < 0
    ));
    const entriesToSave = paymentForm.entries.filter((entry) => Number(entry.amount) > 0);
    if (!paymentForm.officerId) {
      alert('দায়িত্বপ্রাপ্ত অফিসার নির্বাচন করুন।');
      return;
    }
    if (!paymentForm.session) {
      alert('সেশন নির্বাচন করুন।');
      return;
    }
    if (invalidEntry || !entriesToSave.length) {
      alert('অন্তত একটি পেমেন্টের পরিমাণ শূন্যের বেশি দিন।');
      return;
    }

    const d = dealers.find((dl) => dl.id === paymentForm.dealerId);
    if (!d) {
      alert('ডিলার নির্বাচন করুন।');
      return;
    }
    const o = availableOfficers.find((of) => of.id === paymentForm.officerId);
    if (!o) {
      alert('দায়িত্বপ্রাপ্ত অফিসার নির্বাচন করুন।');
      return;
    }

    const newPayments = entriesToSave.map((entry) => {
      const paymentType = normalizePaymentType(entry.paymentType);
      return {
          date: paymentForm.date,
          session: paymentForm.session,
          paymentType,
          dealerId: paymentForm.dealerId,
          dealerName: d?.shopName || 'ডিলার',
          officerId: paymentForm.officerId,
          officerCode: o?.code || '',
          officerName: o?.name || 'অফিসার',
          amount: Math.round(Number(entry.amount)),
          paymentMethod: paymentForm.paymentMethod,
          reference: paymentForm.reference || 'নগদ রসিদ',
          receivedBy: paymentForm.receivedBy,
          note: paymentForm.note || PAYMENT_TYPES.find((type) => type.value === paymentType)?.label || ''
        };

        const openPaymentEdit = (payment) => {
          setPaymentEdit({
            original: payment,
            date: payment.date || '',
            session: payment.session || '',
            amount: String(payment.amount ?? ''),
            paymentMethod: normalizePaymentMethod(payment.paymentMethod),
            reference: payment.reference || '',
            receivedBy: payment.receivedBy || '',
            note: payment.note || ''
          });
          setPaymentEditError('');
        };

        const handlePaymentEditSubmit = async (event) => {
          event.preventDefault();
          if (!paymentEdit || !Number.isFinite(Number(paymentEdit.amount)) || Number(paymentEdit.amount) < 0) {
            setPaymentEditError('পেমেন্টের পরিমাণ সঠিকভাবে দিন।');
            return;
          }
          setPaymentEditBusy(true);
          setPaymentEditError('');
          try {
            const result = await updatePayment({
              ...paymentEdit.original,
              date: paymentEdit.date,
              session: paymentEdit.session,
              amount: Number(paymentEdit.amount),
              paymentMethod: paymentEdit.paymentMethod,
              reference: paymentEdit.reference,
              receivedBy: paymentEdit.receivedBy,
              note: paymentEdit.note
            });
            setPaymentEdit(null);
            setSuccessMsg(result.pendingApproval
              ? 'পেমেন্ট সংশোধনের অনুরোধ সুপার অ্যাডমিন অনুমোদনের জন্য জমা হয়েছে।'
              : 'পেমেন্ট সংশোধন সংরক্ষিত হয়েছে।');
            setTimeout(() => setSuccessMsg(''), 5000);
          } catch (error) {
            setPaymentEditError(error.message);
          } finally {
            setPaymentEditBusy(false);
          }
        };
    });
    try {
      await addDealerPayment(newPayments);
    } catch (error) {
      window.alert(error.message);
      return;
    }

    const total = Math.round(entriesToSave.reduce((sum, entry) => sum + Number(entry.amount), 0));
    window.alert(`${d?.shopName || 'ডিলার'}-এর ${entriesToSave.length}টি পেমেন্ট পোস্টিং, মোট ৳${total.toLocaleString()} সংরক্ষণ হয়েছে।`);
    const resetForm = createPaymentForm(
      paymentForm.dealerId,
      findDealerOfficer(d, availableOfficers)?.id || ''
    );
    resetForm.reference = `MR-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    setPaymentForm(resetForm);
    setSuccessMsg(`${d?.shopName || 'ডিলার'}-এর পেমেন্ট সংরক্ষণ হয়েছে।`);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  const handlePreviousDueSubmit = async (event) => {
    event.preventDefault();
    if (!previousDueForm.dealerId || !previousDueForm.officerId || !previousDueForm.session
      || !previousDueForm.date || !Number.isFinite(Number(previousDueForm.amount))
      || Number(previousDueForm.amount) < 0) {
      setPreviousDueError('ডিলার, অফিসার, সেশন, তারিখ ও বকেয়া সঠিকভাবে দিন।');
      return;
    }
    setPreviousDueError('');
    setPreviousDueSaving(true);
    try {
      const response = await fetch('/api/dealers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previousDueForm)
      });
      const result = await readJsonResponse(response);
      const dealer = dealers.find((entry) => entry.id === previousDueForm.dealerId);
      setShowPreviousDueModal(false);
      setPreviousDueForm(createPreviousDueForm());
      setPreviousDueConfirmation({
        dealerName: dealer?.shopName || result.shopName || 'ডিলার',
        amount: Number(previousDueForm.amount),
        date: previousDueForm.date,
        session: previousDueForm.session
      });
      try {
        const updatedDealers = await refreshSharedRecords('dealers');
        const updatedDealer = updatedDealers.find((entry) => entry.id === previousDueForm.dealerId);
        if (updatedDealer && selectedDealerForLedger?.id === updatedDealer.id) {
          setSelectedDealerForLedgerId(updatedDealer.id);
        }
        setSuccessMsg('পূর্বের বকেয়া সংরক্ষিত হয়েছে এবং ডিলার লেজার হালনাগাদ হয়েছে।');
        setTimeout(() => setSuccessMsg(''), 4500);
      } catch (refreshError) {
        setPreviousDueError(`বকেয়া সংরক্ষিত হয়েছে, কিন্তু লেজার রিফ্রেশ করা যায়নি: ${refreshError.message}`);
      }
    } catch (error) {
      setPreviousDueError(error.message);
    } finally {
      setPreviousDueSaving(false);
    }
  };

  // Submit New Dealer
  const handleNewDealerSubmit = (e) => {
    e.preventDefault();
    if (!newDealerForm.shopName) {
      alert('প্রতিষ্ঠানের নাম আবশ্যক');
      return;
    }

    addNewDealer({
      ...newDealerForm,
      creditLimit: Number(newDealerForm.creditLimit) || 0,
      lastSessionDue: Number(newDealerForm.lastSessionDue) || 0,
      openingDue: Number(newDealerForm.lastSessionDue) || 0
    });

    setSuccessMsg(`নতুন ডিলার "${newDealerForm.shopName}" সফলভাবে তালিকায় যুক্ত হয়েছে!`);
    setTimeout(() => setSuccessMsg(''), 4500);

    setNewDealerForm({
      shopName: '',
      proprietor: '',
      address: 'বগুড়া সদর',
      phone: '',
      officerCode: normalizeOfficerCode(officers[0]?.code, officers[0]?.designation),
      creditLimit: 500000,
      lastSessionDue: 0
    });
    setShowAddDealerModal(false);
  };

  return (
    <div className="dealer-ledger-list-print py-6 px-4 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <span className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </span>
            ডিলার হিসাব ও বাকি-বকেয়া লেজার
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            কোন ডিলার কত টাকা দিলো, কত টাকা বাকি থাকলো এবং সম্পূর্ণ খতিয়ান বিবরণী
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="no-print flex items-center gap-2 text-xs font-semibold text-slate-600">
            অফিসার ফিল্টার
            <select
              value={selectedOfficerId}
              onChange={(event) => {
                officerSelectionTouchedRef.current = true;
                setSelectedOfficerId(event.target.value);
              }}
              disabled={isSalesOfficerRole(currentUser?.role)}
              className="max-w-48 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
            >
              <option value="">সকল অফিসার</option>
              {officerOptions.map((officer) => (
                <option key={getOfficerOptionKey(officer)} value={getOfficerOptionKey(officer)}>
                  {officer.name || officer.officerName || 'অফিসার'}
                  {(officer.code || officer.officerCode)
                    ? ` • ${formatOfficerCode(officer.code || officer.officerCode, officer.designation)}`
                    : ''}
                </option>
              ))}
            </select>
          </label>
          {canSetPreviousDue && (
            <button
              type="button"
              onClick={() => {
                setPreviousDueError('');
                setShowPreviousDueModal(true);
              }}
              className="no-print rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900"
            >
              পূর্বের বকেয়া ইনপুট
            </button>
          )}
          {paymentEdit && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
              <form onSubmit={handlePaymentEditSubmit} className="w-full max-w-xl space-y-4 rounded-xl bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-black text-slate-900">পেমেন্ট সংশোধনের অনুরোধ</h3>
                    <p className="text-xs text-slate-500">{paymentEdit.original.id} • অনুমোদনের আগে মূল রেকর্ড অপরিবর্তিত থাকবে</p>
                  </div>
                  <button type="button" onClick={() => setPaymentEdit(null)} aria-label="বন্ধ করুন" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-600">তারিখ
                    <input required type="date" value={paymentEdit.date} onChange={(event) => setPaymentEdit((previous) => ({
                      ...previous,
                      date: event.target.value,
                      session: getInvoiceSessionForDate(event.target.value) || previous.session
                    }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">সেশন
                    <select required value={paymentEdit.session} onChange={(event) => setPaymentEdit((previous) => ({ ...previous, session: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2">
                      <option value="">সেশন নির্বাচন করুন</option>
                      {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">পরিমাণ
                    <input required type="number" min="0" step="0.01" value={paymentEdit.amount} onChange={(event) => setPaymentEdit((previous) => ({ ...previous, amount: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">পেমেন্ট পদ্ধতি
                    <select value={paymentEdit.paymentMethod} onChange={(event) => setPaymentEdit((previous) => ({ ...previous, paymentMethod: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2">
                      {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-600">রেফারেন্স
                    <input value={paymentEdit.reference} onChange={(event) => setPaymentEdit((previous) => ({ ...previous, reference: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">রিসিভ করেছেন
                    <input value={paymentEdit.receivedBy} onChange={(event) => setPaymentEdit((previous) => ({ ...previous, receivedBy: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 sm:col-span-2">নোট
                    <input value={paymentEdit.note} onChange={(event) => setPaymentEdit((previous) => ({ ...previous, note: event.target.value }))} className="mt-1 w-full rounded border border-slate-300 p-2" />
                  </label>
                </div>
                {paymentEditError && <p role="alert" className="rounded bg-rose-50 p-2 text-xs font-semibold text-rose-700">{paymentEditError}</p>}
                <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                  <button type="button" onClick={() => setPaymentEdit(null)} className="rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">বাতিল</button>
                  <button disabled={paymentEditBusy} className="rounded bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
                    {paymentEditBusy ? 'জমা হচ্ছে…' : 'অনুমোদনের জন্য জমা দিন'}
                  </button>
                </div>
              </form>
            </div>
          )}
          {canAddDealer && (
              <button
                onClick={() => setShowAddDealerModal(true)}
                className="no-print flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>নতুন ডিলার নিবন্ধন</span>
              </button>
          )}
          {canEditPayments && (
              <button
                onClick={() => handleOpenPayment(dealers[0]?.id)}
                className="no-print flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition"
              >
                <CreditCard className="w-4 h-4" />
                <span>টাকা জমা নিন (Payment)</span>
              </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            className="no-print flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700"
          >
            <Printer className="w-4 h-4" /> প্রিন্ট
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-2 no-print">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-sm">{successMsg}</span>
        </div>
      )}
      {officerFilterError && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 no-print">
          অফিসারের তালিকা লোড করা যায়নি: {officerFilterError}
        </p>
      )}
      {previousDueError && !showPreviousDueModal && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">{previousDueError}</p>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট চালানের মাল বিক্রি</p>
            <p className="text-2xl font-black text-slate-800 mt-1">৳{totalSalesToDealers.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট ইনভয়েসের পণ্য ফেরত</p>
            <p className="text-2xl font-black text-rose-700 mt-1">৳{totalReturnCredits.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">মোট আদায়কৃত টাকা (পরিশোধ)</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">৳{totalPaidByDealers.toLocaleString()}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">ডিলারদের মোট নিট বকেয়া / পাওনা</p>
            <p className={`mt-1 text-2xl font-black ${totalOutstandingDue < 0 ? 'text-emerald-700' : totalOutstandingDue > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatBalanceAmount(totalOutstandingDue)}
            </p>
            <p className="mt-1 text-xs text-slate-500">{getBalanceLabel(totalOutstandingDue)}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>
      <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 dealer-ledger-equation">
        মোট ইনভয়েস বিক্রি ৳{totalSalesToDealers.toLocaleString()} − ফেরত ৳{totalReturnCredits.toLocaleString()} = নিট সেলস ৳{totalNetSales.toLocaleString()} • Last Session Due ৳{totalLastSessionDue.toLocaleString()} + নিট সেলস − আদায়/ব্যয় সমন্বয় ৳{totalPaidByDealers.toLocaleString()} = নিট বকেয়া ৳{totalOutstandingDue.toLocaleString()} • ডেমেজ মূল্য লেজার থেকে বাদ নয়
      </p>

      {/* Dealers Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-md no-print">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="দোকানের নাম, প্রোপাইটর, মোবাইল বা এলাকা দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Table */}
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold uppercase">
              <tr>
                <th className="py-3 px-3">ডিলার কোড</th>
                <th className="py-3 px-3">প্রতিষ্ঠান ও মালিকের নাম</th>
                <th className="py-3 px-3">ঠিকানা ও মোবাইল</th>
                <th className="py-3 px-3">দায়িত্বপ্রাপ্ত অফিসার</th>
                <th className="py-3 px-3 text-right">মোট ক্রয় (৳)</th>
                <th className="py-3 px-3 text-right">মোট ফেরত (৳)</th>
                <th className="py-3 px-3 text-right">নিট সেলস</th>
                <th className="py-3 px-3 text-right">মোট পরিশোধ (৳)</th>
                <th className="py-3 px-3 text-right">বকেয়া / পাওনা (৳)</th>
                <th className="no-print py-3 px-3 text-center">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredSummaries.map((d) => {
                const assignedOfficer = findDealerOfficer(d, availableOfficers);
                const hasDue = d.currentDue > 0;
                const hasAdvance = d.currentDue < 0;

                return (
                  <tr key={d.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3">
                      <span className="inline-block bg-emerald-100 text-emerald-900 font-mono font-bold px-2 py-0.5 rounded text-xs">
                        {formatDealerCode(d.code || d.id)}
                      </span>
                      {d.zone && <span className="block text-[10px] text-slate-400 mt-0.5">{d.zone}</span>}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800 text-sm">{d.shopName}</div>
                      <div className="text-[11px] text-slate-500">প্রোপাইটর: {d.proprietor}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600">
                      <div>{d.address}</div>
                      <div className="text-[11px] font-mono text-emerald-700">{d.phone}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {assignedOfficer?.name || '-'}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                      ৳{d.totalPurchases.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                      ৳{d.totalReturnCredits.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">
                      ৳{(Number(d.totalPurchases) - Number(d.totalReturnCredits)).toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                      ৳{d.totalPaid.toLocaleString()}
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md font-extrabold text-sm ${
                          hasDue
                            ? 'bg-rose-100 text-rose-800'
                            : hasAdvance
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {formatBalanceAmount(d.currentDue)}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">{getBalanceLabel(d.currentDue)}</span>
                    </td>

                    <td className="no-print py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEditPayments && (
                          <button
                            onClick={() => handleOpenPayment(d.id)}
                            title="টাকা জমা নিন"
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold border border-emerald-200 transition"
                          >
                            পেমেন্ট
                          </button>
                        )}

                        <button
                          onClick={(event) => {
                            ledgerTriggerRef.current = event.currentTarget;
                            setSelectedDealerForLedgerId(d.id);
                          }}
                          title="বিস্তারিত খতিয়ান দেখুন"
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-semibold transition"
                        >
                          খতিয়ান
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Payment Collection */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-700" />
                ডিলার লেনদেন / আয়-ব্যয় পোস্টিং
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">তারিখ</label>
                  <input
                    type="date"
                    value={paymentForm.date}
                    onChange={(e) => setPaymentForm({
                      ...paymentForm,
                      date: e.target.value,
                      session: getInvoiceSessionForDate(e.target.value)
                    })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">সেশন *</label>
                  <select
                    required
                    value={paymentForm.session}
                    onChange={(e) => setPaymentForm({ ...paymentForm, session: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  >
                    <option value="">সেশন নির্বাচন করুন</option>
                    {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ডিলার নির্বাচন</label>
                  <select
                    required
                    value={paymentForm.dealerId}
                    onChange={(e) => {
                      const dealerId = e.target.value;
                      const dealer = dealers.find((item) => item.id === dealerId);
                      const assignedOfficer = findDealerOfficer(dealer, availableOfficers);
                      setPaymentForm((previous) => ({
                        ...previous,
                        dealerId,
                        officerId: assignedOfficer?.id || (
                          availableOfficers.some((officer) => officer.id === previous.officerId)
                            ? previous.officerId
                            : ''
                        )
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-semibold"
                  >
                    <option value="">ডিলার নির্বাচন করুন</option>
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.shopName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">দায়িত্বপ্রাপ্ত অফিসার</label>
                  <select
                    required
                    value={paymentForm.officerId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, officerId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  >
                    <option value="">অফিসার নির্বাচন করুন</option>
                    {availableOfficers.map((o) => (
                      <option key={o.id} value={o.id}>
                        {formatOfficerCode(o.code, o.designation)} • {o.name} • {o.designation}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="font-bold text-slate-700">পেমেন্ট / আয়-ব্যয়ের খাত</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {paymentForm.entries.map((entry, index) => (
                    <label key={entry.paymentType} className="font-semibold text-slate-600">
                      {LEDGER_PAYMENT_TYPES.find((type) => type.value === entry.paymentType)?.label}
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={entry.amount}
                        onChange={(event) => setPaymentForm((previous) => ({
                          ...previous,
                          entries: previous.entries.map((row, rowIndex) => (
                            rowIndex === index ? { ...row, amount: event.target.value } : row
                          ))
                        }))}
                        className="mt-1 w-full rounded border border-slate-300 bg-white p-2 font-bold"
                        required
                      />
                    </label>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">প্রয়োজন নেই এমন খাত ০ রাখুন; শুধু শূন্যের বেশি পরিমাণ পোস্ট হবে।</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <fieldset>
                    <legend className="mb-1 block font-semibold text-slate-600">পেমেন্ট মেথড</legend>
                    <div className="grid gap-1.5">
                      {PAYMENT_METHODS.map((method) => (
                        <label
                          key={method.value}
                          className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs font-semibold ${
                            paymentForm.paymentMethod === method.value
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="ledgerPaymentMethod"
                            value={method.value}
                            checked={paymentForm.paymentMethod === method.value}
                            onChange={(event) => setPaymentForm({ ...paymentForm, paymentMethod: event.target.value })}
                            className="accent-emerald-700"
                          />
                          {method.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">মানি রসিদ / চেক / ট্রানজেকশন নং</label>
                  <input
                    type="text"
                    value={paymentForm.reference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">রিসিভ করেছেন</label>
                  <input
                    type="text"
                    value={paymentForm.receivedBy}
                    onChange={(e) => setPaymentForm({ ...paymentForm, receivedBy: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">মন্তব্য / নোট</label>
                <input
                  type="text"
                  placeholder="যেমন: ইসলামী ব্যাংক বগুড়া শাখায় জমা"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded text-xs font-bold shadow"
                >
                  টাকা জমা কনফার্ম করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {canSetPreviousDue && showPreviousDueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handlePreviousDueSubmit} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800">ডিলারের পূর্বের বকেয়া ইনপুট</h3>
              <button type="button" aria-label="বন্ধ করুন" onClick={() => setShowPreviousDueModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            {previousDueError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm font-semibold text-rose-700">{previousDueError}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">ডিলার সিলেক্ট *
                <select required value={previousDueForm.dealerId} onChange={(e) => setPreviousDueForm({ ...previousDueForm, dealerId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2">
                  <option value="">ডিলার নির্বাচন করুন</option>
                  {dealers.map((dealer) => <option key={dealer.id} value={dealer.id}>{dealer.shopName}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">অফিসার সিলেক্ট *
                <select required value={previousDueForm.officerId} onChange={(e) => setPreviousDueForm({ ...previousDueForm, officerId: e.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2">
                  <option value="">অফিসার নির্বাচন করুন</option>
                  {availableOfficers.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">সেশন *
                <select required value={previousDueForm.session} onChange={(e) => setPreviousDueForm({ ...previousDueForm, session: e.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2">
                  {INVOICE_SESSIONS.map((session) => <option key={session} value={session}>{session}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">তারিখ *
                <input required type="date" value={previousDueForm.date} onChange={(e) => setPreviousDueForm({
                  ...previousDueForm,
                  date: e.target.value,
                  session: getInvoiceSessionForDate(e.target.value)
                })} className="mt-1 w-full rounded border border-slate-300 p-2" />
              </label>
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">Previous Due Amount *
                <input required type="number" min="0" step="1" value={previousDueForm.amount} onChange={(e) => setPreviousDueForm({ ...previousDueForm, amount: e.target.value })} className="mt-1 w-full rounded border border-slate-300 p-2 font-bold text-rose-700" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button type="button" onClick={() => setShowPreviousDueModal(false)} className="rounded border border-slate-300 px-4 py-2 text-xs font-bold">বাতিল</button>
              <button type="submit" disabled={previousDueSaving} className="rounded bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60">
                {previousDueSaving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {previousDueConfirmation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="previous-due-confirmation-title" className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <CheckCircle className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div>
                <h3 id="previous-due-confirmation-title" className="text-lg font-black text-slate-900">পূর্বের বকেয়া সংরক্ষিত হয়েছে</h3>
                <p className="mt-2 text-sm text-slate-700">{previousDueConfirmation.dealerName}</p>
                <p className="mt-1 text-sm font-bold text-slate-900">৳{previousDueConfirmation.amount.toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-600">তারিখ: {previousDueConfirmation.date} • {previousDueConfirmation.session}</p>
                <p className="mt-2 text-xs text-slate-500">তারিখসহ পোস্টিংটি সংরক্ষিত হয়েছে।</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 pt-3">
              <button type="button" autoFocus onClick={() => setPreviousDueConfirmation(null)} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                বন্ধ করুন
              </button>
            </div>
          </section>
        </div>
      )}

      {/* MODAL 2: Add New Dealer */}
      {showAddDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-700" />
                নতুন ডিলার বা কাস্টমার নিবন্ধন
              </h3>
              <button onClick={() => setShowAddDealerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleNewDealerSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ডিলার কোড *</label>
                  <input
                    type="text"
                    placeholder="DL-09"
                    value={getNextDealerCode(dealers)}
                    readOnly
                    className="w-full bg-slate-100 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-emerald-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">দোকান / প্রতিষ্ঠানের নাম *</label>
                  <input
                    type="text"
                    placeholder="যেমন: সততা এগ্রো ভান্ডার"
                    value={newDealerForm.shopName}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, shopName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">প্রোপাইটর / মালিকের নাম</label>
                  <input
                    type="text"
                    placeholder="মালিকের নাম"
                    value={newDealerForm.proprietor}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, proprietor: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">মোবাইল নম্বর *</label>
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={newDealerForm.phone}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ঠিকানা / বাজার এলাকা</label>
                  <input
                    type="text"
                    placeholder="বাজার, উপজেলা, বগুড়া"
                    value={newDealerForm.address}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">দায়িত্বপ্রাপ্ত অফিসার</label>
                  <select
                    value={newDealerForm.officerCode}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, officerCode: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs"
                  >
                    {officers.map((o) => (
                      <option key={o.id} value={normalizeOfficerCode(o.code, o.designation)}>
                        {formatOfficerCode(o.code, o.designation)} • {o.name} • {o.designation}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">ক্রেডিট লিমিট (৳)</label>
                  <input
                    type="number"
                    value={newDealerForm.creditLimit}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, creditLimit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Last Session Due / পূর্বের বকেয়া (৳)</label>
                  <input
                    type="number"
                    value={newDealerForm.lastSessionDue}
                    onChange={(e) => setNewDealerForm({ ...newDealerForm, lastSessionDue: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs font-mono font-bold text-rose-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddDealerModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-600 text-xs font-semibold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded text-xs font-bold shadow"
                >
                  ডিলার সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Detailed Ledger Statement (Printable) */}
      {selectedDealerForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div role="dialog" aria-modal="true" aria-labelledby="dealer-ledger-dialog-title" className="dealer-ledger-print bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-4 my-8">
            <div className="sticky top-0 z-10 flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 bg-white pb-3 no-print">
              <h3 id="dealer-ledger-dialog-title" className="text-base font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                ডিলার খতিয়ান ও লেনদেন বিবরণী
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow hover:bg-emerald-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  প্রিন্ট খতিয়ান
                </button>
                <button
                  type="button"
                  onClick={closeDealerLedger}
                  aria-label="ডিলার খতিয়ান বন্ধ করুন"
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-rose-300 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-800 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <X className="h-4 w-4" /> বন্ধ করুন / ফিরে যান
                </button>
              </div>
            </div>

            {/* Printable Ledger Header */}
            <div className="text-center border-b border-emerald-800 pb-3">
              <CompanyLetterhead className="dealer-ledger-letterhead" />
              <div className="mt-2 inline-block bg-slate-100 text-slate-800 border border-slate-300 px-3 py-0.5 rounded text-xs font-bold">
                ডিলার লেজার ও বাকি হিসাব বিবরণী
              </div>
            </div>

            {/* Dealer Info Bar */}
            <div className="dealer-ledger-info-box grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <p><span className="font-bold">প্রতিষ্ঠান:</span> {selectedDealerForLedger.shopName}</p>
                <p><span className="font-bold">প্রোপাইটর:</span> {selectedDealerForLedger.proprietor}</p>
                <p><span className="font-bold">ঠিকানা:</span> {selectedDealerForLedger.address}</p>
                <p><span className="font-bold">ফোন:</span> {selectedDealerForLedger.phone}</p>
              </div>
              <div className="text-right">
                <p><span className="font-bold">ডিলার কোড:</span> {formatDealerCode(selectedDealerForLedger.code)}</p>
                <p><span className="font-bold">Last Session Due:</span> ৳{selectedDealerForLedger.lastSessionDue.toLocaleString()}</p>
                {selectedDealerForLedger.previousDueDate && <p><span className="font-bold">পূর্বের বকেয়ার তারিখ:</span> {selectedDealerForLedger.previousDueDate}</p>}
                <p><span className="font-bold text-emerald-700">মোট পরিশোধ:</span> ৳{selectedDealerForLedger.totalPaid.toLocaleString()}</p>
                <p><span className="font-bold text-sky-700">মোট রিটার্ন ক্রেডিট:</span> − ৳{selectedDealerForLedger.totalReturnCredits.toLocaleString()}</p>
                <p className={`mt-1 text-sm font-extrabold ${selectedDealerForLedger.currentDue < 0 ? 'text-sky-700' : 'text-rose-700'}`}>
                  {getBalanceLabel(selectedDealerForLedger.currentDue)}: {formatBalanceAmount(selectedDealerForLedger.currentDue)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700">পূর্বের বকেয়া পোস্টিং হিস্ট্রি</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr><th className="p-2">তারিখ</th><th className="p-2">সেশন</th><th className="p-2">অফিসার</th><th className="p-2 text-right">বকেয়া</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {previousDueHistory.map((entry, index) => (
                      <tr key={`${entry.date}-${entry.postedAt || index}-${index}`}>
                        <td className="p-2 font-mono">{entry.date}</td>
                        <td className="p-2">{entry.session || '—'}</td>
                        <td className="p-2">{availableOfficers.find((officer) => officer.id === entry.officerId)?.name || entry.officerId || '—'}</td>
                        <td className="p-2 text-right font-mono font-bold">৳{Number(entry.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    {previousDueHistory.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-slate-400">কোনো পোস্টিং হিস্ট্রি নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Unified transaction ledger */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                লেনদেন বিবরণী (Ledger Transactions)
              </h4>
              <table className="dealer-ledger-table w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold text-slate-700">
                  <tr>
                    <th className="p-2">তারিখ</th>
                    <th className="p-2">ইনভয়েস / রেফারেন্স</th>
                    <th className="p-2">লেনদেনের বিবরণ</th>
                    <th className="p-2 text-right">ডেবিট</th>
                    <th className="p-2 text-right">ক্রেডিট</th>
                    <th className="p-2 text-right">নিট ব্যালেন্স</th>
                    <th className="no-print p-2">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {ledgerTransactions.map((transaction) => {
                    return (
                      <tr key={transaction.id}>
                        <td className="p-2 font-mono">{transaction.date || '—'}</td>
                        <td className="p-2 font-mono font-bold text-emerald-800">
                          {transaction.reference}
                        </td>
                        <td className="p-2 text-slate-600">
                          {getTransactionDetails(transaction)}
                        </td>
                        <td className="p-2 text-right font-mono">
                          {transaction.debit > 0 ? formatBalanceAmount(transaction.debit) : '—'}
                        </td>
                        <td className="p-2 text-right font-mono font-semibold text-sky-700">
                          {transaction.credit > 0 ? formatBalanceAmount(-transaction.credit) : '—'}
                        </td>
                        <td className={`p-2 text-right font-mono font-bold ${transaction.balance < 0 ? 'text-sky-700' : 'text-rose-700'}`}>
                          {formatBalanceAmount(transaction.balance)}
                        </td>
                        <td className="no-print p-2">
                          {canEditPayments
                            && transaction.sourceType === 'payment'
                            && !transaction.source?.sourceInvoiceId
                            && !/(?:invoice|চালান)\s*#/i.test(String(transaction.source?.reference || ''))
                            && (
                              <button
                                type="button"
                                onClick={() => openPaymentEdit(transaction.source)}
                                title="সুপার অ্যাডমিন অনুমোদনের জন্য পেমেন্ট সংশোধন"
                                className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-800"
                              >
                                <Pencil className="h-3 w-3" /> সংশোধন
                              </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                  {ledgerTransactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-3 text-center text-slate-400 italic">কোনো লেনদেনের রেকর্ড নেই</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures for Print */}
            <div className="grid grid-cols-2 gap-8 pt-10 text-center text-xs">
              <div>
                <div className="border-t border-slate-400 pt-1">ডিলার স্বাক্ষর</div>
              </div>
              <div>
                <div className="border-t border-slate-400 pt-1">হিসাবরক্ষক / ম্যানেজার, নিশিন্দারা বগুড়া</div>
              </div>
              <div className="no-print flex justify-end border-t border-slate-200 pt-3">
                <button type="button" onClick={closeDealerLedger} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">
                  বন্ধ করুন / ফিরে যান
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
