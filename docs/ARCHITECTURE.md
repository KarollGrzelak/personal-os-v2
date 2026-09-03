# Personal OS v2 architecture

## Overview

Personal OS v2 is a single-page static browser application split across eleven production files:

- `index.html` contains the document structure and loads the ten local assets;
- `src/styles.css` contains the extracted application stylesheet;
- `src/core.js` contains the mechanically extracted Core foundation: local date handling, EventBus, Store, MemoryStore, data migrations, ModuleRegistry, and Router;
- `src/today.js` contains the mechanically extracted Today layer: DayEngine, HabitEngine, Today rendering, time budgets, PriorityEngine, and DecisionEngine;
- `src/training.js` contains the mechanically extracted Training domain: exercise data, validation, TrainingPlanEngine, session and log rules, TrainingModule, and its view;
- `src/learning.js` contains the mechanically extracted Learning domain: Roadmap, LessonGuide, validation, escaped rendering, reconciliation, and LearningModule registration;
- `src/school.js` contains the mechanically extracted School domain: school item and lesson data rules, validation, priority and load calculations, SchoolModule, and its view;
- `src/availability.js` contains AvailabilityEngine v1, its strict weekly/free-time and date-exception model, pure validators and normalizers, and the Availability settings card;
- `src/english.js` contains EnglishModule MVP: strict profile and activity contracts, the manual queue and state machine, Task integration, and its escaped view;
- `src/backup.js` contains the mechanically extracted Backup layer: namespace definitions and validators, untrusted-data safeguards, export, preview, staging, migrations, Replace commit, and rollback;
- `src/app.js` contains the remaining view and UI initialization code.

`src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/backup.js`, and `src/app.js` remain classic scripts loaded synchronously and adjacently at the end of `body`, in that exact order, without `type="module"`, `async`, or `defer`. The seven layers created during Step 10 retain their mechanical boundaries; English and Availability are bounded additions after that modularization. There is still no bundler, build step, or runtime package dependency.

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

The Core declarations share the document's global lexical environment with the following classic `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/backup.js`, and `src/app.js` scripts. Migration 5 contains deferred references to LessonGuide validation functions declared later in `src/learning.js`; those callbacks are not invoked while `src/core.js` loads and are available before the existing initialization code calls `runMigrations(Store)`. Migration 6 initializes only missing English namespaces, and migration 7 initializes only a missing Availability namespace. `src/core.js` is therefore the first ordered part of the application, not an independently executable package.

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

The Today declarations in `src/today.js` depend on Core declarations and share the same global lexical environment with the later `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/backup.js`, and `src/app.js`. Their references to `escapeHtml` and `escapeAttr` are deferred until rendering after `src/learning.js` has loaded. Conversely, later application code depends on `DayEngine`, `DEFAULT_HABITS`, `renderDzis`, and `renderTodayTasks`.

The Training declarations in `src/training.js` depend on Core declarations including `Store`, `EventBus`, `localDateKey`, and `ModuleRegistry`, and on Today declarations including `DayEngine` and `renderTodayTasks`. Their reference to `escapeAttr` is deferred until rendering after `src/learning.js` has loaded. Later School, Backup, and initialization code depends on the already registered `TrainingModule`, while backup validation in `src/backup.js` uses Training declarations such as `validateProfile`.

The Learning declarations in `src/learning.js` depend on Core declarations including `Store`, `EventBus`, and `ModuleRegistry`, and on Today rendering through `renderTodayTasks`. The Learning layer performs the existing Roadmap validation and reconciliation, then registers `LearningModule` before the following School layer loads. Its reference to `isValidCalendarDateString` is deferred until after that declaration is available in `src/school.js`. Conversely, School and other later UI code use `escapeHtml` and `escapeAttr` from Learning, while migration 5 and backup code use LessonGuide validation and Roadmap declarations.

The School declarations in `src/school.js` depend on Core declarations including `Store`, `EventBus`, `localDateKey`, and `ModuleRegistry`, on Today rendering through `renderTodayTasks`, and on Learning's `escapeHtml` and `escapeAttr`. During loading the layer initializes its constants and registers `SchoolModule`; Store access and rendering remain deferred until later application initialization or user interaction. English uses School's calendar-date validator, while Backup uses School's `isValidCalendarDateString`, `validateSchoolItem`, and `validateLesson` in cross-domain validation.

