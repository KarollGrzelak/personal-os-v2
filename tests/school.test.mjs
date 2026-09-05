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

test('School ogranicza wyłącznie pochodny Task title bez zmiany trwałych danych', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = school(app.api);
  const longSubject = 'S'.repeat(180);
  const longTitle = 'T'.repeat(180);
  const longItemId = addItem(module, { subject: longSubject, title: longTitle });
  const shortItemId = addItem(module, { subject: 'Short subject', title: 'Short title' });
  const storedBefore = toPlain(module.getItems());
  const storeEvents = [];
  const taskEvents = [];
  app.api.EventBus.on('store:change', payload => storeEvents.push(toPlain(payload)));
  app.api.EventBus.on('tasks:changed', payload => taskEvents.push(toPlain(payload)));

  const tasks = module.getTasks('2026-08-20');
  const longTask = tasks.find(task => task.id === longItemId);
  const shortTask = tasks.find(task => task.id === shortItemId);

  assert.equal(`Zadanie domowe: ${longSubject} — ${longTitle}`.length > 300, true);
  assert.equal(longTask.title.length <= 300, true);
  assert.equal(longTask.title.endsWith('…'), true);
  assert.deepEqual(toPlain(app.api.validateTaskV2(longTask)), { valid: true, errors: [] });
  assert.equal(shortTask.title, 'Zadanie domowe: Short subject — Short title');
  assert.deepEqual(toPlain(module.getItems()), storedBefore);
  assert.equal(storedBefore.find(item => item.id === longItemId).subject, longSubject);
  assert.equal(storedBefore.find(item => item.id === longItemId).title, longTitle);
  const schoolView = app.document.getElementById('view-school');
  module.render(schoolView);
  assert.equal(schoolView.textContent.includes(longSubject), true);
  assert.equal(schoolView.textContent.includes(longTitle), true);
  assert.deepEqual(storeEvents, []);
  assert.deepEqual(taskEvents, []);
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

test('priorytety i planningClass School wynikają z jawnej daty dla zaległości oraz 0–4 dni', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = school(app.api);
  addItem(module, { subject: 'Overdue', dueDate: '2026-08-19' });
  addItem(module, { subject: 'Today', dueDate: '2026-08-20' });
  addItem(module, { subject: 'Tomorrow', dueDate: '2026-08-21' });
  addItem(module, { subject: 'Two days', dueDate: '2026-08-22' });
  addItem(module, { subject: 'Three days', dueDate: '2026-08-23' });
  addItem(module, { subject: 'Four days', dueDate: '2026-08-24' });
  addItem(module, { type: 'material', subject: 'No due date', dueDate: null });

  const tasks = toPlain(module.getTasks('2026-08-20'));
  const priority = subject => tasks.find(task => task.title.includes(`${subject} —`)).priority;

  assert.equal(priority('Overdue'), 25);
  assert.equal(priority('Today'), 25);
  assert.equal(priority('Tomorrow'), 28);
  assert.equal(priority('Two days'), 35);
  assert.equal(priority('Three days'), 35);
  assert.equal(priority('Four days'), 42);
  assert.equal(priority('No due date'), 48);
  const planningClass = subject => tasks.find(task => task.title.includes(`${subject} —`)).planningClass;
  for (const subject of ['Overdue', 'Today', 'Tomorrow']) assert.equal(planningClass(subject), 'urgent');
  for (const subject of ['Two days', 'Three days', 'Four days', 'No due date']) assert.equal(planningClass(subject), 'flexible');
  const fromPreviousDay = toPlain(module.getTasks('2026-08-19'));
  assert.equal(fromPreviousDay.find(task => task.title.includes('Today —')).priority, 28, 'priorytet używa argumentu, nie zamrożonego zegara');
  for (const task of module.getTasks('2026-08-20')) {
    assert.deepEqual(toPlain(app.api.validateTaskV2(task)), { valid: true, errors: [] });
  }
});

