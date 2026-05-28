import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ username });
    if (!user) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Create a 24-hour JWT
    const token = await new SignJWT({ 
      id: user._id.toString(), 
      username: user.username,
      name: user.name,
      role: user.role
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    // Create a generic response
    const response = Response.json({ 
      success: true, 
      user: { id: user._id, name: user.name, username: user.username, role: user.role } 
    });

    // Set HTTP-only cookie
    response.headers.append(
      'Set-Cookie',
      `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24}`
    );

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
