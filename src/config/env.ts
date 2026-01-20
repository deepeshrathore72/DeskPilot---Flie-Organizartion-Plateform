import * as dotenv from 'dotenv';
import * as path from 'path';
import * as os from 'os';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface EnvConfig {
  mongodbUri: string;
  defaultDownloadsPath: string;
  trashPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  dashboardPort: number;
}

function getDefaultDownloadsPath(): string {
  const homeDir = os.homedir();
  
  // Platform-specific Downloads folder
  if (process.platform === 'win32') {
    return path.join(homeDir, 'Downloads');
  } else if (process.platform === 'darwin') {
    return path.join(homeDir, 'Downloads');
  } else {
    // Linux and others
    return path.join(homeDir, 'Downloads');
  }
}

function getDefaultTrashPath(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, '.deskpilot-trash');
}

export const env: EnvConfig = {
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/deskpilot',
  defaultDownloadsPath: process.env.DEFAULT_DOWNLOADS_PATH || getDefaultDownloadsPath(),
  trashPath: process.env.TRASH_PATH || getDefaultTrashPath(),
  logLevel: (process.env.LOG_LEVEL as EnvConfig['logLevel']) || 'info',
  dashboardPort: parseInt(process.env.DASHBOARD_PORT || '3006', 10),
};

export default env;