test('bazowe priorytety typów School i granica roku zachowują całkowitą kolejność', async t => {
  const app = await loadApp();
  t.after(() => app.close());
  const module = school(app.api);
  const priorities = { exam: 32, test: 34, quiz: 36, project: 38, homework: 42, review: 44, material: 48 };
  for (const [type] of Object.entries(priorities)) addItem(module, { type, subject: type, dueDate: null });
  addItem(module, { type: 'material', subject: 'New year tomorrow', dueDate: '2027-01-01' });
  addItem(module, { type: 'material', subject: 'Old year overdue', dueDate: '2026-12-30' });

  const tasks = toPlain(module.getTasks('2026-12-31'));
  for (const [type, expected] of Object.entries(priorities)) {
    assert.equal(tasks.find(task => task.title.includes(`: ${type} —`)).priority, expected);
  }
  assert.equal(tasks.find(task => task.title.includes('New year tomorrow')).priority, 28);
  assert.equal(tasks.find(task => task.title.includes('New year tomorrow')).planningClass, 'urgent');
  assert.equal(tasks.find(task => task.title.includes('Old year overdue')).priority, 25);
});

test('School emituje dokładne tasks:changed dla trybu, utworzenia i usunięcia, ale nie statusu ani lekcji', async t => {
  const app = await loadApp({ fixedNow: FIXED_THURSDAY });
  t.after(() => app.close());
  const module = school(app.api);
  const taskEvents = [];
  const statusEvents = [];
  app.api.EventBus.on('tasks:changed', payload => taskEvents.push(toPlain(payload)));
  app.api.EventBus.on('task:status', payload => statusEvents.push(toPlain(payload)));

  module.setMode('school_year');
  module.setMode('invalid');
  module.setMode('vacation');
  assert.equal(module.addItem({}).ok, false);
  const itemId = addItem(module, { subject: 'Synthetic event item', dueDate: '2026-08-21' });
  module.setTaskStatus(itemId, 'done');
  module.setTaskStatus(itemId, 'done');
  assert.equal(module.addLesson({ weekday: 4, subject: 'Synthetic lesson', startTime: '09:00', endTime: '10:00' }).ok, true);
  const lessonId = module.getSchedule()[0].id;
  module.deleteLesson(lessonId);
  module.deleteItem('missing');
  module.deleteItem(itemId);
  module.deleteItem(itemId);

  assert.deepEqual(taskEvents, [
    { moduleId: 'school', change: 'configuration' },
    { moduleId: 'school', change: 'created' },
    { moduleId: 'school', change: 'deleted' }
  ]);
  assert.equal(taskEvents.every(payload => Object.keys(payload).sort().join(',') === 'change,moduleId'), true);
  assert.deepEqual(statusEvents, [{ moduleId: 'school', taskId: itemId, status: 'done' }]);
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
  const vacationTasks = toPlain(module.getTasks('2026-08-20'));
  const visibleIds = vacationTasks.map(task => task.id);

  assert.equal(visibleIds.includes(dueTodo), true);
  assert.equal(visibleIds.includes(dueDone), true);
  assert.equal(visibleIds.includes(dueSkipped), true);
  assert.equal(visibleIds.includes(active), true);
  assert.equal(visibleIds.includes(sleeping), false);
  assert.deepEqual(new Set(vacationTasks.map(task => task.status)), new Set(['todo', 'done', 'skipped']));
  assert.equal(vacationTasks.find(task => task.id === dueDone).completedDate, '2026-08-20');

  module.setTaskStatus(dueDone, 'todo');
  assert.equal(module.getTasks('2026-08-20').find(task => task.id === dueDone).completedDate, null);
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
  assert.equal(firstSchool.getTasks('2026-08-19')[0].priority, 28);
  assert.equal(secondSchool.getTasks('2026-08-20')[0].priority, 25);
  assert.match(firstSchool.getTasks('2026-08-19')[0].title, /Isolated first/);
  assert.match(secondSchool.getTasks('2026-08-20')[0].title, /Isolated second/);
});
