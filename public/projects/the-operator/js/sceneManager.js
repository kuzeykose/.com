const scenes = new Map();
let currentScene = null;
let currentSceneName = '';

const TRANSITION_SPEED = 4;
let transitionPhase = 'none';
let transitionAlpha = 0;
let pendingSceneName = null;
let pendingContext = null;

export function registerScene(name, scene) {
  scenes.set(name, scene);
}

export function setScene(name, context) {
  if (!scenes.has(name)) {
    throw new Error(`Scene not found: ${name}`);
  }

  if (currentScene === null) {
    currentScene = scenes.get(name);
    currentSceneName = name;
    if (typeof currentScene.enter === 'function') {
      currentScene.enter(context);
    }
    transitionAlpha = 1;
    transitionPhase = 'in';
    return;
  }

  pendingSceneName = name;
  pendingContext = context;
  transitionPhase = 'out';
}

function performSwap() {
  if (currentScene && typeof currentScene.exit === 'function') {
    currentScene.exit(pendingContext);
  }
  const next = scenes.get(pendingSceneName);
  currentScene = next;
  currentSceneName = pendingSceneName;
  const enterContext = pendingContext;
  pendingSceneName = null;
  pendingContext = null;
  if (typeof currentScene.enter === 'function') {
    currentScene.enter(enterContext);
  }
  transitionPhase = 'in';
}

export function updateScene(dt, context) {
  if (transitionPhase === 'out') {
    transitionAlpha = Math.min(1, transitionAlpha + dt * TRANSITION_SPEED);
    if (transitionAlpha >= 1) {
      performSwap();
    }
  } else if (transitionPhase === 'in') {
    transitionAlpha = Math.max(0, transitionAlpha - dt * TRANSITION_SPEED);
    if (transitionAlpha <= 0) {
      transitionPhase = 'none';
    }
  }

  if (currentScene && typeof currentScene.update === 'function') {
    currentScene.update(dt, context);
  }
}

export function renderScene(context) {
  if (!currentScene || typeof currentScene.render !== 'function') {
    return;
  }
  currentScene.render(context);
}

export function getCurrentSceneName() {
  return currentSceneName;
}

export function getTransitionAlpha() {
  return transitionAlpha;
}

export function isTransitioning() {
  return transitionPhase !== 'none';
}
