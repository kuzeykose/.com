import { TR } from './tr.js';
import { EN } from './en.js';

const LANG_KEY = 'the-operator:lang:v1';

let current = EN;
try {
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === 'tr') current = TR;
  else if (saved === 'en') current = EN;
} catch {}

export function t(key) {
  return current[key] ?? key;
}

export function setLanguage(code) {
  current = code === 'en' ? EN : TR;
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch {}
}

export function getLanguage() {
  return current === EN ? 'en' : 'tr';
}

export function toggleLanguage() {
  setLanguage(getLanguage() === 'tr' ? 'en' : 'tr');
}
