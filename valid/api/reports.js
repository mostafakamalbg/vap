import { existsSync } from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import dbConnect from '../lib/mongodb.js';
import { BusinessRecord, Dealer, Invoice } from '../lib/models.js';
import { authorize } from '../lib/auth.js';
import { INVOICE_SESSIONS } from '../shared/sessions.js';
import { normalizeOfficerCode } from '../shared/codes.js';
import { isDealerCollection } from '../shared/paymentMethods.js';

const SALES_TYPES = ['dealer_return', 'factory_damage'];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function getDateFilter({ month, year, startDate, endDate }) {
  if (month) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw badRequest('মাস YYYY-MM ফরম্যাটে দিন।');
    const [yearNumber, monthNumber] = month.split('-').map(Number);
    const start = `${month}-01`;
    const end = new Date(Date.UTC(yearNumber, monthNumber, 0)).toISOString().slice(0, 10);
    return { $gte: start, $lte: end };
  }
  if (year) {
    if (!/^\d{4}$/.test(year)) throw badRequest('বছর YYYY ফরম্যাটে দিন।');
    return { $gte: `${year}-01-01`, $lte: `${year}-12-31` };
  }
  if (startDate || endDate) {
    if ((startDate && !isValidDate(startDate)) || (endDate && !isValidDate(endDate))) {
      throw badRequest('তারিখ YYYY-MM-DD ফরম্যাটে দিন।');
    }
    if (startDate && endDate && startDate > endDate) throw badRequest('শুরুর তারিখ শেষ তারিখের পরে হতে পারে না।');
    const range = {};
    if (startDate) range.$gte = startDate;
    if (endDate) range.$lte = endDate;
    return range;
  }
  return null;
}

function dateMatch(dateRange) {
  return dateRange ? { date: dateRange } : {};
}

function quantityExpression(field, fallback) {
  return {
    $cond: [
      { $gt: [{ $ifNull: [field, 0] }, 0] },
      field,
      fallback
    ]
  };
}

const cartonsExpression = {
  $cond: [
    { $gt: [{ $ifNull: ['$items.cartons', 0] }, 0] },
    '$items.cartons',
    {
      $cond: [
        { $gt: [{ $ifNull: ['$items.quantity', 0] }, 0] },
        '$items.quantity',
        {
          $divide: [
            { $ifNull: ['$items.totalPieces', 0] },
            { $max: [{ $ifNull: ['$items.packPerBox', 1] }, 1] }
          ]
        }
      ]
    }
  ]
};
const invoiceAmountExpression = {
  $cond: [
    { $ne: [{ $ifNull: ['$grandTotal', 0] }, 0] },
    '$grandTotal',
    { $ifNull: ['$totalAmount', 0] }
  ]
};
const piecesExpression = quantityExpression(
  '$items.totalPieces',
  {
    $multiply: [
      cartonsExpression,
      { $ifNull: ['$items.packPerBox', 1] }
    ]
  }
);

function isInvoicePayment(payment) {
  return /(?:invoice|চালান)\s*#/i.test(String(payment?.reference || ''));
}

