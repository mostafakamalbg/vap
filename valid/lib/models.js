import mongoose from 'mongoose';
import { LEGACY_INVOICE_SESSION } from '../shared/sessions.js';

const { Schema } = mongoose;

const flexibleOptions = { timestamps: true, strict: false, minimize: false };

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'officer'], required: true },
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
  officerId: { type: String, default: '' },
  officerCode: { type: String, default: '' },
  phone: { type: String, default: '' }
}, { timestamps: true });

const adminSeatSchema = new Schema({
  _id: { type: Number, enum: [1, 2], required: true },
  email: { type: String, required: true, lowercase: true, trim: true }
}, { timestamps: true });

const businessRecordSchema = new Schema({
  type: { type: String, required: true, index: true },
  recordId: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true }
}, { timestamps: true, minimize: false });
businessRecordSchema.index({ type: 1, recordId: 1 }, { unique: true });

const productSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: '' },
  variants: { type: [Schema.Types.Mixed], default: [] }
}, flexibleOptions);

const dealerSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  code: { type: String, default: '' },
  shopName: { type: String, default: '' },
  openingDue: { type: Number, default: 0 },
  lastSessionDue: { type: Number, default: null }
}, flexibleOptions);

const invoiceItemSchema = new Schema({
  productId: { type: String, default: '' },
  productName: { type: String, default: '' },
  sku: { type: String, default: '' },
  size: { type: String, default: '' },
  cartons: { type: Number, min: 0, default: 0 },
  quantity: { type: Number, min: 0, default: 0 },
  packPerBox: { type: Number, min: 1, default: 1 },
  totalPieces: { type: Number, min: 0, default: 0 },
  retailPieces: { type: Number, min: 0, default: 0 },
  piecePrice: { type: Number, min: 0, default: 0 },
  isRetailOnly: { type: Boolean, default: false },
  unitPrice: { type: Number, min: 0, default: 0 },
  cartonPrice: { type: Number, min: 0, default: 0 },
  commission: { type: Number, min: 0, default: 0 },
  commissionAmount: { type: Number, min: 0, default: 0 },
  netTotal: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 }
}, { _id: false, strict: false });

const invoiceReturnAdjustmentSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, default: '' },
  sku: { type: String, default: '' },
  size: { type: String, default: '' },
  quantity: { type: Number, min: 0, default: 0 },
  quantityPieces: { type: Number, min: 0, default: 0 },
  unit: { type: String, default: '' },
  packPerBox: { type: Number, min: 1, default: 1 },
  price: { type: Number, min: 0, default: 0 },
  unitPrice: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  reason: { type: String, default: '' }
}, { _id: false, strict: false });

const invoiceSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  invoiceNo: { type: String, default: '' },
  challanNo: { type: String, default: '', maxlength: 100 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  session: {
    type: String,
    required: true,
    default: LEGACY_INVOICE_SESSION,
    trim: true
  },
  officerId: { type: String, default: '' },
  officerCode: { type: String, default: '' },
  officerName: { type: String, default: '' },
  dealerId: { type: String, default: '' },
  dealerCode: { type: String, default: '' },
  dealerName: { type: String, default: '' },
  dealerProprietor: { type: String, default: '' },
  dealerAddress: { type: String, default: '' },
  dealerPhone: { type: String, default: '' },
  officerDesignation: { type: String, default: '' },
  items: { type: [invoiceItemSchema], default: [] },
  returnAdjustments: { type: [invoiceReturnAdjustmentSchema], default: [] },
  returnAdjustmentTotal: { type: Number, min: 0, default: 0 },
  totalCartons: { type: Number, min: 0, default: 0 },
  subtotal: { type: Number, min: 0, default: 0 },
  commissionAmount: { type: Number, min: 0, default: 0 },
  transportCost: { type: Number, min: 0, default: 0 },
  totalAmount: { type: Number, min: 0, default: 0 },
  grandTotal: { type: Number, min: 0, default: 0 },
  paidAmount: { type: Number, min: 0, default: 0 },
  dueAmount: { type: Number, min: 0, default: 0 },
  currentDue: { type: Number, min: 0, default: 0 },
  previousDue: { type: Number, default: 0 },
  netPayable: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'credit' },
  seqNumber: { type: Number, default: 0 },
  transport: { type: String, default: '' },
  note: { type: String, default: '' },
  returnReason: { type: String, default: '' },
  invoiceType: { type: String, default: 'regular' }
}, flexibleOptions);

const paymentSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  date: { type: String, default: '', index: true },
  paymentType: {
    type: String,
    enum: ['dealer_collection', 'company_transfer', 'office_pay', 'salary', 'vehicle_rent', 'lc_commission'],
    default: 'dealer_collection',
    index: true
  },
  amount: { type: Number, min: 0, default: 0 },
  paymentMethod: { type: String, default: 'cash' },
  dealerId: { type: String, default: '', index: true },
  dealerName: { type: String, default: '' },
  officerId: { type: String, default: '', index: true },
  officerCode: { type: String, default: '', index: true },
  officerName: { type: String, default: '' },
  reference: { type: String, default: '' },
  receivedBy: { type: String, default: '' },
  note: { type: String, default: '' },
  sourceInvoiceId: { type: String, default: '', index: true }
}, flexibleOptions);

const orderItemSchema = new Schema({}, { _id: false, strict: false });
const orderSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  invoiceNo: { type: String, default: undefined },
  seqNumber: { type: Number, default: 0 },
  officerId: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  items: { type: [orderItemSchema], default: [] }
}, flexibleOptions);
orderSchema.index({ invoiceNo: 1 }, { unique: true, sparse: true });

const paymentAndExpenseSchema = new Schema({
  officePay: { type: Number, default: 0 },
  fare: { type: Number, default: 0 },
  salary: { type: Number, default: 0 },
  lc: { type: Number, default: 0 }
}, { _id: false });

const salesOfficerSchema = new Schema({
  slNo: { type: Number, required: true, unique: true },
  officerId: { type: String, default: '', index: true },
  officerCode: { type: String, default: '', index: true },
  officerName: { type: String, required: true, trim: true },
  mobileNo: { type: String, default: '' },
  salesTargetJulyDec2026: { type: Number, default: 0 },
  salesTargetJanJune2027: { type: Number, default: 0 },
  lastSessionDue: { type: Number, default: 0 },
  salesAmount: { type: Number, default: 0 },
  returnAmount: { type: Number, default: 0 },
  previousPlusNetSales: { type: Number, default: 0 },
  paymentAndExpense: { type: paymentAndExpenseSchema, default: () => ({}) },
  totalReceivedAmount: { type: Number, default: 0 },
  totalAmountDues: { type: Number, default: 0 },
  totalNetSales: { type: Number, default: 0 },
  totalSalesDues: { type: Number, default: 0 },
  expensePercentage: { type: Number, default: 0 },
  salesPercentage: { type: Number, default: 0 },
  paymentPercentage: { type: Number, default: 0 }
}, flexibleOptions);
salesOfficerSchema.index({ officerCode: 1 });

const reportPartySchema = new Schema({
  slNo: { type: Number, default: 0 },
  nameOfTheParty: { type: String, required: true, trim: true },
  lastMonthDues: { type: Number, default: 0 },
  presentMonth: {
    sales: { type: Number, default: 0 },
    return: { type: Number, default: 0 },
    netSales: { type: Number, default: 0 }
  },
  lastAndPresent: {
    netSales: { type: Number, default: 0 },
    salary: { type: Number, default: 0 },
    collection: { type: Number, default: 0 },
    fare: { type: Number, default: 0 },
    l_c: { type: Number, default: 0 }
  },
  presentMonthTotalCollection: { type: Number, default: 0 },
  presentMonthNetDues: { type: Number, default: 0 }
}, { _id: false });

const monthlySalesCollectionSchema = new Schema({
  personName: { type: String, required: true, trim: true },
  designation: { type: String, default: '' },
  areaName: { type: String, default: '' },
  mobileNo: { type: String, default: '' },
  monthOfReport: { type: String, required: true, trim: true },
  session: { type: String, required: true, trim: true },
  reportingDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  officerId: { type: String, default: '', index: true },
  officerCode: { type: String, default: '', index: true },
  parties: { type: [reportPartySchema], default: [] }
}, flexibleOptions);
monthlySalesCollectionSchema.index({ session: 1, monthOfReport: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const AdminSeat = mongoose.models.AdminSeat || mongoose.model('AdminSeat', adminSeatSchema);
export const BusinessRecord = mongoose.models.BusinessRecord
  || mongoose.model('BusinessRecord', businessRecordSchema);
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export const Dealer = mongoose.models.Dealer || mongoose.model('Dealer', dealerSchema);
export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
export const SalesOfficer = mongoose.models.SalesOfficer
  || mongoose.model('SalesOfficer', salesOfficerSchema);
export const MonthlySalesCollection = mongoose.models.MonthlySalesCollection
  || mongoose.model('MonthlySalesCollection', monthlySalesCollectionSchema);
