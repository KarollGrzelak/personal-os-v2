# Personal OS v2

Personal OS v2 is an early-stage, privacy-first personal productivity system. It combines daily planning, habits, training, school responsibilities, an IT learning roadmap, and local data management in one browser application.

The current release is a small static bundle: `index.html` loads `src/styles.css`, then the classic scripts `src/core.js` and `src/app.js` synchronously in that order. It has no backend, account system, analytics service, cloud synchronization, build step, or runtime dependency installation. Application data stays in the browser's `localStorage` unless the user explicitly exports a backup file.

## Current status

- Application milestone: Step 8 accepted and closed
- Quality infrastructure: repeatable Node-based tests and GitHub Actions are available for independent audit
- Data schema: `DATA_VERSION = 5`
- Backup format: `personal-os-v2-backup`, version 1
- Current build: `personal-os-v2_6_2.html`, published in this repository as `index.html`

## Features

- Daily check-in and time-budget-based task selection
- Independent habits and streak tracking
- Training profile, plan, sessions, and exercise logs
- IT learning roadmap with stages, criteria, and LessonGuide content
- School tasks, lesson schedule, and school-year/vacation modes
- Local-first persistence through a central Store
- Versioned data migrations from schema 1 through 5
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

Tests execute the real `index.html`, `src/core.js`, `src/app.js`, and `src/styles.css` in an isolated JSDOM instance. A controlled resource loader serves only those three local assets and rejects every other resource request. The adapter used to expose selected symbols is appended only to the in-memory response for `src/app.js`; production files are not modified or instrumented on disk.

All fixtures and test records are synthetic. Tests do not load exported user backups, real browser data, or network resources.

The `Quality` GitHub Actions workflow runs `npm ci` and `npm run check` for every push and pull request using Node.js 24.19.0. JSDOM provides deterministic DOM and browser-API contracts, but it is not a replacement for manual testing in a real browser, especially for layout, native file dialogs, downloads, and browser-specific behavior.

## Privacy and backups

Personal OS stores potentially private information such as school items, learning progress, habits, and training history. The repository does not contain user data, and the application does not send stored data to a server.

Exported backup files do contain the user's Personal OS data. They should be stored and shared with the same care as other private files.

Import uses Replace semantics: a confirmed import replaces the current Personal OS state rather than merging it. The file is parsed, staged in memory, migrated, and validated before the real Store is changed. If a commit fails, the application attempts to restore every namespace from an in-memory rollback snapshot.

## Security model

- Backup input is treated as untrusted data.
- Only known Store namespaces are exported and imported.
- Backup size and nesting depth are limited.
- Dangerous keys such as `__proto__`, `constructor`, and `prototype` are rejected.
- Domain data is validated before import commit.
- User-controlled values are escaped before HTML rendering.
- LessonGuide resource links accept only `http:` and `https:` URLs.

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

## License

Licensed under the [MIT License](LICENSE).
