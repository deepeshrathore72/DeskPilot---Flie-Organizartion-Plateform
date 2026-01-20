import * as path from 'path';
import { Transaction, ITransaction, ITransactionAction } from '../models';
import {
  logger,
  formatBytes,
  generateId,
  generateShortId,
  safeMove,
  fileExists,
  ensureDirectory,
} from '../utils';

export interface RollbackResult {
  transactionId: string;
  rollbackTransactionId: string;
  originalType: string;
  summary: {
    totalActions: number;
    restoredCount: number;
    failedCount: number;
    skippedCount: number;
  };
  details: Array<{
    from: string;
    to: string;
    status: 'restored' | 'failed' | 'skipped';
    error?: string;
  }>;
}

export class RollbackService {
  private onProgress?: (current: number, total: number, file: string) => void;

  constructor(onProgress?: (current: number, total: number, file: string) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Rollback a previous transaction
   */
  async rollback(transactionId: string): Promise<RollbackResult> {
    // Find the original transaction
    const originalTransaction = await Transaction.findOne({ transactionId });

    if (!originalTransaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    if (originalTransaction.status === 'rolled_back') {
      throw new Error(`Transaction has already been rolled back: ${transactionId}`);
    }

    if (originalTransaction.dryRun) {
      throw new Error(`Cannot rollback a dry-run transaction: ${transactionId}`);
    }

    const rollbackTransactionId = generateId();
    logger.info(`Starting rollback of ${originalTransaction.type} transaction: ${transactionId}`);
    logger.info(`Rollback ID: ${rollbackTransactionId}`);

    const rollbackActions: ITransactionAction[] = [];
    const details: RollbackResult['details'] = [];
    
    let restoredCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Get completed actions that need to be rolled back
    const actionsToRollback = originalTransaction.actions.filter(
      (action: ITransactionAction) => action.status === 'completed'
    );

    // Process in reverse order
    const reversedActions = [...actionsToRollback].reverse();

    for (let i = 0; i < reversedActions.length; i++) {
      const action = reversedActions[i];

      if (this.onProgress) {
        this.onProgress(i + 1, reversedActions.length, path.basename(action.from));
      }

      try {
        let rollbackResult: { status: 'restored' | 'failed' | 'skipped'; error?: string };

        switch (action.type) {
          case 'move':
            rollbackResult = await this.rollbackMove(action);
            break;
          case 'delete':
            rollbackResult = await this.rollbackDelete(action);
            break;
          default:
            rollbackResult = { status: 'skipped', error: `Unknown action type: ${action.type}` };
        }

        details.push({
          from: action.to || action.from,
          to: action.from,
          status: rollbackResult.status,
          error: rollbackResult.error,
        });

        // Create rollback action record
        rollbackActions.push({
          actionId: generateShortId(),
          type: 'restore',
          from: action.to || action.from,
          to: action.from,
          status: rollbackResult.status === 'restored' ? 'completed' : 
                  rollbackResult.status === 'failed' ? 'failed' : 'completed',
          error: rollbackResult.error,
          fileHash: action.fileHash,
          fileSize: action.fileSize,
        });

        switch (rollbackResult.status) {
          case 'restored':
            restoredCount++;
            break;
          case 'failed':
            failedCount++;
            break;
          case 'skipped':
            skippedCount++;
            break;
        }
      } catch (error: any) {
        failedCount++;
        details.push({
          from: action.to || action.from,
          to: action.from,
          status: 'failed',
          error: error.message,
        });
        rollbackActions.push({
          actionId: generateShortId(),
          type: 'restore',
          from: action.to || action.from,
          to: action.from,
          status: 'failed',
          error: error.message,
        });
      }
    }

    // Save rollback transaction
    const rollbackTransaction = new Transaction({
      transactionId: rollbackTransactionId,
      type: 'rollback',
      status: failedCount === 0 ? 'completed' : 'partially_completed',
      actions: rollbackActions,
      summary: {
        movedCount: 0,
        deletedCount: 0,
        restoredCount,
        failedCount,
        savedBytes: 0,
        totalProcessed: reversedActions.length,
      },
      targetPath: originalTransaction.targetPath,
      dryRun: false,
      completedAt: new Date(),
    });
    await rollbackTransaction.save();

    // Update original transaction status
    originalTransaction.status = 'rolled_back';
    originalTransaction.rolledBackAt = new Date();
    originalTransaction.rollbackTransactionId = rollbackTransactionId;
    await originalTransaction.save();

    const result: RollbackResult = {
      transactionId,
      rollbackTransactionId,
      originalType: originalTransaction.type,
      summary: {
        totalActions: reversedActions.length,
        restoredCount,
        failedCount,
        skippedCount,
      },
      details,
    };

    logger.success(`Rollback completed: ${restoredCount} restored, ${failedCount} failed, ${skippedCount} skipped`);

    return result;
  }

  /**
   * Rollback a move action
   */
  private async rollbackMove(action: ITransactionAction): Promise<{ status: 'restored' | 'failed' | 'skipped'; error?: string }> {
    const { from, to } = action;

    // Check if file exists at new location
    if (!fileExists(to)) {
      return { status: 'skipped', error: 'File no longer exists at moved location' };
    }

    // Check if original location is available
    if (fileExists(from)) {
      return { status: 'skipped', error: 'Original location is no longer available (file exists)' };
    }

    // Ensure original directory exists
    const originalDir = path.dirname(from);
    ensureDirectory(originalDir);

    // Move back
    const result = await safeMove(to, from, false);
    
    if (result.success) {
      return { status: 'restored' };
    } else {
      return { status: 'failed', error: result.error };
    }
  }

  /**
   * Rollback a delete action (restore from trash)
   */
  private async rollbackDelete(action: ITransactionAction): Promise<{ status: 'restored' | 'failed' | 'skipped'; error?: string }> {
    const { from, to } = action;

    // If file was moved to trash, restore it
    if (to && fileExists(to)) {
      // Ensure original directory exists
      const originalDir = path.dirname(from);
      ensureDirectory(originalDir);

      const result = await safeMove(to, from, true);
      
      if (result.success) {
        return { status: 'restored' };
      } else {
        return { status: 'failed', error: result.error };
      }
    }

    // File was permanently deleted or trash file not found
    return { status: 'skipped', error: 'File was permanently deleted or trash file not found' };
  }

  /**
   * Get transactions that can be rolled back
   */
  async getRollbackableTransactions(): Promise<ITransaction[]> {
    return Transaction.find({
      status: { $in: ['completed', 'partially_completed'] },
      dryRun: false,
    }).sort({ createdAt: -1 });
  }

  /**
   * Get rollback history
   */
  async getRollbackHistory(): Promise<ITransaction[]> {
    return Transaction.find({ type: 'rollback' }).sort({ createdAt: -1 });
  }
}

export default RollbackService;
