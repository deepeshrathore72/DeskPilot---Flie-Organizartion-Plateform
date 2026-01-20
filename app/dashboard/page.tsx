'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReportData {
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
    createdAt: string;
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
    createdAt: string;
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

interface Transaction {
  transactionId: string;
  type: string;
  status: string;
  dryRun: boolean;
  targetPath: string;
  summary: {
    movedCount: number;
    deletedCount: number;
    restoredCount: number;
    failedCount: number;
    savedBytes: number;
    totalProcessed: number;
  };
  createdAt: string;
}

interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    Documents: '📄',
    Images: '🖼️',
    Videos: '🎬',
    Audio: '🎵',
    Installers: '📦',
    Archives: '🗜️',
    Code: '💻',
    Others: '📁',
  };
  return emojis[category] || '📁';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    case 'rolled_back':
      return 'text-yellow-400';
    case 'partially_completed':
      return 'text-orange-400';
    default:
      return 'text-gray-400';
  }
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'organize':
      return '📁';
    case 'dedupe':
      return '🔍';
    case 'rollback':
      return '⏪';
    default:
      return '📋';
  }
}

export default function DashboardPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  
  // Operation states
  const [runningOperation, setRunningOperation] = useState<string | null>(null);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const [customPath, setCustomPath] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [dedupeStrategy, setDedupeStrategy] = useState<'keep-latest' | 'keep-oldest' | 'keep-largest'>('keep-latest');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);

      const [reportRes, transactionsRes] = await Promise.all([
        fetch('/api/report'),
        fetch('/api/transactions'),
      ]);

      if (!reportRes.ok) {
        throw new Error('Failed to fetch report');
      }

      const reportData = await reportRes.json();
      const transactionsData = await transactionsRes.json();

      setReport(reportData);
      setTransactions(Array.isArray(transactionsData) ? transactionsData : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function runScan() {
    try {
      setRunningOperation('scan');
      setOperationResult(null);
      
      const trimmedPath = customPath.trim();
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: trimmedPath || undefined,
          recursive: true
        })
      });
      
      const data = await res.json();
      setOperationResult(data);
      
      if (data.success) {
        fetchData();
      }
    } catch (err: any) {
      setOperationResult({ success: false, message: err.message, error: err.message });
    } finally {
      setRunningOperation(null);
    }
  }

  async function runOrganize() {
    try {
      setRunningOperation('organize');
      setOperationResult(null);
      
      const trimmedPath = customPath.trim();
      const res = await fetch('/api/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: trimmedPath || undefined,
          dryRun,
          recursive: false
        })
      });
      
      const data = await res.json();
      setOperationResult(data);
      
      if (data.success) {
        fetchData();
      }
    } catch (err: any) {
      setOperationResult({ success: false, message: err.message, error: err.message });
    } finally {
      setRunningOperation(null);
    }
  }

  async function runDedupe() {
    try {
      setRunningOperation('dedupe');
      setOperationResult(null);
      
      const trimmedPath = customPath.trim();
      const res = await fetch('/api/dedupe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: trimmedPath || undefined,
          dryRun,
          strategy: dedupeStrategy,
          moveToTrash: true
        })
      });
      
      const data = await res.json();
      setOperationResult(data);
      
      if (data.success) {
        fetchData();
      }
    } catch (err: any) {
      setOperationResult({ success: false, message: err.message, error: err.message });
    } finally {
      setRunningOperation(null);
    }
  }

  async function handleRollback(transactionId: string) {
    if (!confirm('Are you sure you want to rollback this transaction?')) {
      return;
    }

    try {
      setRollingBack(transactionId);
      const res = await fetch(`/api/transactions/${transactionId}/rollback`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Rollback failed');
      }

      setOperationResult({ success: true, message: 'Rollback completed successfully!' });
      fetchData();
    } catch (err: any) {
      setOperationResult({ success: false, message: `Rollback failed: ${err.message}`, error: err.message });
    } finally {
      setRollingBack(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Error Loading Dashboard</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <p className="text-gray-500 text-sm mb-4">Make sure MongoDB is running and accessible.</p>
          <button
            onClick={fetchData}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 sticky top-0 z-10 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <span className="text-2xl">🚀</span>
              <span className="text-xl font-bold text-white">DeskPilot</span>
              <span className="text-sm text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Dashboard</span>
            </Link>
            <button
              onClick={fetchData}
              disabled={!!runningOperation}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Control Panel */}
        <section className="mb-8 bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-800/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>🎮</span> Control Panel
          </h2>
          
          {/* Path Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              Target Path (leave empty for default Downloads folder)
            </label>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="C:\Users\YourName\Downloads"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              disabled={!!runningOperation}
            />
          </div>

          {/* Options Row */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="rounded bg-gray-800 border-gray-700 text-cyan-500 focus:ring-cyan-500"
                disabled={!!runningOperation}
              />
              <span>Dry Run (preview only)</span>
            </label>
            
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Dedupe Strategy:</label>
              <select
                value={dedupeStrategy}
                onChange={(e) => setDedupeStrategy(e.target.value as any)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                disabled={!!runningOperation}
              >
                <option value="keep-latest">Keep Latest</option>
                <option value="keep-oldest">Keep Oldest</option>
                <option value="keep-largest">Keep Largest</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={runScan}
              disabled={!!runningOperation}
              className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {runningOperation === 'scan' ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Scanning...
                </>
              ) : (
                <>
                  <span>📊</span>
                  Scan Files
                </>
              )}
            </button>

            <button
              onClick={runOrganize}
              disabled={!!runningOperation}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {runningOperation === 'organize' ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Organizing...
                </>
              ) : (
                <>
                  <span>📁</span>
                  Organize Files
                </>
              )}
            </button>

            <button
              onClick={runDedupe}
              disabled={!!runningOperation}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {runningOperation === 'dedupe' ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Deduping...
                </>
              ) : (
                <>
                  <span>🔍</span>
                  Remove Duplicates
                </>
              )}
            </button>
          </div>

          {/* Operation Result */}
          {operationResult && (
            <div className={`mt-4 p-4 rounded-lg ${operationResult.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xl">{operationResult.success ? '✅' : '❌'}</span>
                <div className="flex-1">
                  <p className={`font-medium ${operationResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {operationResult.success ? 'Operation Successful' : 'Operation Failed'}
                  </p>
                  <p className="text-sm text-gray-300 mt-1">{operationResult.message}</p>
                  {operationResult.data && operationResult.data.summary && (
                    <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-3">
                      {operationResult.data.summary.totalFiles !== undefined && (
                        <span>Files: {operationResult.data.summary.totalFiles}</span>
                      )}
                      {operationResult.data.summary.movedCount !== undefined && operationResult.data.summary.movedCount > 0 && (
                        <span>Moved: {operationResult.data.summary.movedCount}</span>
                      )}
                      {operationResult.data.summary.deletedCount !== undefined && operationResult.data.summary.deletedCount > 0 && (
                        <span>Deleted: {operationResult.data.summary.deletedCount}</span>
                      )}
                      {operationResult.data.summary.savedBytes !== undefined && operationResult.data.summary.savedBytes > 0 && (
                        <span className="text-green-400">Saved: {formatBytes(operationResult.data.summary.savedBytes)}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setOperationResult(null)}
                  className="text-gray-500 hover:text-gray-300 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Overview Stats */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              label="Total Scans"
              value={report?.overview.totalScans || 0}
              icon="📊"
            />
            <StatCard
              label="Files Scanned"
              value={report?.overview.totalFilesScanned || 0}
              icon="📁"
            />
            <StatCard
              label="Duplicates Found"
              value={report?.overview.totalDuplicatesFound || 0}
              icon="🔄"
              highlight={true}
            />
            <StatCard
              label="Space Saved"
              value={formatBytes(report?.overview.totalDiskSpaceSaved || 0)}
              icon="💾"
              isString={true}
            />
            <StatCard
              label="Transactions"
              value={report?.overview.totalTransactions || 0}
              icon="📋"
            />
          </div>
        </section>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Category Breakdown */}
          <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">Files by Category</h2>
            {report?.categoryBreakdown && report.categoryBreakdown.length > 0 ? (
              <div className="space-y-3">
                {report.categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-xl">{getCategoryEmoji(cat.category)}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{cat.category}</span>
                        <span className="text-gray-500">{cat.fileCount} files</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                          style={{ width: `${Math.max(cat.percentage, 2)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">
                      {formatBytes(cat.totalSize)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No data available. Run a scan first.</p>
            )}
          </section>

          {/* Duplicate Stats */}
          <section className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">Duplicate Statistics</h2>
            {report?.duplicateStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-400">
                      {report.duplicateStats.totalGroups}
                    </div>
                    <div className="text-xs text-gray-500">Duplicate Groups</div>
                  </div>
                  <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-400">
                      {report.duplicateStats.totalDuplicateFiles}
                    </div>
                    <div className="text-xs text-gray-500">Duplicate Files</div>
                  </div>
                  <div className="text-center p-4 bg-gray-800/50 rounded-lg">
                    <div className="text-2xl font-bold text-red-400">
                      {formatBytes(report.duplicateStats.totalWastedSpace)}
                    </div>
                    <div className="text-xs text-gray-500">Wasted Space</div>
                  </div>
                </div>

                {report.duplicateStats.topDuplicatedExtensions.length > 0 && (
                  <div>
                    <h3 className="text-sm text-gray-400 mb-2">Most Duplicated Extensions</h3>
                    <div className="flex flex-wrap gap-2">
                      {report.duplicateStats.topDuplicatedExtensions.map((ext) => (
                        <span
                          key={ext.extension}
                          className="px-3 py-1 bg-gray-800 rounded-full text-sm text-gray-300"
                        >
                          {ext.extension || 'No ext'}: {ext.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No duplicate data available.</p>
            )}
          </section>
        </div>

        {/* Transaction History */}
        <section className="mt-8 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Transaction History</h2>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-gray-500 text-sm border-b border-gray-800">
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Path</th>
                    <th className="pb-3 font-medium">Actions</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {transactions.slice(0, 15).map((t) => (
                    <tr key={t.transactionId} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <span>{getTypeIcon(t.type)}</span>
                          <span className="capitalize">{t.type}</span>
                          {t.dryRun && (
                            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">
                              dry-run
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`capitalize ${getStatusColor(t.status)}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-gray-400 max-w-xs truncate" title={t.targetPath}>
                        {t.targetPath}
                      </td>
                      <td className="py-3 text-gray-400">
                        {t.summary.totalProcessed} processed
                        {t.summary.savedBytes > 0 && (
                          <span className="text-green-400 ml-2">
                            ({formatBytes(t.summary.savedBytes)} saved)
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3">
                        {['completed', 'partially_completed'].includes(t.status) && !t.dryRun && t.type !== 'rollback' && (
                          <button
                            onClick={() => handleRollback(t.transactionId)}
                            disabled={rollingBack === t.transactionId}
                            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded disabled:opacity-50 transition-colors"
                          >
                            {rollingBack === t.transactionId ? 'Rolling back...' : 'Rollback'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No transactions yet. Run organize or dedupe commands.</p>
          )}
        </section>

        {/* Recent Scans */}
        <section className="mt-8 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-300 mb-4">Recent Scans</h2>
          {report?.recentScans && report.recentScans.length > 0 ? (
            <div className="grid gap-4">
              {report.recentScans.map((scan) => (
                <div
                  key={scan.scanId}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors"
                >
                  <div>
                    <p className="text-gray-300 font-medium truncate max-w-md" title={scan.scannedPath}>
                      {scan.scannedPath}
                    </p>
                    <p className="text-sm text-gray-500">
                      {scan.totalFiles} files • {formatBytes(scan.totalSize)}
                      {scan.duplicatesCount > 0 && (
                        <span className="text-yellow-400 ml-2">
                          • {scan.duplicatesCount} duplicates ({formatBytes(scan.duplicatesSize)})
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(scan.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No scans yet. Run the scan command first.</p>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-8 py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>DeskPilot v1.0.0 — Smart Downloads Organizer</p>
          <p className="mt-1">
            Use the Control Panel above to scan, organize, and dedupe your files
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
  isString,
}: {
  label: string;
  value: number | string;
  icon: string;
  highlight?: boolean;
  isString?: boolean;
}) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${highlight ? 'text-yellow-400' : 'text-white'}`}>
        {isString ? value : typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
