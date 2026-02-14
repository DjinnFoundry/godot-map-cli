/**
 * Core tilemap editing operations: place, read, erase, fill tiles.
 * Works directly on .tscn files via the scene parser.
 */

import { readFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { decodeTileData, encodeTileData } from '../core/tile-data.js';
import { parseTscn, parseTscnText, findTileMapLayers, updateTileMapData } from '../core/scene-parser.js';
import type { TileCell, TileMapLayerInfo, TileMapBounds, Rect } from '../types/index.js';

const MAX_RENDER_AREA = 10000;

export function resolvePath(input: string, projectPath: string): string {
  if (!input) throw new Error('Path is required');
  if (input.startsWith('res://')) return join(projectPath, input.slice(6));
  if (isAbsolute(input)) return input;
  return join(projectPath, input);
}

function getLayer(layers: TileMapLayerInfo[], layerName: string): TileMapLayerInfo {
  const layer = layers.find(l => l.name === layerName);
  if (!layer) {
    const available = layers.map(l => l.name).join(', ');
    throw new Error(`Layer "${layerName}" not found. Available: ${available}`);
  }
  return layer;
}

function getCells(layer: TileMapLayerInfo): TileCell[] {
  return layer.tileMapDataB64 ? decodeTileData(layer.tileMapDataB64) : [];
}

function cellMap(cells: TileCell[]): Map<string, TileCell> {
  const m = new Map<string, TileCell>();
  for (const c of cells) m.set(`${c.x},${c.y}`, c);
  return m;
}

function computeBounds(cells: TileCell[]): TileMapBounds | null {
  if (cells.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of cells) {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { min_x: minX, max_x: maxX, min_y: minY, max_y: maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// ---- List tilemaps in project ----

export async function listTileMaps(projectPath: string): Promise<Array<{
  scene: string;
  absolute_path: string;
  layers: Array<{
    name: string;
    tile_count: number;
    has_data: boolean;
    tileset_ref: string | null;
    z_index: number;
    visible: boolean;
  }>;
}>> {
  const { findScenes } = await import('../core/project.js');
  const scenes = await findScenes(projectPath);
  const results: Array<{
    scene: string;
    absolute_path: string;
    layers: Array<{
      name: string;
      tile_count: number;
      has_data: boolean;
      tileset_ref: string | null;
      z_index: number;
      visible: boolean;
    }>;
  }> = [];

  for (const scenePath of scenes) {
    const fp = join(projectPath, scenePath);
    const text = await readFile(fp, 'utf-8');
    if (!text.includes('type="TileMapLayer"')) continue;

    const parsed = parseTscnText(text);
    const layers = findTileMapLayers(parsed);
    if (layers.length === 0) continue;

    results.push({
      scene: scenePath,
      absolute_path: fp,
      layers: layers.map(l => ({
        name: l.name,
        tile_count: l.tileMapDataB64 ? decodeTileData(l.tileMapDataB64).length : 0,
        has_data: !!l.tileMapDataB64,
        tileset_ref: l.tileSetRef,
        z_index: l.zIndex,
        visible: l.visible,
      })),
    });
  }

  return results;
}

// ---- Get tilemap info ----

export async function getTileMapInfo(
  scenePath: string,
  layerName?: string
): Promise<Array<{
  name: string;
  tile_count: number;
  bounds: TileMapBounds | null;
  tileset_ref: string | null;
  z_index: number;
  visible: boolean;
}>> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);

  return layers
    .filter(l => !layerName || l.name === layerName)
    .map(l => {
      const cells = getCells(l);
      return {
        name: l.name,
        tile_count: cells.length,
        bounds: computeBounds(cells),
        tileset_ref: l.tileSetRef,
        z_index: l.zIndex,
        visible: l.visible,
      };
    });
}

// ---- Read tiles ----

export async function readTiles(
  scenePath: string,
  layerName: string,
  region?: Rect
): Promise<{ layer: string; tile_count: number; tiles: TileCell[] }> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);
  const layer = getLayer(layers, layerName);

  let cells = getCells(layer);

  if (region) {
    cells = cells.filter(c =>
      c.x >= region.x && c.x < region.x + region.width &&
      c.y >= region.y && c.y < region.y + region.height
    );
  }

  return { layer: layer.name, tile_count: cells.length, tiles: cells };
}

// ---- Set tiles ----

