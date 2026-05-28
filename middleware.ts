import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

// Routes that do not require authentication
const publicPaths = ['/login', '/api/auth/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.includes('.') || 
    publicPaths.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('session')?.value;

  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  try {
    // Verify token
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch (error) {
    // Invalid token
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const response = NextResponse.redirect(url);
    response.cookies.delete('session');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
