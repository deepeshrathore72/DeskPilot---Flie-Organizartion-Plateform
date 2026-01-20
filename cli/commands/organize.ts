import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import * as path from 'path';
import { connectDB, disconnectDB, env } from '../../src/config';
import { OrganizerService, OrganizeResult } from '../../src/services';
import { formatBytes, getCategoryEmoji } from '../../src/utils';

export interface OrganizeCommandOptions {
  dryRun?: boolean;
  recursive?: boolean;
}

export async function organizeCommand(targetPath: string | undefined, options: OrganizeCommandOptions): Promise<void> {
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

    console.log('\n' + chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.cyan.bold('  DESKPILOT - File Organizer'));
    console.log(chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.gray(`  Target: ${resolvedPath}`));
    console.log(chalk.gray(`  Mode: ${isDryRun ? chalk.yellow('DRY RUN (no changes)') : chalk.green('LIVE')}`));
    console.log('');

    // Create organizer with progress callback
    let lastProgress = 0;
    const progressSpinner = ora(isDryRun ? 'Planning organization...' : 'Organizing files...').start();
    
    const organizer = new OrganizerService((current, total, file) => {
      const progress = Math.round((current / total) * 100);
      if (progress !== lastProgress) {
        progressSpinner.text = isDryRun 
          ? `Planning... ${progress}% (${current}/${total})`
          : `Organizing... ${progress}% (${current}/${total}) - ${file}`;
        lastProgress = progress;
      }
    });

    // Execute organize
    const result = await organizer.organize(resolvedPath, {
      dryRun: isDryRun,
      recursive: options.recursive ?? false,
    });

    progressSpinner.succeed(isDryRun 
      ? `Plan created for ${result.plan.length} files` 
      : `Organized ${result.summary.movedCount} files`);

    // Display results
    displayOrganizeResults(result, isDryRun);

    if (isDryRun) {
      console.log('\n' + chalk.yellow('⚠ This was a dry run. No files were moved.'));
      console.log(chalk.cyan('💡 Run without --dry-run to apply changes:'));
      console.log(chalk.white(`   deskpilot organize "${resolvedPath}"\n`));
    } else {
      console.log('\n' + chalk.green('✓ Organization completed successfully!'));
      console.log(chalk.gray(`  Transaction ID: ${result.transactionId}`));
      console.log(chalk.cyan('💡 To undo, run: ') + chalk.white(`deskpilot rollback ${result.transactionId}\n`));
    }

  } catch (error: any) {
    spinner.fail('Organization failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

function displayOrganizeResults(result: OrganizeResult, isDryRun: boolean): void {
  // Summary
  console.log('\n' + chalk.yellow('▸ Summary'));
  console.log(chalk.gray('─'.repeat(40)));

  const summaryTable = new Table({
    chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['cyan'] },
  });

  summaryTable.push(
    [chalk.white('Total Files'), chalk.green(result.summary.totalFiles.toString())],
    [chalk.white('Files Moved'), isDryRun ? chalk.yellow('(planned)') : chalk.green(result.summary.movedCount.toString())],
    [chalk.white('Failed'), result.summary.failedCount > 0 ? chalk.red(result.summary.failedCount.toString()) : chalk.gray('0')],
  );

  console.log(summaryTable.toString());

  // By category
  if (Object.keys(result.summary.byCategory).length > 0) {
    console.log('\n' + chalk.yellow('▸ Files by Category'));
    console.log(chalk.gray('─'.repeat(40)));

    const categoryTable = new Table({
      head: [chalk.cyan('Category'), chalk.cyan('Files')],
      colWidths: [25, 10],
    });

    const sortedCategories = Object.entries(result.summary.byCategory)
      .sort(([, a], [, b]) => b - a);

    for (const [category, count] of sortedCategories) {
      const emoji = getCategoryEmoji(category as any);
      categoryTable.push([`${emoji} ${category}`, count.toString()]);
    }

    console.log(categoryTable.toString());
  }

  // Detailed plan (for dry run or small number of files)
  if (isDryRun && result.plan.length > 0) {
    console.log('\n' + chalk.yellow('▸ Planned Moves'));
    console.log(chalk.gray('─'.repeat(40)));

    const planTable = new Table({
      head: [chalk.cyan('From'), chalk.cyan('To')],
      colWidths: [35, 35],
      wordWrap: true,
    });

    // Show first 20 planned moves
    const displayPlan = result.plan.slice(0, 20);
    for (const item of displayPlan) {
      const from = path.basename(item.from);
      const toDir = path.basename(path.dirname(item.to));
      planTable.push([
        from.length > 32 ? from.substring(0, 29) + '...' : from,
        `${toDir}/${from.length > 20 ? from.substring(0, 17) + '...' : from}`,
      ]);
    }

    console.log(planTable.toString());

    if (result.plan.length > 20) {
      console.log(chalk.gray(`  ... and ${result.plan.length - 20} more files`));
    }
  }
}

export default organizeCommand;
