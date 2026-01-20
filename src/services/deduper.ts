import * as path from 'path';
import { Transaction, ITransaction, ITransactionAction, FileRecord } from '../models';
import {
  logger,
  calculateFileHash,
  getAllFiles,
  getFileInfo,
  formatBytes,
  generateId,
  generateShortId,
  directoryExists,
  safeDelete,
  safeMove,
  ensureDirectory,
} from '../utils';
import { env } from '../config';

export type DedupeStrategy = 'keep-latest' | 'keep-oldest' | 'keep-largest';

export interface DedupeOptions {
  dryRun?: boolean;
  strategy?: DedupeStrategy;
  moveToTrash?: boolean;
}

export interface DuplicateInfo {
  hash: string;
  files: {
    path: string;
    size: number;
    createdAt: Date;
    modifiedAt: Date;
    isKept: boolean;
  }[];
  wastedSize: number;
}

export interface DedupeResult {
  transactionId: string;
  targetPath: string;
  dryRun: boolean;
  strategy: DedupeStrategy;
  duplicates: DuplicateInfo[];
  summary: {
    totalDuplicateGroups: number;
    totalDuplicateFiles: number;
    deletedCount: number;
    failedCount: number;
    savedBytes: number;
  };
}

export class DedupeService {
  private onProgress?: (current: number, total: number, file: string) => void;

  constructor(onProgress?: (current: number, total: number, file: string) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Find and optionally remove duplicate files
   */
  async dedupe(dirPath: string, options: DedupeOptions = {}): Promise<DedupeResult> {
    const { 
      dryRun = false, 
      strategy = 'keep-latest',
      moveToTrash = true 
    } = options;

    // Validate directory
    if (!directoryExists(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const transactionId = generateId();
    logger.info(`Starting dedupe: ${dirPath} (ID: ${transactionId}, strategy: ${strategy}, dry-run: ${dryRun})`);

    // Get all files and calculate hashes
    const filePaths = await getAllFiles(dirPath, true);
    const totalFiles = filePaths.length;
    
    logger.info(`Found ${totalFiles} files to analyze`);

    // Build hash map
    const hashMap: Map<string, Array<{
      path: string;
      size: number;
      createdAt: Date;
      modifiedAt: Date;
    }>> = new Map();

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      if (this.onProgress) {
        this.onProgress(i + 1, totalFiles, path.basename(filePath));
      }

      try {
        const fileInfo = getFileInfo(filePath);
        if (!fileInfo || !fileInfo.isFile) continue;

        const hash = await calculateFileHash(filePath);

        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }
        
        hashMap.get(hash)!.push({
          path: filePath,
          size: fileInfo.size,
          createdAt: fileInfo.createdAt,
          modifiedAt: fileInfo.modifiedAt,
        });
      } catch (error) {
        logger.warn(`Error processing file: ${filePath}`, error);
      }
    }

    // Find duplicates and determine which to keep
    const duplicates: DuplicateInfo[] = [];
    const actions: ITransactionAction[] = [];
    let totalDuplicateFiles = 0;
    let savedBytes = 0;

    for (const [hash, files] of hashMap.entries()) {
      if (files.length <= 1) continue;

      // Sort based on strategy
      const sorted = this.sortByStrategy(files, strategy);
      const kept = sorted[0];
      const toRemove = sorted.slice(1);

      const duplicateInfo: DuplicateInfo = {
        hash,
        files: sorted.map((f, idx) => ({
          ...f,
          isKept: idx === 0,
        })),
        wastedSize: toRemove.reduce((sum, f) => sum + f.size, 0),
      };

      duplicates.push(duplicateInfo);
      totalDuplicateFiles += toRemove.length;
      savedBytes += duplicateInfo.wastedSize;

      // Create actions for removal
      for (const file of toRemove) {
        actions.push({
          actionId: generateShortId(),
          type: 'delete',
          from: file.path,
          to: moveToTrash ? path.join(env.trashPath, path.basename(file.path)) : '',
          status: 'pending',
          fileHash: hash,
          fileSize: file.size,
        });
      }
    }

    // Execute if not dry run
    let deletedCount = 0;
    let failedCount = 0;

    if (!dryRun && actions.length > 0) {
      if (moveToTrash) {
        ensureDirectory(env.trashPath);
      }

      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        
        if (this.onProgress) {
          this.onProgress(i + 1, actions.length, path.basename(action.from));
        }

        try {
          const result = await safeDelete(action.from, moveToTrash);
          
          if (result.success) {
            deletedCount++;
            actions[i].status = 'completed';
            // Store the actual trash path for rollback
            if (result.trashPath) {
              actions[i].to = result.trashPath;
            }
          } else {
            failedCount++;
            actions[i].status = 'failed';
            actions[i].error = result.error;
          }
        } catch (error: any) {
          failedCount++;
          actions[i].status = 'failed';
          actions[i].error = error.message;
        }
      }
    }

    // Save transaction to database
    const actualSavedBytes = dryRun ? 0 : (savedBytes * (deletedCount / (actions.length || 1)));
    
    const transaction = new Transaction({
      transactionId,
      type: 'dedupe',
      status: dryRun ? 'pending' : (failedCount === 0 ? 'completed' : 'partially_completed'),
      actions,
      summary: {
        movedCount: 0,
        deletedCount,
        restoredCount: 0,
        failedCount,
        savedBytes: Math.round(actualSavedBytes),
        totalProcessed: actions.length,
      },
      targetPath: dirPath,
      dryRun,
      strategy,
      completedAt: dryRun ? undefined : new Date(),
    });
    await transaction.save();

    const result: DedupeResult = {
      transactionId,
      targetPath: dirPath,
      dryRun,
      strategy,
      duplicates,
      summary: {
        totalDuplicateGroups: duplicates.length,
        totalDuplicateFiles,
        deletedCount,
        failedCount,
        savedBytes: dryRun ? savedBytes : Math.round(actualSavedBytes),
      },
    };

    if (dryRun) {
      logger.info(`Dry run completed: ${totalDuplicateFiles} duplicates found (${formatBytes(savedBytes)} can be saved)`);
    } else {
      logger.success(`Dedupe completed: ${deletedCount} files removed, ${formatBytes(actualSavedBytes)} saved`);
    }

    return result;
  }

  /**
   * Sort files based on the deduplication strategy
   */
  private sortByStrategy(
    files: Array<{ path: string; size: number; createdAt: Date; modifiedAt: Date }>,
    strategy: DedupeStrategy
  ): typeof files {
    const sorted = [...files];

    switch (strategy) {
      case 'keep-latest':
        // Keep the most recently modified file
        sorted.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
        break;
      case 'keep-oldest':
        // Keep the oldest file (original)
        sorted.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        break;
      case 'keep-largest':
        // Keep the largest file (might have better quality)
        sorted.sort((a, b) => b.size - a.size);
        break;
    }

    return sorted;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string): Promise<ITransaction | null> {
    return Transaction.findOne({ transactionId });
  }
}

export default DedupeService;
