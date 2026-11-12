import { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_OFFICERS,
  INITIAL_DEALERS,
  INITIAL_INVOICES,
  INITIAL_STOCK_IN,
  INITIAL_DAMAGES,
  INITIAL_PAYMENTS
} from '../data/initialData';
import {
  formatDealerCode,
  getNextDealerCode,
  normalizeDealerAssignment,
  normalizeOfficerCode
} from '../../shared/codes';
import { isDealerCollection, normalizePaymentMethod } from '../../shared/paymentMethods';
import { applyInvoiceStockChanges } from '../../shared/invoiceStock';

const AgroContext = createContext();

const isSalesInvoice = (invoice) =>
  invoice.invoiceType !== 'dealer_return' && invoice.invoiceType !== 'factory_damage';

function normalizeBusinessRecords(type, records, officers = []) {
  return records.map((record) => {
    const normalized = { ...record };
    if (type === 'officers') {
      normalized.id = String(record.id || record.officerId || normalizeOfficerCode(record.code, record.designation));
      normalized.code = normalizeOfficerCode(record.code, record.designation);
    }
    if (type === 'dealers') {
      normalized.code = formatDealerCode(record.code);
      return normalizeDealerAssignment(normalized, officers);
    }
    if (record.officerCode) normalized.officerCode = normalizeOfficerCode(record.officerCode);
    if (record.dealerCode) normalized.dealerCode = formatDealerCode(record.dealerCode);
    return normalized;
  });
}

function getInvoicePaymentFields(invoice) {
  const paymentMethod = normalizePaymentMethod(invoice.paymentMethod);
  if (paymentMethod !== 'credit') return { paymentMethod };

  const invoiceAmount = Number(invoice.totalAmount ?? invoice.grandTotal) || 0;
  const previousDue = Number(invoice.previousDue) || 0;
  const netPayable = invoiceAmount + previousDue;
  const dueAmount = Math.max(0, netPayable);
  return {
    paymentMethod,
    paidAmount: 0,
    netPayable,
    dueAmount,
    currentDue: dueAmount
  };
}

// Guaranteed unique sequential invoice generator
export function getNextInvoiceNumber(existingInvoices = []) {
  const currentYear = new Date().getFullYear();
  let maxSeq = 0;

  existingInvoices.forEach((inv) => {
    if (inv && inv.id) {
      const match = inv.id.match(/VAP-\d{4}-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    }
  });

  let nextSeq = maxSeq + 1;
  let candidateId = `VAP-${currentYear}-${nextSeq.toString().padStart(4, '0')}`;

  while (existingInvoices.some((inv) => inv.id === candidateId)) {
    nextSeq += 1;
    candidateId = `VAP-${currentYear}-${nextSeq.toString().padStart(4, '0')}`;
  }

  return { candidateId, seqNumber: nextSeq };
}

function escapeXml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createExcelWorksheet(name, rows) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row || {})))];
  const tableRows = columns.length > 0
    ? [
        columns,
        ...rows.map((row) => columns.map((column) => {
          const value = row?.[column];
          return value != null && typeof value === 'object'
            ? JSON.stringify(value)
            : value == null
              ? ''
              : String(value);
        }))
      ]
    : [['তথ্য'], ['কোনো তথ্য নেই']];

  const xmlRows = tableRows.map((row) => (
    `<Row>${row.map((cell) => (
      `<Cell><Data ss:Type="String" xml:space="preserve">${escapeXml(cell)}</Data></Cell>`
    )).join('')}</Row>`
  )).join('');

  return `<Worksheet ss:Name="${name}"><Table>${xmlRows}</Table></Worksheet>`;
}

async function readJsonResponse(response) {
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('সার্ভার থেকে সঠিক প্রতিক্রিয়া পাওয়া যায়নি।');
  }
  if (!response.ok) throw new Error(result.error || 'অনুরোধ সম্পন্ন করা যায়নি।');
  return result;
}

