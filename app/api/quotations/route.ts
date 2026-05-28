import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/lib/models/Quotation';
import Customer from '@/lib/models/Customer';
import Credit from '@/lib/models/Credit';
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
      name: payload.name as string,
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');

    const query: Record<string, unknown> = {};
    if (status) query.status = status;

    const quotations = await Quotation.find(query).sort({ createdAt: -1 }).limit(limit);
    return Response.json(quotations);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch quotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();

    // Generate quotation number
    const count = await Quotation.countDocuments();
    const prefix = body.quotationType === 'wholesale' ? 'QWS' : 'QRT';
    const quotationNo = `${prefix}-${String(count + 1).padStart(5, '0')}`;

    const quotation = await Quotation.create({
      ...body,
      quotationNo,
      createdBy: user.name,
    });

    return Response.json(quotation, { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return Response.json({ error: 'Failed to create quotation', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const body = await request.json();
    const { _id, ...data } = body;

    if (!_id) {
      return Response.json({ error: 'Quotation ID is required' }, { status: 400 });
    }

    console.log('Updating quotation:', { _id, dataKeys: Object.keys(data) });

    // Get the current quotation to check status change
    const currentQuotation = await Quotation.findById(_id);
    if (!currentQuotation) {
      return Response.json({ error: 'Quotation not found', details: `ID: ${_id}` }, { status: 404 });
    }

    const quotation = await Quotation.findByIdAndUpdate(_id, data, { new: true, runValidators: false });
    
    if (!quotation) {
      return Response.json({ error: 'Quotation not found', details: `ID: ${_id}` }, { status: 404 });
    }

    // Check if status changed to 'accepted' and create credit record
    if (data.status === 'accepted' && currentQuotation.status !== 'accepted') {
      try {
        // Find or create customer
        let customer = await Customer.findOne({ name: quotation.customerName });
        if (!customer) {
          customer = await Customer.create({
            name: quotation.customerName,
            phone: quotation.customerPhone || '',
            address: quotation.customerAddress || '',
            type: quotation.quotationType,
          });
        }

        // Calculate amounts
        const originalAmount = quotation.subtotal - (quotation.discount || 0) + (quotation.other || 0);
        const paidAmount = quotation.advance || 0;
        const remainingAmount = originalAmount - paidAmount;

        // Create credit record
        await Credit.create({
          customer: customer._id,
          customerName: quotation.customerName,
          sale: quotation._id, // Using quotation ID as sale reference
          invoiceNo: quotation.quotationNo,
          totalAmount: originalAmount,
          paidAmount: paidAmount,
          remainingAmount: remainingAmount,
          status: remainingAmount <= 0 ? 'paid' : 'pending',
        });

        console.log('Credit record created for accepted quotation');
      } catch (creditError) {
        console.error('Failed to create credit record:', creditError);
        // Don't fail the quotation update if credit creation fails
      }
    }

    console.log('Quotation updated successfully');
    return Response.json(quotation);
  } catch (error) {
    console.error('PUT error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ 
      error: 'Failed to update quotation', 
      details: errorMessage,
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'Quotation ID required' }, { status: 400 });
    }

    await Quotation.findByIdAndDelete(id);
    return Response.json({ message: 'Quotation deleted' });
  } catch (error) {
    return Response.json({ error: 'Failed to delete quotation' }, { status: 500 });
  }
}
