import mongoose from 'mongoose';
import dbConnect from '../lib/mongodb.js';
import {
  BusinessRecord,
  Invoice,
  MonthlySalesCollection,
  Payment
} from '../lib/models.js';
import { transactionOptions, withTransactionFallback } from '../lib/transactions.js';
import { isCurrentSession } from '../shared/sessions.js';

const cutoffDate = '2025-07-01';
const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes('--confirm=PURGE_PRE_2025_07');

if (apply && !confirmed) {
  throw new Error('Apply requires --confirm=PURGE_PRE_2025_07.');
}
if (!process.env.MONGODB_URI?.trim() && !process.env.MONGO_URI?.trim()) {
  throw new Error('Set MONGODB_URI or MONGO_URI before running the cleanup.');
}
if (!await dbConnect()) throw new Error('Could not connect to MongoDB.');

try {
  const [oldInvoices, reports, legacyRecords] = await Promise.all([
    Invoice.find({ date: { $lt: cutoffDate } }).select('_id id').lean(),
    MonthlySalesCollection.find({})
      .select('_id session reportingDate')
      .lean(),
    BusinessRecord.find({ type: { $in: ['payments', 'stockInLogs', 'damageLogs'] } })
      .select('_id type data')
      .lean()
  ]);
  const oldInvoiceIds = new Set(oldInvoices.map((invoice) => String(invoice.id)));
  const oldReportIds = reports
    .filter((report) => String(report.reportingDate || '') < cutoffDate || !isCurrentSession(report.session))
    .map((report) => report._id);
  const oldTypedPayments = await Payment.find({
    $or: [
      { date: { $lt: cutoffDate } },
      { sourceInvoiceId: { $in: [...oldInvoiceIds] } }
    ]
  }).select('_id').lean();
  const oldLegacyRecords = legacyRecords.filter((record) => {
    const date = String(record.data?.date || '');
    if (record.type === 'payments') {
      return date < cutoffDate || oldInvoiceIds.has(String(record.data?.sourceInvoiceId || ''));
    }
    return date && date < cutoffDate;
  }).map((record) => record._id);

  const summary = {
    invoices: oldInvoices.length,
    payments: oldTypedPayments.length,
    legacyPaymentAndMovementRecords: oldLegacyRecords.length,
    monthlyReports: oldReportIds.length
  };
  console.log(`${apply ? 'Deleting' : 'Dry run'} records before ${cutoffDate}:`);
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log('No data was changed. Add --apply --confirm=PURGE_PRE_2025_07 to permanently delete these records.');
  } else {
    await withTransactionFallback(async (session) => {
      const options = transactionOptions(session);
      await Invoice.deleteMany({ _id: { $in: oldInvoices.map((invoice) => invoice._id) } }, options);
      await Payment.deleteMany({ _id: { $in: oldTypedPayments.map((payment) => payment._id) } }, options);
      await BusinessRecord.deleteMany({ _id: { $in: oldLegacyRecords } }, options);
      await MonthlySalesCollection.deleteMany({ _id: { $in: oldReportIds } }, options);
    });
    console.log('Legacy session records permanently deleted.');
  }
} finally {
  await mongoose.disconnect();
}
