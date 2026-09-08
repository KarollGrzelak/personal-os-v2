# Personal OS v2 architecture

## Overview

Personal OS v2 is a single-page static browser application split across twelve production files:

- `index.html` contains the document structure and loads the eleven local assets;
- `src/styles.css` contains the extracted application stylesheet;
- `src/core.js` contains the mechanically extracted Core foundation: local and civil date handling, the pure Task v2 validator, EventBus, Store, MemoryStore, data migrations, ModuleRegistry, and Router;
- `src/today.js` contains the mechanically extracted Today layer: DayEngine, HabitEngine, Today rendering, time budgets, PriorityEngine, and DecisionEngine;
- `src/training.js` contains the mechanically extracted Training domain: exercise data, validation, TrainingPlanEngine, session and log rules, TrainingModule, and its view;
- `src/learning.js` contains the mechanically extracted Learning domain: Roadmap, LessonGuide, validation, escaped rendering, reconciliation, and LearningModule registration;
- `src/school.js` contains the mechanically extracted School domain: school item and lesson data rules, validation, priority and load calculations, SchoolModule, and its view;
- `src/availability.js` contains AvailabilityEngine v1, its strict weekly/free-time and date-exception model, pure validators and normalizers, and the Availability settings card;
- `src/english.js` contains EnglishModule MVP: strict profile and activity contracts, the manual queue and state machine, Task integration, and its escaped view;
- `src/plan-day.js` contains the pure deterministic PlanDayEngine: safe Task projection, source isolation, energy and budget policy, Availability windows, atomic best-fit allocation, domain rotation, and closed result reasons;
- `src/backup.js` contains the mechanically extracted Backup layer: namespace definitions and validators, untrusted-data safeguards, export, preview, staging, migrations, Replace commit, and rollback;
- `src/app.js` contains the remaining view and UI initialization code.

`src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, and `src/app.js` remain classic scripts loaded synchronously and adjacently at the end of `body`, in that exact order, without `type="module"`, `async`, or `defer`. The seven layers created during Step 10 retain their mechanical boundaries; Availability, English, and PlanDay are bounded additions after that modularization. There is still no bundler, build step, or runtime package dependency.

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

The Core declarations share the document's global lexical environment with the following classic `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, and `src/app.js` scripts. Migration 5 contains deferred references to LessonGuide validation functions declared later in `src/learning.js`; those callbacks are not invoked while `src/core.js` loads and are available before the existing initialization code calls `runMigrations(Store)`. Migration 6 initializes only missing English namespaces, and migration 7 initializes only a missing Availability namespace. `src/core.js` is therefore the first ordered part of the application, not an independently executable package.

### EventBus

`EventBus` provides small, explicit notifications such as `store:change`, `route:change`, and `backup:importCompleted`. A task-pool mutation additionally emits `tasks:changed` with exactly `{ moduleId, change }`, where `change` is `created`, `updated`, `deleted`, `selection`, or `configuration`. Explicit status mutations continue to emit only `task:status`, and no task-pool event contains task IDs, dates, titles, minutes, priorities, profiles, or other user content. Domain logic should remain in engines and modules rather than being hidden inside event handlers. Production Today refreshes its plan after `task:status`, `tasks:changed`, and `availability:changed`; aggregate backup import uses the existing whole-application refresh so it does not schedule a second plan render.

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
- `getTasks(date)` where `date` is a required, valid local `YYYY-MM-DD` calendar date;
- `getStats()`;
- `render(container)`;
- optional `setTaskStatus(taskId, status)`.

Missing or invalid planning dates synchronously throw `TypeError` with `code === 'INVALID_DATE'` before domain reads, writes, rendering, or events.

### Civil dates and Task v2

Core is the single source for strict real-calendar `YYYY-MM-DD` validation, planning-date assertion, weekday `0..6`, a civil day ordinal, and calendar-day differences. These calculations use numeric Gregorian components rather than UTC timestamps or 23/25-hour day lengths, so month, year, leap-day, and Europe/Warsaw DST boundaries have the same deterministic semantics.

The pure Task v2 validator accepts safe plain data objects and does not mutate or normalize them. Required fields are `id`, `title`, `status`, integer `priority` `0..100`, integer `estimatedMinutes` `1..1440`, integer `difficulty` `1..5`, and `planningClass`. Optional common fields are `why`, `xp`, `dueDate`, and `completedDate`. Safe domain-specific fields remain allowed. Dangerous own keys, unsafe prototypes, accessors on common fields, invalid dates, non-finite values, and boundary violations are rejected. A future planner will source `moduleId` and `moduleName` from ModuleRegistry rather than trusting task records.

