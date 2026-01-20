import { NextRequest, NextResponse } from 'next/server';
import { connectDBCached, env } from '../../../src/config';
import { ScannerService } from '../../../src/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout for long scans

export async function POST(request: NextRequest) {
  try {
    await connectDBCached();
    
    const body = await request.json().catch(() => ({}));
    const { 
      path: targetPath = env.defaultDownloadsPath, 
      recursive = true 
    } = body;

    const scanner = new ScannerService();
    const result = await scanner.scan(targetPath, { recursive });
    
    return NextResponse.json({
      success: true,
      message: `Scanned ${result.totalFiles} files successfully`,
      data: result
    });
  } catch (error: any) {
    console.error('Error running scan:', error);
    return NextResponse.json(
      { success: false, error: 'Scan failed', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to run a scan',
    options: {
      path: 'string (optional) - Directory to scan, defaults to Downloads folder',
      recursive: 'boolean (optional) - Scan subdirectories, defaults to true'
    }
  });
}
