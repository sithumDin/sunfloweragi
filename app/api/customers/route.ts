import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Customer from '@/lib/models/Customer';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const customers = await Customer.find({}).sort({ createdAt: -1 });
    return Response.json(customers);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const customer = await Customer.create(body);
    return Response.json(customer, { status: 201 });
  } catch (error) {
    return Response.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { _id, ...updateData } = body;
    const customer = await Customer.findByIdAndUpdate(_id, updateData, { new: true });
    if (!customer) {
      return Response.json({ error: 'Customer not found' }, { status: 404 });
    }
    return Response.json(customer);
  } catch (error) {
    return Response.json({ error: 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'Customer ID required' }, { status: 400 });
    }
    await Customer.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete customer' }, { status: 500 });
  }
}
