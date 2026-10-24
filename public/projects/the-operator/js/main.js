import { createGameLoop } from './gameLoop.js';
import { endFrameInput, initInput, setDesignScale, wasKeyPressed } from './input.js';
import { preloadAssets } from './assets.js';
import { clearCanvas, drawText } from './draw.js';
import { getTransitionAlpha, renderScene, setScene, updateScene } from './sceneManager.js';
import { t } from './i18n/index.js';
import { loadAllCases } from './game/cases.js';
import { setSelectedCase, state } from './game/state.js';
import { registerTitleScene } from './scenes/titleScene.js';
import { registerSettingsScene } from './scenes/settingsScene.js';
import { registerMenuScene } from './scenes/menuScene.js';
import { registerBriefingScene } from './scenes/briefingScene.js';
import { registerDossierScene } from './scenes/dossierScene.js';
import { registerPlayScene } from './scenes/playScene.js';
import { registerResultScene } from './scenes/resultScene.js';
import { registerVerdictScene } from './scenes/verdictScene.js';
import { registerBadEndScene } from './scenes/badEndScene.js';
import { startBootAmbient } from './interrogationAudio.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from './ui/theme.js';
import { getCrtStrength } from './videoSettings.js';

async function loadCustomFonts() {
  const font = new FontFace('m5x7', 'url(./assets/m5x7.ttf)');
  await font.load();
  document.fonts.add(font);
}

const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;

if (!canvas || !ctx) {
  throw new Error('Canvas could not be initialized.');
}

let renderScale = 1;
let scanTime = 0;
let scanFlicker = 0;

function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) {
    el.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
}

function resizeCanvas() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const aspect = DESIGN_W / DESIGN_H;
  let w;
  let h;
  if (vw / vh > aspect) {
    h = vh;
    w = Math.round(vh * aspect);
  } else {
    w = vw;
    h = Math.round(vw / aspect);
  }
  canvas.width = w;
  canvas.height = h;
  renderScale = w / DESIGN_W;
  ctx.imageSmoothingEnabled = false;
  setDesignScale(renderScale);
}

initInput(canvas);
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
document.addEventListener('fullscreenchange', resizeCanvas);

registerTitleScene(canvas, ctx);
registerSettingsScene(canvas, ctx);
registerMenuScene(canvas, ctx);
registerBriefingScene(canvas, ctx);
registerDossierScene(canvas, ctx);
registerPlayScene(canvas, ctx);
registerVerdictScene(canvas, ctx);
registerResultScene(canvas, ctx);
registerBadEndScene(canvas, ctx);

function update(dt) {
  scanTime += dt;
  scanFlicker = Math.max(0, scanFlicker - dt * 3);
  if (Math.random() < dt * 0.04) {
    scanFlicker = 1;
  }
  if (wasKeyPressed('f')) {
    toggleFullscreen();
  }
  updateScene(dt);
  endFrameInput();
}

function drawScanlines() {
  const strength = getCrtStrength() / 100;
  if (strength <= 0.001) return;

  const spacing = 3;
  const rollOffset = Math.floor(scanTime * 5) % spacing;
  const breathe = Math.sin(scanTime * 2.2) * 0.015 * strength;
  const base = 0.03 + strength * 0.17;
  const alpha = Math.max(0, Math.min(0.3, base + breathe + scanFlicker * 0.02 * strength));
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  for (let y = -rollOffset; y < DESIGN_H; y += spacing) {
    ctx.fillRect(0, y, DESIGN_W, 1);
  }
}

function render() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  renderScene();
  drawScanlines();

  const alpha = getTransitionAlpha();
  if (alpha > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }
}

const loop = createGameLoop({ update, render });

async function boot() {
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  clearCanvas(ctx, COLORS.ink);
  drawText(ctx, t('LOADING'), DESIGN_W / 2, DESIGN_H / 2, {
    align: 'center',
    size: 18,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });

  const [caseDataById] = await Promise.all([loadAllCases(), loadCustomFonts()]);

  const characterImages = Object.fromEntries(
    Object.entries(caseDataById)
      .filter(([, data]) => data.character_image)
      .map(([id, data]) => [`defendant-${id}`, data.character_image])
  );

  await preloadAssets({
    images: {
      background: './assets/background.png',
      'background-no-light': './assets/background-no-light.png',
      operator: './assets/operator.png',
      defendant: './assets/defendant.png',
      ...characterImages,
    },
    audio: {
      'case-slam': './assets/audio/case-slam.wav',
    },
  });

  state.caseDataById = caseDataById;
  setSelectedCase(0);
  state.loading = false;

  startBootAmbient();
  setScene('title');
  loop.start();
}

boot().catch((error) => {
  state.error = error.message;
  state.loading = false;
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  clearCanvas(ctx, '#1a0b10');
  drawText(ctx, t('LOAD_FAIL_TITLE'), DESIGN_W / 2, DESIGN_H / 2 - 12, {
    align: 'center',
    size: 18,
    color: COLORS.fail,
    font: UI_FONT,
    baseline: 'middle',
  });
  drawText(ctx, error.message, DESIGN_W / 2, DESIGN_H / 2 + 10, {
    align: 'center',
    size: 12,
    color: COLORS.cream,
    font: UI_FONT,
    baseline: 'middle',
  });
  throw error;
});
