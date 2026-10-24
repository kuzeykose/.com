import { registerScene, setScene } from '../sceneManager.js';
import {
  getMousePos,
  isMouseDown,
  toggleScrollInverted,
  wasKeyPressed,
  wasMousePressed,
} from '../input.js';
import { drawSettingsModal } from '../ui/pauseModal.js';

let settingsRects = {};
let volumeDragActive = false;
let crtDragActive = false;

function inRect(point, rect) {
  return (
    rect &&
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

export function registerSettingsScene(_canvas, ctx) {
  registerScene('settings', {
    enter() {
      settingsRects = {};
      volumeDragActive = false;
      crtDragActive = false;
    },
    update() {
      const mouse = getMousePos();

      if (volumeDragActive) {
        if (isMouseDown(0) && settingsRects.hitTest) {
          settingsRects.hitTest(mouse);
        } else {
          volumeDragActive = false;
        }
      }

      if (crtDragActive) {
        if (isMouseDown(0) && settingsRects.hitTest) {
          settingsRects.hitTest(mouse);
        } else {
          crtDragActive = false;
        }
      }

      if (wasKeyPressed('escape')) {
        setScene('menu');
        return;
      }

      if (wasKeyPressed('arrowleft') || wasKeyPressed('a')) {
        settingsRects.cycleLanguage?.(-1);
        return;
      }
      if (wasKeyPressed('arrowright') || wasKeyPressed('d')) {
        settingsRects.cycleLanguage?.(1);
        return;
      }
      if (wasKeyPressed('i')) {
        toggleScrollInverted();
        return;
      }
      if (wasKeyPressed('arrowup') || wasKeyPressed('w')) {
        settingsRects.adjustVolume?.(1);
        return;
      }
      if (wasKeyPressed('arrowdown') || wasKeyPressed('s')) {
        settingsRects.adjustVolume?.(-1);
        return;
      }
      if (wasKeyPressed('q')) {
        settingsRects.adjustCrt?.(-1);
        return;
      }
      if (wasKeyPressed('e')) {
        settingsRects.adjustCrt?.(1);
        return;
      }

      if (wasMousePressed(0)) {
        if (settingsRects.volumeHitRect && inRect(mouse, settingsRects.volumeHitRect)) {
          volumeDragActive = true;
        }
        if (settingsRects.crtHitRect && inRect(mouse, settingsRects.crtHitRect)) {
          crtDragActive = true;
        }
        settingsRects.hitTest?.(mouse);
      }
    },
    render() {
      settingsRects = drawSettingsModal(ctx, { mouse: getMousePos(), standalone: true });
    },
  });
}
