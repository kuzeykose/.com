import { getImage } from './assets.js';

export function createSpriteSheet(frameWidth, frameHeight, frameCount, startX = 0, startY = 0) {
  const frames = [];
  for (let i = 0; i < frameCount; i += 1) {
    frames.push({
      x: startX + i * frameWidth,
      y: startY,
      w: frameWidth,
      h: frameHeight,
    });
  }
  return frames;
}

export function createAnimation({ image, frames, fps = 8, loop = true, autoPlay = true }) {
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('Animation requires at least one frame.');
  }

  const state = {
    image,
    frames,
    fps,
    frameDuration: 1 / fps,
    loop,
    playing: autoPlay,
    timer: 0,
    frameIndex: 0,
    finished: false,
  };

  function update(dt) {
    if (!state.playing || state.finished) {
      return;
    }

    state.timer += dt;
    while (state.timer >= state.frameDuration) {
      state.timer -= state.frameDuration;
      state.frameIndex += 1;

      if (state.frameIndex >= state.frames.length) {
        if (state.loop) {
          state.frameIndex = 0;
        } else {
          state.frameIndex = state.frames.length - 1;
          state.playing = false;
          state.finished = true;
          break;
        }
      }
    }
  }

  function play(reset = false) {
    if (reset) {
      state.frameIndex = 0;
      state.timer = 0;
      state.finished = false;
    }
    state.playing = true;
  }

  function pause() {
    state.playing = false;
  }

  function stop() {
    state.playing = false;
    state.frameIndex = 0;
    state.timer = 0;
    state.finished = false;
  }

  function setFrames(nextFrames, reset = true) {
    if (!Array.isArray(nextFrames) || nextFrames.length === 0) {
      throw new Error('setFrames requires at least one frame.');
    }

    state.frames = nextFrames;
    if (reset) {
      state.frameIndex = 0;
      state.timer = 0;
      state.finished = false;
    } else {
      state.frameIndex = Math.min(state.frameIndex, state.frames.length - 1);
    }
  }

  function setImage(nextImage) {
    state.image = nextImage;
  }

  function setFPS(nextFPS) {
    const value = Number(nextFPS);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error('FPS must be a positive number.');
    }
    state.fps = value;
    state.frameDuration = 1 / value;
  }

  function getFrame() {
    return state.frames[state.frameIndex];
  }

  return {
    update,
    play,
    pause,
    stop,
    setFrames,
    setImage,
    setFPS,
    getFrame,
    get image() {
      return state.image;
    },
    get frameIndex() {
      return state.frameIndex;
    },
    get playing() {
      return state.playing;
    },
    get finished() {
      return state.finished;
    },
  };
}

export function createAnimationSet(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Animation set config must be an object.');
  }

  const animations = new Map();
  let currentName = '';
  let current = null;

  for (const [name, definition] of Object.entries(config)) {
    const image =
      definition.image || (definition.imageName ? getImage(definition.imageName) : null);

    const anim = createAnimation({
      image,
      frames: definition.frames,
      fps: definition.fps,
      loop: definition.loop,
      autoPlay: definition.autoPlay,
    });

    animations.set(name, anim);
    if (!current) {
      current = anim;
      currentName = name;
    }
  }

  if (!current) {
    throw new Error('Animation set requires at least one animation.');
  }

  function play(name, reset = true) {
    const next = animations.get(name);
    if (!next) {
      throw new Error(`Animation not found: ${name}`);
    }

    if (next !== current) {
      current.pause();
      current = next;
      currentName = name;
      current.play(reset);
      return;
    }

    current.play(reset);
  }

  function update(dt) {
    current.update(dt);
  }

  function getCurrentFrame() {
    return current.getFrame();
  }

  function getCurrentImage() {
    return current.image;
  }

  function getCurrentName() {
    return currentName;
  }

  function getAnimation(name) {
    return animations.get(name) || null;
  }

  return {
    play,
    update,
    getCurrentFrame,
    getCurrentImage,
    getCurrentName,
    getAnimation,
  };
}
