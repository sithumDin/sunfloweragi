import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // securely hashed
  role: { type: String, enum: ['admin', 'cashier'], default: 'cashier' }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
