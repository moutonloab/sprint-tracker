import { Command } from 'commander';
import { SprintService, ExportService } from '../../services';
import { initDatabase, getDefaultDbPath } from '../../db/database';
import {
  formatSuccess,
  formatError,
  formatImportResult,
} from '../formatter';

export function createDataCommands(): Command {
  const data = new Command('data')
    .description('Export and import data');

  data
    .command('export')
    .description('Export data to JSON file')
    .option('-o, --output <file>', 'Output file path', 'sprint-data-export.json')
    .option('-s, --sprint <identifier>', 'Export specific sprint only')
    .action((options: { output: string; sprint?: string }) => {
      try {
        initDatabase();
        const exportService = new ExportService();
        const sprintService = new SprintService();

        let sprintId: string | undefined;
        if (options.sprint !== undefined) {
          const num = parseInt(options.sprint, 10);
          const sprint = !isNaN(num)
            ? sprintService.getByVolgnummer(num)
            : sprintService.getById(options.sprint);

          if (sprint === null) {
            console.error(formatError(`Sprint not found: ${options.sprint}`));
            process.exit(1);
          }
          sprintId = sprint.id;
        }

        exportService.exportToFile(options.output, sprintId);
        console.log(formatSuccess(`Data exported to ${options.output}`));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  data
    .command('import <file>')
    .description('Import data from JSON file')
    .option('--overwrite', 'Overwrite existing sprints with same ID')
    .action((file: string, options: { overwrite?: boolean }) => {
      try {
        initDatabase();
        const exportService = new ExportService();

        const result = exportService.importFromFile(file, { overwrite: options.overwrite });
        console.log(formatImportResult(result));

        if (result.errors.length > 0 && result.sprints === 0) {
          process.exit(1);
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  data
    .command('export-json')
    .description('Export data to stdout as JSON')
    .option('-s, --sprint <identifier>', 'Export specific sprint only')
    .option('-p, --pretty', 'Pretty print JSON')
    .action((options: { sprint?: string; pretty?: boolean }) => {
      try {
        initDatabase();
        const exportService = new ExportService();
        const sprintService = new SprintService();

        let data;
        if (options.sprint !== undefined) {
          const num = parseInt(options.sprint, 10);
          const sprint = !isNaN(num)
            ? sprintService.getByVolgnummer(num)
            : sprintService.getById(options.sprint);

          if (sprint === null) {
            console.error(formatError(`Sprint not found: ${options.sprint}`));
            process.exit(1);
          }
          data = {
            version: '1.0',
            exported_at: new Date().toISOString(),
            sprints: [exportService.exportSprint(sprint.id)].filter(Boolean),
          };
        } else {
          data = exportService.exportAll();
        }

        const output = options.pretty === true
          ? JSON.stringify(data, null, 2)
          : JSON.stringify(data);

        console.log(output);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  data
    .command('info')
    .description('Show database information')
    .action(() => {
      try {
        initDatabase();
        const sprintService = new SprintService();
        const dbPath = getDefaultDbPath();

        const sprints = sprintService.getAll();
        const current = sprintService.getCurrent();

        console.log('DATABASE INFO');
        console.log('─'.repeat(50));
        console.log(`Location: ${dbPath}`);
        console.log(`Total sprints: ${sprints.length}`);

        if (current !== null) {
          console.log(`Current sprint: #${current.volgnummer}`);
        } else {
          console.log('Current sprint: None active');
        }

        if (sprints.length > 0) {
          const first = sprints[0];
          const last = sprints[sprints.length - 1];
          console.log(`Sprint range: #${first?.volgnummer} to #${last?.volgnummer}`);
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return data;
}
