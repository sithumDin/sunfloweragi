import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: '.env.local' });
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const args = new Set(process.argv.slice(2));
const force = args.has('--yes') || args.has('-y');

if (!force) {
  console.log('Refusing to run without confirmation flag.');
  console.log('Run: node scripts/clear-testing-data.mjs --yes');
  process.exit(1);
}

const SaleSchema = new mongoose.Schema({}, { strict: false, collection: 'sales' });
const ProductSchema = new mongoose.Schema({}, { strict: false, collection: 'products' });
const CustomerSchema = new mongoose.Schema({}, { strict: false, collection: 'customers' });
const CreditSchema = new mongoose.Schema({}, { strict: false, collection: 'credits' });
const ReminderSchema = new mongoose.Schema({}, { strict: false, collection: 'reminders' });

const Sale = mongoose.models.SaleCleanup || mongoose.model('SaleCleanup', SaleSchema);
const Product = mongoose.models.ProductCleanup || mongoose.model('ProductCleanup', ProductSchema);
const Customer = mongoose.models.CustomerCleanup || mongoose.model('CustomerCleanup', CustomerSchema);
const Credit = mongoose.models.CreditCleanup || mongoose.model('CreditCleanup', CreditSchema);
const Reminder = mongoose.models.ReminderCleanup || mongoose.model('ReminderCleanup', ReminderSchema);

async function clearTestingData() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const [saleCount, productCount, customerCount, creditCount, reminderCount] = await Promise.all([
    Sale.countDocuments(),
    Product.countDocuments(),
    Customer.countDocuments(),
    Credit.countDocuments(),
    Reminder.countDocuments(),
  ]);

  console.log('Current counts:', {
    sales: saleCount,
    products: productCount,
    customers: customerCount,
    credits: creditCount,
    reminders: reminderCount,
  });

  const [salesResult, productsResult, customersResult, creditsResult, remindersResult] = await Promise.all([
    Sale.deleteMany({}),
    Product.deleteMany({}),
    Customer.deleteMany({}),
    Credit.deleteMany({}),
    Reminder.deleteMany({}),
  ]);

  console.log('Deleted:', {
    sales: salesResult.deletedCount || 0,
    products: productsResult.deletedCount || 0,
    customers: customersResult.deletedCount || 0,
    credits: creditsResult.deletedCount || 0,
    reminders: remindersResult.deletedCount || 0,
  });

  const [salesLeft, productsLeft, customersLeft, creditsLeft, remindersLeft] = await Promise.all([
    Sale.countDocuments(),
    Product.countDocuments(),
    Customer.countDocuments(),
    Credit.countDocuments(),
    Reminder.countDocuments(),
  ]);

  console.log('Remaining:', {
    sales: salesLeft,
    products: productsLeft,
    customers: customersLeft,
    credits: creditsLeft,
    reminders: remindersLeft,
  });

  await mongoose.disconnect();
  console.log('Disconnected');
}

clearTestingData().catch(async (error) => {
  console.error('Cleanup failed:', error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
