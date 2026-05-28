import mongoose, { Schema } from 'mongoose';

const CustomerSchema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  type: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
}, { timestamps: true });

export default mongoose.models.Customer || mongoose.model('Customer', CustomerSchema);
