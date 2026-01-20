import mongoose, { Document, Schema } from 'mongoose';

export type TransactionType = 'organize' | 'dedupe' | 'rollback';
export type ActionStatus = 'pending' | 'completed' | 'failed' | 'rolled_back';

export interface ITransactionAction {
  actionId: string;
  type: 'move' | 'delete' | 'restore';
  from: string;
  to: string;
  status: ActionStatus;
  error?: string;
  fileHash?: string;
  fileSize?: number;
}

export interface ITransactionSummary {
  movedCount: number;
  deletedCount: number;
  restoredCount: number;
  failedCount: number;
  savedBytes: number;
  totalProcessed: number;
}

export interface ITransaction extends Document {
  transactionId: string;
  scanId?: string;
  type: TransactionType;
  status: 'pending' | 'completed' | 'partially_completed' | 'failed' | 'rolled_back';
  actions: ITransactionAction[];
  summary: ITransactionSummary;
  targetPath: string;
  dryRun: boolean;
  strategy?: string;
  createdAt: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
  rollbackTransactionId?: string;
}

const TransactionActionSchema = new Schema<ITransactionAction>(
  {
    actionId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['move', 'delete', 'restore'],
      required: true,
    },
    from: {
      type: String,
      required: true,
    },
    to: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'rolled_back'],
      default: 'pending',
    },
    error: {
      type: String,
      default: null,
    },
    fileHash: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
  },
  { _id: false }
);

const TransactionSummarySchema = new Schema<ITransactionSummary>(
  {
    movedCount: { type: Number, default: 0 },
    deletedCount: { type: Number, default: 0 },
    restoredCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    savedBytes: { type: Number, default: 0 },
    totalProcessed: { type: Number, default: 0 },
  },
  { _id: false }
);

const TransactionSchema = new Schema<ITransaction>(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scanId: {
      type: String,
      index: true,
    },
    type: {
      type: String,
      enum: ['organize', 'dedupe', 'rollback'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'partially_completed', 'failed', 'rolled_back'],
      default: 'pending',
    },
    actions: {
      type: [TransactionActionSchema],
      default: [],
    },
    summary: {
      type: TransactionSummarySchema,
      default: () => ({
        movedCount: 0,
        deletedCount: 0,
        restoredCount: 0,
        failedCount: 0,
        savedBytes: 0,
        totalProcessed: 0,
      }),
    },
    targetPath: {
      type: String,
      required: true,
    },
    dryRun: {
      type: Boolean,
      default: false,
    },
    strategy: {
      type: String,
    },
    completedAt: {
      type: Date,
    },
    rolledBackAt: {
      type: Date,
    },
    rollbackTransactionId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TransactionSchema.index({ createdAt: -1 });
TransactionSchema.index({ type: 1, createdAt: -1 });
TransactionSchema.index({ status: 1 });

export const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default Transaction;
