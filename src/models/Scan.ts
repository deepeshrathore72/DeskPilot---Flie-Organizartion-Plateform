import mongoose, { Document, Schema } from 'mongoose';

export interface IScan extends Document {
  scanId: string;
  scannedPath: string;
  totalFiles: number;
  totalSize: number;
  duplicatesCount: number;
  duplicatesSize: number;
  categories: {
    [key: string]: {
      count: number;
      size: number;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const ScanSchema = new Schema<IScan>(
  {
    scanId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    scannedPath: {
      type: String,
      required: true,
    },
    totalFiles: {
      type: Number,
      default: 0,
    },
    totalSize: {
      type: Number,
      default: 0,
    },
    duplicatesCount: {
      type: Number,
      default: 0,
    },
    duplicatesSize: {
      type: Number,
      default: 0,
    },
    categories: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
ScanSchema.index({ createdAt: -1 });
ScanSchema.index({ scannedPath: 1 });

export const Scan = mongoose.models.Scan || mongoose.model<IScan>('Scan', ScanSchema);

export default Scan;
