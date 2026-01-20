import chalk from 'chalk';
import { env } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = chalk.gray(`[${this.formatTimestamp()}]`);
    const formattedArgs = args.length > 0 ? ' ' + args.map(a => 
      typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
    ).join(' ') : '';

    switch (level) {
      case 'debug':
        return `${timestamp} ${chalk.magenta('DEBUG')} ${message}${formattedArgs}`;
      case 'info':
        return `${timestamp} ${chalk.blue('INFO')}  ${message}${formattedArgs}`;
      case 'warn':
        return `${timestamp} ${chalk.yellow('WARN')}  ${message}${formattedArgs}`;
      case 'error':
        return `${timestamp} ${chalk.red('ERROR')} ${message}${formattedArgs}`;
      default:
        return `${timestamp} ${message}${formattedArgs}`;
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, ...args));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, ...args));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, ...args));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, ...args));
    }
  }

  success(message: string): void {
    console.log(`${chalk.gray(`[${this.formatTimestamp()}]`)} ${chalk.green('✓')} ${chalk.green(message)}`);
  }

  failure(message: string): void {
    console.log(`${chalk.gray(`[${this.formatTimestamp()}]`)} ${chalk.red('✗')} ${chalk.red(message)}`);
  }

  header(message: string): void {
    console.log('\n' + chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.cyan.bold(`  ${message}`));
    console.log(chalk.cyan.bold('═'.repeat(60)) + '\n');
  }

  subheader(message: string): void {
    console.log('\n' + chalk.yellow(`▸ ${message}`));
    console.log(chalk.gray('─'.repeat(40)));
  }

  bullet(message: string, indent: number = 0): void {
    const indentation = '  '.repeat(indent);
    console.log(`${indentation}${chalk.cyan('•')} ${message}`);
  }

  newline(): void {
    console.log('');
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger(env.logLevel);

export default logger;
