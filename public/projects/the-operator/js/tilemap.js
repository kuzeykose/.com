export function tileIdToFrame(id, tilesetMeta) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return null;
  }

  const localId = numericId - (tilesetMeta.startId || 0);
  if (localId < 0) {
    return null;
  }

  const col = localId % tilesetMeta.columns;
  const row = Math.floor(localId / tilesetMeta.columns);

  return {
    x: col * tilesetMeta.tileWidth,
    y: row * tilesetMeta.tileHeight,
    w: tilesetMeta.tileWidth,
    h: tilesetMeta.tileHeight,
  };
}

function isBlockingTile(tile, layer, colliderIds) {
  if (layer.collider) {
    return true;
  }

  if (!colliderIds || colliderIds.size === 0) {
    return false;
  }

  return colliderIds.has(tile.id);
}

function createCollisionGrid(mapWidth, mapHeight, layers, colliderIds) {
  const grid = Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false));

  for (const layer of layers) {
    for (const tile of layer.tiles) {
      if (tile.x < 0 || tile.y < 0 || tile.x >= mapWidth || tile.y >= mapHeight) {
        continue;
      }

      if (isBlockingTile(tile, layer, colliderIds)) {
        grid[tile.y][tile.x] = true;
      }
    }
  }

  return grid;
}

function findLayerByNames(layers, names) {
  if (!Array.isArray(names) || names.length === 0) {
    return null;
  }

  const lookup = new Set(names.map((name) => String(name).toLowerCase()));
  return layers.find((layer) => lookup.has(String(layer.name).toLowerCase())) || null;
}

function tileToWorldCenter(tile, tileSize) {
  return {
    x: tile.x * tileSize + tileSize / 2,
    y: tile.y * tileSize + tileSize / 2,
  };
}

function extractSpawns(layers, tileSize, options = {}) {
  const spawnLayer = findLayerByNames(layers, options.spawnLayerNames || []);
  const spawnByType = {
    player: null,
    enemy: null,
    goal: null,
  };

  if (!spawnLayer) {
    return spawnByType;
  }

  const ids = options.spawnTileIds || {};
  const buckets = {
    player: new Set((ids.player || []).map(Number)),
    enemy: new Set((ids.enemy || []).map(Number)),
    goal: new Set((ids.goal || []).map(Number)),
  };

  for (const tile of spawnLayer.tiles) {
    const center = tileToWorldCenter(tile, tileSize);

    if (!spawnByType.player && buckets.player.has(tile.id)) {
      spawnByType.player = center;
      continue;
    }
    if (!spawnByType.enemy && buckets.enemy.has(tile.id)) {
      spawnByType.enemy = center;
      continue;
    }
    if (!spawnByType.goal && buckets.goal.has(tile.id)) {
      spawnByType.goal = center;
    }
  }

  return spawnByType;
}

export function isBlockedAtWorldPos(x, y, mapData) {
  if (!mapData || !mapData.collisionGrid) {
    return false;
  }

  const tx = Math.floor(x / mapData.tileSize);
  const ty = Math.floor(y / mapData.tileSize);

  if (tx < 0 || ty < 0 || tx >= mapData.mapWidth || ty >= mapData.mapHeight) {
    return true;
  }

  return mapData.collisionGrid[ty][tx];
}

export function isRectBlocked(rect, mapData) {
  if (!mapData || !mapData.collisionGrid) {
    return false;
  }

  const samplePoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w - 1, y: rect.y },
    { x: rect.x, y: rect.y + rect.h - 1 },
    { x: rect.x + rect.w - 1, y: rect.y + rect.h - 1 },
  ];

  return samplePoints.some((point) => isBlockedAtWorldPos(point.x, point.y, mapData));
}

export function moveWithCollisions(entity, dx, dy, mapData) {
  if (!mapData || !mapData.collisionGrid) {
    entity.x += dx;
    entity.y += dy;
    return;
  }

  const nextX = { x: entity.x + dx, y: entity.y, w: entity.w, h: entity.h };
  if (!isRectBlocked(nextX, mapData)) {
    entity.x = nextX.x;
  }

  const nextY = { x: entity.x, y: entity.y + dy, w: entity.w, h: entity.h };
  if (!isRectBlocked(nextY, mapData)) {
    entity.y = nextY.y;
  }
}

export async function loadTilemap(path, options = {}) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load tilemap: ${path}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.layers)) {
    throw new Error('Invalid map format: expected layers array.');
  }

  const normalized = {
    tileSize: Number(data.tileSize) || 16,
    mapWidth: Number(data.mapWidth) || 0,
    mapHeight: Number(data.mapHeight) || 0,
    layers: data.layers.map((layer) => ({
      name: layer.name || 'layer',
      collider: Boolean(layer.collider),
      tiles: Array.isArray(layer.tiles)
        ? layer.tiles.map((tile) => ({
            id: Number(tile.id),
            x: Number(tile.x),
            y: Number(tile.y),
          }))
        : [],
    })),
  };

  const colliderIds = new Set((options.colliderTileIds || []).map(Number));
  normalized.collisionGrid = createCollisionGrid(
    normalized.mapWidth,
    normalized.mapHeight,
    normalized.layers,
    colliderIds
  );
  normalized.spawns = extractSpawns(normalized.layers, normalized.tileSize, options);

  if (data.tileset && typeof data.tileset === 'object') {
    normalized.tileset = {
      columns: Number(data.tileset.columns) || null,
      tileWidth: Number(data.tileset.tileWidth) || normalized.tileSize,
      tileHeight: Number(data.tileset.tileHeight) || normalized.tileSize,
      startId: Number(data.tileset.startId) || 0,
    };
  } else {
    normalized.tileset = null;
  }

  return normalized;
}
