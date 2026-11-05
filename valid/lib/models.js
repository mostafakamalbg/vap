import mongoose from 'mongoose';

// Invoice Schema
const InvoiceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: { type: String, required: true },
  dealerId: String,
  dealerCode: String,
  dealerName: String,
  dealerProprietor: String,
  dealerAddress: String,
  dealerPhone: String,
  officerId: String,
  officerCode: String,
  officerName: String,
  invoiceType: { type: String, default: 'regular' },
  items: Array,
  returnAdjustments: Array,
  totalCartons: Number,
  subtotal: Number,
  commissionAmount: Number,
  returnAdjustmentTotal: Number,
  transportCost: Number,
  grandTotal: Number,
  previousDue: Number,
  netPayable: Number,
  paidAmount: Number,
  currentDue: Number,
  paymentMethod: String,
  transport: String,
  note: String,
  createdAt: { type: Date, default: Date.now }
});

// Dealer Schema
const DealerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  code: String,
  shopName: { type: String, required: true },
  proprietor: String,
  address: String,
  phone: String,
  zone: String,
  officerCode: String,
  assignedOfficerId: String,
  transport: String,
  openingDue: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Product Schema
const ProductSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  generic: String,
  category: String,
  description: String,
  variants: Array,
  createdAt: { type: Date, default: Date.now }
});

// Damage / Return Log Schema
const DamageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  date: String,
  dealerId: String,
  dealerName: String,
  officerId: String,
  officerName: String,
  productId: String,
  productName: String,
  sku: String,
  size: String,
  quantityPieces: Number,
  unitPrice: Number,
  totalDamageValue: Number,
  reason: String,
  action: String,
  actionType: String,
  status: String,
  invoiceRef: String,
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin', 'officer'], required: true },
  status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
  officerId: String,
  officerCode: String,
  phone: String,
  createdAt: { type: Date, default: Date.now }
});
UserSchema.index({ officerId: 1 }, { unique: true, sparse: true });
UserSchema.index({ officerCode: 1 }, { unique: true, sparse: true });

const BusinessRecordSchema = new mongoose.Schema({
  type: { type: String, required: true },
  recordId: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true }
});
BusinessRecordSchema.index({ type: 1, recordId: 1 }, { unique: true });

const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  officerId: { type: String, required: true },
  officerCode: String,
  officerName: String,
  items: { type: Array, required: true },
  note: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  decisionNote: String,
  createdAt: { type: Date, default: Date.now },
  decidedAt: Date
});

const AdminSeatSchema = new mongoose.Schema({
  _id: { type: Number, min: 1, max: 2 },
  email: { type: String, required: true }
});

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
export const Dealer = mongoose.models.Dealer || mongoose.model('Dealer', DealerSchema);
export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Damage = mongoose.models.Damage || mongoose.model('Damage', DamageSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const BusinessRecord = mongoose.models.BusinessRecord || mongoose.model('BusinessRecord', BusinessRecordSchema);
export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const AdminSeat = mongoose.models.AdminSeat || mongoose.model('AdminSeat', AdminSeatSchema);
