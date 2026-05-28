import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session')?.value;

  if (!token) {
    return Response.json({ user: null }, { status: 401 });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return Response.json({ user: payload });
  } catch (error) {
    return Response.json({ user: null }, { status: 401 });
  }
}
