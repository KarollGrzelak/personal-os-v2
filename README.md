# Personal OS

Personal OS v2 is an early-stage, privacy-first personal productivity system. It combines daily planning, habits, training, school responsibilities, an IT learning roadmap, a manual English-learning queue, declared availability, and local data management in one browser application.

The current release is a twelve-file static bundle: `index.html` loads `src/styles.css`, then the classic scripts `src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, and `src/app.js` synchronously in that order. It has no backend, account system, analytics service, cloud synchronization, build step, or runtime dependency installation. Application data stays in the browser's `localStorage` unless the user explicitly exports a backup file.

## Current status

- Application milestone: Step 11.4B4 product IT Learning and English views implemented, pending independent audit
- Quality infrastructure: repeatable Node-based tests and GitHub Actions are available for independent audit
- Data schema: `DATA_VERSION = 7`
- Backup format: `personal-os-v2-backup`, version 1
- Production entry point: `index.html` with the external layers in `src/`

## Features

- Semantic product shell with Polish route titles, grouped desktop navigation, and an accessible mobile drawer
- Product Today hierarchy with actionable warnings, check-in or saved energy, a dominant Now task, ordered Next tasks, compact budget, habits, completed work, and progressive plan details
- Independent habits and streak tracking
- Product Training flow with the current session and primary action first, readable weekly days and measurement types, safety notices, expandable exercise instructions and materials, labelled logging, and history
- Product IT Learning flow with the current stage, next criterion, honest LessonGuide sections and primary action first, followed by an accessible expandable roadmap and advanced guide management
- Product School flow with overview, urgent work, deadlines, and lesson plan before fully labelled add forms, without exposing numeric priorities and with school-year/vacation modes preserved
- Product English flow ordered as current activity, progressively disclosed manual queue, labelled creation form, profile, and collapsed history, with at most one current activity
- Weekly free-time intervals and date exceptions in AvailabilityEngine v1
- Explicit local planning dates, integer Task priorities, planning classes, and privacy-minimal task-pool change events
- Pure deterministic PlanDayEngine with energy, availability windows, atomic best-fit allocation, domain fairness, and closed planning reasons
- Safe Today rendering of selected, completed, deferred, excluded, warning, partial, fatal, empty, low-energy, and all-done states with owner-delegated task status changes
- Owner-view navigation from a planned task through the existing in-memory Router, without another task read, plan calculation, persistence write, URL route, or invented material link
- Local-first persistence through a central Store
- Versioned data migrations from schema 1 through 7
- Full JSON backup export
- Validated Replace import with staging and rollback

## Use the application

Normal use does not require Node.js, npm, a build step, or dependency installation.

1. Download or clone the repository, keeping `index.html` and the `src/` directory together.
2. Open `index.html` in a modern browser.

You can also serve the folder with any static file server, but the application does not require one.

## Development and tests

The test environment requires exactly Node.js 24.19.0. After cloning the repository, install the locked development dependency set:

```sh
npm ci
```

Available quality commands:

```sh
npm test             # run the complete test suite once
npm run test:watch  # rerun tests after changes in tests/, helpers, index.html, or src/
npm run check       # validate index.html structure and run the complete test suite
```

Tests execute the real `index.html`, `src/core.js`, `src/today.js`, `src/training.js`, `src/learning.js`, `src/school.js`, `src/availability.js`, `src/english.js`, `src/plan-day.js`, `src/backup.js`, `src/app.js`, and `src/styles.css` in an isolated JSDOM instance. A controlled resource loader serves only those eleven local assets and rejects every other resource request. The adapter used to expose selected symbols is appended only to the in-memory response for the final `src/app.js`; production files are not modified or instrumented on disk.

PlanDayEngine remains pure: it does not persist plans, emit events, register as a module, or mutate tasks. The production Today view calls its `getPlanForToday` facade exactly once per render and uses that one result for the product hierarchy, `completedToday`, and the dynamic header context. Completion and undo delegate once to the owning module. “Open details” uses only the safe projected `moduleId` and the existing in-memory Router; it neither reads tasks again nor creates a URL or placeholder resource. The compatibility `DecisionEngine` remains available for existing contracts but no longer drives production Today planning. Today refreshes only after the approved budget, check-in, task-pool, Availability, backup-import, local-midnight, and changed-day foreground signals.

The Product UI changes in Training, School, IT Learning, and English are presentation-only. These modules keep their existing Store namespaces, domain operations, task projections, priorities, planning classes, events, roadmap reconciliation, status machines, and calculations. Learning now presents the current criterion and LessonGuide before its expandable roadmap; English presents the current activity before its progressively disclosed queue and history. Rendering uses native disclosure controls and explicit labels while leaving `DATA_VERSION`, migrations, and the backup contract unchanged.

All fixtures and test records are synthetic. Tests do not load exported user backups, real browser data, or network resources.

The `Quality` GitHub Actions workflow runs `npm ci` and `npm run check` for every push and pull request using Node.js 24.19.0. JSDOM provides deterministic DOM and browser-API contracts, but it is not a replacement for manual testing in a real browser, especially for layout, native file dialogs, downloads, and browser-specific behavior.

## Privacy and backups

Personal OS stores potentially private information such as school items, learning progress, English activities, declared availability, habits, and training history. The repository does not contain user data, and the application does not send stored data to a server.

Exported backup files do contain the user's Personal OS data. They should be stored and shared with the same care as other private files.

Import uses Replace semantics: a confirmed import replaces the current Personal OS state rather than merging it. The file is parsed, staged in memory, migrated, and validated before the real Store is changed. If a commit fails, the application attempts to restore every namespace from an in-memory rollback snapshot.

## Security model

- Backup input is treated as untrusted data.
- Only known Store namespaces are exported and imported.
- Backup size and nesting depth are limited.
- Dangerous keys such as `__proto__`, `constructor`, and `prototype` are rejected.
- Domain data is validated before import commit.
- User-controlled values are escaped before HTML rendering.
- LessonGuide and English resource links accept only `http:` and `https:` URLs.

This is an early-stage project and has not received a formal third-party security audit.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Development workflow

Changes follow a one-step-at-a-time process:

1. define one bounded specification;
2. implement it directly in the repository;
3. run relevant tests and regression checks;
4. review the diff independently;
5. apply only the identified corrections;
6. commit only after explicit acceptance.

## Author

Created and maintained by [Karol Grzelak](https://github.com/KarollGrzelak).

## License

Licensed under the [MIT License](LICENSE).
