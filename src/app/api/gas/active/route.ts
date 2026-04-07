import { connectToDatabase } from '@/app/lib/mongodb';
import { GasSession } from '@/app/models/GasSession';
import { NextResponse } from 'next/server';


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userEmail = searchParams.get('userEmail');

  if (!userEmail) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  await connectToDatabase();
  const activeSession = await GasSession.findOne({ userEmail, endTime: null });
  
  return NextResponse.json({ activeSession });
}