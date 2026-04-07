import { connectToDatabase } from '@/app/lib/mongodb';
import { GasSession } from '@/app/models/GasSession';
import { NextResponse } from 'next/server';


const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  await connectToDatabase();

  let matchQuery: any = { endTime: { $ne: null } };

  if (startDate && endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    matchQuery.startTime = { $gte: new Date(startDate), $lte: end };
  }

  // Fetch all raw sessions for the history list
  const sessions = await GasSession.find(matchQuery).sort({ startTime: -1 });

  // Use MongoDB Aggregation to calculate total usage per user dynamically
  const aggregatedSummaries = await GasSession.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: "$userEmail",
        userName: { $first: "$userName" },
        userImage: { $first: "$userImage" },
        totalSeconds: { $sum: "$durationInSeconds" }
      }
    },
    { $sort: { totalSeconds: -1 } } // Sort by highest usage first
  ]);

  // Format the aggregated data for the frontend
  const userSummaries = aggregatedSummaries.map(user => ({
    userEmail: user._id,
    userName: user.userName,
    userImage: user.userImage,
    totalSeconds: user.totalSeconds,
    formattedTotal: formatTime(user.totalSeconds)
  }));

  return NextResponse.json({
    sessions,
    userSummaries
  });
}