export function AgroProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [cloudReady, setCloudReady] = useState(false);

  // Version 5 storage keys for continuous serial 1 to 83 dealer codes and 26 products
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('vap_products_v5');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [officers, setOfficers] = useState(() => {
    const saved = localStorage.getItem('vap_officers_v5');
    return normalizeBusinessRecords('officers', saved ? JSON.parse(saved) : INITIAL_OFFICERS);
  });

  const [dealers, setDealers] = useState(() => {
    const saved = localStorage.getItem('vap_dealers_v5');
    return normalizeBusinessRecords('dealers', saved ? JSON.parse(saved) : INITIAL_DEALERS, officers);
  });

  const [invoices, setInvoices] = useState(() => {
    const saved = localStorage.getItem('vap_invoices_v5');
    return normalizeBusinessRecords('invoices', saved ? JSON.parse(saved) : INITIAL_INVOICES);
  });

  const [stockInLogs, setStockInLogs] = useState(() => {
    const saved = localStorage.getItem('vap_stock_in_v5');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_IN;
  });

  const [damageLogs, setDamageLogs] = useState(() => {
    const saved = localStorage.getItem('vap_damages_v5');
    return normalizeBusinessRecords('damageLogs', saved ? JSON.parse(saved) : INITIAL_DAMAGES);
  });
  const [payments, setPayments] = useState(() => {
    const saved = localStorage.getItem('vap_payments_v5');
    return normalizeBusinessRecords('payments', saved ? JSON.parse(saved) : INITIAL_PAYMENTS);
  });
  const [salesAgreements, setSalesAgreements] = useState(() => {
    const saved = localStorage.getItem('vap_sales_agreements_v1');
    return normalizeBusinessRecords('salesAgreements', saved ? JSON.parse(saved) : []);
  });
  const localRecordsRef = useRef({
    products,
    officers,
    dealers,
    invoices,
    stockInLogs,
    damageLogs,
    payments,
    salesAgreements
  });
  const syncQueueRef = useRef({});
  const syncErrorsRef = useRef(new Map());
  const updateCloudError = (key, message) => {
    if (message) {
      syncErrorsRef.current.set(key, message);
    } else {
      syncErrorsRef.current.delete(key);
    }
    setCloudError([...syncErrorsRef.current.values()][0] || '');
  };

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem('vap_products_v5', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('vap_officers_v5', JSON.stringify(officers));
  }, [officers]);

  useEffect(() => {
    localStorage.setItem('vap_dealers_v5', JSON.stringify(dealers));
  }, [dealers]);

  useEffect(() => {
    localStorage.setItem('vap_invoices_v5', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('vap_stock_in_v5', JSON.stringify(stockInLogs));
  }, [stockInLogs]);

  useEffect(() => {
    localStorage.setItem('vap_damages_v5', JSON.stringify(damageLogs));
  }, [damageLogs]);

  useEffect(() => {
    localStorage.setItem('vap_payments_v5', JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem('vap_sales_agreements_v1', JSON.stringify(salesAgreements));
  }, [salesAgreements]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (response) => {
        if (response.status === 401) return null;
        const result = await readJsonResponse(response);
        return result.user;
      })
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch((error) => {
        if (!cancelled) setAuthError(error.message);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const login = async (credentials) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const result = await readJsonResponse(response);
    setCurrentUser(result.user);
    setAuthError('');
    return result.user;
  };

  const registerOfficer = async (registration) => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registration)
    });
    return readJsonResponse(response);
  };

  const logout = async () => {
    const response = await fetch('/api/auth/me', { method: 'POST' });
    await readJsonResponse(response);
    setCurrentUser(null);
    setCloudError('');
  };

  const refreshSharedRecords = async (type) => {
    const response = await fetch(`/api/records?type=${encodeURIComponent(type)}`);
    const records = await readJsonResponse(response);
    const setters = {
      products: setProducts,
      officers: setOfficers,
      dealers: setDealers,
      invoices: setInvoices,
      stockInLogs: setStockInLogs,
      damageLogs: setDamageLogs,
      payments: setPayments,
      salesAgreements: setSalesAgreements
    };
    if (!Array.isArray(records) || !setters[type]) {
      throw new Error('সার্ভার থেকে সঠিক ডেটা পাওয়া যায়নি।');
    }
    const normalizedRecords = normalizeBusinessRecords(
      type,
      records,
      type === 'dealers' ? officers : []
    );
    setters[type](normalizedRecords);
    return normalizedRecords;
  };

  useEffect(() => {
    let cancelled = false;
    setCloudReady(false);
    syncErrorsRef.current.clear();
    setCloudError('');
    if (!currentUser) return () => { cancelled = true; };

    const localRecords = localRecordsRef.current;
    const setters = {
      products: setProducts,
      officers: setOfficers,
      dealers: setDealers,
      invoices: setInvoices,
      stockInLogs: setStockInLogs,
      damageLogs: setDamageLogs,
      payments: setPayments,
      salesAgreements: setSalesAgreements
    };

    async function loadSharedRecords() {
      try {
        const recordTypes = Object.entries(setters)
          .filter(([type]) => type !== 'salesAgreements' || currentUser.role === 'admin');
        const sharedRecords = await Promise.all(recordTypes.map(async ([type]) => {
          const response = await fetch(`/api/records?type=${encodeURIComponent(type)}`);
          const records = await readJsonResponse(response);
          if (!Array.isArray(records)) throw new Error(`সার্ভার থেকে ${type} ডেটা সঠিকভাবে পাওয়া যায়নি।`);
          return [type, records];
        }));
        const hasSharedData = sharedRecords.some(([, records]) => records.length > 0);
        const sharedOfficers = sharedRecords.find(([type]) => type === 'officers')?.[1];
        const officersForAssignments = normalizeBusinessRecords(
          'officers',
          sharedOfficers?.length ? sharedOfficers : localRecords.officers
        );

        for (const [type, records] of sharedRecords) {
          const setter = setters[type];
          if (records.length > 0 || currentUser.role === 'officer' || hasSharedData) {
            if (!cancelled) {
              setter(normalizeBusinessRecords(
                type,
                records,
                type === 'dealers' ? officersForAssignments : []
              ));
            }
          } else if (localRecords[type].length > 0 && type === 'invoices') {
            for (const invoice of localRecords[type]) {
              const saveResponse = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoice)
              });
              await readJsonResponse(saveResponse);
            }
          } else if (localRecords[type].length > 0) {
            const recordsToSave = type === 'dealers'
              ? normalizeBusinessRecords(type, localRecords[type], officersForAssignments)
              : localRecords[type];
            const saveResponse = await fetch(`/api/records?type=${encodeURIComponent(type)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(recordsToSave)
            });
            await readJsonResponse(saveResponse);
          }
        }
        if (!cancelled) {
          updateCloudError('load', '');
          setCloudReady(true);
        }
      } catch (error) {
        if (!cancelled) updateCloudError('load', error.message);
      }
    }

    loadSharedRecords();
    return () => { cancelled = true; };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role !== 'admin' || !cloudReady) return;
    const syncRecords = (type, records) => {
      const previousSync = syncQueueRef.current[type] || Promise.resolve();
      const sync = previousSync.catch(() => {}).then(async () => {
        const response = await fetch(`/api/records?type=${encodeURIComponent(type)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(records)
        });
        await readJsonResponse(response);
        updateCloudError(type, '');
      }).catch((error) => {
        updateCloudError(type, error.message);
      });
      syncQueueRef.current[type] = sync;
    };
    syncRecords('products', products);
    syncRecords('officers', officers);
    syncRecords('dealers', dealers);
    syncRecords('stockInLogs', stockInLogs);
    syncRecords('damageLogs', damageLogs);
    syncRecords('payments', payments);
    syncRecords('salesAgreements', salesAgreements);
  }, [
    currentUser,
    cloudReady,
    products,
    officers,
    dealers,
    stockInLogs,
    damageLogs,
    payments,
    salesAgreements
  ]);

  // Helper: Flattened list of all product variants for 1-click selection with pack sizes
  const allProductVariants = useMemo(() => {
    return products.flatMap((p) =>
      (p.variants || []).map((v) => ({
        key: `${p.id}::${v.sku}`,
        productId: p.id,
        productName: p.name,
        category: p.category,
        generic: p.generic,
        sku: v.sku,
        size: v.size,
        packPerBox: Number(v.packPerBox) || 1,
        unit: v.unit || 'বোতল',
        cartonPrice: Number(v.cartonPrice) || (Number(v.tp || 0) * (Number(v.packPerBox) || 1)),
        tp: Number(v.tp) || 0,
        mrp: Number(v.mrp) || Math.round((Number(v.tp) || 0) * 1.25),
        commission: Number(v.commission) || 20,
        stockCartons: Number(v.stockCartons) || 0,
        stock: Number(v.stock) || 0,
        displayText: `${p.name} (${v.size})`
      }))
    );
  }, [products]);

  const createInvoicePayment = (invoice) => ({
    id: `PAY-${globalThis.crypto.randomUUID()}`,
    sourceInvoiceId: invoice.id,
    date: invoice.date,
    dealerId: invoice.dealerId,
    dealerName: invoice.dealerName,
    officerId: invoice.officerId,
    officerCode: invoice.officerCode,
    officerName: invoice.officerName,
    amount: Number(invoice.paidAmount),
    paymentMethod: normalizePaymentMethod(invoice.paymentMethod),
    reference: `চালান #${invoice.id}`,
    receivedBy: invoice.officerCode
      ? `অফিসার কোড ${normalizeOfficerCode(invoice.officerCode)}`
      : 'ক্যাশিয়ার',
    note: `ইনভয়েস #${invoice.id} এর বিপরীতে পরিশোধ`
  });

  const createInvoiceDamageLogs = (invoice) => (invoice.returnAdjustments || []).map((ret, index) => ({
    id: `DMG-${invoice.id}-${globalThis.crypto.randomUUID()}-${index}`,
    date: invoice.date,
    dealerId: invoice.dealerId,
    dealerName: invoice.dealerName,
    officerId: invoice.officerId,
    officerCode: invoice.officerCode,
    officerName: invoice.officerName,
    productId: ret.productId,
    productName: ret.productName,
    sku: ret.sku,
    size: ret.size,
    packPerBox: Number(ret.packPerBox) || 1,
    unit: ret.unit || 'পিস/বোতল',
    quantityPieces: Number(ret.quantity) || 1,
    unitPrice: Number(ret.price) || 0,
    totalDamageValue: Number(ret.total) || 0,
    reason: ret.reason || 'মেয়াদোত্তীর্ণ বা ক্ষতিগ্রস্ত পণ্য ফেরত',
    action: 'চালান হতে সমন্বয় কর্তন',
    actionType: 'ledger_credit',
    status: 'নিষ্পন্ন',
    invoiceRef: invoice.id
  }));

  // Create new Invoice with strict duplicate prevention, type tracking and stock update
  const createInvoice = async (newInvoice) => {
    let finalId = newInvoice.id;
    if (!finalId || invoices.some((inv) => inv.id === finalId)) {
      const { candidateId } = getNextInvoiceNumber(invoices);
      finalId = candidateId;
    }

    const calculatedTotalCartons = (newInvoice.items || []).reduce(
      (sum, it) => sum + (Number(it.cartons) || 0),
      0
    );

    const invoiceToSave = {
      ...newInvoice,
      ...getInvoicePaymentFields(newInvoice),
      id: finalId,
      invoiceType: newInvoice.invoiceType || 'regular', // 'regular' | 'dealer_return' | 'factory_damage'
      totalCartons: calculatedTotalCartons
    };

    const response = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceToSave)
    });
    const savedInvoice = await readJsonResponse(response);
    setInvoices((prev) => [savedInvoice, ...prev.filter((invoice) => invoice.id !== savedInvoice.id)]);

    // Send to MongoDB Atlas API
    setProducts((prevProducts) => applyInvoiceStockChanges(prevProducts, null, invoiceToSave));

    const damageEntries = createInvoiceDamageLogs(savedInvoice);
    if (damageEntries.length) {
      setDamageLogs((prev) => [...damageEntries, ...prev]);
    }

    // Record payment if paid
    if (Number(savedInvoice.paidAmount) > 0) {
      setPayments((prev) => [createInvoicePayment(savedInvoice), ...prev]);
    }

    return savedInvoice;
  };

  // Update existing invoice (Edit capability)
  const updateInvoice = async (updatedInvoice) => {
    const calculatedTotalCartons = (updatedInvoice.items || []).reduce(
      (sum, it) => sum + (Number(it.cartons) || 0),
      0
    );

    const finalInvoice = {
      ...updatedInvoice,
      ...getInvoicePaymentFields(updatedInvoice),
      totalCartons: calculatedTotalCartons
    };

    const previousInvoice = invoices.find((invoice) => invoice.id === finalInvoice.id);
    const response = await fetch('/api/invoices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice: finalInvoice })
    });
    const savedInvoice = await readJsonResponse(response);
    if (previousInvoice) {
      setProducts((prevProducts) =>
        applyInvoiceStockChanges(prevProducts, previousInvoice, savedInvoice)
      );
    }

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === savedInvoice.id ? savedInvoice : inv))
    );
    setDamageLogs((prev) => [
      ...createInvoiceDamageLogs(savedInvoice),
      ...prev.filter((entry) => entry.invoiceRef !== savedInvoice.id)
    ]);

    setPayments((prev) => {
      const retainedPayments = prev.filter((payment) => (
        payment.sourceInvoiceId !== savedInvoice.id
        && !(
          payment.reference === `চালান #${savedInvoice.id}`
          && payment.note === `ইনভয়েস #${savedInvoice.id} এর বিপরীতে পরিশোধ`
        )
      ));
      return Number(savedInvoice.paidAmount) > 0
        ? [createInvoicePayment(savedInvoice), ...retainedPayments]
        : retainedPayments;
    });

    return savedInvoice;
  };

  // Delete invoice
  const deleteInvoice = async (invoiceId, password) => {
    const response = await fetch('/api/invoices', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: invoiceId, password })
    });
    const result = await readJsonResponse(response);
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
    setDamageLogs((prev) => prev.filter((entry) => entry.invoiceRef !== invoiceId));
    setPayments((prev) => prev.filter((entry) => (
      entry.sourceInvoiceId !== invoiceId
      && !(entry.reference === `চালান #${invoiceId}` && entry.note === `ইনভয়েস #${invoiceId} এর বিপরীতে পরিশোধ`)
    )));
    if (invoice) {
      setProducts((prev) => applyInvoiceStockChanges(prev, invoice, null));
    }
    return result;
  };

  // Stock In (ডিস্ট্রিবিউশন অফিসে মালামাল গ্রহণ)
  const addStockIn = (stockEntry) => {
    const entry = {
      ...stockEntry,
      id: `STK-IN-${globalThis.crypto.randomUUID()}`
    };
    setStockInLogs((prev) => [entry, ...prev]);

    setProducts((prevProducts) =>
      prevProducts.map((prod) => {
        if (prod.id !== entry.productId) return prod;
        return {
          ...prod,
          variants: (prod.variants || []).map((v) => {
            if (v.sku !== entry.sku) return v;
            return {
              ...v,
              stockCartons: (Number(v.stockCartons) || 0) + Number(entry.cartons || 0),
              stock: (Number(v.stock) || 0) + Number(entry.quantityPieces || 0)
            };
          })
        };
      })
    );
  };

  // Record Damage / Return Log
  const recordDamageReturn = (damageEntry) => {
    const entry = {
      ...damageEntry,
      id: `DMG-${globalThis.crypto.randomUUID()}`,
      status: 'গৃহীত'
    };
    setDamageLogs((prev) => [entry, ...prev]);
  };

  // Record Payment
  const addDealerPayment = (paymentData) => {
    const newPayment = {
      ...paymentData,
      id: `PAY-${globalThis.crypto.randomUUID()}`,
    };
    setPayments((prev) => [newPayment, ...prev]);
  };

  const saveSalesAgreement = (agreement) => {
    const savedAgreement = {
      ...agreement,
      id: agreement.id || `AGR-${globalThis.crypto.randomUUID()}`
    };
    setSalesAgreements((previous) => {
      const exists = previous.some((entry) => entry.id === savedAgreement.id);
      return exists
        ? previous.map((entry) => entry.id === savedAgreement.id ? savedAgreement : entry)
        : [savedAgreement, ...previous];
    });
    return savedAgreement;
  };

  const deleteSalesAgreement = (agreementId) => {
    setSalesAgreements((previous) => previous.filter((entry) => entry.id !== agreementId));
  };

  // Add New Dealer with nationwide single continuous serial code 1, 2, 3...
  const addNewDealer = (dealerData) => {
    const nextCode = getNextDealerCode(dealers);
    const serial = Number(nextCode.match(/\d+$/)?.[0]);

    const newDlr = normalizeBusinessRecords('dealers', [{
      ...dealerData,
      id: `DLR-${serial}`,
      code: nextCode
    }], officers)[0];
    setDealers((prev) => [...prev, newDlr]);
    return newDlr;
  };

  // Add New Officer
  const addNewOfficer = (officerData) => {
    const code = normalizeOfficerCode(officerData.code, officerData.designation);
    if (!/^(SO|TSO|ASM|RSM)-\d{2,}$/.test(code)) {
      throw new Error('অফিসার কোডের সঠিক ফরম্যাট দিন।');
    }
    if (officers.some((officer) => normalizeOfficerCode(officer.code, officer.designation) === code)) {
      throw new Error('এই অফিসার কোডটি আগে থেকেই আছে।');
    }
    const newOff = {
      ...officerData,
      id: `OFF-${code}`,
      code
    };
    setOfficers((prev) => [...prev, newOff]);
    return newOff;
  };

  // Add Brand New Product to Catalog
  const addNewProduct = (productData) => {
    const newProd = {
      ...productData,
      id: `prod-${(products.length + 1).toString().padStart(2, '0')}`
    };
    setProducts((prev) => [...prev, newProd]);
  };

  // Add variant to existing product
  const addProductVariant = (productId, variantData) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          variants: [...(p.variants || []), variantData]
        };
      })
    );
  };

  // Calculate dealer summary & running due
  const getDealerSummary = (dealerId) => {
    const dealer = dealers.find((d) => d.id === dealerId || d.code === dealerId);
    if (!dealer) return null;

    const openingDue = Number(dealer.openingDue) || 0;
    const dealerInvoices = invoices.filter((inv) => inv.dealerId === dealer.id || inv.dealerCode === dealer.code);
    
    // Total purchases from regular invoices
    const regularInvoices = dealerInvoices.filter(isSalesInvoice);
    const totalPurchases = regularInvoices.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

    // Total returns (credit) from dealer_return invoices
    const returnInvoices = dealerInvoices.filter((inv) => inv.invoiceType === 'dealer_return');
    const totalReturnCredits = returnInvoices.reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

    const dealerPays = payments.filter((p) => (
      isDealerCollection(p) && (p.dealerId === dealer.id || p.dealerName === dealer.shopName)
    ));
    const totalPaid = dealerPays
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    const damageCredits = damageLogs
      .filter((d) => (d.dealerId === dealer.id || d.dealerName === dealer.shopName) && d.actionType === 'ledger_credit' && !d.invoiceRef)
      .reduce((acc, curr) => acc + (Number(curr.totalDamageValue) || 0), 0);

    const currentDue = openingDue + totalPurchases - totalReturnCredits - totalPaid - damageCredits;

    return {
      ...dealer,
      openingDue,
      totalPurchases,
      totalReturnCredits,
      totalPaid,
      damageCredits,
      currentDue: Math.max(0, currentDue),
      invoices: dealerInvoices,
      payments: dealerPays,
      damages: damageLogs.filter((d) => d.dealerId === dealer.id || d.dealerName === dealer.shopName)
    };
  };

  // Calculate Officer summary: Ranking by cartons sold
  const getOfficerSummary = (officerId) => {
    const officer = officers.find((o) => o.id === officerId || o.code === officerId);
    if (!officer) return null;

    const officerInvoices = invoices.filter(
      (inv) => inv.officerId === officer.id
        || normalizeOfficerCode(inv.officerCode, officer.designation)
          === normalizeOfficerCode(officer.code, officer.designation)
    );

    const totalSalesAmount = officerInvoices
      .filter(isSalesInvoice)
      .reduce((acc, curr) => acc + (Number(curr.grandTotal) || 0), 0);

    let totalCartonsSold = 0;
    officerInvoices
      .filter(isSalesInvoice)
      .forEach((inv) => {
        totalCartonsSold += Number(inv.totalCartons) || 0;
      });

    const officerPayments = payments.filter(
      (p) => p.officerId === officer.id
        || normalizeOfficerCode(p.officerCode, officer.designation)
          === normalizeOfficerCode(officer.code, officer.designation)
        || p.officerName === officer.name
    );
    const totalCollected = officerPayments.filter(isDealerCollection).reduce(
      (acc, curr) => acc + (Number(curr.amount) || 0),
      0
    );

    return {
      ...officer,
      invoiceCount: officerInvoices.length,
      totalSalesAmount,
      totalCartonsSold,
      totalCollected,
      invoices: officerInvoices,
      payments: officerPayments
    };
  };

  // Reset to factory data
  const resetToFactoryData = async () => {
    if (currentUser?.role !== 'admin') {
      throw new Error('এই রিসেট ব্যবহারের অনুমতি নেই।');
    }
    const confirmed = window.confirm(
      'সতর্কতা: রিসেট করলে পণ্য, স্টক, ইনভয়েস, ডিলার, সেলস ও কালেকশন চুক্তি এবং হিসাবসহ সব বর্তমান ডাটা মুছে যাবে এবং মূল ডাটায় ফিরে যাবে। আগে Excel ব্যাকআপ নিন। আপনি কি এগোতে চান?'
    );
    if (!confirmed) return false;

    const confirmationText = window.prompt('নিশ্চিত করতে RESET লিখুন।');
    if (confirmationText !== 'RESET') return false;
    const password = window.prompt('ফ্যাক্টরি রিসেট নিশ্চিত করতে আপনার অ্যাডমিন পাসওয়ার্ড দিন।');
    if (!password) return false;

    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'factory-reset', password })
    });
    await readJsonResponse(response);

    localStorage.removeItem('vap_products_v5');
    localStorage.removeItem('vap_officers_v5');
    localStorage.removeItem('vap_dealers_v5');
    localStorage.removeItem('vap_invoices_v5');
    localStorage.removeItem('vap_stock_in_v5');
    localStorage.removeItem('vap_damages_v5');
    localStorage.removeItem('vap_payments_v5');
    localStorage.removeItem('vap_sales_agreements_v1');

    setProducts(INITIAL_PRODUCTS);
    setOfficers(normalizeBusinessRecords('officers', INITIAL_OFFICERS));
    setDealers(normalizeBusinessRecords('dealers', INITIAL_DEALERS, INITIAL_OFFICERS));
    setInvoices(normalizeBusinessRecords('invoices', INITIAL_INVOICES));
    setStockInLogs(INITIAL_STOCK_IN);
    setDamageLogs(normalizeBusinessRecords('damageLogs', INITIAL_DAMAGES));
    setPayments(normalizeBusinessRecords('payments', INITIAL_PAYMENTS));
    setSalesAgreements([]);
    return true;
  };

  const clearSalesStockData = async (password) => {
    if (currentUser?.role !== 'admin') {
      throw new Error('এই রিসেট ব্যবহারের অনুমতি নেই।');
    }
    if (typeof password !== 'string' || !password) {
      throw new Error('রিসেট করতে অ্যাডমিন পাসওয়ার্ড দিন।');
    }
    const response = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear-sales-stock', password })
    });
    const result = await readJsonResponse(response);
    const clearedProducts = products.map((product) => ({
      ...product,
      variants: (product.variants || []).map((variant) => ({
        ...variant,
        stock: 0,
        stockCartons: 0
      }))
    }));
    const clearedDealers = dealers.map((dealer) => ({ ...dealer, openingDue: 0 }));
    localStorage.removeItem('vap_invoices_v5');
    localStorage.removeItem('vap_stock_in_v5');
    localStorage.removeItem('vap_damages_v5');
    localStorage.removeItem('vap_payments_v5');
    localStorage.removeItem('vap_sales_agreements_v1');
    localRecordsRef.current = {
      ...localRecordsRef.current,
      products: clearedProducts,
      dealers: clearedDealers,
      invoices: [],
      stockInLogs: [],
      damageLogs: [],
      payments: [],
      salesAgreements: []
    };
    setInvoices([]);
    setStockInLogs([]);
    setDamageLogs([]);
    setPayments([]);
    setSalesAgreements([]);
    setProducts(clearedProducts);
    setDealers(clearedDealers);
    syncErrorsRef.current.clear();
    setCloudError('');
    return result;
  };

  const exportBackup = (format = 'excel') => {
    const exportedAt = new Date().toISOString();
    const dateSuffix = exportedAt.slice(0, 10);
    if (format === 'json') {
      const backup = {
        version: 1,
        exportedAt,
        data: {
          products,
          officers,
          dealers,
          invoices,
          stockInLogs,
          damageLogs,
          payments,
          salesAgreements
        }
      };
      const backupBlob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const backupUrl = URL.createObjectURL(backupBlob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = backupUrl;
      downloadAnchor.download = `Valid_Agro_Backup_${dateSuffix}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(backupUrl), 1000);
      return;
    }
    const dataSets = [
      ['Products', products],
      ['Officers', officers],
      ['Dealers', dealers],
      ['Invoices', invoices],
      ['Stock In', stockInLogs],
      ['Damage Logs', damageLogs],
      ['Payments', payments],
      ['Sales Agreements', salesAgreements]
    ];
    let fileName;
    let mimeType;
    let contents;

    if (format === 'excel') {
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${createExcelWorksheet('Summary', [
    { Information: 'Valid Agro Products Ltd. / Mahananda Agro Industries' },
    { Information: `Exported at: ${exportedAt}` }
  ])}
  ${dataSets.map(([name, records]) => createExcelWorksheet(name, records)).join('\n')}
</Workbook>`;
      fileName = `Valid_Agro_Backup_${dateSuffix}.xls`;
      mimeType = 'application/vnd.ms-excel;charset=utf-8';
      contents = workbook;
    } else {
      const tables = dataSets.map(([name, records]) => {
        const columns = [...new Set(records.flatMap((record) => Object.keys(record || {})))];
        const headings = columns.length ? columns : ['তথ্য'];
        const rows = records.length ? records : [{}];
        return `<h2>${escapeXml(name)}</h2><table><thead><tr>${headings.map((column) => `<th>${escapeXml(column)}</th>`).join('')}</tr></thead><tbody>${rows.map((record) => (
          `<tr>${headings.map((column) => {
            const value = record?.[column];
            const cell = value != null && typeof value === 'object' ? JSON.stringify(value) : value ?? '';
            return `<td>${escapeXml(cell)}</td>`;
          }).join('')}</tr>`
        )).join('')}</tbody></table>`;
      }).join('');
      contents = `<!doctype html><html><head><meta charset="utf-8"><title>Valid Agro Backup</title><style>body{font-family:Arial,sans-serif}table{border-collapse:collapse;margin-bottom:24px;width:100%}th,td{border:1px solid #999;padding:6px;text-align:left;vertical-align:top}th{background:#e8f5e9}td{word-break:break-word}</style></head><body><h1>Valid Agro Backup</h1><p>${escapeXml(exportedAt)}</p>${tables}</body></html>`;

      if (format === 'google-docs') {
        fileName = `Valid_Agro_Backup_${dateSuffix}.html`;
        mimeType = 'text/html;charset=utf-8';
      } else {
        fileName = `Valid_Agro_Backup_${dateSuffix}.doc`;
        mimeType = 'application/msword;charset=utf-8';
      }
    }

    const backupBlob = new Blob([contents], { type: mimeType });
    const backupUrl = URL.createObjectURL(backupBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = backupUrl;
    downloadAnchor.download = fileName;
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(backupUrl), 1000);
  };

  const importBackup = async (backup, password) => {
    const recordTypes = [
      'products',
      'officers',
      'dealers',
      'invoices',
      'stockInLogs',
      'damageLogs',
      'payments',
      'salesAgreements'
    ];
    if (currentUser?.role !== 'admin') {
      throw new Error('ব্যাকআপ ইমপোর্ট করার অনুমতি নেই।');
    }
    if (!cloudReady) {
      throw new Error('ডেটাবেসের সঙ্গে সংযোগ সম্পন্ন হলে আবার চেষ্টা করুন।');
    }
    if (typeof password !== 'string' || !password) {
      throw new Error('ব্যাকআপ ইমপোর্টের জন্য পাসওয়ার্ড দিন।');
    }
    if (
      backup?.version !== 1
      || recordTypes.some((type) => (
        !Array.isArray(backup.data?.[type])
        || backup.data[type].some((record) => (
          !record || typeof record !== 'object' || Array.isArray(record)
        ))
      ))
    ) {
      throw new Error('সঠিক JSON ব্যাকআপ নির্বাচন করুন; সব ডেটা তালিকা থাকা আবশ্যক।');
    }
    const response = await fetch('/api/backup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...backup, password })
    });
    await readJsonResponse(response);
    setProducts(backup.data.products);
    setOfficers(normalizeBusinessRecords('officers', backup.data.officers));
    setDealers(normalizeBusinessRecords('dealers', backup.data.dealers, backup.data.officers));
    setInvoices(normalizeBusinessRecords('invoices', backup.data.invoices));
    setStockInLogs(backup.data.stockInLogs);
    setDamageLogs(normalizeBusinessRecords('damageLogs', backup.data.damageLogs));
    setPayments(normalizeBusinessRecords('payments', backup.data.payments));
    setSalesAgreements(normalizeBusinessRecords('salesAgreements', backup.data.salesAgreements));
  };

  const exportBackupExcel = () => exportBackup('excel');

  return (
    <AgroContext.Provider
      value={{
        products,
        officers,
        dealers,
        invoices,
        stockInLogs,
        damageLogs,
        payments,
        salesAgreements,
        allProductVariants,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        addStockIn,
        recordDamageReturn,
        addDealerPayment,
        saveSalesAgreement,
        deleteSalesAgreement,
        addNewDealer,
        addNewOfficer,
        addNewProduct,
        addProductVariant,
        getDealerSummary,
        getOfficerSummary,
        resetToFactoryData,
        clearSalesStockData,
        exportBackupExcel,
        exportBackup,
        importBackup,
        currentUser,
        authLoading,
        authError,
        cloudError,
        cloudReady,
        login,
        registerOfficer,
        logout,
        refreshSharedRecords
      }}
    >
      {children}
    </AgroContext.Provider>
  );
}

export function useAgro() {
  const context = useContext(AgroContext);
  if (!context) {
    throw new Error('useAgro must be used within an AgroProvider');
  }
  return context;
}

