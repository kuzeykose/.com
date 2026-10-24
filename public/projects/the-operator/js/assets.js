const images = new Map();
const audios = new Map();

function loadImage(name, src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      images.set(name, image);
      resolve();
    };
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function loadAudio(name, src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const onReady = () => {
      audios.set(name, audio);
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`Failed to load audio: ${src}`));
    };
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onError);
    };

    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = src;
    audio.load();
  });
}

export async function preloadAssets(config = {}, onProgress) {
  const imageEntries = Object.entries(config.images || {});
  const audioEntries = Object.entries(config.audio || {});
  const total = imageEntries.length + audioEntries.length;

  if (total === 0) {
    if (onProgress) {
      onProgress(1);
    }
    return;
  }

  let loaded = 0;
  const progress = () => {
    loaded += 1;
    if (onProgress) {
      onProgress(loaded / total);
    }
  };

  const tasks = [];

  for (const [name, src] of imageEntries) {
    tasks.push(loadImage(name, src).then(progress));
  }

  for (const [name, src] of audioEntries) {
    tasks.push(loadAudio(name, src).then(progress));
  }

  await Promise.all(tasks);
}

export function getImage(name) {
  return images.get(name) || null;
}

export function getAudio(name) {
  return audios.get(name) || null;
}