### Router

`Router` switches application views and reports route changes. It does not own module business rules.

## Shared engines

- `DayEngine` calculates daily energy from the local date and check-in data.
- `HabitEngine` owns habit completion and streak rules.
- `PriorityEngine` collects tasks for an explicit planning date and selects tasks that fit the selected time budget.
- `DecisionEngine` remains a compatibility engine for existing callers and tests; it no longer drives production Today planning.
- `TrainingPlanEngine` derives the training plan from the validated training profile.
- `RoadmapEngine` owns IT roadmap stages, criteria, reconciliation, and unlocking rules.
- `PlanDayEngine` purely derives a plan from explicit dates, task sources, check-in energy, a manual budget, and the public Availability result.

Engines communicate with modules through stable contracts and shared task records. They should not depend on a module's private storage representation.

The Today declarations in `src/today.js` depend on Core declarations and share the same global lexical environment with the later `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, and `src/app.js`. Their legacy habit-rendering references to `escapeHtml` and `escapeAttr` are deferred until `src/learning.js` has loaded, while the plan renderer's `PlanDayEngine` reference is deferred until `src/plan-day.js` has loaded. Conversely, later application code depends on `DayEngine`, `DEFAULT_HABITS`, `renderDzis`, `renderTodayTasks`, and the Today lifecycle controller.

The Training declarations in `src/training.js` depend on Core declarations including `Store`, `EventBus`, `localDateKey`, the civil weekday helper, and `ModuleRegistry`, and on Today's `DayEngine`. Their reference to `escapeAttr` is deferred until rendering after `src/learning.js` has loaded. Later School, Backup, and initialization code depends on the already registered `TrainingModule`, while backup validation in `src/backup.js` uses Training declarations such as `validateProfile`. Training refreshes only its own view after UI actions; shared task events trigger the single Today refresh.

The Learning declarations in `src/learning.js` depend on Core declarations including `Store`, `EventBus`, the shared planning-date assertion, and `ModuleRegistry`. The Learning layer performs the existing Roadmap validation and reconciliation, then registers `LearningModule` before the following School layer loads. It refreshes its own view after UI actions and relies on shared task events for Today. Conversely, School and other later UI code use `escapeHtml` and `escapeAttr` from Learning, while migration 5 and backup code use LessonGuide validation and Roadmap declarations.

The School declarations in `src/school.js` depend on Core declarations including `Store`, `EventBus`, `localDateKey`, the shared civil date helpers, and `ModuleRegistry`, and on Learning's `escapeHtml` and `escapeAttr`. During loading the layer initializes its constants and registers `SchoolModule`; Store access and rendering remain deferred until later application initialization or user interaction. School refreshes its own view after UI actions and relies on shared task events for Today. Backup uses Core's calendar-date validator plus School's `validateSchoolItem` and `validateLesson` in cross-domain validation.

The Availability declarations in `src/availability.js` depend on Core's `Store`, `EventBus`, shared calendar-date and weekday helpers; Learning's escaping helpers; and School's clock-time validator. AvailabilityEngine is deliberately not a Module: it does not register with ModuleRegistry, create Tasks, read `school:*`, or alter PriorityEngine, DecisionEngine, or the manual 30/60/150-minute budgets. It stores one atomic `availability:configuration` value, where `null` is unconfigured, and reports nominal local minutes from weekly free-time intervals or a date exception that replaces the whole weekly day. PlanDay consumes that public result, and Today rerenders after `availability:changed`. Loading the layer only defines declarations; Store and DOM access remain deferred to calls and application initialization.

The English declarations in `src/english.js` depend on Core persistence, registration, calendar validation, and planning-date assertion, plus Learning's escaping and URL validation. Loading the layer defines strict validators and operations, then registers `EnglishModule`; it does not read or write Store, touch DOM, or emit events. English refreshes its own view after UI actions and relies on shared task events for Today. It exposes at most one current open Task at integer priority `39`, plus activities completed on the explicit planning date so completion can be undone even when the profile is disabled or invalid.

The PlanDay declarations in `src/plan-day.js` depend only on the preceding public contracts: Core's Task and civil-date helpers, Today's `TIME_BUDGETS` and `DayEngine`, `ModuleRegistry`, and AvailabilityEngine. `validateTask()` and `buildPlan()` are pure. The `getPlanForDate()` and `getPlanForToday()` facades read each public source once, do not access Store namespaces directly, and do not mutate tasks. PlanDay is not registered in ModuleRegistry and emits no events. Production Today now invokes `getPlanForToday(budgetKey, now)` exactly once per plan render and renders only that result, including `completedToday`.

The Backup declarations in `src/backup.js` depend on Core's `Store`, `createMemoryStore`, `runMigrations`, `DATA_VERSION`, `EventBus`, `localDateKey`, and calendar validation; Today's `DEFAULT_HABITS`; Training's `validateProfile`; Learning's Roadmap, LessonGuide, and timestamp declarations; School's item and lesson validators; Availability's strict configuration validator; and English's strict validators. Loading the layer only initializes constants, validator maps, and Roadmap identifiers. Store access, migrations, events, DOM APIs, Blob creation, export, preview, import, commit, and rollback remain deferred until their functions are called. The final `src/app.js` uses the Backup API from its settings UI and attaches the aggregate import-completed listener during the existing synchronous initialization. All ten JavaScript files are ordered source layers sharing one global lexical environment, not independently executable modules.

## Modules

### Training

The Training module manages a validated profile, generated plan, session state, exercise logs, completion status, and a temporary training-load calculation used by the daily energy model. `getTasks(date)` derives weekday and session ID only from that date and emits tasks at priority `30` with `planningClass: 'scheduled'`.

### IT learning

The IT learning module manages roadmap stage statuses, criterion progress, and LessonGuide content. `getTasks(date)` validates the explicit date while its current criterion pool remains date-independent; tasks use priority `40` and `planningClass: 'flexible'`. LessonGuide is attached content, never a task. Imported or edited guide data uses domain validation and escaped rendering. Resource URLs are revalidated at render time and accept only HTTP or HTTPS.

### School

The School module manages school items, the lesson schedule, workload, and school-year/vacation behavior. School items calculate urgency against the explicit planning date: overdue/today is priority `25`, tomorrow `28`, up to three days is capped at `35`, and base type priorities are `32/34/36/38/42/44/48`. Overdue, today, and tomorrow are `urgent`; other School tasks are `flexible`.

### English

The English module stores a strict editable profile and an ordered queue of atomic manual activities. At most one `todo` activity can be marked current. `getTasks(date)` uses only the explicit date for completed activities; exposed tasks use priority `39` and `planningClass: 'flexible'`. Status changes follow explicit `todo`, `done`, and `skipped` transitions; editing cannot alter status fields. The weekly minute value is informational in this MVP, and the module does not generate lessons, contact a network service, or assess resource quality.

## AvailabilityEngine v1

AvailabilityEngine stores user-declared free time, not commitments. Its weekly schedule has exactly seven canonical records keyed `0..6` as in `Date.getDay()`, while the UI presents Monday through Sunday. Intervals are half-open `[start, end)`, may touch, cannot overlap or cross midnight, and allow `24:00` only as an end. Date exceptions are unique and ordered; `unavailable` has no intervals and `custom` has one to eight. An exception replaces the whole weekly day.

Calculations use local calendar dates and nominal minutes from local midnight, so `[00:00, 24:00)` is always 1440 minutes across daylight-saving changes. The engine does not infer sleep, school, events, or private commitments. Ordinary mutations use strict Store writes and emit the standard `store:change` followed by a privacy-minimal `availability:changed` discriminator payload with no date, time, minute count, or configuration. Backup import remains the only silent writer.

## PlanDayEngine v2

PlanDayEngine is a computed, non-persistent projection. `validateTask(task, moduleDescriptor, sourceOrder)` creates a closed safe Task record and always sources module identity from the registry descriptor. `buildPlan(input)` receives an explicit date, planning minute, approved manual budget, check-in state, public Availability result, and ordered module sources. It has no Store, DOM, EventBus, clock, network, random, or AI dependency.

Planning is deterministic and phase-based: urgent tasks, scheduled tasks, one feasible flexible task per rotated active domain, then global flexible fill. All tasks, including Training, are atomic. Configured Availability produces half-open physical slots through best-fit allocation; unconfigured Availability preserves the exact manual budget and returns unscheduled records with `slot: null`. Low energy defers difficulty 4–5 without overriding urgent School work. Source failures are isolated fail-closed, and all public selection, deferral, exclusion, warning, and fatal reasons use closed codes without raw records or exception text.

`getPlanForDate(date, budgetKey, planningStartMinute)` reads no clock. `getPlanForToday(budgetKey, now)` captures the supplied valid `Date` once, derives the local date and minute, and ignores seconds and milliseconds. Both facades use only `ModuleRegistry.all()`, one `getTasks(date)` call per module, `DayEngine.getRecord(date)`, `AvailabilityEngine.getAvailabilityForDate(date)`, and the existing 30/60/150-minute `TIME_BUDGETS`. The engine does not call `setTaskStatus`; production Today finds the owner through ModuleRegistry and invokes its public `setTaskStatus(taskId, status)` exactly once.

## Today integration

Each Today plan render captures one `Date`, calls `PlanDayEngine.getPlanForToday()` once, and renders the returned selected, completed, deferred, excluded, warning, partial, or fatal state. Configured Availability produces a chronological slot view; unconfigured Availability produces an ordered list without invented times. Task titles, module names, reasons, warnings, fatal messages, and day context are inserted with text nodes rather than untrusted HTML interpolation.

The plan refreshes once after a manual budget change, successful check-in, `task:status`, `tasks:changed`, `availability:changed`, successful aggregate backup import, or a detected local-day transition. Domain views no longer call the Today renderer beside those events. A single timeout targets the next local midnight and schedules its successor after firing. `visibilitychange` acts only when the document becomes visible and the local date differs from the last rendered plan date; there is no interval or per-second polling.

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
- User-controlled values in the PlanDay-powered Today view are inserted with `textContent` or text nodes; legacy views retain their established escaping before HTML interpolation.
- Resource URLs are restricted to HTTP and HTTPS.
- Private user data and backup files are excluded from the public repository.

## Test infrastructure

The repeatable test suite uses the built-in `node:test` runner and JSDOM. It always reads the real production `index.html`, `src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, `src/app.js`, and `src/styles.css`; production logic is not copied into test modules.

