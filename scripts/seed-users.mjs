import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'cashier'], default: 'cashier' }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const users = [
    { name: 'Admin', username: 'admin', password: 'adminpassword123', role: 'admin' },
    { name: 'Sithum', username: 'sithum', password: 'sithumD', role: 'admin' },
    { name: 'Dumindu', username: 'dumindu', password: 'dunkudda', role: 'admin' },
    { name: 'Sahan', username: 'sahan', password: 'sahansessi', role: 'admin' }
  ];

  for (const u of users) {
    const existing = await User.findOne({ username: u.username });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(u.password, 10);
      await User.create({ ...u, password: hashedPassword });
      console.log(`Created user: ${u.username}`);
    } else {
      console.log(`User already exists: ${u.username}`);
    }
  }

  await mongoose.disconnect();
  console.log('Disconnected');
}

seed().catch(console.error);
