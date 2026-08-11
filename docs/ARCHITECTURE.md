# Architecture

## Overview

Personal OS v2 is a client-only, single-page application delivered as `index.html`. It has no build-time dependencies and no backend. HTML, CSS, and JavaScript are kept together while the project is still in its incremental prototype stage.

User data stays in the browser and is persisted through `localStorage` under the `v2:` key prefix.

## Core services

### Store

`Store` is the only persistent storage interface used by the application. It maintains an in-memory cache backed by `localStorage`.

Normal writes preserve the application's original tolerant behavior. Backup imports use strict writes: serialization and persistent storage must succeed before the cache is updated. Strict writes can also suppress individual change events during a multi-namespace import.

`MemoryStore` implements the same `get`/`set` contract without touching persistent storage. It is used to migrate and validate imported backups in isolation.

### EventBus

`EventBus` provides synchronous publish/subscribe communication. Modules emit state changes without directly calling one another. A successful backup import emits one aggregate completion event after every namespace has been committed.

### Router

`Router` switches application views without reloading the page. Navigation targets are built from core views and registered modules.

### ModuleRegistry

`ModuleRegistry` validates and stores modules. Shared planning engines consume a common task contract instead of depending on concrete module implementations.

## Planning engines

- `DayEngine` manages daily check-in data and energy guidance.
- `HabitEngine` evaluates habit completion and streaks.
- `PriorityEngine` collects and orders open tasks exposed by registered modules.
- `DecisionEngine` applies the user's time budget and completes or restores tasks through their owning modules.
- `TrainingPlanEngine` derives a training plan from a validated training profile.
- `RoadmapEngine` manages IT-roadmap stage status, criteria, prerequisites, and progress.

## Domain modules

### Sandbox

A small reference task module used to demonstrate and exercise the shared module contract.

### Training

Stores a training profile, generated plan state, sessions, and exercise logs. Profile input is validated before persistence. The generated plan can adapt to available equipment, days, session duration, experience, and declared limitations.

### IT learning and LessonGuide

The learning module exposes a linear roadmap made of stages and criteria. `RoadmapEngine` derives active and locked stages from prerequisites.

LessonGuide records attach structured learning material to roadmap criteria. Imported text is treated as untrusted data and escaped during rendering. Resource links are accepted only when they use HTTP or HTTPS.

### School

Stores school tasks, deadlines, completion state, vacation behavior, and a weekly lesson schedule. School workload contributes context and priority information to the daily plan.

## Persistent schema and migrations

`DATA_VERSION` identifies the current persistent schema. Migrations are keyed by their destination version and run sequentially against either `Store` during application startup or `MemoryStore` during backup staging.

Current schema version: `5`.

The migration history covers task statuses, roadmap criterion records, school vacation behavior, and the formal LessonGuide model.

## Backup architecture

The backup process uses an explicit allowlist of application-owned namespaces. It never exports unrelated browser storage.

Import has three phases:

1. Parse and envelope validation
   - enforce a 20 MB UTF-8 size limit
   - parse JSON
   - reject excessive nesting and prototype-related keys
   - validate the backup format and application version
2. Isolated staging
   - copy allowed namespaces into `MemoryStore`
   - run sequential migrations
   - normalize supported legacy state
   - validate every namespace
3. Transactional replace
   - take an in-memory rollback snapshot
   - write every namespace using strict, silent writes
   - restore the snapshot if any write fails
   - emit one completion event after full success

Backups created by a newer application version are rejected. For schema version 5, all required namespaces must be present. The roadmap-status namespace must contain exactly the current stage identifiers with supported status values.

## Security and privacy boundaries

- The application has no API keys, authentication tokens, backend, analytics, or network API calls.
- Personal data remains in browser storage unless the user explicitly exports a backup.
- User-controlled text rendered through HTML templates is escaped.
- LessonGuide URLs are validated again at render time.
- Imported JSON is size-limited, depth-limited, checked for dangerous keys, migrated in memory, and validated before persistent writes.
- External training resources are ordinary links and use `rel="noopener"` when opened in a new tab.

## Current limitations

- Browser storage is device- and browser-profile-specific.
- Clearing site data removes local state unless the user has exported a backup.
- Backup import uses replace semantics; merge behavior is intentionally not defined.
- The application is currently maintained as one HTML file. Splitting it into source modules and adding a formal build pipeline can be considered as the project grows.