export async function setTiles(
  scenePath: string,
  layerName: string,
  tiles: TileCell[]
): Promise<{ total_tiles: number; tiles_set: number }> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);
  const layer = getLayer(layers, layerName);

  const existing = getCells(layer);
  const map = cellMap(existing);

  for (const t of tiles) {
    map.set(`${t.x},${t.y}`, {
      x: t.x,
      y: t.y,
      source_id: t.source_id,
      atlas_x: t.atlas_x,
      atlas_y: t.atlas_y,
      alt: t.alt ?? 0,
    });
  }

  const allCells = Array.from(map.values());
  const newB64 = encodeTileData(allCells);
  await updateTileMapData(scenePath, layerName, newB64);

  return { total_tiles: allCells.length, tiles_set: tiles.length };
}

// ---- Fill rectangle ----

export async function fillRect(
  scenePath: string,
  layerName: string,
  rect: Rect,
  sourceId: number,
  atlasX: number,
  atlasY: number,
  alt = 0
): Promise<{ total_tiles: number; tiles_filled: number }> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);
  const layer = getLayer(layers, layerName);

  const existing = getCells(layer);
  const map = cellMap(existing);

  let count = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      map.set(`${x},${y}`, {
        x, y,
        source_id: sourceId,
        atlas_x: atlasX,
        atlas_y: atlasY,
        alt,
      });
      count++;
    }
  }

  const allCells = Array.from(map.values());
  const newB64 = encodeTileData(allCells);
  await updateTileMapData(scenePath, layerName, newB64);

  return { total_tiles: allCells.length, tiles_filled: count };
}

// ---- Erase tiles ----

export async function eraseTiles(
  scenePath: string,
  layerName: string,
  positions: Array<{ x: number; y: number }>
): Promise<{ total_tiles: number; tiles_erased: number }> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);
  const layer = getLayer(layers, layerName);

  const existing = getCells(layer);
  const toErase = new Set(positions.map(p => `${p.x},${p.y}`));
  const remaining = existing.filter(c => !toErase.has(`${c.x},${c.y}`));

  const newB64 = encodeTileData(remaining);
  await updateTileMapData(scenePath, layerName, newB64);

  return { total_tiles: remaining.length, tiles_erased: existing.length - remaining.length };
}

// ---- Erase rectangle ----

export async function eraseRect(
  scenePath: string,
  layerName: string,
  rect: Rect
): Promise<{ total_tiles: number; tiles_erased: number }> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);
  const layer = getLayer(layers, layerName);

  const existing = getCells(layer);
  const remaining = existing.filter(c =>
    !(c.x >= rect.x && c.x < rect.x + rect.width &&
      c.y >= rect.y && c.y < rect.y + rect.height)
  );

  const newB64 = encodeTileData(remaining);
  await updateTileMapData(scenePath, layerName, newB64);

  return { total_tiles: remaining.length, tiles_erased: existing.length - remaining.length };
}

// ---- Render ASCII ----

export async function renderTileMap(
  scenePath: string,
  layerName: string,
  mode: 'source' | 'atlas' = 'source',
  region?: Rect
): Promise<{ render: string; bounds: TileMapBounds | null; tile_count: number }> {
  const parsed = await parseTscn(scenePath);
  const layers = findTileMapLayers(parsed);
  const layer = getLayer(layers, layerName);

  let cells = getCells(layer);
  if (cells.length === 0) return { render: '(empty layer)', bounds: null, tile_count: 0 };

  if (region) {
    cells = cells.filter(c =>
      c.x >= region.x && c.x < region.x + region.width &&
      c.y >= region.y && c.y < region.y + region.height
    );
  }

  if (cells.length === 0) return { render: '(no tiles in region)', bounds: null, tile_count: 0 };

  const bounds = computeBounds(cells)!;

  if (bounds.width * bounds.height > MAX_RENDER_AREA) {
    return {
      render: `(region too large for ASCII: ${bounds.width}x${bounds.height}. Use a smaller region filter.)`,
      bounds,
      tile_count: cells.length,
    };
  }

  const map = cellMap(cells);
  const lines: string[] = [];

  // Column headers
  const colNums = [];
  for (let x = bounds.min_x; x <= bounds.max_x; x++) {
    colNums.push(String(x).padStart(3));
  }
  lines.push('     ' + colNums.join(' '));

  for (let y = bounds.min_y; y <= bounds.max_y; y++) {
    const rowLabel = String(y).padStart(4) + ' ';
    const row: string[] = [];
    for (let x = bounds.min_x; x <= bounds.max_x; x++) {
      const c = map.get(`${x},${y}`);
      if (!c) {
        row.push(' . ');
      } else if (mode === 'atlas') {
        row.push(`${c.atlas_x}.${c.atlas_y}`.padStart(3));
      } else {
        const ch = c.source_id < 10 ? String(c.source_id) : String.fromCharCode(55 + c.source_id);
        row.push(` ${ch} `);
      }
    }
    lines.push(rowLabel + row.join(' '));
  }

  return { render: lines.join('\n'), bounds, tile_count: cells.length };
}
