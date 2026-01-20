import { Scan, FileRecord, Transaction } from '../models';
import { logger, formatBytes, getAllCategories } from '../utils';

export interface ReportData {
  overview: {
    totalScans: number;
    totalFilesScanned: number;
    totalDuplicatesFound: number;
    totalDiskSpaceSaved: number;
    totalTransactions: number;
  };
  recentScans: Array<{
    scanId: string;
    scannedPath: string;
    totalFiles: number;
    totalSize: number;
    duplicatesCount: number;
    duplicatesSize: number;
    createdAt: Date;
  }>;
  categoryBreakdown: Array<{
    category: string;
    fileCount: number;
    totalSize: number;
    percentage: number;
  }>;
  extensionStats: Array<{
    extension: string;
    count: number;
    totalSize: number;
  }>;
  recentActivity: Array<{
    transactionId: string;
    type: string;
    status: string;
    summary: {
      movedCount: number;
      deletedCount: number;
      restoredCount: number;
      savedBytes: number;
    };
    createdAt: Date;
  }>;
  duplicateStats: {
    totalGroups: number;
    totalDuplicateFiles: number;
    totalWastedSpace: number;
    topDuplicatedExtensions: Array<{
      extension: string;
      count: number;
    }>;
  };
}

export class ReporterService {
  /**
   * Generate a comprehensive report
   */
  async generateReport(): Promise<ReportData> {
    logger.info('Generating report...');

    // Get overview stats
    const totalScans = await Scan.countDocuments();
    const totalFilesScanned = await FileRecord.countDocuments();
    const totalDuplicatesFound = await FileRecord.countDocuments({ isDuplicate: true });

    // Calculate total disk space saved from dedupe operations
    // Include both completed dedupe transactions and subtract rolled back ones
    const dedupeTransactions = await Transaction.find({ 
      type: 'dedupe', 
      status: { $in: ['completed', 'partially_completed'] },
      dryRun: false 
    });
    
    let totalDiskSpaceSaved = dedupeTransactions.reduce(
      (sum, t) => sum + (t.summary?.savedBytes || 0), 
      0
    );

    // Subtract space from rolled back dedupe transactions
    const rolledBackDedupes = await Transaction.find({
      type: 'dedupe',
      status: 'rolled_back',
      dryRun: false
    });
    
    for (const t of rolledBackDedupes) {
      totalDiskSpaceSaved -= (t.summary?.savedBytes || 0);
    }
    
    // Ensure non-negative
    totalDiskSpaceSaved = Math.max(0, totalDiskSpaceSaved);

    const totalTransactions = await Transaction.countDocuments();

    // Get recent scans
    const recentScans = await Scan.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get category breakdown from latest scan
    const latestScan = await Scan.findOne().sort({ createdAt: -1 });
    const categoryBreakdown: ReportData['categoryBreakdown'] = [];

    if (latestScan && latestScan.categories) {
      const totalSize = Object.values(latestScan.categories as Record<string, { count: number; size: number }>)
        .reduce((sum, cat) => sum + cat.size, 0);

      for (const [category, data] of Object.entries(latestScan.categories as Record<string, { count: number; size: number }>)) {
        categoryBreakdown.push({
          category,
          fileCount: data.count,
          totalSize: data.size,
          percentage: totalSize > 0 ? Math.round((data.size / totalSize) * 100) : 0,
        });
      }

      // Sort by size descending
      categoryBreakdown.sort((a, b) => b.totalSize - a.totalSize);
    }

    // Get extension stats
    const extensionAggregation = await FileRecord.aggregate([
      {
        $group: {
          _id: '$extension',
          count: { $sum: 1 },
          totalSize: { $sum: '$size' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const extensionStats = extensionAggregation.map(e => ({
      extension: e._id || 'No extension',
      count: e.count,
      totalSize: e.totalSize,
    }));

    // Get recent activity
    const recentTransactions = await Transaction.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentActivity = recentTransactions.map(t => ({
      transactionId: t.transactionId,
      type: t.type,
      status: t.status,
      summary: {
        movedCount: t.summary?.movedCount || 0,
        deletedCount: t.summary?.deletedCount || 0,
        restoredCount: t.summary?.restoredCount || 0,
        savedBytes: t.summary?.savedBytes || 0,
      },
      createdAt: t.createdAt,
    }));

    // Get duplicate stats from the latest scan
    const latestScanForDuplicates = await Scan.findOne().sort({ createdAt: -1 });
    
    let duplicateStats: ReportData['duplicateStats'] = {
      totalGroups: 0,
      totalDuplicateFiles: 0,
      totalWastedSpace: 0,
      topDuplicatedExtensions: [],
    };

    if (latestScanForDuplicates) {
      // Use data from the latest scan
      duplicateStats.totalDuplicateFiles = latestScanForDuplicates.duplicatesCount || 0;
      duplicateStats.totalWastedSpace = latestScanForDuplicates.duplicatesSize || 0;
      
      // Calculate groups from FileRecord if available
      const duplicateHashGroups = await FileRecord.aggregate([
        { $match: { scanId: latestScanForDuplicates.scanId, isDuplicate: true } },
        {
          $group: {
            _id: '$hash',
            count: { $sum: 1 },
          },
        },
      ]);
      
      duplicateStats.totalGroups = duplicateHashGroups.length;

      // Get top duplicated extensions from latest scan
      const duplicateAggregation = await FileRecord.aggregate([
        { $match: { scanId: latestScanForDuplicates.scanId, isDuplicate: true } },
        {
          $group: {
            _id: '$extension',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      duplicateStats.topDuplicatedExtensions = duplicateAggregation.map(e => ({
        extension: e._id || 'No extension',
        count: e.count,
      }));
    }

    const report: ReportData = {
      overview: {
        totalScans,
        totalFilesScanned,
        totalDuplicatesFound,
        totalDiskSpaceSaved,
        totalTransactions,
      },
      recentScans: recentScans.map(s => ({
        scanId: s.scanId,
        scannedPath: s.scannedPath,
        totalFiles: s.totalFiles,
        totalSize: s.totalSize,
        duplicatesCount: s.duplicatesCount,
        duplicatesSize: s.duplicatesSize,
        createdAt: s.createdAt,
      })),
      categoryBreakdown,
      extensionStats,
      recentActivity,
      duplicateStats,
    };

    // Save report as a scan record for historical tracking
    logger.success('Report generated successfully');

    return report;
  }

  /**
   * Format report for CLI display
   */
  formatReportForCLI(report: ReportData): string {
    const lines: string[] = [];

    // Overview
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('                    DESKPILOT REPORT                        ');
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');

    lines.push('📊 OVERVIEW');
    lines.push('───────────────────────────────────────────────────────────');
    lines.push(`  Total Scans:           ${report.overview.totalScans}`);
    lines.push(`  Files Scanned:         ${report.overview.totalFilesScanned}`);
    lines.push(`  Duplicates Found:      ${report.overview.totalDuplicatesFound}`);
    lines.push(`  Disk Space Saved:      ${formatBytes(report.overview.totalDiskSpaceSaved)}`);
    lines.push(`  Total Transactions:    ${report.overview.totalTransactions}`);
    lines.push('');

    // Category Breakdown
    if (report.categoryBreakdown.length > 0) {
      lines.push('📁 CATEGORY BREAKDOWN');
      lines.push('───────────────────────────────────────────────────────────');
      for (const cat of report.categoryBreakdown) {
        const bar = '█'.repeat(Math.max(1, Math.round(cat.percentage / 5)));
        lines.push(`  ${cat.category.padEnd(12)} ${cat.fileCount.toString().padStart(6)} files  ${formatBytes(cat.totalSize).padStart(10)}  ${bar} ${cat.percentage}%`);
      }
      lines.push('');
    }

    // Top Extensions
    if (report.extensionStats.length > 0) {
      lines.push('📄 TOP FILE EXTENSIONS');
      lines.push('───────────────────────────────────────────────────────────');
      for (const ext of report.extensionStats.slice(0, 5)) {
        lines.push(`  ${(ext.extension || 'none').padEnd(10)} ${ext.count.toString().padStart(6)} files  ${formatBytes(ext.totalSize).padStart(10)}`);
      }
      lines.push('');
    }

    // Duplicate Stats
    lines.push('🔄 DUPLICATE STATISTICS');
    lines.push('───────────────────────────────────────────────────────────');
    lines.push(`  Duplicate Groups:      ${report.duplicateStats.totalGroups}`);
    lines.push(`  Duplicate Files:       ${report.duplicateStats.totalDuplicateFiles}`);
    lines.push(`  Wasted Space:          ${formatBytes(report.duplicateStats.totalWastedSpace)}`);
    if (report.duplicateStats.topDuplicatedExtensions.length > 0) {
      lines.push('  Most Duplicated Types:');
      for (const ext of report.duplicateStats.topDuplicatedExtensions.slice(0, 3)) {
        lines.push(`    • ${ext.extension || 'none'}: ${ext.count} duplicates`);
      }
    }
    lines.push('');

    // Recent Activity
    if (report.recentActivity.length > 0) {
      lines.push('⏱️  RECENT ACTIVITY');
      lines.push('───────────────────────────────────────────────────────────');
      for (const activity of report.recentActivity.slice(0, 5)) {
        const date = new Date(activity.createdAt).toLocaleString();
        const statusIcon = activity.status === 'completed' ? '✓' : 
                          activity.status === 'failed' ? '✗' : '◐';
        lines.push(`  ${statusIcon} ${activity.type.padEnd(10)} ${date}  ${activity.transactionId.substring(0, 8)}...`);
      }
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`  Report generated: ${new Date().toLocaleString()}`);
    lines.push('═══════════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}

export default ReporterService;
