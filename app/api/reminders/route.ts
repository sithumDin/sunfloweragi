import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import connectDB from '@/lib/mongodb';
import Reminder from '@/lib/models/Reminder';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_key_change_this_later');

export const dynamic = 'force-dynamic';

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      name: (payload.name as string) || 'Admin',
      role: (payload.role as string) || 'cashier',
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    await connectDB();
    const reminders = await Reminder.find({})
      .sort({ done: 1, createdAt: -1 })
      .limit(100);

    return Response.json(reminders);
  } catch (error) {
    return Response.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can add reminders' }, { status: 403 });
    }

    const body = await request.json();
    const text = String(body.text || '').trim();
    if (!text) {
      return Response.json({ error: 'Reminder text is required' }, { status: 400 });
    }

    await connectDB();
    const reminder = await Reminder.create({
      text,
      done: false,
      createdById: user.id,
      createdByName: user.name,
    });

    return Response.json(reminder, { status: 201 });
  } catch (error) {
    return Response.json({ error: 'Failed to create reminder' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can update reminders' }, { status: 403 });
    }

    const body = await request.json();
    const id = String(body.id || '');
    const done = Boolean(body.done);

    if (!id) {
      return Response.json({ error: 'Reminder id is required' }, { status: 400 });
    }

    await connectDB();
    const reminder = await Reminder.findByIdAndUpdate(
      id,
      {
        done,
        completedById: done ? user.id : undefined,
        completedByName: done ? user.name : undefined,
        completedAt: done ? new Date() : undefined,
      },
      { new: true }
    );

    if (!reminder) {
      return Response.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return Response.json(reminder);
  } catch (error) {
    return Response.json({ error: 'Failed to update reminder' }, { status: 500 });
  }
}
