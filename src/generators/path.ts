/**
 * Path generator: creates a winding path between two points.
 * Uses a simplified A*-like approach with randomized waypoints.
 */

import type { TileCell } from '../types/index.js';
import { makeTile, seededRandom, type TilePalette, DEFAULT_PALETTE } from './base-generator.js';

const WAYPOINT_DISTANCE_DIVISOR = 10;
const WANDER_FACTOR = 0.3;

export interface PathOptions {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  width?: number;   // path width (1-3)
  style?: 'straight' | 'winding' | 'l-shaped';
  seed?: number;
  palette?: Partial<TilePalette>;
}

/**
 * Generate a path between two points using Bresenham line with optional waypoints.
 *
 * Limitations:
 * - Distances < 10 tiles produce nearly straight paths (only 1 waypoint)
 * - Path widening creates square expansion (not organic/rounded)
 * - No obstacle avoidance; paths go through anything
 * - Winding paths can self-intersect on tight curves
 */
export function generatePath(options: PathOptions): TileCell[] {
  const {
    fromX, fromY, toX, toY,
    width: pathWidth = 1,
    style = 'winding',
    seed = 42,
  } = options;
  const palette = { ...DEFAULT_PALETTE, ...options.palette };
  const rng = seededRandom(seed);

  const points: Array<{ x: number; y: number }> = [];

  if (style === 'straight') {
    points.push(...bresenhamLine(fromX, fromY, toX, toY));
  } else if (style === 'l-shaped') {
    // Go horizontal first, then vertical
    const midX = toX;
    points.push(...bresenhamLine(fromX, fromY, midX, fromY));
    points.push(...bresenhamLine(midX, fromY, toX, toY));
  } else {
    // Winding: add random waypoints
    const dx = toX - fromX;
    const dy = toY - fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const waypointCount = Math.max(1, Math.floor(dist / WAYPOINT_DISTANCE_DIVISOR));

    const waypoints: Array<{ x: number; y: number }> = [{ x: fromX, y: fromY }];
    for (let i = 1; i <= waypointCount; i++) {
      const t = i / (waypointCount + 1);
      const baseX = fromX + dx * t;
      const baseY = fromY + dy * t;
      // Add perpendicular offset
      const perpX = -dy / dist;
      const perpY = dx / dist;
      const offset = (rng() - 0.5) * dist * WANDER_FACTOR;
      waypoints.push({
        x: Math.round(baseX + perpX * offset),
        y: Math.round(baseY + perpY * offset),
      });
    }
    waypoints.push({ x: toX, y: toY });

    for (let i = 0; i < waypoints.length - 1; i++) {
      points.push(...bresenhamLine(
        waypoints[i].x, waypoints[i].y,
        waypoints[i + 1].x, waypoints[i + 1].y
      ));
    }
  }

  // Widen path
  const tiles: TileCell[] = [];
  const seen = new Set<string>();

  for (const p of points) {
    const halfW = Math.floor(pathWidth / 2);
    for (let dy = -halfW; dy <= halfW; dy++) {
      for (let dx = -halfW; dx <= halfW; dx++) {
        const key = `${p.x + dx},${p.y + dy}`;
        if (!seen.has(key)) {
          seen.add(key);
          tiles.push(makeTile(p.x + dx, p.y + dy, palette.path));
        }
      }
    }
  }

  return tiles;
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  let x = x0;
  let y = y0;

  while (true) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}
