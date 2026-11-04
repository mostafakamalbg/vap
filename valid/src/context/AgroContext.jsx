import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  INITIAL_PRODUCTS,
  INITIAL_OFFICERS,
  INITIAL_DEALERS,
  INITIAL_INVOICES,
  INITIAL_STOCK_IN,
  INITIAL_DAMAGES,
  INITIAL_PAYMENTS
} from '../data/initialData';

const AgroContext = createContext();

const isSalesInvoice = (invoice) =>
  invoice.invoiceType !== 'dealer_return' && invoice.invoiceType !== 'factory_damage';

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

function getInvoiceStockMovements(invoice) {
  const direction = invoice.invoiceType === 'dealer_return' ? 1 : -1;
  const movements = new Map();

  (invoice.items || []).forEach((item) => {
    if (!item.productId || !item.sku) return;

    const key = `${item.productId}\u0000${item.sku}`;
    const cartons = Number(item.cartons) || 0;
    const pieces = item.totalPieces != null
      ? Number(item.totalPieces) || 0
      : cartons * (Number(item.packPerBox) || 0);
    const movement = movements.get(key) || {
      productId: item.productId,
      sku: item.sku,
      cartons: 0,
      pieces: 0
    };

    movement.cartons += cartons * direction;
    movement.pieces += pieces * direction;
    movements.set(key, movement);
  });

  return movements;
}

export function getInvoiceStockChanges(previousInvoice, nextInvoice) {
  const changes = new Map();

  [[previousInvoice, -1], [nextInvoice, 1]].forEach(([invoice, multiplier]) => {
    if (!invoice) return;

    getInvoiceStockMovements(invoice).forEach((movement, key) => {
      const change = changes.get(key) || {
        productId: movement.productId,
        sku: movement.sku,
        cartons: 0,
        pieces: 0
      };
      change.cartons += movement.cartons * multiplier;
      change.pieces += movement.pieces * multiplier;
      changes.set(key, change);
    });
  });

  return changes;
}

