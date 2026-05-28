import mongoose, { Schema } from 'mongoose';

const SaleItemSchema = new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  costPrice: { type: Number, required: true },
  total: { type: Number, required: true },
}, { _id: false });

const SaleSchema = new Schema({
  invoiceNo: { type: String, required: true, unique: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customerName: { type: String, default: 'Walk-in Customer' },
  items: [SaleItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  otherCharges: { type: Number, default: 0 },
  otherChargesDescription: { type: String, default: '' },
  total: { type: Number, required: true },
  profit: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'card', 'transfer'], default: 'cash' },
  saleType: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
  cashierId: { type: Schema.Types.ObjectId, ref: 'User' },
  cashierName: { type: String, required: true, default: 'Admin' },
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.Sale || mongoose.model('Sale', SaleSchema);
