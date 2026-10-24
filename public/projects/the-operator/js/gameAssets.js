export const ASSETS = {
  images: {
    mapTileset: './assets/spritesheet.png',
    dungeon: './assets/0x72_DungeonTilesetII_v1.7.png',
  },
  audio: {},
};

export const MAP_TILESET_KEY = 'mapTileset';
export const ACTOR_TILESET_KEY = 'dungeon';

export const TILE_RENDER = {
  size: 16,
  sourceInset: 0,
};

export const TILESET_META = {
  columns: 8,
  tileWidth: 16,
  tileHeight: 16,
  startId: 0,
};

export const MAP_CONFIG = {
  path: './assets/map.json',
};

export const MAP_PARSE_CONFIG = {
  spawnLayerNames: ['spawns', 'spawn', 'spawn_points'],
  spawnTileIds: {
    player: [],
    enemy: [],
    goal: [],
  },
};

function frame(x, y, w = 16, h = 16) {
  return { x, y, w, h };
}

export const PLAYER_ANIMATIONS = {
  idle: [
    frame(128, 68, 16, 28),
    frame(144, 68, 16, 28),
    frame(160, 68, 16, 28),
    frame(176, 68, 16, 28),
  ],
  run: [
    frame(192, 68, 16, 28),
    frame(208, 68, 16, 28),
    frame(224, 68, 16, 28),
    frame(240, 68, 16, 28),
  ],
};

export const ENEMY_ANIMATIONS = {
  idle: [frame(368, 40), frame(384, 40), frame(400, 40), frame(416, 40)],
  run: [frame(432, 40), frame(448, 40), frame(464, 40), frame(480, 40)],
};

export const DECOR_FRAMES = {
  banner: frame(16, 32),
  skull: frame(288, 432),
  crate: frame(288, 408, 16, 24),
};

export const GOAL_SPRITE_FRAME = frame(304, 416, 16, 16);

export const ENVIRONMENT_ANIMATIONS = {
  spikes: [frame(16, 192), frame(32, 192), frame(48, 192), frame(64, 192)],
  fountainTop: [frame(64, 0), frame(80, 0), frame(96, 0)],
  fountainMid: [frame(64, 16), frame(80, 16), frame(96, 16)],
  fountainBasin: [frame(64, 32), frame(80, 32), frame(96, 32)],
};
