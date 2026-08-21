# Personal OS v2 architecture

## Overview

Personal OS v2 is a single-page static browser application split across six production files:

- `index.html` contains the document structure and loads the five local assets;
- `src/styles.css` contains the extracted application stylesheet;
- `src/core.js` contains the mechanically extracted Core foundation: local date handling, EventBus, Store, MemoryStore, data migrations, ModuleRegistry, and Router;
- `src/today.js` contains the mechanically extracted Today layer: DayEngine, HabitEngine, Today rendering, time budgets, PriorityEngine, and DecisionEngine;
- `src/training.js` contains the mechanically extracted Training domain: exercise data, validation, TrainingPlanEngine, session and log rules, TrainingModule, and its view;
- `src/app.js` contains the remaining Roadmap, Learning, School, backup, validation, view, and UI initialization code.

`src/core.js`, `src/today.js`, `src/training.js`, and `src/app.js` remain classic scripts loaded synchronously and adjacently at the end of `body`, in that exact order, without `type="module"`, `async`, or `defer`. Their boundaries are byte-preserving mechanical extractions from the former single `src/app.js`; concatenating the four files recreates that source without altering declaration, registration, reconciliation, migration, or UI initialization order. There is still no bundler, build step, or runtime package dependency.

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

The Core declarations share the document's global lexical environment with the following classic `src/today.js`, `src/training.js`, and `src/app.js` scripts. Migration 5 contains deferred references to LessonGuide validation functions declared later in `src/app.js`; those callbacks are not invoked while `src/core.js` loads and are available before the existing initialization code calls `runMigrations(Store)`. `src/core.js` is therefore the first ordered part of the application, not an independently executable package.

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

The Today declarations in `src/today.js` depend on Core declarations and share the same global lexical environment with the later `src/training.js` and `src/app.js`. Their references to `escapeHtml` and `escapeAttr` are deferred until rendering after the final script has loaded. Conversely, later application code depends on `DayEngine`, `DEFAULT_HABITS`, `renderDzis`, and `renderTodayTasks`.

The Training declarations in `src/training.js` depend on Core declarations including `Store`, `EventBus`, `localDateKey`, and `ModuleRegistry`, and on Today declarations including `DayEngine` and `renderTodayTasks`. Their reference to `escapeAttr` is deferred until rendering after the final script has loaded. Later backup and initialization code in `src/app.js` depends on Training declarations such as `validateProfile` and on the already registered `TrainingModule`. All four JavaScript files are ordered source layers sharing one global lexical environment, not independently executable modules.

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

The repeatable test suite uses the built-in `node:test` runner and JSDOM. It always reads the real production `index.html`, `src/core.js`, `src/today.js`, `src/training.js`, `src/app.js`, and `src/styles.css`; production logic is not copied into test modules.

### Loader and in-memory adapter

`tests/helpers/load-app.mjs` verifies that the document contains four classic external scripts in the exact order `./src/core.js`, `./src/today.js`, `./src/training.js`, then `./src/app.js`, plus one external stylesheet at `./src/styles.css`. A controlled JSDOM resource loader, implemented with the version-30 `requestInterceptor` API, serves only those exact five local resources and rejects every other resource request. It serves `src/core.js`, `src/today.js`, and `src/training.js` unchanged and appends a small explicit test adapter only to the in-memory response for the final `src/app.js`; the adapter exposes only symbols required by the current tests and is never written to a production file.

Every test or logical group receives a fresh JSDOM window and closes it after use. The loader provides deterministic isolation for:

- local time in the `Europe/Warsaw` timezone and fixed timestamps;
- pseudorandom values;
- localStorage and controlled write failures;
- dialogs, Blob URLs, download links, and FileReader success or failure;
- window errors, unhandled promise rejections, JSDOM errors, and console errors;
- synthetic data with no network access; only the five allowlisted production resources are served from memory.

### Test layers

The suite is divided into explicit regression layers:

1. startup, script structure, Core, Store, EventBus, and MemoryStore;
2. schema migrations and recovery behavior;
3. module contracts, decisions, Day/Habits, Training, Learning/LessonGuide, and School;
4. backup export, parsing, preview, staging, Replace commit, rollback, file APIs, URL validation, and untrusted DOM rendering.

`npm test` runs all layers once. `npm run check` first validates the production resource wiring and compiles the real `src/core.js`, `src/today.js`, `src/training.js`, and `src/app.js` without executing them, then runs the complete suite. `npm run test:watch` watches test files, helpers, `index.html`, and the complete `src/` tree, terminating the previous test process before a restart.

GitHub Actions performs a locked `npm ci` followed by `npm run check` for pushes and pull requests on Node.js 24.19.0.

### File boundary and limitations

The six-file structure is an intentional boundary. The structural check requires the exact relative paths and order of the four classic scripts, no inline script body or scheduling attributes, and a single external stylesheet with no `style` block. Any future approved split or module-system change must update the check and loader explicitly instead of silently testing a stale copy of the logic.

JSDOM validates DOM structure and controlled browser-API contracts, but it does not fully reproduce layout, native file pickers, browser download behavior, or every browser-specific security boundary. Those areas still require proportional verification in a real browser.

## Current constraints

- Application logic remains four ordered classic JavaScript files sharing one global lexical environment; the remaining domain/application layer still lives in `src/app.js`.
- Tests use the native Node.js runner and JSDOM rather than a browser automation framework.
- Data remains tied to the current browser unless manually exported and imported.
- There is no backend, login, synchronization, mobile app, full analytics engine, or background AI.

Architectural changes, schema changes, and new modules require a separate bounded step, migration analysis where applicable, regression tests, and independent review before commit.
