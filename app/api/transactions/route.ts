import { NextResponse } from 'next/server';
import { connectDBCached } from '../../../src/config';
import { Transaction } from '../../../src/models';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDBCached();
    
    const transactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    return NextResponse.json(transactions);
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions', message: error.message },
      { status: 500 }
    );
  }
}
