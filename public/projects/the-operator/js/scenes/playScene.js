import { registerScene, setScene } from '../sceneManager.js';
import {
  getMousePos,
  getPlatformScrollDelta,
  isMouseDown,
  toUnifiedScrollLines,
  toUnifiedScrollPixels,
  wasKeyPressed,
  wasMousePressed,
} from '../input.js';
import { clamp, lerp } from '../math.js';
import {
  getScrollTarget,
  resetScroll,
  setScrollTarget,
  tickScrollOffset,
} from '../smoothScroll.js';
import {
  applyPendingResponseSignals,
  finalizeCurrentMarkerCapture,
  flushPendingResponseSignals,
  getDefendantImageKey,
  getSuspectLabel,
  pickChoice,
  resetSignalsToBaseline,
  resetRun,
  setNode,
  state,
  updateMarkerCapture,
} from '../game/state.js';
import { getBiometricDrawData, updateWave } from '../game/waves.js';
import { drawSceneBackground } from '../ui/background.js';
import { drawNarrationBox } from '../ui/narrationBox.js';
import { drawPortraitBadge } from '../ui/portraitBadge.js';
import { classifyCctv } from '../ui/cctvEffect.js';
import { drawPolygraph } from '../ui/polygraph.js';
import { drawChoiceModal } from '../ui/choiceModal.js';
import { drawDialogueModal } from '../ui/dialogueModal.js';
import { drawLogPanel, drawLogTab } from '../ui/dialogLog.js';
import { drawDossierPanel, drawDossierTab } from '../ui/dossierPanel.js';
import { drawPauseModal, drawSettingsModal } from '../ui/pauseModal.js';
import {
  drawTutorial,
  getTutorialStepCount,
  isTutorialDone,
  markTutorialDone,
} from '../ui/tutorial.js';
import { COLORS, DESIGN_H, DESIGN_W, UI_FONT } from '../ui/theme.js';
import { drawText, drawRect } from '../draw.js';
import { t, getLanguage } from '../i18n/index.js';
import { CASES } from '../game/cases.js';
import { playTypewriterKey } from '../audio.js';
import {
  applyDialogueAudio,
  applyNodeAtmosphere,
  enterInterrogationAudio,
} from '../interrogationAudio.js';

const LAYOUT = {
  narration: { x: 8, y: 8, w: 518, h: 48 },
  operatorBadge: { x: 530, y: 4, w: 62, h: 56 },
  defendantBadge: { x: 8, y: 230, w: 62, h: 56 },
  modal: { x: 82, y: 154, w: 434, h: 132 },
  logTab: { x: DESIGN_W - 14, y: 94, w: 12, h: 84 },
  logPanel: { x: DESIGN_W - 196, y: 64, w: 192, h: 170 },
  dossierTab: { x: 2, y: 94, w: 12, h: 84 },
  dossierPanel: { x: 4, y: 64, w: 192, h: 220 },
  polygraph: { x: 0, y: 290, w: 600, h: 110 },
};

const QUESTION_CPS = 80;
const ANSWER_CPS = 55;
const FEAR_SMOOTH = 6;
const FEAR_FLASH_DECAY = 2;
const LOG_ANIM_SPEED = 12;
const PORTRAIT_SLIDE_SPEED = 2.5;
const NARRATION_SLIDE_SPEED = 4;
const NARRATION_CPS = 45;
const CHOICES_ANIM_SPEED = 1.6;
const POLYGRAPH_SLIDE_SPEED = 3;
const LANE_FLASH_DECAY = 1.8;

let pauseOpen = false;
let pauseRects = [];
let pauseSelectedIndex = 0;
let settingsOpen = false;
let settingsRects = {};
let pauseSettingsVolumeDragActive = false;
let pauseSettingsCrtDragActive = false;
let logExpanded = false;
let logAnim = 0;
let logScrollOffset = 0;
let logMaxScroll = 0;
let dossierExpanded = false;
let dossierAnim = 0;
let dossierScrollOffset = 0;
let dossierMaxScroll = 0;
let answerScrollOffset = 0;
let answerMaxScroll = 0;
let questionScrollOffset = 0;
let questionMaxScroll = 0;
let choiceScrollOffset = 0;
let choiceMaxScroll = 0;
let portraitSlide = 0;
let narrationSlide = 0;
let narrationTextProgress = 0;
let narrationScrollOffset = 0;
let narrationMaxScroll = 0;
let narrationBodyRect = null;
let choicesAnim = 0;
let polygraphSlide = 0;
let displayedNodeId = '';
let tutorialStep = -1;
let tutorialPulseTime = 0;
let tutorialPending = false;
let lastAppliedEvidenceCount = 0;

