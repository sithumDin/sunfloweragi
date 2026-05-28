import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Credit from '@/lib/models/Credit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const customer = searchParams.get('customer');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (customer) query.customer = customer;
    if (status) query.status = status;

    const credits = await Credit.find(query).sort({ createdAt: -1 });
    return Response.json(credits);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const credit = await Credit.create(body);
    return Response.json(credit, { status: 201 });
  } catch (error) {
    return Response.json({ error: 'Failed to create credit record' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { creditId, payment } = body;

    const credit = await Credit.findById(creditId);
    if (!credit) {
      return Response.json({ error: 'Credit record not found' }, { status: 404 });
    }

    credit.payments.push(payment);
    credit.paidAmount += payment.amount;
    credit.remainingAmount = credit.totalAmount - credit.paidAmount;
    credit.status = credit.remainingAmount <= 0 ? 'paid' : 'partial';

    await credit.save();
    return Response.json(credit);
  } catch (error) {
    return Response.json({ error: 'Failed to update credit' }, { status: 500 });
  }
}
