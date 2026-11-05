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
  openingDue: { type: Number, default: 0 }
}, flexibleOptions);

const invoiceItemSchema = new Schema({
  productId: { type: String, default: '' },
  productName: { type: String, default: '' },
  sku: { type: String, default: '' },
  size: { type: String, default: '' },
  cartons: { type: Number, min: 0, default: 0 },
  quantity: { type: Number, min: 0, default: 0 },
  packPerBox: { type: Number, min: 0, default: 1 },
  totalPieces: { type: Number, min: 0, default: 0 },
  unitPrice: { type: Number, min: 0, default: 0 },
  cartonPrice: { type: Number, min: 0, default: 0 },
  commission: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 }
}, { _id: false, strict: false });

const invoiceSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  invoiceNo: { type: String, default: '' },
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
  items: { type: [invoiceItemSchema], default: [] },
  subtotal: { type: Number, min: 0, default: 0 },
  totalAmount: { type: Number, min: 0, default: 0 },
  grandTotal: { type: Number, min: 0, default: 0 },
  paidAmount: { type: Number, min: 0, default: 0 },
  dueAmount: { type: Number, min: 0, default: 0 },
  currentDue: { type: Number, min: 0, default: 0 },
  invoiceType: { type: String, default: 'regular' }
}, flexibleOptions);

const orderItemSchema = new Schema({}, { _id: false, strict: false });
const orderSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  officerId: { type: String, required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  items: { type: [orderItemSchema], default: [] }
}, flexibleOptions);

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const BusinessRecord = mongoose.models.BusinessRecord
  || mongoose.model('BusinessRecord', businessRecordSchema);
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
export const Dealer = mongoose.models.Dealer || mongoose.model('Dealer', dealerSchema);
export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);
