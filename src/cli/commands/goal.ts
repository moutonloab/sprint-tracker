import { Command } from 'commander';
import { SprintService, GoalService, CriterionService } from '../../services';
import { initDatabase } from '../../db/database';
import {
  formatGoal,
  formatGoalList,
  formatSuccess,
  formatError,
} from '../formatter';

export function createGoalCommands(): Command {
  const goal = new Command('goal')
    .description('Manage goals');

  goal
    .command('create')
    .description('Create a new goal')
    .requiredOption('-s, --sprint <identifier>', 'Sprint number or ID')
    .requiredOption('-t, --title <title>', 'Goal title (max 200 chars)')
    .requiredOption('-d, --description <text>', 'Goal description')
    .requiredOption('-o, --owner <name>', 'Goal owner (max 50 chars)')
    .requiredOption('-h, --hours <hours>', 'Estimated hours')
    .option('-c, --criteria <criteria...>', 'Success criteria (can specify multiple)')
    .action((options: {
      sprint: string;
      title: string;
      description: string;
      owner: string;
      hours: string;
      criteria?: string[];
    }) => {
      try {
        initDatabase();
        const sprintService = new SprintService();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        let sprint;
        const num = parseInt(options.sprint, 10);
        if (!isNaN(num)) {
          sprint = sprintService.getByVolgnummer(num);
        } else {
          sprint = sprintService.getById(options.sprint);
        }

        if (sprint === null) {
          console.error(formatError(`Sprint not found: ${options.sprint}`));
          process.exit(1);
        }

        const goal = goalService.create({
          sprint_id: sprint.id,
          titel: options.title,
          beschrijving: options.description,
          eigenaar: options.owner,
          geschatte_uren: parseFloat(options.hours),
        });

        let criteria;
        if (options.criteria !== undefined && options.criteria.length > 0) {
          criteria = criterionService.createMany(goal.id, options.criteria);
        }

        console.log(formatSuccess(`Goal created in Sprint #${sprint.volgnummer}`));
        console.log(formatGoal(goal, criteria));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('list')
    .description('List goals')
    .option('-s, --sprint <identifier>', 'Filter by sprint number or ID')
    .option('-o, --owner <name>', 'Filter by owner')
    .action((options: { sprint?: string; owner?: string }) => {
      try {
        initDatabase();
        const sprintService = new SprintService();
        const goalService = new GoalService();

        let goals;

        if (options.sprint !== undefined) {
          let sprint;
          const num = parseInt(options.sprint, 10);
          if (!isNaN(num)) {
            sprint = sprintService.getByVolgnummer(num);
          } else {
            sprint = sprintService.getById(options.sprint);
          }

          if (sprint === null) {
            console.error(formatError(`Sprint not found: ${options.sprint}`));
            process.exit(1);
          }

          goals = goalService.getBySprintId(sprint.id);
          console.log(`Goals for Sprint #${sprint.volgnummer}:`);
        } else if (options.owner !== undefined) {
          goals = goalService.getByOwner(options.owner);
          console.log(`Goals for owner: ${options.owner}`);
        } else {
          goals = goalService.getAll();
        }

        console.log(formatGoalList(goals));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('show <id>')
    .description('Show goal details')
    .action((id: string) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const goal = goalService.getById(id);
        if (goal === null) {
          console.error(formatError(`Goal not found: ${id}`));
          process.exit(1);
        }

        const criteria = criterionService.getByGoalId(goal.id);
        console.log(formatGoal(goal, criteria));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('update <id>')
    .description('Update a goal')
    .option('-t, --title <title>', 'New title')
    .option('-d, --description <text>', 'New description')
    .option('-o, --owner <name>', 'New owner')
    .option('-h, --hours <hours>', 'New estimated hours')
    .action((id: string, options: {
      title?: string;
      description?: string;
      owner?: string;
      hours?: string;
    }) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const existing = goalService.getById(id);
        if (existing === null) {
          console.error(formatError(`Goal not found: ${id}`));
          process.exit(1);
        }

        const updates: {
          titel?: string;
          beschrijving?: string;
          eigenaar?: string;
          geschatte_uren?: number;
        } = {};

        if (options.title !== undefined) updates.titel = options.title;
        if (options.description !== undefined) updates.beschrijving = options.description;
        if (options.owner !== undefined) updates.eigenaar = options.owner;
        if (options.hours !== undefined) updates.geschatte_uren = parseFloat(options.hours);

        const goal = goalService.update(id, updates);
        const criteria = criterionService.getByGoalId(goal.id);

        console.log(formatSuccess('Goal updated'));
        console.log(formatGoal(goal, criteria));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('complete <id>')
    .description('Mark a goal as achieved')
    .option('-n, --notes <text>', 'Completion notes')
    .option('-l, --lessons <text>', 'Lessons learned')
    .action((id: string, options: { notes?: string; lessons?: string }) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const existing = goalService.getById(id);
        if (existing === null) {
          console.error(formatError(`Goal not found: ${id}`));
          process.exit(1);
        }

        const goal = goalService.markAchieved(id, true, options.notes, options.lessons);
        const criteria = criterionService.getByGoalId(goal.id);

        console.log(formatSuccess('Goal marked as achieved'));
        console.log(formatGoal(goal, criteria));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('incomplete <id>')
    .description('Mark a goal as not achieved')
    .option('-n, --notes <text>', 'Reason/notes')
    .option('-l, --lessons <text>', 'Lessons learned')
    .action((id: string, options: { notes?: string; lessons?: string }) => {
      try {
        initDatabase();
        const goalService = new GoalService();
        const criterionService = new CriterionService();

        const existing = goalService.getById(id);
        if (existing === null) {
          console.error(formatError(`Goal not found: ${id}`));
          process.exit(1);
        }

        const goal = goalService.markAchieved(id, false, options.notes, options.lessons);
        const criteria = criterionService.getByGoalId(goal.id);

        console.log(formatSuccess('Goal marked as not achieved'));
        console.log(formatGoal(goal, criteria));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('log-hours <id> <hours>')
    .description('Log actual hours spent on a goal')
    .action((id: string, hours: string) => {
      try {
        initDatabase();
        const goalService = new GoalService();

        const existing = goalService.getById(id);
        if (existing === null) {
          console.error(formatError(`Goal not found: ${id}`));
          process.exit(1);
        }

        const parsedHours = parseFloat(hours);
        const goal = goalService.logHours(id, parsedHours);

        console.log(formatSuccess(`Logged ${parsedHours}h for goal "${goal.titel}"`));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  goal
    .command('delete <id>')
    .description('Delete a goal')
    .option('-f, --force', 'Skip confirmation')
    .action((id: string, options: { force?: boolean }) => {
      try {
        initDatabase();
        const goalService = new GoalService();

        const goal = goalService.getById(id);
        if (goal === null) {
          console.error(formatError(`Goal not found: ${id}`));
          process.exit(1);
        }

        if (options.force !== true) {
          console.log(`This will delete goal "${goal.titel}" and all its criteria.`);
          console.log('Use --force to confirm deletion.');
          process.exit(1);
        }

        const deleted = goalService.delete(id);
        if (deleted) {
          console.log(formatSuccess(`Goal "${goal.titel}" deleted`));
        } else {
          console.error(formatError('Failed to delete goal'));
          process.exit(1);
        }
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return goal;
}
