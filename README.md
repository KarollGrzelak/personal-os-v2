# Personal OS v2

A privacy-first, local-first personal productivity application that combines daily planning, habits, training, school, and structured IT learning in a single browser-based system.

> Personal OS v2 is an early-stage open-source project under active development.

## Features

- daily check-in, energy score, and time-budget-aware planning
- cross-module task prioritization
- habit tracking and streaks
- configurable training plans, sessions, and exercise logs
- school tasks, deadlines, lesson schedules, and vacation mode
- a staged IT learning roadmap with completion criteria
- structured LessonGuide content and reviewed learning resources
- versioned local data migrations
- validated backup export and transactional replace import with rollback

## Privacy

Personal OS stores application data in the browser's `localStorage`. The application has no backend, does not require an account, and does not upload personal data.

Backup files can contain personal information entered into the application. Treat exported backups as private files and do not commit them to a public repository.

## Run locally

No build step or dependency installation is required.

1. Download or clone this repository.
2. Open `index.html` in a modern browser.

For normal development and testing, serving the directory through a small local static server is recommended.

## Architecture

The application is delivered as a single HTML file containing its interface, styles, domain models, engines, persistence layer, modules, and backup system.

Shared components include:

- `Store` and `MemoryStore`
- `EventBus`
- `Router`
- `ModuleRegistry`
- `DayEngine`, `HabitEngine`, `PriorityEngine`, and `DecisionEngine`
- `TrainingPlanEngine` and `RoadmapEngine`
- versioned migrations and per-namespace backup validators

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Data compatibility

The current persistent application schema is:

```text
DATA_VERSION = 5
```

Older supported data is upgraded through explicit, sequential migrations. Backups from newer application versions are rejected to prevent unsafe downgrades.

## Project status

The repository currently represents the completed Step 8 application. The codebase is being developed incrementally, with each step reviewed before publication.

## License

Licensed under the [MIT License](LICENSE).
