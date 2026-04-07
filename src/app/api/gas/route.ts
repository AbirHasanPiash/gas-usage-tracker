import { connectToDatabase } from '@/app/lib/mongodb';
import { GasSession } from '@/app/models/GasSession';
import { NextResponse } from 'next/server';


// Helper to format seconds for the backend responses
const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

export async function POST(req: Request) {
  const { userEmail, userName, userImage, action } = await req.json();
  await connectToDatabase();

  if (action === 'START') {
    const activeSession = await GasSession.findOne({ userEmail, endTime: null });
    if (activeSession) return NextResponse.json({ error: 'Timer running' }, { status: 400 });

    const newSession = await GasSession.create({ userEmail, userName, userImage, startTime: new Date() });
    return NextResponse.json(newSession);
  } 
  
  if (action === 'STOP') {
    const activeSession = await GasSession.findOne({ userEmail, endTime: null });
    if (!activeSession) return NextResponse.json({ error: 'No active timer' }, { status: 400 });

    const endTime = new Date();
    const durationInSeconds = Math.floor((endTime.getTime() - activeSession.startTime.getTime()) / 1000);

    activeSession.endTime = endTime;
    activeSession.durationInSeconds = durationInSeconds;
    await activeSession.save();

    return NextResponse.json(activeSession);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userEmail = searchParams.get('userEmail');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  await connectToDatabase();

  let query: any = { endTime: { $ne: null } }; // Only completed sessions
  if (userEmail) query.userEmail = userEmail;
  
  if (startDate && endDate) {
    // End date should include the full day up to 23:59:59
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    query.startTime = { $gte: new Date(startDate), $lte: end };
  }

  const sessions = await GasSession.find(query).sort({ startTime: -1 });
  const totalSeconds = sessions.reduce((sum, session) => sum + session.durationInSeconds, 0);

  return NextResponse.json({
    sessions,
    summary: { totalSeconds, formattedTotal: formatTime(totalSeconds) }
  });
}