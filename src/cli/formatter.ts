import {
  Sprint,
  Goal,
  SuccessCriterion,
  SprintWithGoals,
  GoalWithCriteria,
} from '../types';

/**
 * Accessible CLI formatter
 * Produces clear, screen-reader friendly output
 */

const BORDER_CHAR = '─';
const CORNER_TL = '┌';
const CORNER_TR = '┐';
const CORNER_BL = '└';
const CORNER_BR = '┘';
const VERTICAL = '│';

function line(char: string, length: number): string {
  return char.repeat(length);
}

function box(title: string, content: string[], width = 60): string {
  const lines: string[] = [];
  const innerWidth = width - 4;

  lines.push(`${CORNER_TL}${line(BORDER_CHAR, width - 2)}${CORNER_TR}`);
  lines.push(`${VERTICAL} ${title.padEnd(innerWidth)} ${VERTICAL}`);
  lines.push(`${VERTICAL}${line(BORDER_CHAR, width - 2)}${VERTICAL}`);

  for (const line of content) {
    const wrapped = wrapText(line, innerWidth);
    for (const wline of wrapped) {
      lines.push(`${VERTICAL} ${wline.padEnd(innerWidth)} ${VERTICAL}`);
    }
  }

  lines.push(`${CORNER_BL}${line(BORDER_CHAR, width - 2)}${CORNER_BR}`);

  return lines.join('\n');
}

function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) {
    return [text];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine.length > 0) {
        lines.push(currentLine);
      }
      currentLine = word.length > maxWidth ? word.substring(0, maxWidth) : word;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Format a sprint for display
 */
export function formatSprint(sprint: Sprint): string {
  return box(`Sprint #${sprint.volgnummer}`, [
    `ID: ${sprint.id}`,
    `Period: ${sprint.startdatum} to ${sprint.einddatum}`,
  ]);
}

/**
 * Format sprint list
 */
export function formatSprintList(sprints: Sprint[]): string {
  if (sprints.length === 0) {
    return 'No sprints found.';
  }

  const lines: string[] = [
    'SPRINTS',
    line(BORDER_CHAR, 70),
    'No.  Start Date   End Date     ID',
    line(BORDER_CHAR, 70),
  ];

  for (const sprint of sprints) {
    lines.push(
      `${String(sprint.volgnummer).padStart(3)}  ${sprint.startdatum}  ${sprint.einddatum}   ${sprint.id.substring(0, 8)}...`
    );
  }

  lines.push(line(BORDER_CHAR, 70));
  lines.push(`Total: ${sprints.length} sprint(s)`);

  return lines.join('\n');
}

/**
 * Format a goal for display
 */
export function formatGoal(goal: Goal, criteria?: SuccessCriterion[]): string {
  const statusIcon = goal.behaald === null ? '○' : goal.behaald ? '●' : '○';
  const status = goal.behaald === null ? 'In Progress' : goal.behaald ? 'Achieved' : 'Not Achieved';

  const content = [
    `Status: ${statusIcon} ${status}`,
    `Owner: ${goal.eigenaar}`,
    '',
    'Description:',
    goal.beschrijving,
    '',
    `Estimated: ${goal.geschatte_uren}h`,
    `Actual: ${goal.werkelijke_uren !== null ? `${goal.werkelijke_uren}h` : 'Not logged'}`,
  ];

  if (goal.toelichting !== null) {
    content.push('', 'Notes:', goal.toelichting);
  }

  if (goal.geleerde_lessen !== null) {
    content.push('', 'Lessons Learned:', goal.geleerde_lessen);
  }

  if (criteria !== undefined && criteria.length > 0) {
    content.push('', 'Success Criteria:');
    for (const c of criteria) {
      const checkIcon = c.voltooid ? '[x]' : '[ ]';
      content.push(`  ${checkIcon} ${c.beschrijving}`);
    }
  }

  return box(goal.titel, content, 70);
}

/**
 * Format goal list
 */
export function formatGoalList(goals: Goal[]): string {
  if (goals.length === 0) {
    return 'No goals found.';
  }

  const lines: string[] = [
    'GOALS',
    line(BORDER_CHAR, 80),
    'Status  Hours   Owner           Title',
    line(BORDER_CHAR, 80),
  ];

  for (const goal of goals) {
    const statusIcon = goal.behaald === null ? '○' : goal.behaald ? '●' : '○';
    const hours = `${goal.geschatte_uren}h`.padEnd(6);
    const owner = goal.eigenaar.substring(0, 14).padEnd(14);
    const title = goal.titel.substring(0, 40);

    lines.push(`  ${statusIcon}     ${hours}  ${owner}  ${title}`);
  }

  lines.push(line(BORDER_CHAR, 80));
  lines.push(`Total: ${goals.length} goal(s)`);

  return lines.join('\n');
}

