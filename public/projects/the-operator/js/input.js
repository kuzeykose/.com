const keysDown = new Set();
const keysPressed = new Set();
const keysReleased = new Set();

const mouseDown = new Set();
const mousePressed = new Set();
const mouseReleased = new Set();

const mouse = {
  x: 0,
  y: 0,
};

let isInitialized = false;
let designScale = 1;
let wheelDelta = 0;

const platformText = `${navigator.platform || ''} ${navigator.userAgent || ''}`;
const isMacPlatform = /mac|iphone|ipad|ipod/i.test(platformText);
const isWindowsPlatform = /win/i.test(platformText);
const SCROLL_INVERT_KEY = 'the-operator:scroll-invert:v1';
const SCROLL_LINE_DIVISOR = 30;
const SCROLL_PIXEL_DIVISOR = 2.5;

let scrollInverted = false;
try {
  scrollInverted = localStorage.getItem(SCROLL_INVERT_KEY) === '1';
} catch {}

export function setDesignScale(scale) {
  designScale = scale || 1;
}

function normalizeKey(key) {
  return String(key).toLowerCase();
}

function onKeyDown(event) {
  const key = normalizeKey(event.key);
  if (!keysDown.has(key)) {
    keysPressed.add(key);
  }
  keysDown.add(key);
}

function onKeyUp(event) {
  const key = normalizeKey(event.key);
  keysDown.delete(key);
  keysReleased.add(key);
}

function onMouseDown(event) {
  if (!mouseDown.has(event.button)) {
    mousePressed.add(event.button);
  }
  mouseDown.add(event.button);
}

function onMouseUp(event) {
  mouseDown.delete(event.button);
  mouseReleased.add(event.button);
}

function onWheel(event) {
  wheelDelta += event.deltaY;
  event.preventDefault();
}

function onMouseMove(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  mouse.x = ((event.clientX - rect.left) * scaleX) / designScale;
  mouse.y = ((event.clientY - rect.top) * scaleY) / designScale;
}

export function initInput(canvas) {
  if (isInitialized) {
    return;
  }

  isInitialized = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mousemove', (event) => onMouseMove(event, canvas));
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

export function endFrameInput() {
  keysPressed.clear();
  keysReleased.clear();
  mousePressed.clear();
  mouseReleased.clear();
  wheelDelta = 0;
}

export function getWheelDelta() {
  return wheelDelta;
}

export function getPlatformScrollDelta() {
  const delta = wheelDelta;
  if (isMacPlatform || isWindowsPlatform) {
    return scrollInverted ? -delta : delta;
  }
  return scrollInverted ? -delta : delta;
}

export function toUnifiedScrollLines(delta) {
  return delta / SCROLL_LINE_DIVISOR;
}

export function toUnifiedScrollPixels(delta) {
  return delta / SCROLL_PIXEL_DIVISOR;
}

export function isScrollInverted() {
  return scrollInverted;
}

export function setScrollInverted(next) {
  scrollInverted = !!next;
  try {
    localStorage.setItem(SCROLL_INVERT_KEY, scrollInverted ? '1' : '0');
  } catch {}
}

export function toggleScrollInverted() {
  setScrollInverted(!scrollInverted);
}

export function isKeyDown(key) {
  return keysDown.has(normalizeKey(key));
}

export function wasKeyPressed(key) {
  return keysPressed.has(normalizeKey(key));
}

export function wasAnyKeyPressed() {
  return keysPressed.size > 0;
}

export function wasKeyReleased(key) {
  return keysReleased.has(normalizeKey(key));
}

export function isMouseDown(button = 0) {
  return mouseDown.has(button);
}

export function wasMousePressed(button = 0) {
  return mousePressed.has(button);
}

export function wasMouseReleased(button = 0) {
  return mouseReleased.has(button);
}

export function getMousePos() {
  return { x: mouse.x, y: mouse.y };
}
