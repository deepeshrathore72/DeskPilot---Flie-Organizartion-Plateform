import chalk from 'chalk';
import ora from 'ora';
import { connectDB, disconnectDB } from '../../src/config';
import { ReporterService } from '../../src/services';

export async function reportCommand(): Promise<void> {
  const spinner = ora('Connecting to database...').start();

  try {
    // Connect to database
    await connectDB();
    spinner.succeed('Connected to database');

    const reportSpinner = ora('Generating report...').start();

    const reporter = new ReporterService();
    const report = await reporter.generateReport();

    reportSpinner.succeed('Report generated');

    // Display formatted report
    const formattedReport = reporter.formatReportForCLI(report);
    console.log(formattedReport);

  } catch (error: any) {
    spinner.fail('Report generation failed');
    console.error(chalk.red(`\nError: ${error.message}`));
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

export default reportCommand;
