import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { sendWhatsAppText } from '@/lib/whatsapp';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback_secret_key_change_this_later'
);

export const dynamic = 'force-dynamic';

async function hasSession(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return false;

  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorized = await hasSession(request);
    if (!authorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, text } = await request.json();

    if (!to || !text) {
      return Response.json(
        { error: 'Both to and text are required' },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppText({ to, text });
    return Response.json({ success: true, result });
  } catch (error: any) {
    return Response.json(
      { error: error?.message || 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
}
