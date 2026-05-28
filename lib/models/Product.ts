import mongoose, { Schema } from 'mongoose';

const ProductSchema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true, default: 'Other' },
  costPrice: { type: Number, required: true, default: 0 },
  retailPrice: { type: Number, required: true, default: 0 },
  wholesalePrice: { type: Number, required: true, default: 0 },
  sellingPrice: { type: Number, default: 0 },
  stock: { type: Number, required: true, default: 0 },
  unit: { type: String, required: true, default: 'pcs' },
  lowStockThreshold: { type: Number, default: 10 },
}, { timestamps: true });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
