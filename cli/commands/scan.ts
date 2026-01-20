import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import * as path from 'path';
import { connectDB, disconnectDB, env } from '../../src/config';
import { ScannerService, ScanResult } from '../../src/services';
import { formatBytes, getCategoryEmoji } from '../../src/utils';

export interface ScanCommandOptions {
  recursive?: boolean;
}

export async function scanCommand(targetPath: string | undefined, options: ScanCommandOptions): Promise<void> {
  const spinner = ora('Connecting to database...').start();

  try {
    // Connect to database
    await connectDB();
    spinner.succeed('Connected to database');

    // Resolve path
    const resolvedPath = targetPath 
      ? path.resolve(targetPath) 
      : env.defaultDownloadsPath;

    console.log('\n' + chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.cyan.bold('  DESKPILOT - File Scanner'));
    console.log(chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.gray(`  Target: ${resolvedPath}`));
    console.log(chalk.gray(`  Mode: ${options.recursive ? 'Recursive' : 'Non-recursive'}`));
    console.log('');

    // Create scanner with progress callback
    let lastProgress = 0;
    const progressSpinner = ora('Scanning files...').start();
    
    const scanner = new ScannerService((current, total, file) => {
      const progress = Math.round((current / total) * 100);
      if (progress !== lastProgress) {
        progressSpinner.text = `Scanning files... ${progress}% (${current}/${total}) - ${file}`;
        lastProgress = progress;
      }
    });

    // Execute scan
    const result = await scanner.scan(resolvedPath, {
      recursive: options.recursive ?? true,
    });

    progressSpinner.succeed(`Scanned ${result.totalFiles} files`);

    // Display results
    displayScanResults(result);

    console.log('\n' + chalk.green('✓ Scan completed successfully!'));
    console.log(chalk.gray(`  Scan ID: ${result.scanId}`));
    console.log(chalk.gray(`  Results saved to database\n`));

  } catch (error: any) {
    spinner.fail('Scan failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

function displayScanResults(result: ScanResult): void {
  // Summary table
  console.log('\n' + chalk.yellow('▸ Summary'));
  console.log(chalk.gray('─'.repeat(40)));

  const summaryTable = new Table({
    chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['cyan'] },
  });

  summaryTable.push(
    [chalk.white('Total Files'), chalk.green(result.totalFiles.toString())],
    [chalk.white('Total Size'), chalk.green(formatBytes(result.totalSize))],
    [chalk.white('Duplicates Found'), result.duplicatesCount > 0 ? chalk.yellow(result.duplicatesCount.toString()) : chalk.gray('0')],
    [chalk.white('Wasted Space'), result.duplicatesSize > 0 ? chalk.yellow(formatBytes(result.duplicatesSize)) : chalk.gray('0 Bytes')],
  );

  console.log(summaryTable.toString());

  // Category breakdown
  console.log('\n' + chalk.yellow('▸ Files by Category'));
  console.log(chalk.gray('─'.repeat(40)));

  const categoryTable = new Table({
    head: [chalk.cyan('Category'), chalk.cyan('Files'), chalk.cyan('Size'), chalk.cyan('Percentage')],
    colWidths: [20, 10, 15, 12],
  });

  const totalSize = result.totalSize || 1;
  const sortedCategories = Object.entries(result.categories)
    .sort(([, a], [, b]) => b.size - a.size);

  for (const [category, data] of sortedCategories) {
    const percentage = Math.round((data.size / totalSize) * 100);
    const emoji = getCategoryEmoji(category as any);
    categoryTable.push([
      `${emoji} ${category}`,
      data.count.toString(),
      formatBytes(data.size),
      `${percentage}%`,
    ]);
  }

  console.log(categoryTable.toString());

  // Duplicate groups (if any)
  if (result.duplicateGroups.length > 0) {
    console.log('\n' + chalk.yellow('▸ Duplicate Files'));
    console.log(chalk.gray('─'.repeat(40)));

    const dupTable = new Table({
      head: [chalk.cyan('Group'), chalk.cyan('Files'), chalk.cyan('Wasted Space')],
      colWidths: [40, 10, 15],
    });

    // Show top 10 duplicate groups
    const topDuplicates = result.duplicateGroups
      .sort((a, b) => b.wastedSize - a.wastedSize)
      .slice(0, 10);

    for (const group of topDuplicates) {
      const firstFile = path.basename(group.files[0].path);
      const displayName = firstFile.length > 35 ? firstFile.substring(0, 32) + '...' : firstFile;
      dupTable.push([
        displayName,
        group.files.length.toString(),
        formatBytes(group.wastedSize),
      ]);
    }

    console.log(dupTable.toString());

    if (result.duplicateGroups.length > 10) {
      console.log(chalk.gray(`  ... and ${result.duplicateGroups.length - 10} more duplicate groups`));
    }

    console.log('\n' + chalk.cyan('💡 Tip: Run ') + chalk.white('deskpilot dedupe <path>') + chalk.cyan(' to remove duplicates'));
  }
}

export default scanCommand;
