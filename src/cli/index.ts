import { Command } from 'commander';
import {
  createSprintCommands,
  createGoalCommands,
  createCriterionCommands,
  createDataCommands,
} from './commands';
import { closeDatabase } from '../db/database';

const VERSION = '1.0.0';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('sprint-tracker')
    .description('Lightweight sprint tracking tool for 2-week cycles')
    .version(VERSION, '-v, --version', 'Output the version number');

  program.addCommand(createSprintCommands());
  program.addCommand(createGoalCommands());
  program.addCommand(createCriterionCommands());
  program.addCommand(createDataCommands());

  program.hook('postAction', () => {
    closeDatabase();
  });

  return program;
}

export function run(): void {
  const program = createCLI();

  try {
    program.parse(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
