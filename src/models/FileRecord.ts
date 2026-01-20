import mongoose, { Document, Schema } from 'mongoose';

export interface IFileRecord extends Document {
  scanId: string;
  fileName: string;
  filePath: string;
  originalPath: string;
  hash: string;
  extension: string;
  category: string;
  size: number;
  isDuplicate: boolean;
  duplicateOf?: string;
  createdAt: Date;
  modifiedAt: Date;
  fileCreatedAt: Date;
  fileModifiedAt: Date;
}

const FileRecordSchema = new Schema<IFileRecord>(
  {
    scanId: {
      type: String,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    originalPath: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
      index: true,
    },
    extension: {
      type: String,
      default: '',
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
    },
    duplicateOf: {
      type: String,
      default: null,
    },
    fileCreatedAt: {
      type: Date,
    },
    fileModifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
FileRecordSchema.index({ scanId: 1, hash: 1 });
FileRecordSchema.index({ scanId: 1, category: 1 });
FileRecordSchema.index({ scanId: 1, isDuplicate: 1 });
FileRecordSchema.index({ createdAt: -1 });

export const FileRecord = mongoose.models.FileRecord || mongoose.model<IFileRecord>('FileRecord', FileRecordSchema);

export default FileRecord;
