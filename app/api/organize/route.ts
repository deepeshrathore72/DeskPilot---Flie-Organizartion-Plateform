import { NextRequest, NextResponse } from 'next/server';
import { connectDBCached, env } from '../../../src/config';
import { OrganizerService } from '../../../src/services';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    await connectDBCached();
    
    const body = await request.json().catch(() => ({}));
    const { 
      path: targetPath = env.defaultDownloadsPath, 
      dryRun = false,
      recursive = false 
    } = body;

    const organizer = new OrganizerService();
    const result = await organizer.organize(targetPath, { dryRun, recursive });
    
    return NextResponse.json({
      success: true,
      message: dryRun 
        ? `Dry run complete: ${result.summary.totalFiles} files would be organized`
        : `Organized ${result.summary.movedCount} files successfully`,
      data: result
    });
  } catch (error: any) {
    console.error('Error running organize:', error);
    return NextResponse.json(
      { success: false, error: 'Organize failed', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to organize files',
    options: {
      path: 'string (optional) - Directory to organize, defaults to Downloads folder',
      dryRun: 'boolean (optional) - Preview changes without moving files, defaults to false',
      recursive: 'boolean (optional) - Include subdirectories, defaults to false'
    }
  });
}