/**
 * Format a success criterion
 */
export function formatCriterion(criterion: SuccessCriterion): string {
  const checkIcon = criterion.voltooid ? '[x]' : '[ ]';
  return `${checkIcon} ${criterion.beschrijving}`;
}

/**
 * Format criterion list
 */
export function formatCriteriaList(criteria: SuccessCriterion[]): string {
  if (criteria.length === 0) {
    return 'No success criteria defined.';
  }

  const completed = criteria.filter(c => c.voltooid).length;
  const total = criteria.length;
  const percentage = Math.round((completed / total) * 100);

  const lines: string[] = [
    `SUCCESS CRITERIA (${completed}/${total} complete - ${percentage}%)`,
    line(BORDER_CHAR, 60),
  ];

  for (const c of criteria) {
    lines.push(formatCriterion(c));
  }

  return lines.join('\n');
}

/**
 * Format sprint with goals (detailed view)
 */
export function formatSprintDetail(sprint: SprintWithGoals): string {
  const lines: string[] = [];

  lines.push(`SPRINT #${sprint.volgnummer}`);
  lines.push(line('═', 70));
  lines.push(`Period: ${sprint.startdatum} to ${sprint.einddatum}`);
  lines.push(`ID: ${sprint.id}`);
  lines.push('');

  if (sprint.goals.length === 0) {
    lines.push('No goals defined for this sprint.');
  } else {
    const totalEstimated = sprint.goals.reduce((sum, g) => sum + g.geschatte_uren, 0);
    const totalActual = sprint.goals.reduce((sum, g) => sum + (g.werkelijke_uren ?? 0), 0);
    const achieved = sprint.goals.filter(g => g.behaald === true).length;

    lines.push(`Goals: ${sprint.goals.length} | Achieved: ${achieved} | Hours: ${totalActual}/${totalEstimated}h`);
    lines.push(line(BORDER_CHAR, 70));

    for (const goal of sprint.goals) {
      lines.push('');
      lines.push(formatGoal(goal, goal.success_criteria));
    }
  }

  return lines.join('\n');
}

/**
 * Format statistics
 */
export function formatStats(stats: {
  totalGoals: number;
  completedGoals: number;
  estimatedHours: number;
  actualHours: number;
}): string {
  const completionRate = stats.totalGoals > 0
    ? Math.round((stats.completedGoals / stats.totalGoals) * 100)
    : 0;

  const hoursDiff = stats.actualHours - stats.estimatedHours;
  const hoursDiffStr = hoursDiff >= 0 ? `+${hoursDiff}` : String(hoursDiff);

  return [
    'STATISTICS',
    line(BORDER_CHAR, 40),
    `Goals: ${stats.completedGoals}/${stats.totalGoals} (${completionRate}%)`,
    `Hours: ${stats.actualHours}/${stats.estimatedHours}h (${hoursDiffStr}h)`,
    line(BORDER_CHAR, 40),
  ].join('\n');
}

/**
 * Format a success message
 */
export function formatSuccess(message: string): string {
  return `OK: ${message}`;
}

/**
 * Format an error message
 */
export function formatError(message: string): string {
  return `ERROR: ${message}`;
}

/**
 * Format a warning message
 */
export function formatWarning(message: string): string {
  return `WARNING: ${message}`;
}

/**
 * Format import/export results
 */
export function formatImportResult(result: {
  sprints: number;
  goals: number;
  criteria: number;
  skipped: number;
  errors: string[];
}): string {
  const lines: string[] = [
    'IMPORT RESULT',
    line(BORDER_CHAR, 40),
    `Sprints: ${result.sprints}`,
    `Goals: ${result.goals}`,
    `Criteria: ${result.criteria}`,
    `Skipped: ${result.skipped}`,
  ];

  if (result.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Format table data (accessible format)
 */
export function formatTable(headers: string[], rows: string[][], columnWidths?: number[]): string {
  const widths = columnWidths ?? headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] ?? '').length))
  );

  const headerLine = headers.map((h, i) => h.padEnd(widths[i] ?? h.length)).join('  ');
  const separator = widths.map(w => line(BORDER_CHAR, w)).join('  ');

  const lines = [headerLine, separator];

  for (const row of rows) {
    const rowLine = row.map((cell, i) => (cell ?? '').padEnd(widths[i] ?? cell.length)).join('  ');
    lines.push(rowLine);
  }

  return lines.join('\n');
}
