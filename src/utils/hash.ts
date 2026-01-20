import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './logger';

/**
 * Calculate SHA-256 hash of a file
 * Uses streaming to handle large files efficiently
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => {
        hash.update(data);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (error) => {
        logger.error(`Error reading file for hashing: ${filePath}`, error);
        reject(error);
      });
    } catch (error) {
      logger.error(`Error creating hash stream: ${filePath}`, error);
      reject(error);
    }
  });
}

/**
 * Calculate quick hash for small files (< 1MB)
 * Falls back to full hash for larger files
 */
export async function calculateQuickHash(filePath: string, sizeThreshold: number = 1024 * 1024): Promise<string> {
  try {
    const stats = fs.statSync(filePath);
    
    if (stats.size <= sizeThreshold) {
      // For small files, read entire content
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    }
    
    // For larger files, use streaming
    return calculateFileHash(filePath);
  } catch (error) {
    logger.error(`Error calculating quick hash: ${filePath}`, error);
    throw error;
  }
}

/**
 * Calculate a partial hash (first + last + size) for quick duplicate detection
 * Useful for initial filtering before full hash comparison
 */
export async function calculatePartialHash(filePath: string): Promise<string> {
  try {
    const stats = fs.statSync(filePath);
    const size = stats.size;
    
    if (size === 0) {
      return crypto.createHash('sha256').update('empty').digest('hex');
    }

    const chunkSize = Math.min(65536, Math.floor(size / 2)); // 64KB or half file
    const hash = crypto.createHash('sha256');

    // Read first chunk
    const fd = fs.openSync(filePath, 'r');
    const firstChunk = Buffer.alloc(chunkSize);
    fs.readSync(fd, firstChunk, 0, chunkSize, 0);
    hash.update(firstChunk);

    // Read last chunk (if file is large enough)
    if (size > chunkSize * 2) {
      const lastChunk = Buffer.alloc(chunkSize);
      fs.readSync(fd, lastChunk, 0, chunkSize, size - chunkSize);
      hash.update(lastChunk);
    }

    fs.closeSync(fd);

    // Include file size in hash
    hash.update(size.toString());

    return hash.digest('hex');
  } catch (error) {
    logger.error(`Error calculating partial hash: ${filePath}`, error);
    throw error;
  }
}

/**
 * Generate a unique ID using UUID-like format
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a short ID (8 characters)
 */
export function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex');
}

export default {
  calculateFileHash,
  calculateQuickHash,
  calculatePartialHash,
  generateId,
  generateShortId,
};