const laneFlash = { heartRate: 0, breathing: 0, gsr: 0 };
const prevMetrics = { heartRate: '', breathing: '', gsr: '' };
const CCTV_RISE_SPEED = 4;
const CCTV_DECAY_SPEED = 1.4;
let cctvStyle = 'NEUTRAL';
let cctvIntensity = 0;
let dialogueQuestionRect = null;
let dialogueAnswerRect = null;

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function inRect(point, rect) {
  if (!point || !rect) return false;
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function playTypewriterForRange(text, startIndex, endIndex, volume = 1) {
  if (!text || endIndex <= startIndex) {
    return;
  }

  for (let i = startIndex; i < endIndex; i += 1) {
    const ch = text[i];
    if (ch && ch !== ' ' && ch !== '\n' && ch !== '\t') {
      playTypewriterKey(volume);
    }
  }
}

function drawConversationPortraits(ctx) {
  const slideE = easeOutCubic(clamp(portraitSlide, 0, 1));
  const opX = lerp(DESIGN_W, LAYOUT.operatorBadge.x, slideE);
  const defX = lerp(-LAYOUT.defendantBadge.w, LAYOUT.defendantBadge.x, slideE);

  drawPortraitBadge(
    ctx,
    opX,
    LAYOUT.operatorBadge.y,
    LAYOUT.operatorBadge.w,
    LAYOUT.operatorBadge.h,
    'operator',
    t('PLAY_OPERATOR_LABEL')
  );

  drawPortraitBadge(
    ctx,
    defX,
    LAYOUT.defendantBadge.y,
    LAYOUT.defendantBadge.w,
    LAYOUT.defendantBadge.h,
    getDefendantImageKey(),
    getSuspectLabel(),
    { style: cctvStyle, intensity: cctvIntensity, time: state.time }
  );
}

function drawPlayScene(ctx) {
  drawSceneBackground(ctx);

  drawConversationPortraits(ctx);

  const node = state.currentNode;
  if (node) {
    const narrEase = easeOutCubic(clamp(narrationSlide, 0, 1));
    const narrY = lerp(-LAYOUT.narration.h, LAYOUT.narration.y, narrEase);

    const titleStr = node.theme || '';
    const descStr = node.description || '';
    const titleLen = titleStr.length;
    const shown = Math.floor(narrationTextProgress);
    const titleSlice = titleStr.slice(0, Math.min(titleLen, shown));
    const descSlice = descStr.slice(0, Math.max(0, shown - titleLen));

    const narrScroll = drawNarrationBox(
      ctx,
      LAYOUT.narration.x,
      narrY,
      LAYOUT.narration.w,
      LAYOUT.narration.h,
      titleSlice,
      descSlice,
      narrationScrollOffset
    );
    narrationMaxScroll = narrScroll.maxScroll;
    narrationBodyRect = narrScroll.bodyRect
      ? {
          x: narrScroll.bodyRect.x,
          y: narrY + (narrScroll.bodyRect.y - LAYOUT.narration.y),
          w: narrScroll.bodyRect.w,
          h: narrScroll.bodyRect.h,
        }
      : null;
  } else {
    narrationBodyRect = null;
  }

  const mouse = getMousePos();
  const textFullyRevealed = narrationTextProgress >= narrationTotalLen();

  if (state.responseMode && (state.lastQuestion || state.lastAnswer)) {
    const qVisible = state.lastQuestion.slice(0, Math.floor(state.questionProgress));
    const aVisible = state.lastAnswer.slice(0, Math.floor(state.answerProgress));
    const modalResult = drawDialogueModal(ctx, {
      x: LAYOUT.modal.x,
      y: LAYOUT.modal.y,
      w: LAYOUT.modal.w,
      h: LAYOUT.modal.h,
      question: qVisible,
      answer: aVisible,
      questionScrollOffset,
      answerScrollOffset,
      suspectLabel: getSuspectLabel(),
    });
    questionMaxScroll = modalResult.questionMaxScroll;
    answerMaxScroll = modalResult.answerMaxScroll;
    dialogueQuestionRect = modalResult.questionRect || null;
    dialogueAnswerRect = modalResult.answerRect || null;
    state.choiceRects = [];
  } else if (textFullyRevealed && node && node.choices && !node.is_end_state) {
    const choiceResult = drawChoiceModal(ctx, {
      x: LAYOUT.modal.x,
      y: LAYOUT.modal.y,
      w: LAYOUT.modal.w,
      h: LAYOUT.modal.h,
      choices: node.choices,
      mouse: logExpanded || dossierExpanded || pauseOpen ? null : mouse,
      animProgress: choicesAnim,
      scrollOffset: choiceScrollOffset,
    });
    state.choiceRects = choiceResult.rects;
    choiceMaxScroll = choiceResult.maxScroll;
    dialogueQuestionRect = null;
    dialogueAnswerRect = null;
  } else {
    state.choiceRects = [];
    dialogueQuestionRect = null;
    dialogueAnswerRect = null;
  }

  const polyE = easeOutCubic(clamp(polygraphSlide, 0, 1));
  const polyY = lerp(DESIGN_H, LAYOUT.polygraph.y, polyE);
  drawPolygraph(ctx, LAYOUT.polygraph.x, polyY, LAYOUT.polygraph.w, LAYOUT.polygraph.h, {
    waves: state.wave,
    time: state.time,
    metrics: state.metrics,
    biometric: getBiometricDrawData(state),
    fearBar: state.fearBarDisplay,
    maxFearBar: state.maxFearBar,
    fearFlash: state.fearFlash,
    laneFlash,
    markers: state.polygraphMarkers,
    activeMarker: state.markerCapture,
  });

  const ease = smoothstep(clamp(logAnim, 0, 1));
  const tabX = lerp(LAYOUT.logTab.x, LAYOUT.logPanel.x - LAYOUT.logTab.w - 2, ease);
  const tabRect = { x: tabX, y: LAYOUT.logTab.y, w: LAYOUT.logTab.w, h: LAYOUT.logTab.h };
  const tabHovered = inRect(mouse, tabRect);
  drawLogTab(ctx, tabX, LAYOUT.logTab.y, LAYOUT.logTab.w, LAYOUT.logTab.h, ease > 0.4, tabHovered);

  const dossEase = smoothstep(clamp(dossierAnim, 0, 1));
  const dossTabX = lerp(
    LAYOUT.dossierTab.x,
    LAYOUT.dossierPanel.x + LAYOUT.dossierPanel.w + 2,
    dossEase
  );
  const dossTabRect = {
    x: dossTabX,
    y: LAYOUT.dossierTab.y,
    w: LAYOUT.dossierTab.w,
    h: LAYOUT.dossierTab.h,
  };
  const dossTabHovered = inRect(mouse, dossTabRect);
  drawDossierTab(
    ctx,
    dossTabX,
    LAYOUT.dossierTab.y,
    LAYOUT.dossierTab.w,
    LAYOUT.dossierTab.h,
    dossEase > 0.4,
    dossTabHovered
  );

  if (ease > 0.01) {
    const panelRect = {
      x: lerp(DESIGN_W, LAYOUT.logPanel.x, ease),
      y: LAYOUT.logPanel.y,
      w: LAYOUT.logPanel.w,
      h: LAYOUT.logPanel.h,
    };
    ctx.save();
    ctx.globalAlpha = Math.min(1, ease * 1.25);
    const result = drawLogPanel(
      ctx,
      panelRect.x,
      panelRect.y,
      panelRect.w,
      panelRect.h,
      state.topLog,
      logScrollOffset
    );
    ctx.restore();
    if (ease > 0.95) {
      logMaxScroll = result.maxScroll;
    }
  }

  if (dossEase > 0.01) {
    const panelRect = {
      x: lerp(-LAYOUT.dossierPanel.w, LAYOUT.dossierPanel.x, dossEase),
      y: LAYOUT.dossierPanel.y,
      w: LAYOUT.dossierPanel.w,
      h: LAYOUT.dossierPanel.h,
    };
    ctx.save();
    ctx.globalAlpha = Math.min(1, dossEase * 1.25);
    const result = drawDossierPanel(
      ctx,
      panelRect.x,
      panelRect.y,
      panelRect.w,
      panelRect.h,
      state.gameData?.dossier,
      state.gameData?.suspect,
      dossierScrollOffset
    );
    ctx.restore();
    if (dossEase > 0.95) {
      dossierMaxScroll = result.maxScroll;
    }
  }

  if (pauseOpen) {
    if (settingsOpen) {
      settingsRects = drawSettingsModal(ctx, { mouse });
    } else {
      const result = drawPauseModal(ctx, { mouse, selectedIndex: pauseSelectedIndex });
      pauseRects = result.rects;
    }
  }

  if (tutorialStep >= 0) {
    const pulse = 0.5 + 0.5 * Math.sin(tutorialPulseTime * 4);
    drawTutorial(ctx, LAYOUT, tutorialStep, pulse);
  }

  const caseDef = CASES[state.caseIndex];
  if (caseDef?.language && caseDef.language !== getLanguage()) {
    const warnBlink = 0.55 + 0.45 * Math.abs(Math.sin(state.time * 2.2));
    const warnH = 14;
    ctx.save();
    ctx.globalAlpha = warnBlink * 0.9;
    drawRect(ctx, 0, 0, DESIGN_W, warnH, 'rgba(14, 0, 0, 0.85)');
    ctx.globalAlpha = warnBlink;
    drawText(ctx, t('WARN_LANG_MISMATCH'), DESIGN_W / 2, warnH / 2, {
      align: 'center',
      size: 9,
      color: COLORS.fail,
      font: UI_FONT,
      baseline: 'middle',
    });
    ctx.restore();
  }
}

function narrationTotalLen() {
  const node = state.currentNode;
  if (!node) {
    return 0;
  }
  return (node.theme || '').length + (node.description || '').length;
}

function advanceToPendingNode() {
  if (!state.pendingNodeId) {
    return;
  }
  const result = setNode(state.pendingNodeId);
  if (!result.ok) {
    setScene('result');
    return;
  }
  if (result.isEnd) {
    const wasSuccess = state.currentNodeId.includes('success');
    state.interrogationOutcome = {
      nodeId: state.currentNodeId,
      theme: state.currentNode?.theme || '',
      description: state.currentNode?.description || '',
      resultText: state.currentNode?.result_text || '',
      wasSuccess,
    };
    setScene(wasSuccess ? 'verdict' : 'bad-end');
    return;
  }
  if (shouldForceVerdictByStress()) {
    finalizeCurrentMarkerCapture();
    setScene('verdict');
  }
}

function updateLogHover(dt) {
  const mouse = getMousePos();
  const ease = smoothstep(clamp(logAnim, 0, 1));
  const tabX = lerp(LAYOUT.logTab.x, LAYOUT.logPanel.x - LAYOUT.logTab.w - 2, ease);
  const liveTabRect = { x: tabX, y: LAYOUT.logTab.y, w: LAYOUT.logTab.w, h: LAYOUT.logTab.h };
  const panelRect = {
    x: LAYOUT.logPanel.x,
    y: LAYOUT.logPanel.y,
    w: LAYOUT.logPanel.w,
    h: LAYOUT.logPanel.h,
  };

  if (wasMousePressed(0)) {
    if (inRect(mouse, liveTabRect)) {
      logExpanded = !logExpanded;
      if (!logExpanded) {
        resetScroll('play.log');
        logScrollOffset = 0;
      }
    } else if (logExpanded && !inRect(mouse, panelRect)) {
      logExpanded = false;
      resetScroll('play.log');
      logScrollOffset = 0;
    }
  }

  const target = logExpanded ? 1 : 0;
  const diff = target - logAnim;
  logAnim += diff * Math.min(1, dt * LOG_ANIM_SPEED);
  if (Math.abs(diff) < 0.005) {
    logAnim = target;
  }

  if (logExpanded && inRect(mouse, panelRect)) {
    const wheel = getPlatformScrollDelta();
    if (wheel !== 0) {
      setScrollTarget(
        'play.log',
        getScrollTarget('play.log') + toUnifiedScrollPixels(wheel),
        logMaxScroll
      );
    }
  }
}

function updateDossierHover(dt) {
  const mouse = getMousePos();
  const ease = smoothstep(clamp(dossierAnim, 0, 1));
  const tabX = lerp(LAYOUT.dossierTab.x, LAYOUT.dossierPanel.x + LAYOUT.dossierPanel.w + 2, ease);
  const liveTabRect = {
    x: tabX,
    y: LAYOUT.dossierTab.y,
    w: LAYOUT.dossierTab.w,
    h: LAYOUT.dossierTab.h,
  };
  const panelRect = {
    x: LAYOUT.dossierPanel.x,
    y: LAYOUT.dossierPanel.y,
    w: LAYOUT.dossierPanel.w,
    h: LAYOUT.dossierPanel.h,
  };

  if (wasMousePressed(0)) {
    if (inRect(mouse, liveTabRect)) {
      dossierExpanded = !dossierExpanded;
      if (!dossierExpanded) {
        resetScroll('play.dossier');
        dossierScrollOffset = 0;
      }
    } else if (dossierExpanded && !inRect(mouse, panelRect)) {
      dossierExpanded = false;
      resetScroll('play.dossier');
      dossierScrollOffset = 0;
    }
  }

  const target = dossierExpanded ? 1 : 0;
  const diff = target - dossierAnim;
  dossierAnim += diff * Math.min(1, dt * LOG_ANIM_SPEED);
  if (Math.abs(diff) < 0.005) {
    dossierAnim = target;
  }

  if (dossierExpanded && inRect(mouse, panelRect)) {
    const wheel = getPlatformScrollDelta();
    if (wheel !== 0) {
      setScrollTarget(
        'play.dossier',
        getScrollTarget('play.dossier') + toUnifiedScrollPixels(wheel),
        dossierMaxScroll
      );
    }
  }
}

function tickFearAnimation(dt) {
  const diff = state.fearBar - state.fearBarDisplay;
  state.fearBarDisplay += diff * Math.min(1, dt * FEAR_SMOOTH);
  if (Math.abs(diff) < 0.05) {
    state.fearBarDisplay = state.fearBar;
  }
  state.fearFlash = Math.max(0, state.fearFlash - dt * FEAR_FLASH_DECAY);
}

function shouldForceVerdictByStress() {
  return state.fearBar <= 10 || state.fearBar >= 90;
}

function handleResponseMode(dt) {
  const qLen = state.lastQuestion.length;
  const aLen = state.lastAnswer.length;
  const qDone = state.questionProgress >= qLen;
  const aDone = state.answerProgress >= aLen;

  if (wasKeyPressed('enter')) {
    if (!qDone) {
      state.questionProgress = qLen;
      flushPendingResponseSignals();
      return;
    }
    if (!aDone) {
      state.answerProgress = aLen;
      flushPendingResponseSignals();
      return;
    }
    advanceToPendingNode();
    return;
  }

  if (!qDone) {
    const prevChars = Math.floor(state.questionProgress);
    state.questionProgress = Math.min(qLen, state.questionProgress + dt * QUESTION_CPS);
    const nextChars = Math.floor(state.questionProgress);
    playTypewriterForRange(state.lastQuestion, prevChars, nextChars, 0.85);
    return;
  }

  if (!aDone) {
    const prevChars = Math.floor(state.answerProgress);
    state.answerProgress = Math.min(aLen, state.answerProgress + dt * ANSWER_CPS);
    const nextChars = Math.floor(state.answerProgress);
    playTypewriterForRange(state.lastAnswer, prevChars, nextChars, 0.75);
    return;
  }

  // both texts fully revealed — wait for user to press ENTER
}

export function registerPlayScene(_canvas, ctx) {
  registerScene('play', {
    enter() {
      resetRun();
      enterInterrogationAudio();
      applyNodeAtmosphere(state.currentNode, state.currentNodeId);
      pauseOpen = false;
      pauseRects = [];
      pauseSelectedIndex = 0;
      settingsOpen = false;
      settingsRects = {};
      pauseSettingsVolumeDragActive = false;
      pauseSettingsCrtDragActive = false;
      logExpanded = false;
      logAnim = 0;
      logScrollOffset = 0;
      logMaxScroll = 0;
      dossierExpanded = false;
      dossierAnim = 0;
      dossierScrollOffset = 0;
      dossierMaxScroll = 0;
      tutorialStep = -1;
      tutorialPending = !isTutorialDone();
      tutorialPulseTime = 0;
      answerScrollOffset = 0;
      answerMaxScroll = 0;
      questionScrollOffset = 0;
      questionMaxScroll = 0;
      choiceScrollOffset = 0;
      choiceMaxScroll = 0;
      portraitSlide = 0;
      narrationSlide = 0;
      narrationTextProgress = 0;
      narrationScrollOffset = 0;
      narrationMaxScroll = 0;
      resetScroll('play.narration');
      resetScroll('play.question');
      resetScroll('play.answer');
      resetScroll('play.log');
      resetScroll('play.dossier');
      resetScroll('play.choice');
      narrationBodyRect = null;
      choicesAnim = 0;
      polygraphSlide = 0;
      laneFlash.heartRate = 0;
      laneFlash.breathing = 0;
      laneFlash.gsr = 0;
      cctvStyle = 'NEUTRAL';
      cctvIntensity = 0;
      dialogueQuestionRect = null;
      dialogueAnswerRect = null;
      prevMetrics.heartRate = state.metrics.heartRate;
      prevMetrics.breathing = state.metrics.breathing;
      prevMetrics.gsr = state.metrics.gsr;
      displayedNodeId = state.currentNodeId;
      lastAppliedEvidenceCount = state.evidence.length;
    },
    update(dt) {
      state.time += dt;
      applyPendingResponseSignals();
      updateWave(state, dt);
      tickFearAnimation(dt);
      updateMarkerCapture();

      narrationScrollOffset = tickScrollOffset('play.narration', dt, narrationMaxScroll);
      questionScrollOffset = tickScrollOffset('play.question', dt, questionMaxScroll);
      answerScrollOffset = tickScrollOffset('play.answer', dt, answerMaxScroll);
      logScrollOffset = tickScrollOffset('play.log', dt, logMaxScroll);
      dossierScrollOffset = tickScrollOffset('play.dossier', dt, dossierMaxScroll);
      choiceScrollOffset = tickScrollOffset('play.choice', dt, choiceMaxScroll);

      if (!state.responseMode && shouldForceVerdictByStress()) {
        finalizeCurrentMarkerCapture();
        setScene('verdict');
        return;
      }

      if (tutorialStep >= 0) {
        tutorialPulseTime += dt;
        const stepCount = getTutorialStepCount(LAYOUT);
        if (wasKeyPressed('escape')) {
          tutorialStep = -1;
          markTutorialDone();
        } else if (wasKeyPressed('enter') || wasMousePressed(0)) {
          tutorialStep += 1;
          if (tutorialStep >= stepCount) {
            tutorialStep = -1;
            markTutorialDone();
          }
        }
        return;
      }

      if (
        tutorialPending &&
        polygraphSlide >= 1 &&
        narrationSlide >= 0.99 &&
        narrationTextProgress >= narrationTotalLen()
      ) {
        tutorialPending = false;
        tutorialStep = 0;
      }

      portraitSlide = Math.min(1, portraitSlide + dt * PORTRAIT_SLIDE_SPEED);
      polygraphSlide = Math.min(1, polygraphSlide + dt * POLYGRAPH_SLIDE_SPEED);
      if (portraitSlide >= 0.7) {
        narrationSlide = Math.min(1, narrationSlide + dt * NARRATION_SLIDE_SPEED);
      }

      for (const key of ['heartRate', 'breathing', 'gsr']) {
        if (state.metrics[key] !== prevMetrics[key]) {
          prevMetrics[key] = state.metrics[key];
          laneFlash[key] = 1;
        }
        laneFlash[key] = Math.max(0, laneFlash[key] - dt * LANE_FLASH_DECAY);
      }

      if (state.currentNodeId !== displayedNodeId) {
        displayedNodeId = state.currentNodeId;
        resetSignalsToBaseline();
        applyNodeAtmosphere(state.currentNode, state.currentNodeId);
        narrationTextProgress = 0;
        narrationScrollOffset = 0;
        narrationMaxScroll = 0;
        narrationBodyRect = null;
        choicesAnim = 0;
        answerScrollOffset = 0;
        answerMaxScroll = 0;
        questionScrollOffset = 0;
        questionMaxScroll = 0;
        choiceScrollOffset = 0;
        choiceMaxScroll = 0;
        resetScroll('play.narration');
        resetScroll('play.answer');
        resetScroll('play.question');
        resetScroll('play.choice');
      }

      const totalTextLen = narrationTotalLen();

      if (state.evidence.length > lastAppliedEvidenceCount) {
        const latest = state.evidence[state.evidence.length - 1];
        applyDialogueAudio(latest, state.fearBar, state.maxFearBar);
        lastAppliedEvidenceCount = state.evidence.length;
      }

      cctvStyle = classifyCctv(state.metrics.cctvVisual || 'NEUTRAL');

      if (state.responseMode && cctvStyle !== 'NEUTRAL') {
        cctvIntensity = Math.min(1, cctvIntensity + dt * CCTV_RISE_SPEED);
      } else {
        cctvIntensity = Math.max(0, cctvIntensity - dt * CCTV_DECAY_SPEED);
      }

      if (narrationSlide >= 0.99 && narrationTextProgress < totalTextLen) {
        const node = state.currentNode;
        const fullNarration = `${node?.theme || ''}${node?.description || ''}`;
        const prevChars = Math.floor(narrationTextProgress);
        narrationTextProgress = Math.min(totalTextLen, narrationTextProgress + dt * NARRATION_CPS);
        const nextChars = Math.floor(narrationTextProgress);
        playTypewriterForRange(fullNarration, prevChars, nextChars, 0.9);
      }

      if (narrationTextProgress >= totalTextLen && !state.responseMode) {
        choicesAnim += dt * CHOICES_ANIM_SPEED;
      }

      updateLogHover(dt);
      updateDossierHover(dt);

      if (wasKeyPressed('escape')) {
        if (settingsOpen) {
          settingsOpen = false;
        } else {
          pauseOpen = !pauseOpen;
          pauseSelectedIndex = 0;
        }
        return;
      }

      if (pauseOpen) {
        if (settingsOpen) {
          if (pauseSettingsVolumeDragActive) {
            if (isMouseDown(0) && settingsRects.hitTest) {
              settingsRects.hitTest(getMousePos());
            } else {
              pauseSettingsVolumeDragActive = false;
            }
          }
          if (pauseSettingsCrtDragActive) {
            if (isMouseDown(0) && settingsRects.hitTest) {
              settingsRects.hitTest(getMousePos());
            } else {
              pauseSettingsCrtDragActive = false;
            }
          }

          if (wasKeyPressed('arrowleft') || wasKeyPressed('a')) {
            settingsRects.cycleLanguage?.(-1);
            return;
          }
          if (wasKeyPressed('arrowright') || wasKeyPressed('d')) {
            settingsRects.cycleLanguage?.(1);
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
            const mouse = getMousePos();
            if (settingsRects.volumeHitRect && inRect(mouse, settingsRects.volumeHitRect)) {
              pauseSettingsVolumeDragActive = true;
            }
            if (settingsRects.crtHitRect && inRect(mouse, settingsRects.crtHitRect)) {
              pauseSettingsCrtDragActive = true;
            }
            if (settingsRects.hitTest) {
              settingsRects.hitTest(mouse);
            }
          }
          return;
        }

        if (wasKeyPressed('arrowup') || wasKeyPressed('w')) {
          pauseSelectedIndex = (pauseSelectedIndex - 1 + pauseRects.length) % pauseRects.length;
          return;
        }
        if (wasKeyPressed('arrowdown') || wasKeyPressed('s')) {
          pauseSelectedIndex = (pauseSelectedIndex + 1) % pauseRects.length;
          return;
        }
        if (wasKeyPressed('enter')) {
          const selected = pauseRects[pauseSelectedIndex];
          if (selected?.key === 'continue') {
            pauseOpen = false;
          } else if (selected?.key === 'settings') {
            settingsOpen = true;
          } else if (selected?.key === 'quit') {
            setScene('menu');
          }
          return;
        }

        if (wasMousePressed(0)) {
          const mouse = getMousePos();
          for (let i = 0; i < pauseRects.length; i += 1) {
            const rect = pauseRects[i];
            if (
              mouse.x >= rect.x &&
              mouse.x <= rect.x + rect.w &&
              mouse.y >= rect.y &&
              mouse.y <= rect.y + rect.h
            ) {
              pauseSelectedIndex = i;
              if (rect.key === 'continue') {
                pauseOpen = false;
              } else if (rect.key === 'settings') {
                settingsOpen = true;
              } else if (rect.key === 'quit') {
                setScene('menu');
              }
              return;
            }
          }
        }
        return;
      }

      if (wasKeyPressed('r')) {
        resetRun();
        narrationTextProgress = 0;
        choicesAnim = 0;
        return;
      }

      if (!state.responseMode && narrationTextProgress < totalTextLen && wasKeyPressed('enter')) {
        narrationTextProgress = totalTextLen;
        return;
      }

      if (!state.responseMode && narrationTextProgress >= totalTextLen) {
        const wheel = getPlatformScrollDelta();
        if (wheel !== 0) {
          const mouse = getMousePos();
          const overNarration = inRect(mouse, narrationBodyRect);
          if (overNarration && narrationMaxScroll > 0) {
            setScrollTarget(
              'play.narration',
              getScrollTarget('play.narration') + toUnifiedScrollLines(wheel),
              narrationMaxScroll
            );
            return;
          }
        }
      }

      if (state.responseMode) {
        const wheel = getPlatformScrollDelta();
        if (wheel !== 0) {
          const mouse = getMousePos();
          const overQuestion = inRect(mouse, dialogueQuestionRect);
          const overAnswer = inRect(mouse, dialogueAnswerRect);
          const delta = toUnifiedScrollLines(wheel);
          if (overQuestion && questionMaxScroll > 0) {
            setScrollTarget(
              'play.question',
              getScrollTarget('play.question') + delta,
              questionMaxScroll
            );
          } else if (overAnswer && answerMaxScroll > 0) {
            setScrollTarget('play.answer', getScrollTarget('play.answer') + delta, answerMaxScroll);
          } else {
            setScrollTarget('play.answer', getScrollTarget('play.answer') + delta, answerMaxScroll);
          }
        }
        handleResponseMode(dt);
        return;
      }

      if (!state.responseMode && state.currentNode?.choices && !logExpanded && !dossierExpanded) {
        const wheel = getPlatformScrollDelta();
        if (wheel !== 0) {
          setScrollTarget(
            'play.choice',
            getScrollTarget('play.choice') + toUnifiedScrollPixels(wheel),
            choiceMaxScroll
          );
        }
      }

      if (narrationTextProgress < totalTextLen) {
        return;
      }

      const choices = state.currentNode?.choices || [];
      for (let i = 0; i < Math.min(9, choices.length); i += 1) {
        if (wasKeyPressed(String(i + 1))) {
          pickChoice(i);
          return;
        }
      }

      if (wasMousePressed(0) && state.choiceRects.length > 0 && !logExpanded && !dossierExpanded) {
        const mouse = getMousePos();
        for (const rect of state.choiceRects) {
          if (inRect(mouse, rect)) {
            pickChoice(rect.index);
            return;
          }
        }
      }
    },
    render() {
      drawPlayScene(ctx);
    },
  });
}
