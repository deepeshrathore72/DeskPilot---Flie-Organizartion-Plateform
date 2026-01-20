import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import * as path from 'path';
import { connectDB, disconnectDB } from '../../src/config';
import { RollbackService, RollbackResult } from '../../src/services';
import { Transaction } from '../../src/models';

export async function rollbackCommand(transactionId: string): Promise<void> {
  const spinner = ora('Connecting to database...').start();

  try {
    // Connect to database
    await connectDB();
    spinner.succeed('Connected to database');

    console.log('\n' + chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.cyan.bold('  DESKPILOT - Rollback'));
    console.log(chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.gray(`  Transaction: ${transactionId}`));
    console.log('');

    // Get original transaction info
    const originalTransaction = await Transaction.findOne({ transactionId });
    if (!originalTransaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    console.log(chalk.yellow('▸ Original Transaction'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  Type: ${chalk.white(originalTransaction.type)}`);
    console.log(`  Date: ${chalk.white(originalTransaction.createdAt.toLocaleString())}`);
    console.log(`  Path: ${chalk.white(originalTransaction.targetPath)}`);
    console.log(`  Status: ${chalk.white(originalTransaction.status)}`);
    console.log(`  Actions: ${chalk.white(originalTransaction.actions.length.toString())}`);
    console.log('');

    // Create rollback service with progress callback
    let lastProgress = 0;
    const progressSpinner = ora('Rolling back changes...').start();
    
    const rollbackService = new RollbackService((current, total, file) => {
      const progress = Math.round((current / total) * 100);
      if (progress !== lastProgress) {
        progressSpinner.text = `Rolling back... ${progress}% (${current}/${total}) - ${file}`;
        lastProgress = progress;
      }
    });

    // Execute rollback
    const result = await rollbackService.rollback(transactionId);

    progressSpinner.succeed(`Rollback completed`);

    // Display results
    displayRollbackResults(result);

    console.log('\n' + chalk.green('✓ Rollback completed!'));
    console.log(chalk.gray(`  Rollback ID: ${result.rollbackTransactionId}\n`));

  } catch (error: any) {
    spinner.fail('Rollback failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

export async function listRollbackableCommand(): Promise<void> {
  const spinner = ora('Connecting to database...').start();

  try {
    // Connect to database
    await connectDB();
    spinner.succeed('Connected to database');

    console.log('\n' + chalk.cyan.bold('═'.repeat(60)));
    console.log(chalk.cyan.bold('  DESKPILOT - Rollbackable Transactions'));
    console.log(chalk.cyan.bold('═'.repeat(60)));
    console.log('');

    const rollbackService = new RollbackService();
    const transactions = await rollbackService.getRollbackableTransactions();

    if (transactions.length === 0) {
      console.log(chalk.yellow('  No transactions available for rollback.\n'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('Transaction ID'),
        chalk.cyan('Type'),
        chalk.cyan('Date'),
        chalk.cyan('Actions'),
        chalk.cyan('Status'),
      ],
      colWidths: [40, 12, 22, 10, 15],
    });

    for (const t of transactions) {
      table.push([
        t.transactionId,
        t.type,
        t.createdAt.toLocaleString(),
        t.actions.length.toString(),
        t.status,
      ]);
    }

    console.log(table.toString());
    console.log('\n' + chalk.cyan('💡 To rollback, run: ') + chalk.white('deskpilot rollback <transactionId>\n'));

  } catch (error: any) {
    spinner.fail('Failed to list transactions');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

function displayRollbackResults(result: RollbackResult): void {
  // Summary
  console.log('\n' + chalk.yellow('▸ Rollback Summary'));
  console.log(chalk.gray('─'.repeat(40)));

  const summaryTable = new Table({
    chars: { 'mid': '', 'left-mid': '', 'mid-mid': '', 'right-mid': '' },
    style: { head: ['cyan'] },
  });

  summaryTable.push(
    [chalk.white('Original Type'), chalk.white(result.originalType)],
    [chalk.white('Total Actions'), chalk.white(result.summary.totalActions.toString())],
    [chalk.white('Restored'), chalk.green(result.summary.restoredCount.toString())],
    [chalk.white('Failed'), result.summary.failedCount > 0 ? chalk.red(result.summary.failedCount.toString()) : chalk.gray('0')],
    [chalk.white('Skipped'), result.summary.skippedCount > 0 ? chalk.yellow(result.summary.skippedCount.toString()) : chalk.gray('0')],
  );

  console.log(summaryTable.toString());

  // Details (if there were failures or skips)
  const nonRestoredDetails = result.details.filter(d => d.status !== 'restored');
  if (nonRestoredDetails.length > 0) {
    console.log('\n' + chalk.yellow('▸ Non-Restored Items'));
    console.log(chalk.gray('─'.repeat(40)));

    for (const detail of nonRestoredDetails.slice(0, 10)) {
      const fileName = path.basename(detail.to);
      const statusIcon = detail.status === 'failed' ? chalk.red('✗') : chalk.yellow('⊘');
      const statusText = detail.status === 'failed' ? chalk.red('FAILED') : chalk.yellow('SKIPPED');
      console.log(`  ${statusIcon} ${fileName} - ${statusText}`);
      if (detail.error) {
        console.log(chalk.gray(`      Reason: ${detail.error}`));
      }
    }

    if (nonRestoredDetails.length > 10) {
      console.log(chalk.gray(`  ... and ${nonRestoredDetails.length - 10} more`));
    }
  }
}

export default rollbackCommand;