### Loader and in-memory adapter

`tests/helpers/load-app.mjs` verifies that the document contains ten classic external scripts in the exact order `./src/core.js`, `./src/today.js`, `./src/training.js`, `./src/learning.js`, `./src/school.js`, `./src/availability.js`, `./src/english.js`, `./src/plan-day.js`, `./src/backup.js`, then `./src/app.js`, plus one external stylesheet at `./src/styles.css`. A controlled JSDOM resource loader, implemented with the version-30 `requestInterceptor` API, serves only those exact eleven local resources and rejects every other resource request. It serves every production layer, including PlanDay, unchanged and appends a small explicit test adapter only to the in-memory response for the final `src/app.js`; the adapter exposes only the PlanDayEngine symbol needed by its tests alongside the previously approved test surface and is never written to a production file.

Every test or logical group receives a fresh JSDOM window and closes it after use. The loader provides deterministic isolation for:

- local time in the `Europe/Warsaw` timezone and fixed timestamps;
- a mutable deterministic clock and controllable midnight timer with explicit cleanup;
- pseudorandom values;
- localStorage and controlled write failures;
- dialogs, Blob URLs, download links, and FileReader success or failure;
- window errors, unhandled promise rejections, JSDOM errors, and console errors;
- synthetic data with no network access; only the ten allowlisted production resources are served from memory.

