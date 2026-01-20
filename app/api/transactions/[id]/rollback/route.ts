import { NextRequest, NextResponse } from 'next/server';
import { connectDBCached } from '../../../../../src/config';
import { RollbackService } from '../../../../../src/services';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDBCached();
    
    const transactionId = params.id;
    const rollbackService = new RollbackService();
    
    const result = await rollbackService.rollback(transactionId);
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error rolling back transaction:', error);
    return NextResponse.json(
      { error: 'Failed to rollback transaction', message: error.message },
      { status: 500 }
    );
  }
}