function periodSession(dateValue) {
  const date = new Date(`${String(dateValue || '').slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return 'সেশন নির্ধারিত নয়';
  const year = date.getUTCFullYear();
  return date.getUTCMonth() < 6
    ? `জানুয়ারি - জুন ${year}`
    : `জুলাই - ডিসেম্বর ${year}`;
}

function money(value) {
  return Number(value) || 0;
}

async function getOfficerSales(query) {
  const { officerId, officerCode: requestedOfficerCode, month, year } = query;
  if (!officerId) throw badRequest('অফিসার নির্বাচন করুন।');
  if (month && year) throw badRequest('মাস অথবা বছর—একটি নির্বাচন করুন।');
  if (!month && !year) throw badRequest('রিপোর্টের মাস অথবা বছর দিন।');
  const range = getDateFilter({ month, year });
  const normalizedOfficerCode = normalizeOfficerCode(requestedOfficerCode || officerId);
  const officerConditions = [{ officerId: String(officerId) }];
  if (normalizedOfficerCode) officerConditions.push({ officerCode: normalizedOfficerCode });
  const [result = { sales: [], quantities: [] }] = await Invoice.aggregate([
    { $match: { $or: officerConditions, ...dateMatch(range) } },
    {
      $facet: {
        sales: [
          { $match: { invoiceType: { $nin: SALES_TYPES } } },
          {
            $group: {
              _id: null,
              totalSalesAmount: { $sum: invoiceAmountExpression },
              invoiceCollections: { $sum: { $ifNull: ['$paidAmount', 0] } },
              invoiceCount: { $sum: 1 }
            }
          }
        ],
        quantities: [
          { $match: { invoiceType: { $nin: SALES_TYPES } } },
          { $unwind: '$items' },
          {
            $group: {
              _id: null,
              totalItemsSold: { $sum: piecesExpression },
              totalCartonsSold: { $sum: cartonsExpression }
            }
          }
        ]
      }
    }
  ]);
  const paymentConditions = [{ 'data.officerId': String(officerId) }];
  if (normalizedOfficerCode) paymentConditions.push({ 'data.officerCode': normalizedOfficerCode });
  const payments = await BusinessRecord.find({
    type: 'payments',
    ...(range ? { 'data.date': range } : {}),
    $or: paymentConditions
  }).select('data').lean();
  const otherCollections = payments
    .map((record) => record.data)
    .filter((payment) => (
      isDealerCollection(payment)
      && !payment.sourceInvoiceId
      && !isInvoicePayment(payment)
    ))
    .reduce((sum, payment) => sum + money(payment.amount), 0);
  return {
    reportType: 'officer-sales',
    filters: {
      officerId: String(officerId),
      ...(normalizedOfficerCode ? { officerCode: normalizedOfficerCode } : {}),
      ...(month ? { month } : { year })
    },
    summary: {
      totalSalesAmount: money(result.sales[0]?.totalSalesAmount),
      invoiceCount: money(result.sales[0]?.invoiceCount),
      totalCollected: money(result.sales[0]?.invoiceCollections) + otherCollections,
      totalItemsSold: money(result.quantities[0]?.totalItemsSold),
      totalCartonsSold: money(result.quantities[0]?.totalCartonsSold)
    }
  };
}

async function getProductSales(query) {
  const { session, startDate, endDate } = query;
  if (session && !INVOICE_SESSIONS.includes(session)) throw badRequest('নির্বাচিত সেশনটি সঠিক নয়।');
  if (!session && !startDate && !endDate) throw badRequest('সেশন অথবা তারিখের সীমা দিন।');
  const range = getDateFilter({ startDate, endDate });
  const match = {
    invoiceType: { $ne: 'factory_damage' },
    ...(session ? { session } : {}),
    ...dateMatch(range)
  };
  const products = await Invoice.aggregate([
    { $match: match },
    { $unwind: '$items' },
    {
      $group: {
        _id: {
          productId: '$items.productId',
          sku: '$items.sku',
          productName: '$items.productName',
          size: '$items.size'
        },
        totalQuantitySold: {
          $sum: {
            $cond: [
              { $eq: ['$invoiceType', 'dealer_return'] },
              0,
              piecesExpression
            ]
          }
        },
        totalQuantityReturned: {
          $sum: {
            $cond: [
              { $eq: ['$invoiceType', 'dealer_return'] },
              piecesExpression,
              0
            ]
          }
        },
        cartonsSold: {
          $sum: {
            $cond: [
              { $eq: ['$invoiceType', 'dealer_return'] },
              0,
              cartonsExpression
            ]
          }
        },
        cartonsReturned: {
          $sum: {
            $cond: [
              { $eq: ['$invoiceType', 'dealer_return'] },
              cartonsExpression,
              0
            ]
          }
        },
        invoiceIds: { $addToSet: '$id' }
      }
    },
    {
      $project: {
        _id: 0,
        productId: '$_id.productId',
        sku: '$_id.sku',
        productName: '$_id.productName',
        size: '$_id.size',
        totalQuantitySold: 1,
        totalQuantityReturned: 1,
        netQuantity: { $subtract: ['$totalQuantitySold', '$totalQuantityReturned'] },
        cartonsSold: 1,
        cartonsReturned: 1,
        invoiceCount: { $size: '$invoiceIds' }
      }
    },
    { $sort: { productName: 1, size: 1 } }
  ]);
  return {
    reportType: 'product-sales',
    filters: session ? { session } : { ...(startDate ? { startDate } : {}), ...(endDate ? { endDate } : {}) },
    products
  };
}

async function getPayments(filter = {}) {
  const query = { type: 'payments' };
  const dealerConditions = [];
  if (filter.dealerId) dealerConditions.push({ 'data.dealerId': filter.dealerId });
  if (filter.dealerName) dealerConditions.push({ 'data.dealerName': filter.dealerName });
  if (dealerConditions.length) query.$or = dealerConditions;
  return BusinessRecord.find(query).select('data').lean();
}

async function getLedgerCredits(filter = {}) {
  const query = {
    type: 'damageLogs',
    'data.actionType': 'ledger_credit',
    'data.invoiceRef': { $in: [null, ''] }
  };
  const dealerConditions = [];
  if (filter.dealerId) dealerConditions.push({ 'data.dealerId': filter.dealerId });
  if (filter.dealerName) dealerConditions.push({ 'data.dealerName': filter.dealerName });
  if (dealerConditions.length) query.$or = dealerConditions;
  return BusinessRecord.find(query).select('data').lean();
}

async function getDealerLedger(query) {
  const dealerId = String(query.dealerId || '');
  if (!dealerId) throw badRequest('ডিলার নির্বাচন করুন।');
  const dealer = await Dealer.findOne({ $or: [{ id: dealerId }, { code: dealerId }] }).lean();
  if (!dealer) return null;
  const dealerMatch = {
    $or: [{ dealerId: dealer.id }, { dealerCode: dealer.code }]
  };
  const [invoiceTotals = {}] = await Invoice.aggregate([
    { $match: dealerMatch },
    {
      $group: {
        _id: null,
        billAmount: {
          $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, invoiceAmountExpression, 0] }
        },
        returnAmount: {
          $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, invoiceAmountExpression, 0] }
        },
        invoicePayments: {
          $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, { $ifNull: ['$paidAmount', 0] }, 0] }
        }
      }
    }
  ]);
  const [payments, creditRecords] = await Promise.all([
    getPayments({ dealerId: dealer.id, dealerName: dealer.shopName }),
    getLedgerCredits({ dealerId: dealer.id, dealerName: dealer.shopName })
  ]);
  const manualPayments = payments
    .map((record) => record.data)
    .filter((payment) => !isInvoicePayment(payment))
    .reduce((total, payment) => total + money(payment.amount), 0);
  const damageCredits = creditRecords
    .map((record) => record.data)
    .reduce((total, credit) => total + money(credit.totalDamageValue), 0);
  const totalPaidAmount = money(invoiceTotals.invoicePayments) + manualPayments;
  const totalBillAmount = money(invoiceTotals.billAmount);
  const totalReturnAmount = money(invoiceTotals.returnAmount);
  const openingDue = money(dealer.openingDue);
  return {
    reportType: 'dealer-ledger',
    dealer: { id: dealer.id, code: dealer.code, shopName: dealer.shopName },
    summary: {
      openingDue,
      totalBillAmount,
      totalReturnAmount,
      totalPaidAmount,
      damageCredits,
      currentNetDue: openingDue + totalBillAmount - totalReturnAmount - totalPaidAmount - damageCredits
    }
  };
}

async function getCurrentCompanyDue() {
  const [invoiceTotals = {}] = await Invoice.aggregate([
    {
      $group: {
        _id: null,
        bills: {
          $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, invoiceAmountExpression, 0] }
        },
        returns: {
          $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, invoiceAmountExpression, 0] }
        },
        invoicePayments: {
          $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, { $ifNull: ['$paidAmount', 0] }, 0] }
        }
      }
    }
  ]);
  const [dealerTotals = {}] = await Dealer.aggregate([
    { $group: { _id: null, openingDue: { $sum: { $ifNull: ['$openingDue', 0] } } } }
  ]);
  const [payments, creditRecords] = await Promise.all([getPayments(), getLedgerCredits()]);
  const manualPayments = payments
    .map((record) => record.data)
    .filter((payment) => !isInvoicePayment(payment))
    .reduce((total, payment) => total + money(payment.amount), 0);
  const damageCredits = creditRecords
    .map((record) => record.data)
    .reduce((total, credit) => total + money(credit.totalDamageValue), 0);
  return money(dealerTotals.openingDue)
    + money(invoiceTotals.bills)
    - money(invoiceTotals.returns)
    - money(invoiceTotals.invoicePayments)
    - manualPayments
    - damageCredits;
}

function companyPeriod(period) {
  if (!['6m', '1y'].includes(period)) throw badRequest('সময়কাল 6m অথবা 1y হতে হবে।');
  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - (period === '6m' ? 6 : 12));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

async function getCompanyReport(query) {
  const period = companyPeriod(query.period || '6m');
  const dateRange = { $gte: period.startDate, $lte: period.endDate };
  const invoiceMatch = dateMatch(dateRange);
  const [summaries, movements, paymentRecords, stockEntries] = await Promise.all([
    Invoice.aggregate([
      { $match: invoiceMatch },
      {
        $group: {
          _id: { $ifNull: ['$session', 'সেশন নির্ধারিত নয়'] },
          totalSales: {
            $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, invoiceAmountExpression, 0] }
          },
          returns: {
            $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, invoiceAmountExpression, 0] }
          },
          invoiceCashCollected: {
            $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, { $ifNull: ['$paidAmount', 0] }, 0] }
          }
        }
      }
    ]),
    Invoice.aggregate([
      { $match: invoiceMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: {
            session: { $ifNull: ['$session', 'সেশন নির্ধারিত নয়'] },
            productId: '$items.productId',
            sku: '$items.sku',
            productName: '$items.productName',
            size: '$items.size'
          },
          cartonsSold: {
            $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, cartonsExpression, 0] }
          },
          cartonsReturned: {
            $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, cartonsExpression, 0] }
          },
          piecesSold: {
            $sum: { $cond: [{ $not: [{ $in: ['$invoiceType', SALES_TYPES] }] }, piecesExpression, 0] }
          },
          piecesReturned: {
            $sum: { $cond: [{ $eq: ['$invoiceType', 'dealer_return'] }, piecesExpression, 0] }
          },
          piecesDamaged: {
            $sum: { $cond: [{ $eq: ['$invoiceType', 'factory_damage'] }, piecesExpression, 0] }
          }
        }
      },
      { $sort: { '_id.session': 1, '_id.productName': 1, '_id.size': 1 } }
    ]),
    getPayments(),
    BusinessRecord.find({
      type: 'stockInLogs',
      'data.date': dateRange
    }).select('data').lean()
  ]);
  const sessions = new Map();
  for (const summary of summaries) {
    sessions.set(String(summary._id), {
      session: String(summary._id),
      totalSales: money(summary.totalSales),
      cashCollected: money(summary.invoiceCashCollected),
      outstandingDue: money(summary.totalSales) - money(summary.returns) - money(summary.invoiceCashCollected),
      itemStockMovements: []
    });
  }
  for (const movement of movements) {
    const sessionName = String(movement._id.session);
    if (!sessions.has(sessionName)) {
      sessions.set(sessionName, {
        session: sessionName,
        totalSales: 0,
        cashCollected: 0,
        outstandingDue: 0,
        itemStockMovements: []
      });
    }
    sessions.get(sessionName).itemStockMovements.push({
      productId: movement._id.productId,
      productName: movement._id.productName,
      sku: movement._id.sku,
      size: movement._id.size,
      cartonsSold: money(movement.cartonsSold),
      cartonsReturned: money(movement.cartonsReturned),
      cartonsReceived: 0,
      piecesSold: money(movement.piecesSold),
      piecesReturned: money(movement.piecesReturned),
      piecesDamaged: money(movement.piecesDamaged),
      piecesReceived: 0,
      netStockChangePieces: money(movement.piecesReturned) - money(movement.piecesSold) - money(movement.piecesDamaged)
    });
  }
  for (const record of stockEntries) {
    const entry = record.data || {};
    const sessionName = entry.session || periodSession(entry.date);
    if (!isValidDate(String(entry.date || ''))) continue;
    if (!sessions.has(sessionName)) {
      sessions.set(sessionName, {
        session: sessionName,
        totalSales: 0,
        cashCollected: 0,
        outstandingDue: 0,
        itemStockMovements: []
      });
    }
    const sessionReport = sessions.get(sessionName);
    let itemMovement = sessionReport.itemStockMovements.find((item) => (
      item.productId === entry.productId && item.sku === entry.sku
    ));
    if (!itemMovement) {
      itemMovement = {
        productId: entry.productId,
        productName: entry.productName,
        sku: entry.sku,
        size: entry.size,
        cartonsSold: 0,
        cartonsReturned: 0,
        cartonsReceived: 0,
        piecesSold: 0,
        piecesReturned: 0,
        piecesDamaged: 0,
        piecesReceived: 0,
        netStockChangePieces: 0
      };
      sessionReport.itemStockMovements.push(itemMovement);
    }
    const cartonsReceived = money(entry.cartons);
    const piecesReceived = money(entry.quantityPieces)
      || cartonsReceived * (money(entry.packPerBox) || 1);
    itemMovement.cartonsReceived += cartonsReceived;
    itemMovement.piecesReceived += piecesReceived;
    itemMovement.netStockChangePieces += piecesReceived;
  }
  for (const record of paymentRecords) {
    const payment = record.data || {};
    const paymentDate = String(payment.date || '');
    if (
      isInvoicePayment(payment)
      || !isValidDate(paymentDate)
      || paymentDate < period.startDate
      || paymentDate > period.endDate
    ) continue;
    const sessionName = periodSession(paymentDate);
    if (!sessions.has(sessionName)) {
      sessions.set(sessionName, {
        session: sessionName,
        totalSales: 0,
        cashCollected: 0,
        outstandingDue: 0,
        itemStockMovements: []
      });
    }
    const amount = money(payment.amount);
    sessions.get(sessionName).cashCollected += amount;
    sessions.get(sessionName).outstandingDue -= amount;
  }

  const sessionRows = [...sessions.values()].sort((a, b) => a.session.localeCompare(b.session, 'bn'));
  const totalSales = sessionRows.reduce((total, row) => total + row.totalSales, 0);
  const cashCollected = sessionRows.reduce((total, row) => total + row.cashCollected, 0);
  return {
    reportType: 'company-session',
    period,
    summary: {
      totalSales,
      totalCashCollected: cashCollected,
      totalOutstandingDue: await getCurrentCompanyDue()
    },
    sessions: sessionRows
  };
}

async function createExcel(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MOHANANDA AGRO INDUSTRIES';
  workbook.title = 'Mohananda Agro Industries Sales Report';
  workbook.subject = 'Sales, collection and inventory report';
  workbook.created = new Date();
  const addSheet = (name, rows) => {
    const sheet = workbook.addWorksheet(name);
    const columns = rows.length
      ? Object.keys(rows[0]).map((key) => ({ header: key, key, width: 22 }))
      : [{ header: 'তথ্য', key: 'info', width: 28 }];
    sheet.columns = columns.map(({ key, width }) => ({ key, width }));
    [
      'MOHANANDA AGRO INDUSTRIES',
      'মহানন্দা এগ্রো ইন্ডাস্ট্রিজ',
      'Agricultural Commodities Importer, Repacker & Supplier',
      'Office/Factory: Matidali, Bogra Sadar, Bogra | Mob: 01713-736920, 01773-523723 | E-mail: mohananda.agro@gmail.com'
    ].forEach((value, index) => {
      const row = sheet.addRow([value]);
      if (columns.length > 1) sheet.mergeCells(row.number, 1, row.number, columns.length);
      row.font = { bold: index < 2, size: index === 0 ? 16 : index === 1 ? 13 : 10 };
      row.alignment = { horizontal: 'center' };
    });
    sheet.addRow([]);
    sheet.addRow(columns.map((column) => column.header)).font = { bold: true };
    if (rows.length) {
      rows.forEach((row) => sheet.addRow(columns.map((column) => row[column.key] ?? '')));
    } else {
      sheet.addRow(['কোনো তথ্য নেই']);
    }
    sheet.views = [{ state: 'frozen', ySplit: 6 }];
  };

  if (report.reportType === 'company-session') {
    addSheet('Summary', [{
      ...report.period,
      ...report.summary
    }]);
    addSheet('Session Summary', report.sessions.map((session) => ({
      session: session.session,
      totalSales: session.totalSales,
      cashCollected: session.cashCollected,
      outstandingDue: session.outstandingDue
    })));
    addSheet('Stock Movements', report.sessions.flatMap((session) => (
      session.itemStockMovements.map((item) => ({ session: session.session, ...item }))
    )));
  } else if (report.reportType === 'product-sales') {
    addSheet('Product Sales', report.products);
  } else {
    addSheet('Summary', [{
      ...(report.dealer || {}),
      ...(report.summary || {})
    }]);
  }
  return workbook.xlsx.writeBuffer();
}

function reportRows(report) {
  if (report.reportType === 'company-session') {
    return [
      ...Object.entries(report.summary).map(([key, value]) => `${key}: ${value}`),
      ...report.sessions.flatMap((session) => [
      `${session.session} | বিক্রয়: ${session.totalSales} | আদায়: ${session.cashCollected} | বকেয়া: ${session.outstandingDue}`,
      ...session.itemStockMovements.map((item) => (
        `  ${item.productName || item.productId} (${item.size || item.sku}) | বিক্রি: ${item.piecesSold} | ফেরত: ${item.piecesReturned} | ক্ষতি: ${item.piecesDamaged}`
      ))
      ])
    ];
  }
  const records = report.products || report.items || [];
  if (records.length) {
    return records.map((item) => Object.entries(item)
      .map(([key, value]) => `${key}: ${value ?? ''}`)
      .join(' | '));
  }
  return Object.entries(report.summary || {})
    .map(([key, value]) => `${key}: ${value}`);
}

async function createPdf(report) {
  const fontPath = process.env.REPORT_FONT_PATH
    ? path.resolve(process.env.REPORT_FONT_PATH)
    : path.resolve(process.cwd(), 'public', 'fonts', 'Nirmala.ttf');
  if (!existsSync(fontPath)) {
    const error = new Error('PDF export-এর জন্য REPORT_FONT_PATH-এ বাংলা সমর্থিত TTF ফন্ট সেট করুন।');
    error.statusCode = 503;
    throw error;
  }
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ margin: 48, size: 'A4', bufferPages: true });
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.font(fontPath);
    document.fontSize(17).text('MOHANANDA AGRO INDUSTRIES', { align: 'center' });
    document.fontSize(13).text('মহানন্দা এগ্রো ইন্ডাস্ট্রিজ', { align: 'center' });
    document.moveDown(0.2).fontSize(9).text('Agricultural Commodities Importer, Repacker & Supplier', { align: 'center' });
    document.fontSize(8).text('Office/Factory: Matidali, Bogra Sadar, Bogra', { align: 'center' });
    document.text('Mob: 01713-736920, 01773-523723 • E-mail: mohananda.agro@gmail.com', { align: 'center' });
    document.moveDown(0.5).fontSize(10).text(`Report: ${report.reportType}`);
    document.moveDown();
    for (const line of reportRows(report)) {
      document.fontSize(9).text(String(line), { width: 500 });
    }
    document.end();
  });
}

function fileNameFor(type, format) {
  return `valid-agro-${type}-${new Date().toISOString().slice(0, 10)}.${format}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    if (!await dbConnect()) return res.status(503).json({ error: 'MongoDB is not configured.' });
    if (!await authorize(req, res, ['admin'])) return;

    const type = String(req.query?.type || '');
    let report;
    if (type === 'officer-sales') report = await getOfficerSales(req.query || {});
    else if (type === 'product-sales') report = await getProductSales(req.query || {});
    else if (type === 'dealer-ledger') report = await getDealerLedger(req.query || {});
    else if (type === 'company-session') report = await getCompanyReport(req.query || {});
    else return res.status(400).json({ error: 'Unknown report type.' });

    if (!report) return res.status(404).json({ error: 'ডিলার পাওয়া যায়নি।' });
    const format = String(req.query?.format || '').toLowerCase();
    if (!format) return res.status(200).json(report);

    const downloadFormat = format === 'xlsx' ? 'excel' : format;
    if (!['excel', 'pdf'].includes(downloadFormat)) {
      return res.status(400).json({ error: 'format excel, xlsx অথবা pdf হতে হবে।' });
    }
    const content = downloadFormat === 'pdf'
      ? await createPdf(report)
      : await createExcel(report);
    const extension = downloadFormat === 'excel' ? 'xlsx' : 'pdf';
    const contentType = downloadFormat === 'excel'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/pdf';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileNameFor(type, extension)}"`);
    return res.status(200).send(content);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Report generation failed:', error);
    return res.status(500).json({ error: 'রিপোর্ট তৈরি করা যায়নি।' });
  }
}
