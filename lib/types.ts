export interface Product {
  _id?: string;
  name: string;
  category: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  sellingPrice: number;
  stock: number;
  unit: string;
  lowStockThreshold: number;
  createdAt?: string;
}

export interface Customer {
  _id?: string;
  name: string;
  phone: string;
  address: string;
  type: 'retail' | 'wholesale';
  createdAt?: string;
}

export interface SaleItem {
  product: string;
  productName: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  total: number;
}

export interface Sale {
  _id?: string;
  invoiceNo: string;
  customer?: string;
  customerName?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  otherCharges: number;
  otherChargesDescription?: string;
  total: number;
  profit: number;
  paymentMethod: 'cash' | 'card' | 'transfer';
  saleType: 'retail' | 'wholesale';
  cashierId?: string;
  cashierName?: string;
  date: string;
  createdAt?: string;
}

export interface CreditPayment {
  amount: number;
  date: string;
  note: string;
}

export interface Credit {
  _id?: string;
  customer: string;
  customerName: string;
  sale: string;
  invoiceNo: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  payments: CreditPayment[];
  status: 'pending' | 'partial' | 'paid';
  createdAt?: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  discount: number;
}

export const CATEGORIES = [
  'Fertilizers',
  'Coco Products',
  'Seeds',
  'Grow Bags',
  'Tools',
  'Other',
] as const;

export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'bags', 'packs'] as const;
