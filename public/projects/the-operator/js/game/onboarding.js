const BRIEFING_SEEN_KEY = 'the-operator:briefing-seen:v1';

export function hasSeenBriefing() {
  try {
    return localStorage.getItem(BRIEFING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markBriefingSeen() {
  try {
    localStorage.setItem(BRIEFING_SEEN_KEY, '1');
  } catch {}
}
