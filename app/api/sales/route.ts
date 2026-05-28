import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Sale from '@/lib/models/Sale';
import Product from '@/lib/models/Product';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

export const dynamic = 'force-dynamic';

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      role: (payload.role as string) || 'cashier',
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const query: Record<string, unknown> = {};
    if (type) query.saleType = type;
    if (from || to) {
      query.date = {};
      if (from) (query.date as Record<string, unknown>).$gte = new Date(from);
      if (to) (query.date as Record<string, unknown>).$lte = new Date(to + 'T23:59:59');
    }

    const sales = await Sale.find(query).sort({ date: -1 }).limit(limit);
    return Response.json(sales);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch sales' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let cashierId, cashierName = 'Admin';
    const token = request.cookies.get('session')?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        cashierId = payload.id as string;
        cashierName = payload.name as string;
      } catch (e) {}
    }

    await connectDB();
    const body = await request.json();

    // Generate invoice number
    const count = await Sale.countDocuments();
    const prefix = body.saleType === 'wholesale' ? 'WS' : 'RT';
    const invoiceNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;

    const sale = await Sale.create({ ...body, invoiceNo, cashierId, cashierName });

    // Update stock for each item
    for (const item of body.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.qty },
      });
    }

    return Response.json(sale, { status: 201 });
  } catch (error) {
    return Response.json({ error: 'Failed to create sale' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can clear sales' }, { status: 403 });
    }

    await connectDB();
    const result = await Sale.deleteMany({});

    return Response.json({
      message: 'Sales cleared successfully',
      deletedCount: result.deletedCount || 0,
    });
  } catch (error) {
    return Response.json({ error: 'Failed to clear sales' }, { status: 500 });
  }
}
