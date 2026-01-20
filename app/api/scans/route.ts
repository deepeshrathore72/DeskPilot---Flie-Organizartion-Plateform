import { NextResponse } from 'next/server';
import { connectDBCached } from '../../../src/config';
import { Scan } from '../../../src/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDBCached();
    
    const scans = await Scan.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    return NextResponse.json(scans);
  } catch (error: any) {
    console.error('Error fetching scans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scans', message: error.message },
      { status: 500 }
    );
  }
}
