import mongoose, { Schema } from 'mongoose';

const QuotationSchema = new Schema(
  {
    quotationNo: String,
    customerName: String,
    customerPhone: String,
    customerEmail: String,
    customerAddress: String,
    items: [
      {
        product: { type: String, default: '' },
        productName: String,
        qty: Number,
        unitPrice: Number,
        unit: String,
        total: Number,
      },
    ],
    subtotal: Number,
    discount: Number,
    other: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    total: Number,
    notes: String,
    validUntil: String,
    quotationType: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' },
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Quotation || mongoose.model('Quotation', QuotationSchema);
