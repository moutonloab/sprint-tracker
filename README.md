# Sprint Tracker

Lightweight sprint tracking tool for 2-week cycles. Track goals, success criteria, and retrospectives with a scalable data model.

## Features

- **Sprint Management**: Create and track 2-week sprints with auto-suggested dates
- **Goal Tracking**: Define goals with estimated hours, owners, and success criteria
- **Success Criteria**: Checklist items that define when a goal is achieved
- **Retrospectives**: Record lessons learned and notes when completing goals
- **Data Migration**: Import/export via JSON for system interoperability
- **Accessible Design**: Screen-reader friendly CLI output

## Installation

```bash
npm install
npm run build
```

## Usage

### Sprint Commands

```bash
# Create a sprint (auto-generates number and dates)
sprint-tracker sprint create

# Create a sprint with specific values
sprint-tracker sprint create -n 1 -s 2026-01-13 -e 2026-01-26

# List all sprints
sprint-tracker sprint list

# Show sprint details
sprint-tracker sprint show 1

# Show current sprint (based on today's date)
sprint-tracker sprint current

# Show sprint statistics
sprint-tracker sprint stats 1

# Update a sprint
sprint-tracker sprint update 1 -e 2026-01-27

# Delete a sprint
sprint-tracker sprint delete 1 --force
```

### Goal Commands

```bash
# Create a goal
sprint-tracker goal create -s 1 \
  -t "Implement feature X" \
  -d "Build and test the new feature" \
  -o "Developer" \
  -h 8 \
  -c "Unit tests pass" \
  -c "Integration tests pass"

# List goals for a sprint
sprint-tracker goal list -s 1

# List goals by owner
sprint-tracker goal list -o "Developer"

# Show goal details
sprint-tracker goal show <goal-id>

# Update a goal
sprint-tracker goal update <goal-id> -h 12

# Mark goal as achieved
sprint-tracker goal complete <goal-id> \
  -n "Completed with minor issues" \
  -l "Learned to write tests first"

# Mark goal as not achieved
sprint-tracker goal incomplete <goal-id> \
  -n "Ran out of time" \
  -l "Need better estimation"

# Log actual hours
sprint-tracker goal log-hours <goal-id> 10.5

# Delete a goal
sprint-tracker goal delete <goal-id> --force
```

### Criterion Commands

```bash
# Add a criterion
sprint-tracker criterion add <goal-id> -d "New criterion"

# List criteria for a goal
sprint-tracker criterion list <goal-id>

# Toggle completion status
sprint-tracker criterion toggle <criterion-id>

# Mark as complete/incomplete
sprint-tracker criterion complete <criterion-id>
sprint-tracker criterion uncomplete <criterion-id>

# Show progress
sprint-tracker criterion progress <goal-id>

# Delete a criterion
sprint-tracker criterion delete <criterion-id> --force
```

### Data Commands

```bash
# Export all data to file
sprint-tracker data export -o backup.json

# Export specific sprint
sprint-tracker data export -s 1 -o sprint-1.json

# Export to stdout
sprint-tracker data export-json -p

# Import from file
sprint-tracker data import backup.json

# Import with overwrite
sprint-tracker data import backup.json --overwrite

# Show database info
sprint-tracker data info
```

## Data Model

Based on the Sprint Tracking Data Model v1.0:

### Entities

**Sprint**
- `id`: UUID
- `volgnummer`: Sprint number (1, 2, 3...)
- `startdatum`: Start date (YYYY-MM-DD)
- `einddatum`: End date (YYYY-MM-DD)

**Goal**
- `id`: UUID
- `sprint_id`: Reference to Sprint
- `titel`: Title (max 200 chars)
- `beschrijving`: Description (max 2000 chars)
- `eigenaar`: Owner (max 50 chars)
- `geschatte_uren`: Estimated hours (0.25h precision)
- `werkelijke_uren`: Actual hours (nullable)
- `behaald`: Achieved (null/true/false)
- `toelichting`: Notes (max 2000 chars)
- `geleerde_lessen`: Lessons learned (max 2000 chars)
- `aangemaakt_op`: Created timestamp (ISO 8601)
- `gewijzigd_op`: Modified timestamp (ISO 8601)

**Success Criterion**
- `id`: UUID
- `goal_id`: Reference to Goal
- `beschrijving`: Description (max 500 chars)
- `voltooid`: Completed (true/false)

## Configuration

Set the data directory via environment variable:

```bash
export SPRINT_TRACKER_DATA_DIR=/path/to/data
```

Default location: `./data/sprint-tracker.db`

## Development

```bash
# Run tests
npm test

# Build
npm run build

# Lint
npm run lint
```

## License

MIT
