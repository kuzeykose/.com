const delayedTasks = [];
const intervalTasks = [];
const cooldowns = new Map();

export function after(ms, fn) {
  delayedTasks.push({ remaining: ms, fn });
}

export function every(ms, fn) {
  const task = { interval: ms, remaining: ms, fn, active: true };
  intervalTasks.push(task);
  return () => {
    task.active = false;
  };
}

export function cooldown(name, ms) {
  const now = performance.now();
  const readyAt = cooldowns.get(name) || 0;
  if (now < readyAt) {
    return false;
  }
  cooldowns.set(name, now + ms);
  return true;
}

export function updateTimers(dtMs) {
  for (let i = delayedTasks.length - 1; i >= 0; i -= 1) {
    const task = delayedTasks[i];
    task.remaining -= dtMs;
    if (task.remaining <= 0) {
      task.fn();
      delayedTasks.splice(i, 1);
    }
  }

  for (const task of intervalTasks) {
    if (!task.active) {
      continue;
    }

    task.remaining -= dtMs;
    while (task.remaining <= 0) {
      task.fn();
      task.remaining += task.interval;
    }
  }
}
