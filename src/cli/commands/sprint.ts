import { Command } from 'commander';
import { SprintService, GoalService, ExportService } from '../../services';
import { initDatabase } from '../../db/database';
import {
  formatSprint,
  formatSprintList,
  formatSprintDetail,
  formatStats,
  formatSuccess,
  formatError,
} from '../formatter';

export function createSprintCommands(): Command {
  const sprint = new Command('sprint')
    .description('Manage sprints');

  sprint
    .command('create')
    .description('Create a new sprint')
    .option('-n, --number <number>', 'Sprint number (auto-increment if not provided)')
    .option('-s, --start <date>', 'Start date (YYYY-MM-DD)')
    .option('-e, --end <date>', 'End date (YYYY-MM-DD)')
    .action((options: { number?: string; start?: string; end?: string }) => {
      try {
        initDatabase();
        const service = new SprintService();

        const volgnummer = options.number !== undefined
          ? parseInt(options.number, 10)
          : service.getNextVolgnummer();

        let startdatum: string;
        let einddatum: string;

        if (options.start !== undefined && options.end !== undefined) {
          startdatum = options.start;
          einddatum = options.end;
        } else {
          const suggested = service.getSuggestedNextDates();
          startdatum = options.start ?? suggested.startdatum;
          einddatum = options.end ?? suggested.einddatum;
        }

        const sprint = service.create({ volgnummer, startdatum, einddatum });
        console.log(formatSuccess(`Sprint #${sprint.volgnummer} created`));
        console.log(formatSprint(sprint));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  sprint
    .command('list')
    .description('List all sprints')
    .action(() => {
      try {
        initDatabase();
        const service = new SprintService();
        const sprints = service.getAll();
        console.log(formatSprintList(sprints));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  sprint
    .command('show <identifier>')
    .description('Show sprint details (by number or ID)')
    .action((identifier: string) => {
      try {
        initDatabase();
        const sprintService = new SprintService();
        const exportService = new ExportService();

        let sprint;
        const num = parseInt(identifier, 10);
        if (!isNaN(num)) {
          sprint = sprintService.getByVolgnummer(num);
        } else {
          sprint = sprintService.getById(identifier);
        }

        if (sprint === null) {
          console.error(formatError(`Sprint not found: ${identifier}`));
          process.exit(1);
        }

        const detailed = exportService.exportSprint(sprint.id);
        if (detailed !== null) {
          console.log(formatSprintDetail(detailed));
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  sprint
    .command('current')
    .description('Show the current sprint')
    .action(() => {
      try {
        initDatabase();
        const sprintService = new SprintService();
        const exportService = new ExportService();

        const sprint = sprintService.getCurrent();
        if (sprint === null) {
          console.log('No active sprint found for today.');
          const latest = sprintService.getLatest();
          if (latest !== null) {
            console.log(`\nLatest sprint: #${latest.volgnummer} (${latest.startdatum} to ${latest.einddatum})`);
          }
          return;
        }

        const detailed = exportService.exportSprint(sprint.id);
        if (detailed !== null) {
          console.log(formatSprintDetail(detailed));
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  sprint
    .command('stats <identifier>')
    .description('Show sprint statistics')
    .action((identifier: string) => {
      try {
        initDatabase();
        const sprintService = new SprintService();
        const goalService = new GoalService();

        let sprint;
        const num = parseInt(identifier, 10);
        if (!isNaN(num)) {
          sprint = sprintService.getByVolgnummer(num);
        } else {
          sprint = sprintService.getById(identifier);
        }

        if (sprint === null) {
          console.error(formatError(`Sprint not found: ${identifier}`));
          process.exit(1);
        }

        console.log(`Sprint #${sprint.volgnummer}`);
        const stats = goalService.getSprintStats(sprint.id);
        console.log(formatStats(stats));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  sprint
    .command('update <identifier>')
    .description('Update a sprint')
    .option('-n, --number <number>', 'New sprint number')
    .option('-s, --start <date>', 'New start date (YYYY-MM-DD)')
    .option('-e, --end <date>', 'New end date (YYYY-MM-DD)')
    .action((identifier: string, options: { number?: string; start?: string; end?: string }) => {
      try {
        initDatabase();
        const service = new SprintService();

        let sprint;
        const num = parseInt(identifier, 10);
        if (!isNaN(num)) {
          sprint = service.getByVolgnummer(num);
        } else {
          sprint = service.getById(identifier);
        }

        if (sprint === null) {
          console.error(formatError(`Sprint not found: ${identifier}`));
          process.exit(1);
        }

        const updates: { volgnummer?: number; startdatum?: string; einddatum?: string } = {};
        if (options.number !== undefined) updates.volgnummer = parseInt(options.number, 10);
        if (options.start !== undefined) updates.startdatum = options.start;
        if (options.end !== undefined) updates.einddatum = options.end;

        const updated = service.update(sprint.id, updates);
        console.log(formatSuccess(`Sprint #${updated.volgnummer} updated`));
        console.log(formatSprint(updated));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  sprint
    .command('delete <identifier>')
    .description('Delete a sprint (and all its goals)')
    .option('-f, --force', 'Skip confirmation')
    .action((identifier: string, options: { force?: boolean }) => {
      try {
        initDatabase();
        const service = new SprintService();

        let sprint;
        const num = parseInt(identifier, 10);
        if (!isNaN(num)) {
          sprint = service.getByVolgnummer(num);
        } else {
          sprint = service.getById(identifier);
        }

        if (sprint === null) {
          console.error(formatError(`Sprint not found: ${identifier}`));
          process.exit(1);
        }

        if (options.force !== true) {
          console.log(`This will delete Sprint #${sprint.volgnummer} and all its goals.`);
          console.log('Use --force to confirm deletion.');
          process.exit(1);
        }

        const deleted = service.delete(sprint.id);
        if (deleted) {
          console.log(formatSuccess(`Sprint #${sprint.volgnummer} deleted`));
        } else {
          console.error(formatError('Failed to delete sprint'));
          process.exit(1);
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return sprint;
}
