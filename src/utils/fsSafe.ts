import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';
import { env } from '../config/env';

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  isFile: boolean;
  isDirectory: boolean;
}

export interface MoveResult {
  success: boolean;
  from: string;
  to: string;
  error?: string;
}

export interface DeleteResult {
  success: boolean;
  path: string;
  movedToTrash: boolean;
  trashPath?: string;
  error?: string;
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists
 */
export function directoryExists(dirPath: string): boolean {
  try {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get file information safely
 */
export function getFileInfo(filePath: string): FileInfo | null {
  try {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stats.size,
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    logger.debug(`Failed to get file info: ${filePath}`, error);
    return null;
  }
}

/**
 * Create directory if it doesn't exist
 */
export function ensureDirectory(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      logger.debug(`Created directory: ${dirPath}`);
    }
    return true;
  } catch (error) {
    logger.error(`Failed to create directory: ${dirPath}`, error);
    return false;
  }
}

/**
 * Generate a unique filename if collision occurs
 */
export function getUniqueFilename(targetPath: string): string {
  if (!fs.existsSync(targetPath)) {
    return targetPath;
  }

  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const baseName = path.basename(targetPath, ext);
  
  let counter = 1;
  let newPath: string;
  
  do {
    newPath = path.join(dir, `${baseName}_${counter}${ext}`);
    counter++;
  } while (fs.existsSync(newPath) && counter < 1000);

  return newPath;
}

/**
 * Safely move a file with collision handling
 */
export async function safeMove(from: string, to: string, handleCollision: boolean = true): Promise<MoveResult> {
  try {
    // Check source exists
    if (!fs.existsSync(from)) {
      return { success: false, from, to, error: 'Source file does not exist' };
    }

    // Ensure target directory exists
    const targetDir = path.dirname(to);
    if (!ensureDirectory(targetDir)) {
      return { success: false, from, to, error: 'Failed to create target directory' };
    }

    // Handle collision
    let finalTo = to;
    if (handleCollision && fs.existsSync(to)) {
      finalTo = getUniqueFilename(to);
      logger.debug(`Collision detected, renamed to: ${finalTo}`);
    }

    // Try rename first (same filesystem)
    try {
      fs.renameSync(from, finalTo);
      return { success: true, from, to: finalTo };
    } catch {
      // Fall back to copy + delete (cross filesystem)
      fs.copyFileSync(from, finalTo);
      fs.unlinkSync(from);
      return { success: true, from, to: finalTo };
    }
  } catch (error: any) {
    const errorMsg = error.code === 'EACCES' ? 'Permission denied' :
                     error.code === 'EBUSY' ? 'File is locked/busy' :
                     error.code === 'ENOENT' ? 'File not found' :
                     error.message || 'Unknown error';
    
    logger.error(`Failed to move file: ${from} -> ${to}`, errorMsg);
    return { success: false, from, to, error: errorMsg };
  }
}

/**
 * Safely delete a file (moves to trash by default)
 */
export async function safeDelete(filePath: string, moveToTrash: boolean = true): Promise<DeleteResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, path: filePath, movedToTrash: false, error: 'File does not exist' };
    }

    if (moveToTrash) {
      // Move to trash folder instead of permanent delete
      const trashDir = env.trashPath;
      ensureDirectory(trashDir);
      
      const fileName = path.basename(filePath);
      const timestamp = Date.now();
      const trashFilePath = path.join(trashDir, `${timestamp}_${fileName}`);
      
      const moveResult = await safeMove(filePath, trashFilePath, true);
      if (moveResult.success) {
        return { success: true, path: filePath, movedToTrash: true, trashPath: moveResult.to };
      } else {
        return { success: false, path: filePath, movedToTrash: false, error: moveResult.error };
      }
    } else {
      // Permanent delete
      fs.unlinkSync(filePath);
      return { success: true, path: filePath, movedToTrash: false };
    }
  } catch (error: any) {
    const errorMsg = error.code === 'EACCES' ? 'Permission denied' :
                     error.code === 'EBUSY' ? 'File is locked/busy' :
                     error.message || 'Unknown error';
    
    logger.error(`Failed to delete file: ${filePath}`, errorMsg);
    return { success: false, path: filePath, movedToTrash: false, error: errorMsg };
  }
}

/**
 * Restore a file from trash
 */
export async function restoreFromTrash(trashFilePath: string, originalPath: string): Promise<MoveResult> {
  return safeMove(trashFilePath, originalPath, true);
}

/**
 * Get all files in a directory recursively
 */
export async function getAllFiles(
  dirPath: string, 
  recursive: boolean = true,
  filter?: (filePath: string) => boolean
): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isFile()) {
        if (!filter || filter(fullPath)) {
          files.push(fullPath);
        }
      } else if (entry.isDirectory() && recursive) {
        // Skip hidden directories and system folders
        if (!entry.name.startsWith('.') && 
            entry.name !== 'node_modules' && 
            entry.name !== '.deskpilot-trash') {
          const subFiles = await getAllFiles(fullPath, recursive, filter);
          files.push(...subFiles);
        }
      }
    }
  } catch (error: any) {
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      logger.warn(`Error reading directory: ${dirPath}`, error.message);
    }
  }

  return files;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if file is accessible (readable)
 */
export function isAccessible(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get directory size
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  const files = await getAllFiles(dirPath);
  
  for (const file of files) {
    const info = getFileInfo(file);
    if (info) {
      totalSize += info.size;
    }
  }
  
  return totalSize;
}

export default {
  fileExists,
  directoryExists,
  getFileInfo,
  ensureDirectory,
  getUniqueFilename,
  safeMove,
  safeDelete,
  restoreFromTrash,
  getAllFiles,
  formatBytes,
  isAccessible,
  getDirectorySize,
};
