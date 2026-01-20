import * as path from 'path';

export type FileCategory = 
  | 'Documents'
  | 'Images'
  | 'Videos'
  | 'Audio'
  | 'Installers'
  | 'Archives'
  | 'Code'
  | 'Others';

// Extension mappings to categories
const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  // Documents
  '.pdf': 'Documents',
  '.doc': 'Documents',
  '.docx': 'Documents',
  '.xls': 'Documents',
  '.xlsx': 'Documents',
  '.ppt': 'Documents',
  '.pptx': 'Documents',
  '.txt': 'Documents',
  '.rtf': 'Documents',
  '.odt': 'Documents',
  '.ods': 'Documents',
  '.odp': 'Documents',
  '.csv': 'Documents',
  '.md': 'Documents',
  '.epub': 'Documents',
  '.mobi': 'Documents',

  // Images
  '.jpg': 'Images',
  '.jpeg': 'Images',
  '.png': 'Images',
  '.gif': 'Images',
  '.bmp': 'Images',
  '.svg': 'Images',
  '.webp': 'Images',
  '.ico': 'Images',
  '.tiff': 'Images',
  '.tif': 'Images',
  '.psd': 'Images',
  '.ai': 'Images',
  '.eps': 'Images',
  '.raw': 'Images',
  '.cr2': 'Images',
  '.nef': 'Images',
  '.heic': 'Images',
  '.heif': 'Images',

  // Videos
  '.mp4': 'Videos',
  '.avi': 'Videos',
  '.mkv': 'Videos',
  '.mov': 'Videos',
  '.wmv': 'Videos',
  '.flv': 'Videos',
  '.webm': 'Videos',
  '.m4v': 'Videos',
  '.mpeg': 'Videos',
  '.mpg': 'Videos',
  '.3gp': 'Videos',
  '.vob': 'Videos',

  // Audio
  '.mp3': 'Audio',
  '.wav': 'Audio',
  '.flac': 'Audio',
  '.aac': 'Audio',
  '.ogg': 'Audio',
  '.wma': 'Audio',
  '.m4a': 'Audio',
  '.aiff': 'Audio',
  '.ape': 'Audio',
  '.alac': 'Audio',
  '.mid': 'Audio',
  '.midi': 'Audio',

  // Installers
  '.exe': 'Installers',
  '.msi': 'Installers',
  '.dmg': 'Installers',
  '.pkg': 'Installers',
  '.deb': 'Installers',
  '.rpm': 'Installers',
  '.appimage': 'Installers',
  '.snap': 'Installers',
  '.flatpak': 'Installers',
  '.apk': 'Installers',
  '.ipa': 'Installers',

  // Archives
  '.zip': 'Archives',
  '.rar': 'Archives',
  '.7z': 'Archives',
  '.tar': 'Archives',
  '.gz': 'Archives',
  '.bz2': 'Archives',
  '.xz': 'Archives',
  '.iso': 'Archives',
  '.img': 'Archives',
  '.cab': 'Archives',
  '.arj': 'Archives',
  '.lzh': 'Archives',

  // Code
  '.js': 'Code',
  '.ts': 'Code',
  '.jsx': 'Code',
  '.tsx': 'Code',
  '.py': 'Code',
  '.java': 'Code',
  '.c': 'Code',
  '.cpp': 'Code',
  '.cc': 'Code',
  '.h': 'Code',
  '.hpp': 'Code',
  '.cs': 'Code',
  '.go': 'Code',
  '.rs': 'Code',
  '.rb': 'Code',
  '.php': 'Code',
  '.swift': 'Code',
  '.kt': 'Code',
  '.scala': 'Code',
  '.r': 'Code',
  '.m': 'Code',
  '.mm': 'Code',
  '.sql': 'Code',
  '.sh': 'Code',
  '.bash': 'Code',
  '.ps1': 'Code',
  '.bat': 'Code',
  '.cmd': 'Code',
  '.html': 'Code',
  '.htm': 'Code',
  '.css': 'Code',
  '.scss': 'Code',
  '.sass': 'Code',
  '.less': 'Code',
  '.json': 'Code',
  '.xml': 'Code',
  '.yaml': 'Code',
  '.yml': 'Code',
  '.toml': 'Code',
  '.ini': 'Code',
  '.cfg': 'Code',
  '.conf': 'Code',
  '.vue': 'Code',
  '.svelte': 'Code',
  '.astro': 'Code',
};

/**
 * Get the category for a file based on its extension
 */
export function categorizeFile(filePath: string): FileCategory {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_CATEGORIES[ext] || 'Others';
}

/**
 * Get the file extension (lowercase, with dot)
 */
export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Get all categories
 */
export function getAllCategories(): FileCategory[] {
  return ['Documents', 'Images', 'Videos', 'Audio', 'Installers', 'Archives', 'Code', 'Others'];
}

/**
 * Get category color for CLI output
 */
export function getCategoryColor(category: FileCategory): string {
  const colors: Record<FileCategory, string> = {
    Documents: 'blue',
    Images: 'green',
    Videos: 'magenta',
    Audio: 'yellow',
    Installers: 'red',
    Archives: 'cyan',
    Code: 'white',
    Others: 'gray',
  };
  return colors[category] || 'white';
}

/**
 * Get category emoji for display
 */
export function getCategoryEmoji(category: FileCategory): string {
  const emojis: Record<FileCategory, string> = {
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

/**
 * Get all extensions for a category
 */
export function getExtensionsForCategory(category: FileCategory): string[] {
  return Object.entries(EXTENSION_CATEGORIES)
    .filter(([_, cat]) => cat === category)
    .map(([ext, _]) => ext);
}

export default {
  categorizeFile,
  getExtension,
  getAllCategories,
  getCategoryColor,
  getCategoryEmoji,
  getExtensionsForCategory,
};
