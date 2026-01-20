import { NextResponse } from 'next/server';
import { connectDBCached } from '../../../src/config';
import { ReporterService } from '../../../src/services';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDBCached();
    
    const reporter = new ReporterService();
    const report = await reporter.generateReport();
    
    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', message: error.message },
      { status: 500 }
    );
  }
}
