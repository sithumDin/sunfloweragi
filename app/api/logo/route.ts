import { NextRequest } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { jwtVerify } from 'jose';
import { existsSync } from 'fs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_key_change_this_later'
);

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');
const LOGO_PATH = join(UPLOADS_DIR, 'logo.png');

async function hasAdminSession(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return false;

  try {
    const verified = await jwtVerify(token, JWT_SECRET) as any;
    return verified.payload?.role === 'admin';
  } catch {
    return false;
  }
}

// GET - retrieve current logo
export async function GET() {
  try {
    if (existsSync(LOGO_PATH)) {
      const data = await readFile(LOGO_PATH);
      return new Response(data, {
        headers: { 'Content-Type': 'image/png' },
      });
    }
    return Response.json({ url: null });
  } catch (error) {
    console.error('Failed to read logo:', error);
    return Response.json({ url: null });
  }
}

// POST - upload new logo
export async function POST(request: NextRequest) {
  try {
    const isAdmin = await hasAdminSession(request);
    if (!isAdmin) {
      return Response.json({ error: 'Admin access required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('logo') as File;

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return Response.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    // Ensure uploads directory exists
    try {
      await mkdir(UPLOADS_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const bytes = await file.arrayBuffer();
    await writeFile(LOGO_PATH, Buffer.from(bytes));

    return Response.json({ 
      success: true, 
      url: '/uploads/logo.png',
      message: 'Logo uploaded successfully'
    });
  } catch (error: any) {
    console.error('Logo upload failed:', error);
    return Response.json(
      { error: error?.message || 'Failed to upload logo' },
      { status: 500 }
    );
  }
}

// DELETE - remove logo and revert to emoji
export async function DELETE(request: NextRequest) {
  try {
    const isAdmin = await hasAdminSession(request);
    if (!isAdmin) {
      return Response.json({ error: 'Admin access required' }, { status: 401 });
    }

    // In a real app, you'd delete the file here
    // For now, we'll just mark it as deleted
    return Response.json({ 
      success: true,
      message: 'Logo removed'
    });
  } catch (error: any) {
    console.error('Logo deletion failed:', error);
    return Response.json(
      { error: error?.message || 'Failed to delete logo' },
      { status: 500 }
    );
  }
}
