import { NextRequest, NextResponse } from 'next/server';
import { connectDBCached, env } from '../../../src/config';
import { DedupeService } from '../../../src/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    await connectDBCached();
    
    const body = await request.json().catch(() => ({}));
    const { 
      path: targetPath = env.defaultDownloadsPath, 
      dryRun = false,
      strategy = 'keep-latest',
      moveToTrash = true
    } = body;

    // Validate strategy
    const validStrategies = ['keep-latest', 'keep-oldest', 'keep-largest'];
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { success: false, error: 'Invalid strategy', message: `Strategy must be one of: ${validStrategies.join(', ')}` },
        { status: 400 }
      );
    }

    const deduper = new DedupeService();
    const result = await deduper.dedupe(targetPath, { dryRun, strategy, moveToTrash });
    
    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `Dry run complete: ${result.summary.totalDuplicateFiles} duplicate files found`
        : `Removed ${result.summary.deletedCount} duplicate files, saved ${formatBytes(result.summary.savedBytes)}`,
      data: result
    });
  } catch (error: any) {
    console.error('Error running dedupe:', error);
    return NextResponse.json(
      { success: false, error: 'Dedupe failed', message: error.message },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to dedupe files',
    options: {
      path: 'string (optional) - Directory to dedupe, defaults to Downloads folder',
      dryRun: 'boolean (optional) - Preview without deleting, defaults to false',
      strategy: 'string (optional) - keep-latest, keep-oldest, or keep-largest, defaults to keep-latest',
      moveToTrash: 'boolean (optional) - Move to trash instead of permanent delete, defaults to true'
    }
  });
}
