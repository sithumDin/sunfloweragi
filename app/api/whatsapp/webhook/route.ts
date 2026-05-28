import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const mode = search.get('hub.mode');
  const token = search.get('hub.verify_token');
  const challenge = search.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return new Response(challenge || 'ok', { status: 200 });
  }

  return Response.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // Keep logs minimal; extend this handler later for message/status processing.
  console.log('WhatsApp webhook event received');

  return Response.json({ received: true, hasEntry: Boolean(body?.entry) });
}