function applyInvoiceStockChanges(products, previousInvoice, nextInvoice) {
  const changes = getInvoiceStockChanges(previousInvoice, nextInvoice);

  return products.map((product) => {
    const productChanges = [...changes.values()].filter((change) => change.productId === product.id);
    if (productChanges.length === 0) return product;

    return {
      ...product,
      variants: (product.variants || []).map((variant) => {
        const change = productChanges.find((entry) => entry.sku === variant.sku);
        if (!change) return variant;

        return {
          ...variant,
          stockCartons: Math.max(0, (Number(variant.stockCartons) || 0) + change.cartons),
          stock: Math.max(0, (Number(variant.stock) || 0) + change.pieces)
        };
      })
    };
  });
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

export function AgroProvider({ children }) {
  // Version 5 storage keys for continuous serial 1 to 83 dealer codes and 26 products
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('vap_products_v5');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [officers, setOfficers] = useState(() => {
    const saved = localStorage.getItem('vap_officers_v5');
    return saved ? JSON.parse(saved) : INITIAL_OFFICERS;
  });

  const [dealers, setDealers] = useState(() => {
    const saved = localStorage.getItem('vap_dealers_v5');
    return saved ? JSON.parse(saved) : INITIAL_DEALERS;
  });

  const [invoices, setInvoices] = useState(() => {
    const saved = localStorage.getItem('vap_invoices_v5');
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [stockInLogs, setStockInLogs] = useState(() => {
    const saved = localStorage.getItem('vap_stock_in_v5');
    return saved ? JSON.parse(saved) : INITIAL_STOCK_IN;
  });

  const [damageLogs, setDamageLogs] = useState(() => {
    const saved = localStorage.getItem('vap_damages_v5');
    return saved ? JSON.parse(saved) : INITIAL_DAMAGES;
  });

  const [payments, setPayments] = useState(() => {
    const saved = localStorage.getItem('vap_payments_v5');
    return saved ? JSON.parse(saved) : INITIAL_PAYMENTS;
  });

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

  // Optional: Attempt to load from MongoDB Atlas API on mount
  useEffect(() => {
    async function loadFromApi() {
      try {
        const res = await fetch('/api/invoices');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setInvoices(data);
          }
        }
      } catch (err) {
        // Silently fallback to localStorage
      }
    }
    loadFromApi();
  }, []);

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
        displayText: `${p.name} — ${v.size} (কার্টুন দর: ৳${Number(v.cartonPrice || 0).toLocaleString()})`
      }))
    );
  }, [products]);

  // Create new Invoice with strict duplicate prevention, type tracking and stock update
  const createInvoice = (newInvoice) => {
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
      id: finalId,
      invoiceType: newInvoice.invoiceType || 'regular', // 'regular' | 'dealer_return' | 'factory_damage'
      totalCartons: calculatedTotalCartons
    };

    setInvoices((prev) => [invoiceToSave, ...prev]);

    // Send to MongoDB Atlas API
    fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceToSave)
    }).catch(() => {});

    setProducts((prevProducts) => applyInvoiceStockChanges(prevProducts, null, invoiceToSave));

    // If loose damage or returns exist inside this invoice, log them
    if (invoiceToSave.returnAdjustments && invoiceToSave.returnAdjustments.length > 0) {
      invoiceToSave.returnAdjustments.forEach((ret) => {
        const dmgEntry = {
          id: `DMG-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
          date: invoiceToSave.date,
          dealerId: invoiceToSave.dealerId,
          dealerName: invoiceToSave.dealerName,
          officerId: invoiceToSave.officerId,
          officerCode: invoiceToSave.officerCode,
          officerName: invoiceToSave.officerName,
          productId: ret.productId,
          productName: ret.productName,
          sku: ret.sku,
          size: ret.size,
          quantityPieces: Number(ret.quantity) || 1,
          unitPrice: Number(ret.price) || 0,
          totalDamageValue: Number(ret.total) || 0,
          reason: ret.reason || 'মেয়াদোত্তীর্ণ বা ক্ষতিগ্রস্ত পণ্য ফেরত',
          action: 'চালান হতে সমন্বয় কর্তন',
          actionType: 'ledger_credit',
          status: 'নিষ্পন্ন',
          invoiceRef: finalId
        };
        setDamageLogs((prev) => [dmgEntry, ...prev]);
      });
    }

    // Record payment if paid
    if (Number(invoiceToSave.paidAmount) > 0) {
      const paymentRecord = {
        id: `PAY-${Date.now().toString().slice(-6)}`,
        date: invoiceToSave.date,
        dealerId: invoiceToSave.dealerId,
        dealerName: invoiceToSave.dealerName,
        officerId: invoiceToSave.officerId,
        officerCode: invoiceToSave.officerCode,
        officerName: invoiceToSave.officerName,
        amount: Number(invoiceToSave.paidAmount),
        paymentMethod: invoiceToSave.paymentMethod || 'নগদ জমা',
        reference: `চালান #${finalId}`,
        receivedBy: invoiceToSave.officerCode ? `অফিসার কোড ${invoiceToSave.officerCode}` : 'ক্যাশিয়ার',
        note: `ইনভয়েস #${finalId} এর বিপরীতে পরিশোধ`
      };
      setPayments((prev) => [paymentRecord, ...prev]);
    }

    return invoiceToSave;
  };

  // Update existing invoice (Edit capability)
  const updateInvoice = (updatedInvoice) => {
    const calculatedTotalCartons = (updatedInvoice.items || []).reduce(
      (sum, it) => sum + (Number(it.cartons) || 0),
      0
    );

    const finalInvoice = {
      ...updatedInvoice,
      totalCartons: calculatedTotalCartons
    };

    const previousInvoice = invoices.find((invoice) => invoice.id === finalInvoice.id);
    if (previousInvoice) {
      setProducts((prevProducts) =>
        applyInvoiceStockChanges(prevProducts, previousInvoice, finalInvoice)
      );
    }

    setInvoices((prev) =>
      prev.map((inv) => (inv.id === finalInvoice.id ? finalInvoice : inv))
    );

    // Sync to API
    fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalInvoice)
    }).catch(() => {});

    return finalInvoice;
  };

  // Delete invoice
  const deleteInvoice = (invoiceId) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== invoiceId));
  };

  // Stock In (ডিস্ট্রিবিউশন অফিসে মালামাল গ্রহণ)
  const addStockIn = (stockEntry) => {
    const entry = {
      ...stockEntry,
      id: `STK-IN-${Date.now().toString().slice(-6)}`
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
      id: `DMG-${Date.now().toString().slice(-6)}`,
      status: 'গৃহীত'
    };
    setDamageLogs((prev) => [entry, ...prev]);
  };

  // Record Payment
  const addDealerPayment = (paymentData) => {
    const newPayment = {
      ...paymentData,
      id: `PAY-${Date.now().toString().slice(-6)}`
    };
    setPayments((prev) => [newPayment, ...prev]);
  };

  // Add New Dealer with nationwide single continuous serial code 1, 2, 3...
  const addNewDealer = (dealerData) => {
    let maxCode = 0;
    dealers.forEach((d) => {
      const num = parseInt(d.code, 10);
      if (!isNaN(num) && num > maxCode) maxCode = num;
    });
    const nextCode = String(maxCode + 1);

    const newDlr = {
      ...dealerData,
      id: `DLR-${nextCode}`,
      code: nextCode
    };
    setDealers((prev) => [...prev, newDlr]);
    return newDlr;
  };

  // Add New Officer
  const addNewOfficer = (officerData) => {
    const newOff = {
      ...officerData,
      id: `OFF-${officerData.code || (officers.length + 1)}`,
      code: String(officerData.code || (officers.length + 1))
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

    const dealerPays = payments.filter((p) => p.dealerId === dealer.id || p.dealerName === dealer.shopName);
    const totalPaid = dealerPays.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

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
      (inv) => inv.officerId === officer.id || inv.officerCode === officer.code
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
      (p) => p.officerId === officer.id || p.officerCode === officer.code || p.officerName === officer.name
    );
    const totalCollected = officerPayments.reduce(
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
  const resetToFactoryData = () => {
    const confirmed = window.confirm(
      'সতর্কতা: রিসেট করলে পণ্য, স্টক, ইনভয়েস, ডিলার ও হিসাবসহ সব বর্তমান ডাটা মুছে যাবে এবং মূল ডাটায় ফিরে যাবে। আগে Excel ব্যাকআপ নিন। আপনি কি এগোতে চান?'
    );
    if (!confirmed) return;

    const confirmationText = window.prompt('নিশ্চিত করতে RESET লিখুন।');
    if (confirmationText !== 'RESET') return;

    localStorage.removeItem('vap_products_v5');
    localStorage.removeItem('vap_officers_v5');
    localStorage.removeItem('vap_dealers_v5');
    localStorage.removeItem('vap_invoices_v5');
    localStorage.removeItem('vap_stock_in_v5');
    localStorage.removeItem('vap_damages_v5');
    localStorage.removeItem('vap_payments_v5');

    setProducts(INITIAL_PRODUCTS);
    setOfficers(INITIAL_OFFICERS);
    setDealers(INITIAL_DEALERS);
    setInvoices(INITIAL_INVOICES);
    setStockInLogs(INITIAL_STOCK_IN);
    setDamageLogs(INITIAL_DAMAGES);
    setPayments(INITIAL_PAYMENTS);
  };

  // Export each dataset to its own Excel-compatible worksheet.
  const exportBackupExcel = () => {
    const exportedAt = new Date().toISOString();
    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${createExcelWorksheet('Summary', [
    { Information: 'Valid Agro Products Ltd. & Mahananda Agro Industries' },
    { Information: `Exported at: ${exportedAt}` }
  ])}
  ${createExcelWorksheet('Products', products)}
  ${createExcelWorksheet('Officers', officers)}
  ${createExcelWorksheet('Dealers', dealers)}
  ${createExcelWorksheet('Invoices', invoices)}
  ${createExcelWorksheet('Stock In', stockInLogs)}
  ${createExcelWorksheet('Damage Logs', damageLogs)}
  ${createExcelWorksheet('Payments', payments)}
</Workbook>`;
    const backupBlob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const backupUrl = URL.createObjectURL(backupBlob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', backupUrl);
    downloadAnchor.setAttribute('download', `Valid_Agro_Backup_${exportedAt.slice(0, 10)}.xls`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(backupUrl), 1000);
  };

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
        allProductVariants,
        createInvoice,
        updateInvoice,
        deleteInvoice,
        addStockIn,
        recordDamageReturn,
        addDealerPayment,
        addNewDealer,
        addNewOfficer,
        addNewProduct,
        addProductVariant,
        getDealerSummary,
        getOfficerSummary,
        resetToFactoryData,
        exportBackupExcel
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
