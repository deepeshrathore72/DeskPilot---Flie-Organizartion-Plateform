import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import * as path from 'path';
import { connectDB, disconnectDB, env } from '../../src/config';
import { DedupeService, DedupeStrategy, DedupeResult } from '../../src/services';
import { formatBytes } from '../../src/utils';

export interface DedupeCommandOptions {
  dryRun?: boolean;
  strategy?: DedupeStrategy;
  permanent?: boolean;
}

export async function dedupeCommand(targetPath: string | undefined, options: DedupeCommandOptions): Promise<void> {
  const spinner = ora('Connecting to database...').start();

  try {
    // Connect to database
    await connectDB();
    spinner.succeed('Connected to database');

    // Resolve path
    const resolvedPath = targetPath 
      ? path.resolve(targetPath) 
      : env.defaultDownloadsPath;

    const isDryRun = options.dryRun ?? false;
    const strategy: DedupeStrategy = options.strategy ?? 'keep-latest';
    const moveToTrash = !(options.permanent ?? false);

    console.log('\n' + chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.cyan.bold('  DESKPILOT - Duplicate Finder & Remover'));
    console.log(chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.gray(`  Target: ${resolvedPath}`));
    console.log(chalk.gray(`  Strategy: ${strategyDescription(strategy)}`));
    console.log(chalk.gray(`  Mode: ${isDryRun ? chalk.yellow('DRY RUN (no changes)') : chalk.green('LIVE')}`));
    console.log(chalk.gray(`  Deletion: ${moveToTrash ? 'Move to trash' : chalk.red('Permanent')}`));
    console.log('');

    // Create deduper with progress callback
    let lastProgress = 0;
    const progressSpinner = ora('Analyzing files for duplicates...').start();
    
    const deduper = new DedupeService((current, total, file) => {
      const progress = Math.round((current / total) * 100);
      if (progress !== lastProgress) {
        progressSpinner.text = `Analyzing... ${progress}% (${current}/${total}) - ${file}`;
        lastProgress = progress;
      }
    });

    // Execute dedupe
    const result = await deduper.dedupe(resolvedPath, {
      dryRun: isDryRun,
      strategy,
      moveToTrash,
    });

    progressSpinner.succeed(`Found ${result.summary.totalDuplicateFiles} duplicates in ${result.summary.totalDuplicateGroups} groups`);

    // Display results
    displayDedupeResults(result, isDryRun);

    if (result.summary.totalDuplicateFiles === 0) {
      console.log('\n' + chalk.green('✓ No duplicates found! Your files are unique.'));
    } else if (isDryRun) {
      console.log('\n' + chalk.yellow('⚠ This was a dry run. No files were deleted.'));
      console.log(chalk.cyan('💡 Run without --dry-run to remove duplicates:'));
      console.log(chalk.white(`   deskpilot dedupe "${resolvedPath}" --strategy=${strategy}\n`));
    } else {
      console.log('\n' + chalk.green('✓ Deduplication completed successfully!'));
      console.log(chalk.gray(`  Transaction ID: ${result.transactionId}`));
      console.log(chalk.green(`  Space saved: ${formatBytes(result.summary.savedBytes)}`));
      if (moveToTrash) {
        console.log(chalk.cyan('💡 To restore, run: ') + chalk.white(`deskpilot rollback ${result.transactionId}\n`));
      }
    }

  } catch (error: any) {
    spinner.fail('Deduplication failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

function strategyDescription(strategy: DedupeStrategy): string {
  switch (strategy) {
    case 'keep-latest':
      return 'Keep most recently modified';
    case 'keep-oldest':
      return 'Keep oldest (original)';
    case 'keep-largest':
      return 'Keep largest file';
    default:
      return strategy;
  }
}

function displayDedupeResults(result: DedupeResult, isDryRun: boolean): void {
  // Summary
  console.log('\n' + chalk.yellow('▸ Summary'));
  console.log(chalk.gray('─'.repeat(40)));

  const summaryTable = new Table({
    chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['cyan'] },
  });

  summaryTable.push(
    [chalk.white('Duplicate Groups'), chalk.yellow(result.summary.totalDuplicateGroups.toString())],
    [chalk.white('Duplicate Files'), chalk.yellow(result.summary.totalDuplicateFiles.toString())],
    [chalk.white('Space to Save'), chalk.green(formatBytes(result.summary.savedBytes))],
  );

  if (!isDryRun) {
    summaryTable.push(
      [chalk.white('Files Deleted'), chalk.green(result.summary.deletedCount.toString())],
      [chalk.white('Failed'), result.summary.failedCount > 0 ? chalk.red(result.summary.failedCount.toString()) : chalk.gray('0')],
    );
  }

  console.log(summaryTable.toString());

  // Duplicate details
  if (result.duplicates.length > 0) {
    console.log('\n' + chalk.yellow('▸ Duplicate Groups'));
    console.log(chalk.gray('─'.repeat(40)));

    // Show top 10 groups by wasted space
    const topGroups = result.duplicates
      .sort((a, b) => b.wastedSize - a.wastedSize)
      .slice(0, 10);

    for (let i = 0; i < topGroups.length; i++) {
      const group = topGroups[i];
      const keptFile = group.files.find(f => f.isKept);
      
      console.log(chalk.cyan(`\n  Group ${i + 1} (${formatBytes(group.wastedSize)} wasted):`));
      
      for (const file of group.files) {
        const fileName = path.basename(file.path);
        const displayName = fileName.length > 45 ? fileName.substring(0, 42) + '...' : fileName;
        const date = file.modifiedAt.toLocaleDateString();
        
        if (file.isKept) {
          console.log(chalk.green(`    ✓ ${displayName} (${formatBytes(file.size)}, ${date}) - KEEP`));
        } else {
          console.log(chalk.red(`    ✗ ${displayName} (${formatBytes(file.size)}, ${date}) - ${isDryRun ? 'WILL DELETE' : 'DELETED'}`));
        }
      }
    }

    if (result.duplicates.length > 10) {
      console.log(chalk.gray(`\n  ... and ${result.duplicates.length - 10} more duplicate groups`));
    }
  }
}

export default dedupeCommand;
