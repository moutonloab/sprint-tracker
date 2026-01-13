import { Command } from 'commander';
import { GoalService, CriterionService } from '../../services';
import { initDatabase } from '../../db/database';
import {
  formatCriteriaList,
  formatCriterion,
  formatSuccess,
  formatError,
} from '../formatter';

export function createCriterionCommands(): Command {
  const criterion = new Command('criterion')
    .alias('criteria')
    .description('Manage success criteria');

  criterion
    .command('add <goal-id>')
    .description('Add a success criterion to a goal')
    .requiredOption('-d, --description <text>', 'Criterion description (max 500 chars)')
    .action((goalId: string, options: { description: string }) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const goal = goalService.getById(goalId);
        if (goal === null) {
          console.error(formatError(`Goal not found: ${goalId}`));
          process.exit(1);
        }

        const criterion = criterionService.create({
          goal_id: goalId,
          beschrijving: options.description,
        });

        console.log(formatSuccess(`Criterion added to goal "${goal.titel}"`));
        console.log(formatCriterion(criterion));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('list <goal-id>')
    .description('List all criteria for a goal')
    .action((goalId: string) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const goal = goalService.getById(goalId);
        if (goal === null) {
          console.error(formatError(`Goal not found: ${goalId}`));
          process.exit(1);
        }

        console.log(`Criteria for: "${goal.titel}"`);
        const criteria = criterionService.getByGoalId(goalId);
        console.log(formatCriteriaList(criteria));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('toggle <id>')
    .description('Toggle criterion completion status')
    .action((id: string) => {
      try {
        initDatabase();
        const criterionService = new CriterionService();

        const existing = criterionService.getById(id);
        if (existing === null) {
          console.error(formatError(`Criterion not found: ${id}`));
          process.exit(1);
        }

        const criterion = criterionService.toggle(id);
        const status = criterion.voltooid ? 'complete' : 'incomplete';
        console.log(formatSuccess(`Criterion marked as ${status}`));
        console.log(formatCriterion(criterion));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('complete <id>')
    .description('Mark criterion as complete')
    .action((id: string) => {
      try {
        initDatabase();
        const criterionService = new CriterionService();

        const existing = criterionService.getById(id);
        if (existing === null) {
          console.error(formatError(`Criterion not found: ${id}`));
          process.exit(1);
        }

        const criterion = criterionService.complete(id);
        console.log(formatSuccess('Criterion marked as complete'));
        console.log(formatCriterion(criterion));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('uncomplete <id>')
    .description('Mark criterion as incomplete')
    .action((id: string) => {
      try {
        initDatabase();
        const criterionService = new CriterionService();

        const existing = criterionService.getById(id);
        if (existing === null) {
          console.error(formatError(`Criterion not found: ${id}`));
          process.exit(1);
        }

        const criterion = criterionService.uncomplete(id);
        console.log(formatSuccess('Criterion marked as incomplete'));
        console.log(formatCriterion(criterion));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('update <id>')
    .description('Update criterion description')
    .requiredOption('-d, --description <text>', 'New description')
    .action((id: string, options: { description: string }) => {
      try {
        initDatabase();
        const criterionService = new CriterionService();

        const existing = criterionService.getById(id);
        if (existing === null) {
          console.error(formatError(`Criterion not found: ${id}`));
          process.exit(1);
        }

        const criterion = criterionService.update(id, { beschrijving: options.description });
        console.log(formatSuccess('Criterion updated'));
        console.log(formatCriterion(criterion));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('delete <id>')
    .description('Delete a criterion')
    .option('-f, --force', 'Skip confirmation')
    .action((id: string, options: { force?: boolean }) => {
      try {
        initDatabase();
        const criterionService = new CriterionService();

        const criterion = criterionService.getById(id);
        if (criterion === null) {
          console.error(formatError(`Criterion not found: ${id}`));
          process.exit(1);
        }

        if (options.force !== true) {
          console.log(`This will delete criterion: "${criterion.beschrijving}"`);
          console.log('Use --force to confirm deletion.');
          process.exit(1);
        }

        const deleted = criterionService.delete(id);
        if (deleted) {
          console.log(formatSuccess('Criterion deleted'));
        } else {
          console.error(formatError('Failed to delete criterion'));
          process.exit(1);
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  criterion
    .command('progress <goal-id>')
    .description('Show progress for a goal')
    .action((goalId: string) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const goal = goalService.getById(goalId);
        if (goal === null) {
          console.error(formatError(`Goal not found: ${goalId}`));
          process.exit(1);
        }

        const progress = criterionService.getProgress(goalId);
        console.log(`Progress for: "${goal.titel}"`);
        console.log(`Completed: ${progress.completed}/${progress.total} (${progress.percentage}%)`);

        const progressBar = createProgressBar(progress.percentage);
        console.log(progressBar);
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return criterion;
}

function createProgressBar(percentage: number, width = 30): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}
