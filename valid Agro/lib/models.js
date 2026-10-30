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

export const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
export const Dealer = mongoose.models.Dealer || mongoose.model('Dealer', DealerSchema);
export const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
export const Damage = mongoose.models.Damage || mongoose.model('Damage', DamageSchema);
