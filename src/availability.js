/* ============================================================
   ENGINE / AvailabilityEngine v1
   Użytkownik deklaruje wolne przedziały czasu. Silnik nie jest
   modułem zadaniowym, nie rejestruje się w ModuleRegistry i nie
   wpływa na Today ani na ręczny budżet 30/60/150.
   ============================================================ */

const AVAILABILITY_NAMESPACE = 'availability:configuration';
const AVAILABILITY_MAX_INTERVALS_PER_DAY = 8;
const AVAILABILITY_MAX_EXCEPTIONS = 366;
const AVAILABILITY_CONFIGURATION_FIELDS = ['weeklySchedule', 'exceptions'];
const AVAILABILITY_WEEKLY_DAY_FIELDS = ['weekday', 'intervals'];
const AVAILABILITY_INTERVAL_FIELDS = ['start', 'end'];
const AVAILABILITY_EXCEPTION_FIELDS = ['date', 'kind', 'intervals'];
const AVAILABILITY_WEEKDAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const AVAILABILITY_UI_WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function isAvailabilityPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactAvailabilityFields(value, fields) {
  if (!isAvailabilityPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function cloneAvailabilityValue(value) {
  return value === null ? null : JSON.parse(JSON.stringify(value));
}

function availabilityTimeToMinutes(value) {
  if (value === '24:00') return 1440;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function compareAvailabilityIntervals(left, right) {
  const leftStart = typeof left.start === 'string' ? left.start : '';
  const rightStart = typeof right.start === 'string' ? right.start : '';
  const leftEnd = typeof left.end === 'string' ? left.end : '';
  const rightEnd = typeof right.end === 'string' ? right.end : '';
  return leftStart.localeCompare(rightStart) || leftEnd.localeCompare(rightEnd);
}

function validateAvailabilityInterval(value) {
  const errors = [];
  if (!hasExactAvailabilityFields(value, AVAILABILITY_INTERVAL_FIELDS)) {
    return { valid: false, errors: ['Przedział musi zawierać dokładnie pola start i end.'] };
  }
  const startValid = isValidTimeString(value.start);
  const endValid = value.end === '24:00' || isValidTimeString(value.end);
  if (!startValid) errors.push('start: wymagany format HH:MM w zakresie 00:00-23:59');
  if (!endValid || value.end === '00:00') errors.push('end: wymagany format HH:MM w zakresie 00:01-24:00');
  if (startValid && endValid && value.end !== '00:00'
      && availabilityTimeToMinutes(value.start) >= availabilityTimeToMinutes(value.end)) {
    errors.push('Koniec przedziału musi być późniejszy niż początek; przedziały przez północ są zabronione.');
  }
  return { valid: errors.length === 0, errors };
}

function normalizeAvailabilityIntervals(value) {
  if (!Array.isArray(value)) return value;
  if (!value.every(interval => hasExactAvailabilityFields(interval, AVAILABILITY_INTERVAL_FIELDS))) return value;
  return value.map(interval => ({
    start: typeof interval.start === 'string' ? interval.start.trim() : interval.start,
    end: typeof interval.end === 'string' ? interval.end.trim() : interval.end
  })).sort(compareAvailabilityIntervals);
}

function validateAvailabilityIntervals(value, path) {
  if (!Array.isArray(value)) return { valid: false, errors: [`${path}: wymagana tablica przedziałów`] };
  const errors = [];
  if (value.length > AVAILABILITY_MAX_INTERVALS_PER_DAY) {
    errors.push(`${path}: maksymalnie ${AVAILABILITY_MAX_INTERVALS_PER_DAY} przedziałów`);
  }
  value.forEach((interval, index) => {
    const check = validateAvailabilityInterval(interval);
    if (!check.valid) errors.push(`${path}[${index}]: ${check.errors.join('; ')}`);
  });
  for (let index = 1; index < value.length; index++) {
    const previous = value[index - 1];
    const current = value[index];
    if (!hasExactAvailabilityFields(previous, AVAILABILITY_INTERVAL_FIELDS)
        || !hasExactAvailabilityFields(current, AVAILABILITY_INTERVAL_FIELDS)) continue;
    if (compareAvailabilityIntervals(previous, current) > 0) {
      errors.push(`${path}: przedziały muszą być zapisane w kolejności kanonicznej`);
    }
    const previousCheck = validateAvailabilityInterval(previous);
    const currentCheck = validateAvailabilityInterval(current);
    if (previousCheck.valid && currentCheck.valid
        && availabilityTimeToMinutes(previous.end) > availabilityTimeToMinutes(current.start)) {
      errors.push(`${path}: przedziały nie mogą się nakładać ani duplikować`);
    }
  }
  return { valid: errors.length === 0, errors };
}

function validateWeeklySchedule(value) {
  if (!Array.isArray(value)) return { valid: false, errors: ['weeklySchedule: wymagana tablica'] };
  const errors = [];
  if (value.length !== 7) errors.push('weeklySchedule: wymagane dokładnie siedem dni');
  const weekdays = [];
  value.forEach((day, index) => {
    if (!hasExactAvailabilityFields(day, AVAILABILITY_WEEKLY_DAY_FIELDS)) {
      errors.push(`weeklySchedule[${index}]: wymagane dokładnie pola weekday i intervals`);
      return;
    }
    if (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6) {
      errors.push(`weeklySchedule[${index}].weekday: wymagana liczba całkowita 0-6`);
    } else {
      weekdays.push(day.weekday);
      if (day.weekday !== index) errors.push('weeklySchedule: dni muszą być zapisane w kolejności kanonicznej 0-6');
    }
    const intervalsCheck = validateAvailabilityIntervals(day.intervals, `weeklySchedule[${index}].intervals`);
    if (!intervalsCheck.valid) errors.push(...intervalsCheck.errors);
  });
  if (new Set(weekdays).size !== weekdays.length) errors.push('weeklySchedule: dni tygodnia muszą być unikalne');
  return { valid: errors.length === 0, errors };
}

function normalizeWeeklySchedule(value) {
  if (!Array.isArray(value)) return value;
  if (!value.every(day => hasExactAvailabilityFields(day, AVAILABILITY_WEEKLY_DAY_FIELDS))) return value;
  return value.map(day => ({
    weekday: typeof day.weekday === 'string' && /^\d$/.test(day.weekday.trim()) ? Number(day.weekday.trim()) : day.weekday,
    intervals: normalizeAvailabilityIntervals(day.intervals)
  })).sort((left, right) => left.weekday - right.weekday);
}

function validateAvailabilityException(value) {
  const errors = [];
  if (!hasExactAvailabilityFields(value, AVAILABILITY_EXCEPTION_FIELDS)) {
    return { valid: false, errors: ['Wyjątek musi zawierać dokładnie pola date, kind i intervals.'] };
  }
  if (typeof value.date !== 'string' || !isValidCalendarDateString(value.date)) errors.push('date: wymagana istniejąca data YYYY-MM-DD');
  if (value.kind !== 'unavailable' && value.kind !== 'custom') errors.push('kind: dozwolone unavailable albo custom');
  if (!Array.isArray(value.intervals)) {
    errors.push('intervals: wymagana tablica');
  } else {
    if (value.kind === 'unavailable' && value.intervals.length !== 0) {
      errors.push('Wyjątek unavailable musi mieć pustą listę przedziałów.');
    }
    if (value.kind === 'custom' && (value.intervals.length < 1 || value.intervals.length > AVAILABILITY_MAX_INTERVALS_PER_DAY)) {
      errors.push(`Wyjątek custom wymaga od 1 do ${AVAILABILITY_MAX_INTERVALS_PER_DAY} przedziałów.`);
    }
    const intervalsCheck = validateAvailabilityIntervals(value.intervals, 'exception.intervals');
    if (!intervalsCheck.valid) errors.push(...intervalsCheck.errors);
  }
  return { valid: errors.length === 0, errors };
}

function normalizeAvailabilityException(value) {
  if (!hasExactAvailabilityFields(value, AVAILABILITY_EXCEPTION_FIELDS)) return value;
  return {
    date: typeof value.date === 'string' ? value.date.trim() : value.date,
    kind: typeof value.kind === 'string' ? value.kind.trim() : value.kind,
    intervals: normalizeAvailabilityIntervals(value.intervals)
  };
}

function validateAvailabilityConfigurationValue(value) {
  if (value === null) return { valid: true, errors: [] };
  if (!hasExactAvailabilityFields(value, AVAILABILITY_CONFIGURATION_FIELDS)) {
    return { valid: false, errors: ['availability:configuration ma nieprawidłowy zestaw pól'] };
  }
  const errors = [];
  const weeklyCheck = validateWeeklySchedule(value.weeklySchedule);
  if (!weeklyCheck.valid) errors.push(...weeklyCheck.errors);
  if (!Array.isArray(value.exceptions)) {
    errors.push('exceptions: wymagana tablica');
  } else {
    if (value.exceptions.length > AVAILABILITY_MAX_EXCEPTIONS) {
      errors.push(`exceptions: maksymalnie ${AVAILABILITY_MAX_EXCEPTIONS} wyjątków`);
    }
    value.exceptions.forEach((exception, index) => {
      const check = validateAvailabilityException(exception);
      if (!check.valid) errors.push(`exceptions[${index}]: ${check.errors.join('; ')}`);
      if (index > 0
          && isAvailabilityPlainObject(value.exceptions[index - 1])
          && isAvailabilityPlainObject(exception)
          && typeof value.exceptions[index - 1].date === 'string'
          && typeof exception.date === 'string') {
        if (value.exceptions[index - 1].date >= exception.date) {
          errors.push('exceptions: daty muszą być unikalne i zapisane rosnąco');
        }
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

function sumAvailabilityMinutes(intervals) {
  return intervals.reduce((sum, interval) => (
    sum + availabilityTimeToMinutes(interval.end) - availabilityTimeToMinutes(interval.start)
  ), 0);
}

function resolveAvailabilityForDate(configuration, date) {
  if (typeof date !== 'string' || !isValidCalendarDateString(date)) {
    return { ok: false, changed: false, code: 'INVALID_INPUT', errors: ['Wymagana istniejąca data YYYY-MM-DD.'] };
  }
  const configurationCheck = validateAvailabilityConfigurationValue(configuration);
  if (!configurationCheck.valid) {
    return { ok: false, changed: false, code: 'INVALID_INPUT', errors: configurationCheck.errors };
  }
  const weekday = weekdayFromLocalDate(date);
  if (configuration === null) {
    return {
      ok: true, configured: false, date, weekday, source: 'unconfigured',
      status: 'unconfigured', intervals: [], availableMinutes: null
    };
  }
  const exception = configuration.exceptions.find(item => item.date === date);
  const intervals = exception
    ? exception.intervals
    : configuration.weeklySchedule[weekday].intervals;
  return {
    ok: true,
    configured: true,
    date,
    weekday,
    source: exception ? 'exception' : 'weekly',
    status: intervals.length ? 'available' : 'unavailable',
    intervals: cloneAvailabilityValue(intervals),
    availableMinutes: sumAvailabilityMinutes(intervals)
  };
}

function availabilityError(code, errors) {
  return { ok: false, changed: false, code, errors: Array.isArray(errors) ? errors : [String(errors)] };
}

function readAvailabilityState() {
  const value = Store.get(AVAILABILITY_NAMESPACE, null);
  if (value === null) return { ok: true, configured: false, configuration: null };
  const check = validateAvailabilityConfigurationValue(value);
  if (!check.valid) {
    return availabilityError('INVALID_STORED_DATA', ['Zapisana konfiguracja dostępności jest niepoprawna.']);
  }
  return { ok: true, configured: true, configuration: cloneAvailabilityValue(value) };
}

function availabilityMutationSuccess(configuration, change) {
  try {
    Store.set('availability:configuration', configuration, { strict: true });
  } catch (error) {
    return availabilityError('PERSISTENCE_FAILED', ['Nie udało się trwale zapisać konfiguracji dostępności.']);
  }
  EventBus.emit('availability:changed', { change });
  return { ok: true, changed: true, configuration: cloneAvailabilityValue(configuration) };
}

const AvailabilityEngine = {
  getConfiguration() {
    const state = readAvailabilityState();
    if (!state.ok) return state;
    return {
      ok: true,
      configured: state.configured,
      configuration: cloneAvailabilityValue(state.configuration)
    };
  },

  saveWeeklySchedule(schedule) {
    const state = readAvailabilityState();
    if (!state.ok) return state;
    if (Array.isArray(schedule)
        && schedule.some(day => isAvailabilityPlainObject(day)
          && Array.isArray(day.intervals)
          && day.intervals.length > AVAILABILITY_MAX_INTERVALS_PER_DAY)) {
      return availabilityError('LIMIT_EXCEEDED', [`Maksymalnie ${AVAILABILITY_MAX_INTERVALS_PER_DAY} przedziałów na dzień.`]);
    }
    const normalized = normalizeWeeklySchedule(schedule);
    const check = validateWeeklySchedule(normalized);
    if (!check.valid) return availabilityError('INVALID_INPUT', check.errors);
    const next = {
      weeklySchedule: cloneAvailabilityValue(normalized),
      exceptions: state.configured ? cloneAvailabilityValue(state.configuration.exceptions) : []
    };
    if (state.configured && JSON.stringify(next) === JSON.stringify(state.configuration)) {
      return { ok: true, changed: false, configuration: cloneAvailabilityValue(state.configuration) };
    }
    return availabilityMutationSuccess(next, 'weekly-schedule');
  },

  getExceptions() {
    const state = readAvailabilityState();
    if (!state.ok) return state;
    return {
      ok: true,
      configured: state.configured,
      exceptions: state.configured ? cloneAvailabilityValue(state.configuration.exceptions) : []
    };
  },

  saveException(exception) {
    const state = readAvailabilityState();
    if (!state.ok) return state;
    if (!state.configured) return availabilityError('NOT_CONFIGURED', ['Najpierw zapisz tygodniowy harmonogram dostępności.']);
    if (isAvailabilityPlainObject(exception)
        && Array.isArray(exception.intervals)
        && exception.intervals.length > AVAILABILITY_MAX_INTERVALS_PER_DAY) {
      return availabilityError('LIMIT_EXCEEDED', [`Maksymalnie ${AVAILABILITY_MAX_INTERVALS_PER_DAY} przedziałów w wyjątku.`]);
    }
    const normalized = normalizeAvailabilityException(exception);
    const check = validateAvailabilityException(normalized);
    if (!check.valid) return availabilityError('INVALID_INPUT', check.errors);
    const existingIndex = state.configuration.exceptions.findIndex(item => item.date === normalized.date);
    if (existingIndex < 0 && state.configuration.exceptions.length >= AVAILABILITY_MAX_EXCEPTIONS) {
      return availabilityError('LIMIT_EXCEEDED', [`Maksymalnie ${AVAILABILITY_MAX_EXCEPTIONS} wyjątków.`]);
    }
    if (existingIndex >= 0
        && JSON.stringify(state.configuration.exceptions[existingIndex]) === JSON.stringify(normalized)) {
      return { ok: true, changed: false, configuration: cloneAvailabilityValue(state.configuration) };
    }
    const exceptions = cloneAvailabilityValue(state.configuration.exceptions);
    if (existingIndex >= 0) exceptions[existingIndex] = normalized;
    else exceptions.push(normalized);
    exceptions.sort((left, right) => left.date.localeCompare(right.date));
    const next = { weeklySchedule: cloneAvailabilityValue(state.configuration.weeklySchedule), exceptions };
    return availabilityMutationSuccess(next, existingIndex >= 0 ? 'exception-updated' : 'exception-added');
  },

  deleteException(date) {
    const state = readAvailabilityState();
    if (!state.ok) return state;
    if (!state.configured) return availabilityError('NOT_CONFIGURED', ['Dostępność nie jest skonfigurowana.']);
    if (typeof date !== 'string' || !isValidCalendarDateString(date)) {
      return availabilityError('INVALID_INPUT', ['Wymagana istniejąca data YYYY-MM-DD.']);
    }
    const existingIndex = state.configuration.exceptions.findIndex(item => item.date === date);
    if (existingIndex < 0) {
      return { ok: true, changed: false, configuration: cloneAvailabilityValue(state.configuration) };
    }
    const next = {
      weeklySchedule: cloneAvailabilityValue(state.configuration.weeklySchedule),
      exceptions: state.configuration.exceptions.filter(item => item.date !== date)
    };
    return availabilityMutationSuccess(next, 'exception-deleted');
  },

  clearConfiguration() {
    const value = Store.get(AVAILABILITY_NAMESPACE, null);
    if (value === null) return { ok: true, changed: false, configuration: null };
    return availabilityMutationSuccess(null, 'configuration-cleared');
  },

  getAvailabilityForDate(date) {
    if (typeof date !== 'string' || !isValidCalendarDateString(date)) {
      return availabilityError('INVALID_INPUT', ['Wymagana istniejąca data YYYY-MM-DD.']);
    }
    const state = readAvailabilityState();
    if (!state.ok) return state;
    return resolveAvailabilityForDate(state.configuration, date);
  },

  getAvailableMinutes(date) {
    const result = this.getAvailabilityForDate(date);
    if (!result.ok) return result;
    return {
      ok: true,
      configured: result.configured,
      date: result.date,
      availableMinutes: result.availableMinutes
    };
  }
};

/* ============================================================
   UI / karta Availability w Ustawieniach
   ============================================================ */

function emptyAvailabilityWeeklySchedule() {
  return Array.from({ length: 7 }, (_, weekday) => ({ weekday, intervals: [] }));
}

function formatAvailabilityMinutes(minutes) {
  if (minutes === null) return 'brak konfiguracji';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function availabilityUiMessage(target, result, noOpText) {
  if (!target) return;
  target.style.display = 'block';
  target.style.color = result.ok ? 'var(--text3)' : '#f87171';
  target.textContent = result.ok ? noOpText : (result.errors || ['Nieznany błąd.']).join(' · ');
}

function availabilityIntervalInputs(intervals, context, weekday) {
  return intervals.map((interval, index) => `
    <div class="field-row" data-availability-interval="${index}">
      <input type="time" data-availability-start value="${escapeAttr(interval.start)}" aria-label="Początek przedziału">
      <span>–</span>
      <input type="text" data-availability-end value="${escapeAttr(interval.end)}" list="availability-end-times" placeholder="HH:MM lub 24:00" inputmode="numeric" aria-label="Koniec przedziału" style="width:145px;">
      <button class="mini-btn" data-availability-remove-interval="${index}" data-context="${context}" ${weekday === null ? '' : `data-weekday="${weekday}"`}>usuń</button>
    </div>
  `).join('');
}

function renderAvailabilitySettings() {
  const host = document.getElementById('availability-settings-card');
  if (!host) return;
  const configurationResult = AvailabilityEngine.getConfiguration();

  if (!configurationResult.ok) {
    host.innerHTML = `
      <div class="card" data-availability-card>
        <h3>🗓️ Dostępność</h3>
        <div class="banner-warn">Zapisana konfiguracja dostępności jest niepoprawna. Nie została automatycznie naprawiona ani pokazana.</div>
        <button class="ghost" id="availability-clear-invalid">Wyczyść uszkodzoną konfigurację</button>
      </div>
    `;
    host.querySelector('#availability-clear-invalid').addEventListener('click', () => {
      if (!confirm('Wyczyścić uszkodzoną konfigurację dostępności? Tej operacji nie można cofnąć.')) return;
      const result = AvailabilityEngine.clearConfiguration();
      if (!result.ok) availabilityUiMessage(host.querySelector('.banner-warn'), result, '');
    });
    return;
  }

  const configured = configurationResult.configured;
  let weeklyDraft = configured
    ? cloneAvailabilityValue(configurationResult.configuration.weeklySchedule)
    : emptyAvailabilityWeeklySchedule();
  let exceptionDraft = { date: '', kind: 'unavailable', intervals: [] };

  host.innerHTML = `
    <div class="card" data-availability-card>
      <h3>🗓️ Dostępność</h3>
      <p>Wpisz przedziały wolnego czasu, które możesz przeznaczyć na zadania Personal OS. Te dane nie zmieniają jeszcze planu „Dziś” ani ręcznego budżetu czasu.</p>
      ${configured ? '' : '<div class="banner-warn" id="availability-unconfigured">Dostępność nie jest skonfigurowana. Brak konfiguracji nie oznacza zera minut.</div>'}
      <datalist id="availability-end-times">
        <option value="12:00"></option><option value="16:00"></option><option value="18:00"></option>
        <option value="20:00"></option><option value="22:00"></option><option value="24:00"></option>
      </datalist>
      <div class="pillar-tag" style="margin:12px 0 8px;">Tygodniowy harmonogram</div>
      <div id="availability-weekly-editor"></div>
      <button class="primary" id="availability-save-weekly">Zapisz harmonogram tygodnia</button>
      <div id="availability-weekly-message" style="display:none;font-size:12px;margin-top:8px;"></div>
      ${configured ? `
        <div class="pillar-tag" style="margin:18px 0 8px;">Wyjątki datowe</div>
        <div id="availability-exception-editor"></div>
        <div id="availability-exception-list" style="margin-top:10px;"></div>
      ` : ''}
      <div class="pillar-tag" style="margin:18px 0 8px;">Sprawdź wybraną datę</div>
      <div class="field-row">
        <input type="date" id="availability-query-date" value="${escapeAttr(localDateKey())}">
        <button class="ghost" id="availability-query-button">Oblicz dostępne minuty</button>
        <span class="badge" id="availability-query-result">—</span>
      </div>
      ${configured ? '<button class="ghost" id="availability-clear" style="margin-top:12px;">Wyczyść całą konfigurację</button>' : ''}
    </div>
  `;

  const weeklyHost = host.querySelector('#availability-weekly-editor');
  const weeklyMessage = host.querySelector('#availability-weekly-message');

  function readWeeklyDraft() {
    const next = emptyAvailabilityWeeklySchedule();
    weeklyHost.querySelectorAll('[data-availability-weekday]').forEach(dayElement => {
      const weekday = Number(dayElement.dataset.availabilityWeekday);
      next[weekday].intervals = [...dayElement.querySelectorAll('[data-availability-interval]')].map(row => ({
        start: row.querySelector('[data-availability-start]').value,
        end: row.querySelector('[data-availability-end]').value
      }));
    });
    return next;
  }

  function renderWeeklyEditor() {
    weeklyHost.innerHTML = AVAILABILITY_UI_WEEKDAY_ORDER.map(weekday => {
      const day = weeklyDraft[weekday];
      const normalized = normalizeAvailabilityIntervals(day.intervals);
      const check = validateAvailabilityIntervals(normalized, 'intervals');
      const minutes = check.valid ? sumAvailabilityMinutes(normalized) : null;
      return `
        <div class="exercise-card" data-availability-weekday="${weekday}">
          <div class="ex-head">
            <span class="ex-name">${AVAILABILITY_WEEKDAY_NAMES[weekday]}</span>
            <span class="badge">${check.valid ? formatAvailabilityMinutes(minutes) : 'uzupełnij godziny'}</span>
          </div>
          <div data-availability-intervals>${availabilityIntervalInputs(day.intervals, 'weekly', weekday)}</div>
          <button class="mini-btn" data-availability-add-interval data-weekday="${weekday}" ${day.intervals.length >= AVAILABILITY_MAX_INTERVALS_PER_DAY ? 'disabled' : ''}>+ przedział</button>
        </div>
      `;
    }).join('');

    weeklyHost.querySelectorAll('[data-availability-add-interval]').forEach(button => {
      button.addEventListener('click', () => {
        weeklyDraft = readWeeklyDraft();
        const weekday = Number(button.dataset.weekday);
        if (weeklyDraft[weekday].intervals.length < AVAILABILITY_MAX_INTERVALS_PER_DAY) {
          weeklyDraft[weekday].intervals.push({ start: '', end: '' });
        }
        renderWeeklyEditor();
      });
    });
    weeklyHost.querySelectorAll('[data-context="weekly"][data-availability-remove-interval]').forEach(button => {
      button.addEventListener('click', () => {
        weeklyDraft = readWeeklyDraft();
        weeklyDraft[Number(button.dataset.weekday)].intervals.splice(Number(button.dataset.availabilityRemoveInterval), 1);
        renderWeeklyEditor();
      });
    });
  }

  renderWeeklyEditor();

  host.querySelector('#availability-save-weekly').addEventListener('click', () => {
    weeklyDraft = readWeeklyDraft();
    const result = AvailabilityEngine.saveWeeklySchedule(weeklyDraft);
    if (!result.ok || !result.changed) {
      availabilityUiMessage(weeklyMessage, result, 'Brak zmian do zapisania.');
    }
  });

  const exceptionHost = host.querySelector('#availability-exception-editor');
  const exceptionListHost = host.querySelector('#availability-exception-list');

  if (configured && exceptionHost && exceptionListHost) {
    function readExceptionDraft() {
      const kind = exceptionHost.querySelector('#availability-exception-kind').value;
      return {
        date: exceptionHost.querySelector('#availability-exception-date').value,
        kind,
        intervals: kind === 'custom'
          ? [...exceptionHost.querySelectorAll('[data-availability-interval]')].map(row => ({
            start: row.querySelector('[data-availability-start]').value,
            end: row.querySelector('[data-availability-end]').value
          }))
          : []
      };
    }

    function renderExceptionEditor() {
      exceptionHost.innerHTML = `
        <div class="profile-form">
          <div class="field-row">
            <input type="date" id="availability-exception-date" value="${escapeAttr(exceptionDraft.date)}">
            <select id="availability-exception-kind">
              <option value="unavailable" ${exceptionDraft.kind === 'unavailable' ? 'selected' : ''}>całkowicie niedostępny</option>
              <option value="custom" ${exceptionDraft.kind === 'custom' ? 'selected' : ''}>niestandardowe przedziały</option>
            </select>
          </div>
          ${exceptionDraft.kind === 'custom' ? `
            <div id="availability-exception-intervals">${availabilityIntervalInputs(exceptionDraft.intervals, 'exception', null)}</div>
            <button class="mini-btn" id="availability-exception-add" ${exceptionDraft.intervals.length >= AVAILABILITY_MAX_INTERVALS_PER_DAY ? 'disabled' : ''}>+ przedział wyjątku</button>
          ` : ''}
          <div class="field-row" style="margin-top:8px;">
            <button class="ghost" id="availability-exception-save">Zapisz wyjątek</button>
            <button class="ghost" id="availability-exception-cancel">Wyczyść formularz</button>
          </div>
          <div id="availability-exception-message" style="display:none;font-size:12px;"></div>
        </div>
      `;

      exceptionHost.querySelector('#availability-exception-kind').addEventListener('change', event => {
        exceptionDraft = readExceptionDraft();
        exceptionDraft.kind = event.target.value;
        exceptionDraft.intervals = event.target.value === 'custom' ? [{ start: '', end: '' }] : [];
        renderExceptionEditor();
      });
      exceptionHost.querySelector('#availability-exception-add')?.addEventListener('click', () => {
        exceptionDraft = readExceptionDraft();
        if (exceptionDraft.intervals.length < AVAILABILITY_MAX_INTERVALS_PER_DAY) {
          exceptionDraft.intervals.push({ start: '', end: '' });
        }
        renderExceptionEditor();
      });
      exceptionHost.querySelectorAll('[data-context="exception"][data-availability-remove-interval]').forEach(button => {
        button.addEventListener('click', () => {
          exceptionDraft = readExceptionDraft();
          exceptionDraft.intervals.splice(Number(button.dataset.availabilityRemoveInterval), 1);
          renderExceptionEditor();
        });
      });
      exceptionHost.querySelector('#availability-exception-save').addEventListener('click', () => {
        exceptionDraft = readExceptionDraft();
        const result = AvailabilityEngine.saveException(exceptionDraft);
        if (!result.ok || !result.changed) {
          availabilityUiMessage(exceptionHost.querySelector('#availability-exception-message'), result, 'Brak zmian do zapisania.');
        }
      });
      exceptionHost.querySelector('#availability-exception-cancel').addEventListener('click', () => {
        exceptionDraft = { date: '', kind: 'unavailable', intervals: [] };
        renderExceptionEditor();
      });
    }

    function renderExceptionList() {
      const exceptionsResult = AvailabilityEngine.getExceptions();
      const exceptions = exceptionsResult.ok ? exceptionsResult.exceptions : [];
      exceptionListHost.innerHTML = exceptions.map(exception => `
        <div class="item" data-availability-exception-date="${escapeAttr(exception.date)}">
          <label><b>${escapeHtml(exception.date)}</b> — ${exception.kind === 'unavailable' ? 'całkowicie niedostępny' : `${formatAvailabilityMinutes(sumAvailabilityMinutes(exception.intervals))} wolnego czasu`}</label>
          <button class="mini-btn" data-availability-edit-exception>edytuj</button>
          <button class="mini-btn" data-availability-delete-exception>usuń</button>
        </div>
      `).join('') || '<p style="color:var(--text3);font-size:12px;">Brak wyjątków.</p>';
      exceptionListHost.querySelectorAll('[data-availability-edit-exception]').forEach(button => {
        button.addEventListener('click', () => {
          const date = button.closest('[data-availability-exception-date]').dataset.availabilityExceptionDate;
          exceptionDraft = cloneAvailabilityValue(exceptions.find(exception => exception.date === date));
          renderExceptionEditor();
        });
      });
      exceptionListHost.querySelectorAll('[data-availability-delete-exception]').forEach(button => {
        button.addEventListener('click', () => {
          const date = button.closest('[data-availability-exception-date]').dataset.availabilityExceptionDate;
          const result = AvailabilityEngine.deleteException(date);
          if (!result.ok || !result.changed) {
            availabilityUiMessage(exceptionHost.querySelector('#availability-exception-message'), result, 'Brak wyjątku do usunięcia.');
          }
        });
      });
    }

    renderExceptionEditor();
    renderExceptionList();
  }

  host.querySelector('#availability-query-button').addEventListener('click', () => {
    const result = AvailabilityEngine.getAvailabilityForDate(host.querySelector('#availability-query-date').value);
    const output = host.querySelector('#availability-query-result');
    output.textContent = result.ok
      ? (result.configured ? `${formatAvailabilityMinutes(result.availableMinutes)} · ${result.source === 'exception' ? 'wyjątek' : 'tydzień'}` : 'brak konfiguracji')
      : (result.errors || ['Błąd']).join(' · ');
    output.classList.toggle('warn', !result.ok || !result.configured);
  });

  host.querySelector('#availability-clear')?.addEventListener('click', () => {
    if (!confirm('Wyczyścić całą konfigurację dostępności? Tej operacji nie można cofnąć.')) return;
    const result = AvailabilityEngine.clearConfiguration();
    if (!result.ok || !result.changed) availabilityUiMessage(weeklyMessage, result, 'Konfiguracja jest już pusta.');
  });
}
