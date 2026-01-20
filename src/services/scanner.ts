import * as path from 'path';
import { Scan, IScan, FileRecord, IFileRecord } from '../models';
import {
  logger,
  calculateFileHash,
  categorizeFile,
  getExtension,
  getAllFiles,
  getFileInfo,
  formatBytes,
  generateId,
  directoryExists,
  isAccessible,
} from '../utils';

export interface ScanOptions {
  recursive?: boolean;
  includeHidden?: boolean;
}

export interface ScanResult {
  scanId: string;
  scannedPath: string;
  totalFiles: number;
  totalSize: number;
  duplicatesCount: number;
  duplicatesSize: number;
  categories: Record<string, { count: number; size: number }>;
  files: ScannedFile[];
  duplicateGroups: DuplicateGroup[];
}

export interface ScannedFile {
  path: string;
  name: string;
  hash: string;
  extension: string;
  category: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isDuplicate: boolean;
  duplicateOf?: string;
}

export interface DuplicateGroup {
  hash: string;
  files: ScannedFile[];
  totalSize: number;
  wastedSize: number;
}

export class ScannerService {
  private onProgress?: (current: number, total: number, file: string) => void;

  constructor(onProgress?: (current: number, total: number, file: string) => void) {
    this.onProgress = onProgress;
  }

  /**
   * Scan a directory for files and detect duplicates
   */
  async scan(dirPath: string, options: ScanOptions = {}): Promise<ScanResult> {
    const { recursive = true } = options;

    // Validate directory
    if (!directoryExists(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    const scanId = generateId();
    logger.info(`Starting scan: ${dirPath} (ID: ${scanId})`);

    // Get all files
    const filePaths = await getAllFiles(dirPath, recursive);
    const totalFiles = filePaths.length;
    
    logger.info(`Found ${totalFiles} files to scan`);

    // Process files
    const files: ScannedFile[] = [];
    const hashMap: Map<string, ScannedFile[]> = new Map();
    const categories: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      
      if (this.onProgress) {
        this.onProgress(i + 1, totalFiles, path.basename(filePath));
      }

      try {
        // Skip inaccessible files
        if (!isAccessible(filePath)) {
          logger.debug(`Skipping inaccessible file: ${filePath}`);
          continue;
        }

        const fileInfo = getFileInfo(filePath);
        if (!fileInfo || !fileInfo.isFile) continue;

        // Calculate hash
        const hash = await calculateFileHash(filePath);
        const extension = getExtension(filePath);
        const category = categorizeFile(filePath);

        const scannedFile: ScannedFile = {
          path: filePath,
          name: fileInfo.name,
          hash,
          extension,
          category,
          size: fileInfo.size,
          createdAt: fileInfo.createdAt,
          modifiedAt: fileInfo.modifiedAt,
          isDuplicate: false,
        };

        files.push(scannedFile);
        totalSize += fileInfo.size;

        // Track for duplicate detection
        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }
        hashMap.get(hash)!.push(scannedFile);

        // Update category stats
        if (!categories[category]) {
          categories[category] = { count: 0, size: 0 };
        }
        categories[category].count++;
        categories[category].size += fileInfo.size;

      } catch (error) {
        logger.warn(`Error processing file: ${filePath}`, error);
      }
    }

    // Detect duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    let duplicatesCount = 0;
    let duplicatesSize = 0;

    for (const [hash, groupFiles] of hashMap.entries()) {
      if (groupFiles.length > 1) {
        // Sort by date (oldest first) or size (largest first)
        groupFiles.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        // First file is the "original", rest are duplicates
        const original = groupFiles[0];
        const duplicates = groupFiles.slice(1);

        for (const dup of duplicates) {
          dup.isDuplicate = true;
          dup.duplicateOf = original.path;
          duplicatesCount++;
          duplicatesSize += dup.size;
        }

        duplicateGroups.push({
          hash,
          files: groupFiles,
          totalSize: groupFiles.reduce((sum, f) => sum + f.size, 0),
          wastedSize: duplicates.reduce((sum, f) => sum + f.size, 0),
        });
      }
    }

    // Create scan result
    const result: ScanResult = {
      scanId,
      scannedPath: dirPath,
      totalFiles: files.length,
      totalSize,
      duplicatesCount,
      duplicatesSize,
      categories,
      files,
      duplicateGroups,
    };

    // Save to database
    await this.saveScanResults(result);

    logger.success(`Scan completed: ${files.length} files, ${duplicatesCount} duplicates (${formatBytes(duplicatesSize)} wasted)`);

    return result;
  }

  /**
   * Save scan results to MongoDB
   */
  private async saveScanResults(result: ScanResult): Promise<void> {
    try {
      // Save scan document
      const scan = new Scan({
        scanId: result.scanId,
        scannedPath: result.scannedPath,
        totalFiles: result.totalFiles,
        totalSize: result.totalSize,
        duplicatesCount: result.duplicatesCount,
        duplicatesSize: result.duplicatesSize,
        categories: result.categories,
      });
      await scan.save();

      // Save file records in batches
      const batchSize = 100;
      for (let i = 0; i < result.files.length; i += batchSize) {
        const batch = result.files.slice(i, i + batchSize);
        const fileRecords = batch.map(file => ({
          scanId: result.scanId,
          fileName: file.name,
          filePath: file.path,
          originalPath: file.path,
          hash: file.hash,
          extension: file.extension,
          category: file.category,
          size: file.size,
          isDuplicate: file.isDuplicate,
          duplicateOf: file.duplicateOf,
          fileCreatedAt: file.createdAt,
          fileModifiedAt: file.modifiedAt,
        }));
        await FileRecord.insertMany(fileRecords);
      }

      logger.debug(`Saved scan results to database: ${result.scanId}`);
    } catch (error) {
      logger.error('Failed to save scan results to database', error);
      throw error;
    }
  }

  /**
   * Get scan by ID
   */
  async getScanById(scanId: string): Promise<IScan | null> {
    return Scan.findOne({ scanId });
  }

  /**
   * Get recent scans
   */
  async getRecentScans(limit: number = 10): Promise<IScan[]> {
    return Scan.find().sort({ createdAt: -1 }).limit(limit);
  }

  /**
   * Get file records for a scan
   */
  async getFileRecords(scanId: string): Promise<IFileRecord[]> {
    return FileRecord.find({ scanId });
  }

  /**
   * Get duplicates for a scan
   */
  async getDuplicates(scanId: string): Promise<IFileRecord[]> {
    return FileRecord.find({ scanId, isDuplicate: true });
  }
}

export default ScannerService;