The Availability declarations in `src/availability.js` depend on Core's `Store`, `EventBus`, and local date helper; Learning's escaping helpers; and School's general calendar-date and clock-time validators. AvailabilityEngine is deliberately not a Module: it does not register with ModuleRegistry, create Tasks, read `school:*`, or participate in Today, PriorityEngine, DecisionEngine, or the manual 30/60/150-minute budgets. It stores one atomic `availability:configuration` value, where `null` is unconfigured, and reports nominal local minutes from weekly free-time intervals or a date exception that replaces the whole weekly day. Loading the layer only defines declarations; Store and DOM access remain deferred to calls and application initialization.

The English declarations in `src/english.js` depend on Core persistence and registration, Today task rendering, Learning's escaping and URL validation, and School's calendar-date validation. Loading the layer defines strict validators and operations, then registers `EnglishModule`; it does not read or write Store, touch DOM, or emit events. English exposes at most one current open Task at temporary priority `3.9`, plus activities completed today so completion can be undone even when the profile is disabled or invalid.

The Backup declarations in `src/backup.js` depend on Core's `Store`, `createMemoryStore`, `runMigrations`, `DATA_VERSION`, `EventBus`, and `localDateKey`; Today's `DEFAULT_HABITS`; Training's `validateProfile`; Learning's Roadmap, LessonGuide, and timestamp declarations; School's date, item, and lesson validators; Availability's strict configuration validator; and English's strict validators. Loading the layer only initializes constants, validator maps, and Roadmap identifiers. Store access, migrations, events, DOM APIs, Blob creation, export, preview, import, commit, and rollback remain deferred until their functions are called. The final `src/app.js` uses the Backup API from its settings UI and attaches the aggregate import-completed listener during the existing synchronous initialization. All nine JavaScript files are ordered source layers sharing one global lexical environment, not independently executable modules.

## Modules

### Training

The Training module manages a validated profile, generated plan, session state, exercise logs, completion status, and a temporary training-load calculation used by the daily energy model.

### IT learning

The IT learning module manages roadmap stage statuses, criterion progress, and LessonGuide content. LessonGuide is attached content, never a task. Imported or edited guide data uses domain validation and escaped rendering. Resource URLs are revalidated at render time and accept only HTTP or HTTPS.

### School

The School module manages school items, the lesson schedule, workload, and school-year/vacation behavior. School items participate in the shared task contract used by the Today view.

### English

The English module stores a strict editable profile and an ordered queue of atomic manual activities. At most one `todo` activity can be marked current. Status changes follow explicit `todo`, `done`, and `skipped` transitions; editing cannot alter status fields. The weekly minute value is informational in this MVP, and the module does not generate lessons, contact a network service, or assess resource quality.

## AvailabilityEngine v1

AvailabilityEngine stores user-declared free time, not commitments. Its weekly schedule has exactly seven canonical records keyed `0..6` as in `Date.getDay()`, while the UI presents Monday through Sunday. Intervals are half-open `[start, end)`, may touch, cannot overlap or cross midnight, and allow `24:00` only as an end. Date exceptions are unique and ordered; `unavailable` has no intervals and `custom` has one to eight. An exception replaces the whole weekly day.

Calculations use local calendar dates and nominal minutes from local midnight, so `[00:00, 24:00)` is always 1440 minutes across daylight-saving changes. The engine does not infer sleep, school, events, or private commitments. Ordinary mutations use strict Store writes and emit the standard `store:change` followed by a privacy-minimal `availability:changed` discriminator payload with no date, time, minute count, or configuration. Backup import remains the only silent writer.

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

availability:configuration

english:profile
english:activities

