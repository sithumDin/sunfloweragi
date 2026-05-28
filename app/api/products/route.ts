import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();
    const products = await Product.find({}).sort({ createdAt: -1 });
    return Response.json(products);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const retailPrice = Number(body.retailPrice ?? body.sellingPrice ?? 0);
    const wholesalePrice = Number(body.wholesalePrice ?? body.sellingPrice ?? 0);

    const product = await Product.create({
      ...body,
      retailPrice,
      wholesalePrice,
      // Keep legacy field populated for parts of the app that still read sellingPrice.
      sellingPrice: retailPrice,
    });
    return Response.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Database Error:', error);
    return Response.json({ error: error.message || 'Failed to create product' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const { _id, ...updateData } = body;
    const retailPrice = Number(updateData.retailPrice ?? updateData.sellingPrice ?? 0);
    const wholesalePrice = Number(updateData.wholesalePrice ?? updateData.sellingPrice ?? 0);

    const product = await Product.findByIdAndUpdate(
      _id,
      {
        ...updateData,
        retailPrice,
        wholesalePrice,
        sellingPrice: retailPrice,
      },
      { new: true }
    );
    if (!product) {
      return Response.json({ error: 'Product not found' }, { status: 404 });
    }
    return Response.json(product);
  } catch (error) {
    return Response.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');
    if (!id) {
      return Response.json({ error: 'Product ID required' }, { status: 400 });
    }
    await Product.findByIdAndDelete(id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
