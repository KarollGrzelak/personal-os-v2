import assert from 'node:assert/strict';
import test from 'node:test';
import { FIXED_MONDAY, FIXED_THURSDAY, schoolItem } from './helpers/fixtures.mjs';
import { loadApp, toPlain } from './helpers/load-app.mjs';

function school(api) {
  return api.ModuleRegistry.get('school');
}

function addItem(module, overrides) {
  const result = module.addItem(schoolItem(overrides));
  assert.equal(result.ok, true, toPlain(result.errors).join(' | '));
  return module.getItems().at(-1).id;
}

test('walidacja szkolna rozpoznaje prawdziwe daty kalendarzowe, godziny i błędne elementy', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = school(app.api);

  assert.equal(app.api.isValidCalendarDateString('2024-02-29'), true);
  assert.equal(app.api.isValidCalendarDateString('2026-02-29'), false);
  assert.equal(app.api.isValidCalendarDateString('2026-02-31'), false);
  assert.equal(app.api.isValidCalendarDateString('20-08-2026'), false);
  assert.equal(app.api.isValidTimeString('00:00'), true);
  assert.equal(app.api.isValidTimeString('23:59'), true);
  assert.equal(app.api.isValidTimeString('24:00'), false);
  assert.equal(app.api.isValidTimeString('09:60'), false);

  const invalid = toPlain(module.addItem({ type: 'unknown', subject: '', title: '', dueDate: '2026-02-31', estimatedMinutes: 1, difficulty: 9 }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length >= 5, true);
  assert.deepEqual(toPlain(module.getItems()), []);
});

test('plan lekcji odrzuca błędne godziny i nakładanie, ale dopuszcza stykające się lekcje', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = school(app.api);

  assert.equal(module.addLesson({ weekday: 1, subject: 'Synthetic A', startTime: '09:00', endTime: '10:00' }).ok, true);
  const overlap = toPlain(module.addLesson({ weekday: 1, subject: 'Synthetic overlap', startTime: '09:30', endTime: '10:30' }));
  assert.equal(overlap.ok, false);
  assert.equal(overlap.errors.some(error => /nakłada/.test(error)), true);

  assert.equal(module.addLesson({ weekday: 1, subject: 'Synthetic B', startTime: '10:00', endTime: '11:00' }).ok, true);
  assert.equal(module.addLesson({ weekday: 2, subject: 'Synthetic invalid', startTime: '12:00', endTime: '11:00' }).ok, false);
  assert.equal(module.getSchedule().length, 2);
});

test('priorytety szkolne eskalują dla terminów dziś, jutro i w najbliższych dniach', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = school(app.api);
  addItem(module, { subject: 'Today', dueDate: '2026-08-20' });
  addItem(module, { subject: 'Tomorrow', dueDate: '2026-08-21' });
  addItem(module, { subject: 'Soon', dueDate: '2026-08-22' });
  addItem(module, { subject: 'Far', dueDate: '2026-08-30' });
  addItem(module, { type: 'material', subject: 'No due date', dueDate: null });

  const tasks = toPlain(module.getTasks());
  const priority = subject => tasks.find(task => task.title.includes(`${subject} —`)).priority;

  assert.equal(priority('Today'), 2.5);
  assert.equal(priority('Tomorrow'), 2.8);
  assert.equal(priority('Soon'), 3.5);
  assert.equal(priority('Far'), 4.2);
  assert.equal(priority('No due date'), 4.8);
});

test('wakacje filtrują tylko elementy bez terminu, a getTasks zachowuje wszystkie statusy', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = school(app.api);
  const dueTodo = addItem(module, { subject: 'Due todo', dueDate: '2026-08-25' });
  const dueDone = addItem(module, { subject: 'Due done', dueDate: '2026-08-26' });
  const dueSkipped = addItem(module, { subject: 'Due skipped', dueDate: '2026-08-27' });
  const sleeping = addItem(module, { type: 'material', subject: 'Sleeping', dueDate: null, activeDuringVacation: false });
  const active = addItem(module, { type: 'material', subject: 'Active', dueDate: null, activeDuringVacation: true });

  module.setTaskStatus(dueDone, 'done');
  module.setTaskStatus(dueSkipped, 'skipped');
  module.setMode('vacation');
  const vacationTasks = toPlain(module.getTasks());
  const visibleIds = vacationTasks.map(task => task.id);

  assert.equal(visibleIds.includes(dueTodo), true);
  assert.equal(visibleIds.includes(dueDone), true);
  assert.equal(visibleIds.includes(dueSkipped), true);
  assert.equal(visibleIds.includes(active), true);
  assert.equal(visibleIds.includes(sleeping), false);
  assert.deepEqual(new Set(vacationTasks.map(task => task.status)), new Set(['todo', 'done', 'skipped']));
  assert.equal(vacationTasks.find(task => task.id === dueDone).completedDate, '2026-08-20');

  module.setTaskStatus(dueDone, 'todo');
  assert.equal(module.getTasks().find(task => task.id === dueDone).completedDate, null);
  assert.equal(module.getItems().length, 5, 'filtr wakacyjny nie usuwa danych');
});

test('obciążenie uwzględnia wagi lekcji, pilnych i zaległych zadań oraz getDayContext', async t => {
  const app = await loadApp({ fixedNow: FIXED_MONDAY });
  t.after(() => app.close());
  const module = school(app.api);
  module.addLesson({ weekday: 1, subject: 'Synthetic long lesson', startTime: '08:00', endTime: '12:00' });
  addItem(module, { subject: 'Urgent', dueDate: '2026-08-17', estimatedMinutes: 120 });

  assert.equal(module.getTodayLoadLevel(), 'medium');
  assert.equal(module.getDayContext(), null);

  module.setMode('vacation');
  assert.equal(module.getTodayLoadLevel(), 'low', 'w wakacje minuty planu lekcji nie obciążają dnia');

  addItem(module, { subject: 'Overdue', dueDate: '2026-08-16', estimatedMinutes: 160 });
  assert.equal(module.getTodayLoadLevel(), 'high');
  const context = toPlain(module.getDayContext());
  assert.equal(context.moduleId, 'school');
  assert.equal(context.level, 'high');
  assert.match(context.message, /Duże obciążenie szkolne/);
});

test('różne dni i instancje aplikacji mają niezależne dane oraz priorytety', async t => {
  const dayBefore = await loadApp({ fixedNow: '2026-08-19T08:00:00.000Z' });
  const dueDay = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => dayBefore.close());
  t.after(() => dueDay.close());
  const firstSchool = school(dayBefore.api);
  const secondSchool = school(dueDay.api);

  addItem(firstSchool, { subject: 'Isolated first', dueDate: '2026-08-20' });
  addItem(secondSchool, { subject: 'Isolated second', dueDate: '2026-08-20' });

  assert.equal(firstSchool.getItems().length, 1);
  assert.equal(secondSchool.getItems().length, 1);
  assert.equal(firstSchool.getTasks()[0].priority, 2.8);
  assert.equal(secondSchool.getTasks()[0].priority, 2.5);
  assert.match(firstSchool.getTasks()[0].title, /Isolated first/);
  assert.match(secondSchool.getTasks()[0].title, /Isolated second/);
});
