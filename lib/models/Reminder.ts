import mongoose, { Schema } from 'mongoose';

const ReminderSchema = new Schema({
  text: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  createdById: { type: Schema.Types.ObjectId, ref: 'User' },
  createdByName: { type: String, default: 'Admin' },
  completedById: { type: Schema.Types.ObjectId, ref: 'User' },
  completedByName: { type: String },
  completedAt: { type: Date },
}, { timestamps: true });

export default mongoose.models.Reminder || mongoose.model('Reminder', ReminderSchema);
