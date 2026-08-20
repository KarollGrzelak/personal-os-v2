# Personal OS v2 architecture

## Overview

Personal OS v2 is currently a single-page, single-file browser application. HTML, CSS, application state management, domain engines, modules, validation, migrations, and backup logic are contained in `index.html`.

The system is local-first:

```text
UI and modules
      |
shared engines
      |
Store + EventBus
      |
browser localStorage
```

There is no backend, user account, cloud database, or automatic synchronization.

## Core

### EventBus

`EventBus` provides small, explicit notifications such as `store:change`, `route:change`, and `backup:importCompleted`. Domain logic should remain in engines and modules rather than being hidden inside event handlers.

### Store

`Store` is the only normal persistence gateway. It owns JSON serialization, the in-memory cache, the `v2:` localStorage prefix, and change events.

`Store.set(key, value, opts)` supports two import-oriented options:

- `strict: true` propagates serialization or localStorage write failures;
- `silent: true` suppresses the individual `store:change` event.

Calls without options retain the original behavior. A successful write follows this order: serialize, write to localStorage, update the cache, then optionally emit an event.

`createMemoryStore()` implements the Store interface in memory without localStorage or EventBus. Backup import uses it as an isolated staging area.

### ModuleRegistry

`ModuleRegistry` registers modules and validates the shared module contract. A module exposes:

- `id` and `name`;
- `getTasks()`;
- `getStats()`;
- `render(container)`;
- optional `setTaskStatus(taskId, status)`.

### Router

`Router` switches application views and reports route changes. It does not own module business rules.

## Shared engines

- `DayEngine` calculates daily energy from the local date and check-in data.
- `HabitEngine` owns habit completion and streak rules.
- `PriorityEngine` selects tasks that fit the selected time budget.
- `DecisionEngine` combines energy, priorities, tasks, and habits for the Today view.
- `TrainingPlanEngine` derives the training plan from the validated training profile.
- `RoadmapEngine` owns IT roadmap stages, criteria, reconciliation, and unlocking rules.

Engines communicate with modules through stable contracts and shared task records. They should not depend on a module's private storage representation.

## Modules

### Training

The Training module manages a validated profile, generated plan, session state, exercise logs, completion status, and a temporary training-load calculation used by the daily energy model.

### IT learning

The IT learning module manages roadmap stage statuses, criterion progress, and LessonGuide content. LessonGuide is attached content, never a task. Imported or edited guide data uses domain validation and escaped rendering. Resource URLs are revalidated at render time and accept only HTTP or HTTPS.

### School

The School module manages school items, the lesson schedule, workload, and school-year/vacation behavior. School items participate in the shared task contract used by the Today view.

## Store namespaces

The current known namespaces are:

```text
meta:schemaVersion
dayRecords
habitDefs
habitLogs
ui:timeBudget

training:profile
training:sessions
training:exerciseLogs

it:stageStatuses
it:criteriaDone
it:lessonGuides
it:lessonGuidesRecoveredContainer

school:mode
school:items
school:schedule

sandbox:tasks
```

Every new domain should receive its own prefix. Generic storage keys such as `data`, `state`, or `items` are intentionally avoided.

## Data versioning

The current schema is `DATA_VERSION = 5`.

Existing migrations are additive:

1. schema 1 to 2: task `done` boolean becomes a status enum;
2. schema 2 to 3: IT criteria progress becomes `{ status, completedDate }`;
3. schema 3 to 4: school items receive `activeDuringVacation`;
4. schema 4 to 5: LessonGuide receives its formal validated model and recovery rules.

`runMigrations(store)` accepts either the real Store or a MemoryStore. The target schema version is written only after a migration step succeeds.

## Backup architecture

### Envelope

Backups use this outer structure:

```text
backupFormat: "personal-os-v2-backup"
backupVersion: 1
appDataVersion: integer
exportedAt: ISO timestamp
data: known namespace values
```

Export reads only `KNOWN_NAMESPACES`. It never enumerates unrelated localStorage entries.

### Import pipeline

```text
JSON file
   |
parse, size/depth checks, dangerous-key scan, envelope validation
   |
MemoryStore staging + migrations + per-namespace validation
   |
user confirms Replace
   |
in-memory rollback snapshot
   |
strict, silent commit to the real Store
   | success                         | failure
one backup:importCompleted event     restore every namespace
```

Import is Replace-only. Merge is not implemented.

The application rejects backups from a newer app data version. A version 5 backup must include every required namespace. Its `it:stageStatuses` value must contain exactly the current roadmap stage IDs with valid statuses. Only older backups may receive an initial stage map during staging.

If commit fails, rollback continues across all namespaces even if one restoration also fails. The result distinguishes a successful rollback from a failed or partial rollback so the UI cannot report false recovery.

## Security boundaries

- Backup size is checked before FileReader and again from UTF-8 text.
- Maximum object nesting depth is limited.
- `__proto__`, `constructor`, and `prototype` keys are rejected recursively.
- Every imported namespace has a domain validator.
- Current-version roadmap state must be complete and internally consistent.
- User-controlled values are escaped before HTML interpolation.
- Resource URLs are restricted to HTTP and HTTPS.
- Private user data and backup files are excluded from the public repository.

## Test infrastructure

The repeatable test suite uses the built-in `node:test` runner and JSDOM. It always reads the real production `index.html`; production logic is not copied into test modules.

### Loader and in-memory adapter

`tests/helpers/load-app.mjs` verifies that the document contains one classic inline script, reads that script from `index.html`, and adds a small explicit test adapter to an in-memory copy of the document. The adapter exposes only symbols required by the current tests. It is never written back to `index.html`, so the production file remains byte-for-byte uninstrumented on disk.

Every test or logical group receives a fresh JSDOM window and closes it after use. The loader provides deterministic isolation for:

- local time in the `Europe/Warsaw` timezone and fixed timestamps;
- pseudorandom values;
- localStorage and controlled write failures;
- dialogs, Blob URLs, download links, and FileReader success or failure;
- window errors, unhandled promise rejections, JSDOM errors, and console errors;
- synthetic data with no external resource loading or network access.

### Test layers

The suite is divided into explicit regression layers:

1. startup, script structure, Core, Store, EventBus, and MemoryStore;
2. schema migrations and recovery behavior;
3. module contracts, decisions, Day/Habits, Training, Learning/LessonGuide, and School;
4. backup export, parsing, preview, staging, Replace commit, rollback, file APIs, URL validation, and untrusted DOM rendering.

`npm test` runs all layers once. `npm run check` first compiles and validates the real inline script without executing it, then runs the complete suite. `npm run test:watch` watches test files, helpers, and `index.html`, terminating the previous test process before a restart.

GitHub Actions performs a locked `npm ci` followed by `npm run check` for pushes and pull requests on Node.js 24.19.0.

### Modularization boundary and limitations

The single-inline-script assertion is an intentional boundary. A future approved modularization will make that check fail visibly and require the loader to be adapted to the new production structure instead of silently testing a stale copy of the logic.

JSDOM validates DOM structure and controlled browser-API contracts, but it does not fully reproduce layout, native file pickers, browser download behavior, or every browser-specific security boundary. Those areas still require proportional verification in a real browser.

## Current constraints

- The application remains one large HTML file.
- Tests use the native Node.js runner and JSDOM rather than a browser automation framework.
- Data remains tied to the current browser unless manually exported and imported.
- There is no backend, login, synchronization, mobile app, full analytics engine, or background AI.

Architectural changes, schema changes, and new modules require a separate bounded step, migration analysis where applicable, regression tests, and independent review before commit.