sandbox:tasks
```

Every new domain should receive its own prefix. Generic storage keys such as `data`, `state`, or `items` are intentionally avoided.

## Data versioning

The current schema is `DATA_VERSION = 7`.

Existing migrations are additive:

1. schema 1 to 2: task `done` boolean becomes a status enum;
2. schema 2 to 3: IT criteria progress becomes `{ status, completedDate }`;
3. schema 3 to 4: school items receive `activeDuringVacation`;
4. schema 4 to 5: LessonGuide receives its formal validated model and recovery rules.
5. schema 5 to 6: missing `english:profile` and `english:activities` receive `null` and `[]` without overwriting existing parseable values.
6. schema 6 to 7: a missing `availability:configuration` receives `null`; every existing parseable value is preserved without validation, normalization, or repair.

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

The application rejects backups from a newer app data version. The historical required lists for versions 5 and 6 remain unchanged; a version 5 backup may omit English, and a version 6 backup may omit Availability and receives `null` during staging. A version 7 backup must contain `availability:configuration` in addition to all required version 6 namespaces. Its Availability value may be `null`, but any configured value must already be strict and canonically ordered. Current-version `it:stageStatuses` must contain exactly the current roadmap stage IDs with valid statuses. Only older backups may receive an initial stage map during staging.

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

The repeatable test suite uses the built-in `node:test` runner and JSDOM. It always reads the real production `index.html`, `src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/backup.js`, `src/app.js`, and `src/styles.css`; production logic is not copied into test modules.

### Loader and in-memory adapter

`tests/helpers/load-app.mjs` verifies that the document contains nine classic external scripts in the exact order `./src/core.js`, `./src/today.js`, `./src/training.js`, `./src/learning.js`, `./src/school.js`, `./src/availability.js`, `./src/english.js`, `./src/backup.js`, then `./src/app.js`, plus one external stylesheet at `./src/styles.css`. A controlled JSDOM resource loader, implemented with the version-30 `requestInterceptor` API, serves only those exact ten local resources and rejects every other resource request. It serves every domain layer unchanged and appends a small explicit test adapter only to the in-memory response for the final `src/app.js`; the adapter exposes only symbols required by the current tests and is never written to a production file.

Every test or logical group receives a fresh JSDOM window and closes it after use. The loader provides deterministic isolation for:

- local time in the `Europe/Warsaw` timezone and fixed timestamps;
- pseudorandom values;
- localStorage and controlled write failures;
- dialogs, Blob URLs, download links, and FileReader success or failure;
- window errors, unhandled promise rejections, JSDOM errors, and console errors;
- synthetic data with no network access; only the ten allowlisted production resources are served from memory.

### Test layers

The suite is divided into explicit regression layers:

1. startup, script structure, Core, Store, EventBus, and MemoryStore;
2. schema migrations and recovery behavior;
3. module contracts, decisions, Day/Habits, Training, Learning/LessonGuide, School, Availability, and English;
4. backup export, parsing, preview, staging, Replace commit, rollback, file APIs, URL validation, and untrusted DOM rendering.

`npm test` runs all layers once. `npm run check` first validates the production resource wiring and compiles the real `src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/backup.js`, and `src/app.js` without executing them, then runs the complete suite. `npm run test:watch` watches test files, helpers, `index.html`, and the complete `src/` tree, terminating the previous test process before a restart.

GitHub Actions performs a locked `npm ci` followed by `npm run check` for pushes and pull requests on Node.js 24.19.0.

### File boundary and limitations

The eleven-file structure is an intentional boundary. The structural check requires the exact relative paths and order of the nine classic scripts, no inline script body or scheduling attributes, and a single external stylesheet with no `style` block. Any future approved split or module-system change must update the check and loader explicitly instead of silently testing a stale copy of the logic.

JSDOM validates DOM structure and controlled browser-API contracts, but it does not fully reproduce layout, native file pickers, browser download behavior, or every browser-specific security boundary. Those areas still require proportional verification in a real browser.

## Current constraints

- Application logic remains nine ordered classic JavaScript files sharing one global lexical environment; Availability, English, Backup, and App are ordered source layers rather than independently executable modules.
- Tests use the native Node.js runner and JSDOM rather than a browser automation framework.
- Data remains tied to the current browser unless manually exported and imported.
- There is no backend, login, synchronization, mobile app, full analytics engine, or background AI.

Architectural changes, schema changes, and new modules require a separate bounded step, migration analysis where applicable, regression tests, and independent review before commit.
