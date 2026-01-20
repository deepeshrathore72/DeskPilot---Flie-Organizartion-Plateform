#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import {
  scanCommand,
  organizeCommand,
  dedupeCommand,
  rollbackCommand,
  listRollbackableCommand,
  reportCommand,
} from './commands';
import { DedupeStrategy } from '../src/services';

const program = new Command();

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('DeskPilot')} ${chalk.gray('- Smart Downloads Organizer')}                   ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('Organize • Dedupe • Rollback • Report')}                   ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════╝')}
`;

program
  .name('deskpilot')
  .description('Smart Downloads Organizer + Duplicate Finder + Rollback + Report Dashboard')
  .version('1.0.0')
  .hook('preAction', () => {
    console.log(banner);
  });

// Scan command
program
  .command('scan [path]')
  .description('Scan a directory for files and detect duplicates')
  .option('-r, --recursive', 'Scan recursively (default: true)', true)
  .option('--no-recursive', 'Do not scan recursively')
  .action(async (targetPath: string | undefined, options: { recursive?: boolean }) => {
    await scanCommand(targetPath, options);
  });

// Organize command
program
  .command('organize [path]')
  .description('Organize files into category folders')
  .option('-d, --dry-run', 'Preview changes without making them', false)
  .option('-r, --recursive', 'Include files in subdirectories', false)
  .action(async (targetPath: string | undefined, options: { dryRun?: boolean; recursive?: boolean }) => {
    await organizeCommand(targetPath, options);
  });

// Dedupe command
program
  .command('dedupe [path]')
  .description('Find and remove duplicate files')
  .option('-d, --dry-run', 'Preview what would be deleted without making changes', false)
  .option('-s, --strategy <strategy>', 'Strategy for keeping files: keep-latest, keep-oldest, keep-largest', 'keep-latest')
  .option('-p, --permanent', 'Permanently delete instead of moving to trash', false)
  .action(async (targetPath: string | undefined, options: { dryRun?: boolean; strategy?: string; permanent?: boolean }) => {
    const strategy = options.strategy as DedupeStrategy;
    if (!['keep-latest', 'keep-oldest', 'keep-largest'].includes(strategy)) {
      console.error(chalk.red(`Invalid strategy: ${strategy}`));
      console.log(chalk.gray('Valid strategies: keep-latest, keep-oldest, keep-largest'));
      process.exit(1);
    }
    await dedupeCommand(targetPath, { ...options, strategy });
  });

// Rollback command
program
  .command('rollback <transactionId>')
  .description('Rollback a previous organize or dedupe operation')
  .action(async (transactionId: string) => {
    await rollbackCommand(transactionId);
  });

// List rollbackable transactions
program
  .command('transactions')
  .description('List transactions that can be rolled back')
  .action(async () => {
    await listRollbackableCommand();
  });

// Report command
program
  .command('report')
  .description('Generate a comprehensive report of all activities')
  .action(async () => {
    await reportCommand();
  });

// Error handling
program.exitOverride((err) => {
  if (err.code === 'commander.missingArgument') {
    console.error(chalk.red(`\nError: ${err.message}`));
    process.exit(1);
  }
  if (err.code === 'commander.helpDisplayed' || err.code === 'commander.version') {
    process.exit(0);
  }
  throw err;
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
