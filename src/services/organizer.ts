import * as path from 'path';
import { Transaction, ITransaction, ITransactionAction } from '../models';
import {
  logger,
  categorizeFile,
  getAllFiles,
  getFileInfo,
  formatBytes,
  generateId,
  generateShortId,
  directoryExists,
  ensureDirectory,
  safeMove,
  FileCategory,
  getAllCategories,
} from '../utils';

export interface OrganizeOptions {
  dryRun?: boolean;
  recursive?: boolean;
}

export interface OrganizePlan {
  from: string;
  to: string;
  category: FileCategory;
  fileName: string;
  size: number;
}

export interface OrganizeResult {
  transactionId: string;
  targetPath: string;
  dryRun: boolean;
  plan: OrganizePlan[];
  summary: {
    totalFiles: number;
    movedCount: number;
    failedCount: number;
    byCategory: Record<string, number>;
  };
}

export class OrganizerService {
  private onProgress?: (current: number, total: number, file: string) => void;

  constructor(onProgress?: (current: number, total: number, file: string) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Organize files into category folders
   */
  async organize(dirPath: string, options: OrganizeOptions = {}): Promise<OrganizeResult> {
    const { dryRun = false, recursive = false } = options;

    // Validate directory
    if (!directoryExists(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const transactionId = generateId();
    logger.info(`Starting organize: ${dirPath} (ID: ${transactionId}, dry-run: ${dryRun})`);

    // Get all files (non-recursive by default for organize)
    const filePaths = await this.getOrganizableFiles(dirPath, recursive);
    const totalFiles = filePaths.length;

    logger.info(`Found ${totalFiles} files to organize`);

    // Build organization plan
    const plan: OrganizePlan[] = [];
    const actions: ITransactionAction[] = [];
    const byCategory: Record<string, number> = {};

    for (const filePath of filePaths) {
      const fileInfo = getFileInfo(filePath);
      if (!fileInfo || !fileInfo.isFile) continue;

      const category = categorizeFile(filePath);
      const targetDir = path.join(dirPath, category);
      const targetPath = path.join(targetDir, fileInfo.name);

      // Skip if already in correct folder
      if (path.dirname(filePath) === targetDir) {
        continue;
      }

      plan.push({
        from: filePath,
        to: targetPath,
        category,
        fileName: fileInfo.name,
        size: fileInfo.size,
      });

      byCategory[category] = (byCategory[category] || 0) + 1;

      actions.push({
        actionId: generateShortId(),
        type: 'move',
        from: filePath,
        to: targetPath,
        status: 'pending',
        fileSize: fileInfo.size,
      });
    }

    // Execute if not dry run
    let movedCount = 0;
    let failedCount = 0;

    if (!dryRun && plan.length > 0) {
      // Create category folders
      for (const category of getAllCategories()) {
        ensureDirectory(path.join(dirPath, category));
      }

      // Execute moves
      for (let i = 0; i < plan.length; i++) {
        const item = plan[i];
        
        if (this.onProgress) {
          this.onProgress(i + 1, plan.length, item.fileName);
        }

        try {
          const result = await safeMove(item.from, item.to, true);
          
          if (result.success) {
            movedCount++;
            actions[i].status = 'completed';
            actions[i].to = result.to; // Update with actual path (may differ due to collision)
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
    const transaction = new Transaction({
      transactionId,
      type: 'organize',
      status: dryRun ? 'pending' : (failedCount === 0 ? 'completed' : 'partially_completed'),
      actions,
      summary: {
        movedCount,
        deletedCount: 0,
        restoredCount: 0,
        failedCount,
        savedBytes: 0,
        totalProcessed: plan.length,
      },
      targetPath: dirPath,
      dryRun,
      completedAt: dryRun ? undefined : new Date(),
    });
    await transaction.save();

    const result: OrganizeResult = {
      transactionId,
      targetPath: dirPath,
      dryRun,
      plan,
      summary: {
        totalFiles: plan.length,
        movedCount,
        failedCount,
        byCategory,
      },
    };

    if (dryRun) {
      logger.info(`Dry run completed: ${plan.length} files would be organized`);
    } else {
      logger.success(`Organization completed: ${movedCount} files moved, ${failedCount} failed`);
    }

    return result;
  }

  /**
   * Get files that should be organized (skip already organized folders)
   */
  private async getOrganizableFiles(dirPath: string, recursive: boolean): Promise<string[]> {
    const categories = getAllCategories();
    const files: string[] = [];

    const entries = await getAllFiles(dirPath, recursive, (filePath: string) => {
      // Skip files already in category folders
      const parentDir = path.basename(path.dirname(filePath));
      return !categories.includes(parentDir as FileCategory);
    });

    // For non-recursive, only get immediate files
    if (!recursive) {
      const immediateFiles = entries.filter(f => path.dirname(f) === dirPath);
      return immediateFiles;
    }

    return entries;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string): Promise<ITransaction | null> {
    return Transaction.findOne({ transactionId });
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(limit: number = 10, type?: string): Promise<ITransaction[]> {
    const query = type ? { type } : {};
    return Transaction.find(query).sort({ createdAt: -1 }).limit(limit);
  }
}

export default OrganizerService;