### Test layers

The suite is divided into explicit regression layers:

1. startup, script structure, Core, Store, EventBus, and MemoryStore;
2. schema migrations and recovery behavior;
3. module contracts, compatibility decisions, Day/Habits, Training, Learning/LessonGuide, School, Availability, English, pure PlanDay algorithms, and production Today integration;
4. backup export, parsing, preview, staging, Replace commit, rollback, file APIs, URL validation, and untrusted DOM rendering.

`npm test` runs all layers once. `npm run check` first validates the production resource wiring and compiles the real `src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, and `src/app.js` without executing them, then runs the complete suite. `npm run test:watch` watches test files, helpers, `index.html`, and the complete `src/` tree, terminating the previous test process before a restart.

GitHub Actions performs a locked `npm ci` followed by `npm run check` for pushes and pull requests on Node.js 24.19.0.

### File boundary and limitations

The twelve-file structure is an intentional boundary. The structural check requires the exact relative paths and order of the ten classic scripts, no inline script body or scheduling attributes, and a single external stylesheet with no `style` block. Any future approved split or module-system change must update the check and loader explicitly instead of silently testing a stale copy of the logic.

JSDOM validates DOM structure and controlled browser-API contracts, but it does not fully reproduce layout, native file pickers, browser download behavior, or every browser-specific security boundary. Those areas still require proportional verification in a real browser.

## Current constraints

- Application logic remains ten ordered classic JavaScript files sharing one global lexical environment; Availability, English, PlanDay, Backup, and App are ordered source layers rather than independently executable modules.
- Tests use the native Node.js runner and JSDOM rather than a browser automation framework.
- Data remains tied to the current browser unless manually exported and imported.
- There is no backend, login, synchronization, mobile app, full analytics engine, or background AI.

Architectural changes, schema changes, and new modules require a separate bounded step, migration analysis where applicable, regression tests, and independent review before commit.
