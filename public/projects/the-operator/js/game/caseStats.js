const STORAGE_KEY = 'the-operator:case-stats:v1';

function safeLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore (private mode, quota)
  }
}

let cache = null;

function ensureLoaded() {
  if (cache === null) cache = safeLoad();
  return cache;
}

export function getStats(caseId) {
  const all = ensureLoaded();
  return all[caseId] || { attempts: 0, successes: 0, fails: 0 };
}

export function recordAttempt(caseId, correct) {
  const all = ensureLoaded();
  const current = all[caseId] || { attempts: 0, successes: 0, fails: 0 };
  current.attempts += 1;
  if (correct) current.successes += 1;
  else current.fails += 1;
  all[caseId] = current;
  cache = all;
  safeSave(all);
  return current;
}

export function recordBadEnd(caseId) {
  const all = ensureLoaded();
  const current = all[caseId] || { attempts: 0, successes: 0, fails: 0 };
  current.attempts += 1;
  all[caseId] = current;
  cache = all;
  safeSave(all);
  return current;
}

export function resetStats() {
  cache = {};
  safeSave({});
}
