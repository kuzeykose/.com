export function createGameLoop({ update, render, fixedTimeStep = 1 / 60, maxSubSteps = 5 }) {
  let isRunning = false;
  let lastTime = 0;
  let accumulator = 0;

  function frame(timestampMs) {
    if (!isRunning) {
      return;
    }

    const now = timestampMs / 1000;
    let delta = now - lastTime;
    lastTime = now;

    if (delta > 0.25) {
      delta = 0.25;
    }

    accumulator += delta;

    let steps = 0;
    while (accumulator >= fixedTimeStep && steps < maxSubSteps) {
      update(fixedTimeStep);
      accumulator -= fixedTimeStep;
      steps += 1;
    }

    const alpha = accumulator / fixedTimeStep;
    render(alpha);

    requestAnimationFrame(frame);
  }

  function start() {
    if (isRunning) {
      return;
    }
    isRunning = true;
    lastTime = performance.now() / 1000;
    accumulator = 0;
    requestAnimationFrame(frame);
  }

  function stop() {
    isRunning = false;
  }

  return {
    start,
    stop,
    get running() {
      return isRunning;
    },
  };
}
