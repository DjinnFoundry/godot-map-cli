/**
 * Village generator: creates a simple village layout with houses and paths.
 */

import type { TileCell } from '../types/index.js';
import { makeTile, fillRectTiles, seededRandom, type TilePalette, DEFAULT_PALETTE } from './base-generator.js';

const DEFAULT_HOUSE_COUNT = 3;
const MIN_HOUSE_WIDTH = 3;
const MAX_HOUSE_WIDTH_EXTRA = 3;  // house width = MIN + floor(rng * this)
const MIN_HOUSE_HEIGHT = 3;
const MAX_HOUSE_HEIGHT_EXTRA = 2;
const MAX_PLACEMENT_ATTEMPTS = 20;
const HOUSE_MARGIN = 2;

export interface VillageOptions {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  houseCount?: number;
  seed?: number;
  palette?: Partial<TilePalette>;
}

interface House {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Generate a village layout with houses connected by L-shaped paths.
 *
 * Limitations:
 * - Max 20 placement attempts per house; houses are silently skipped if they don't fit
 * - Fixed 2-tile margin between houses (not configurable)
 * - Inter-house paths are always L-shaped (horizontal then vertical)
 * - House sizes are random: 3-5 wide, 3-4 tall
 */
export function generateVillage(options: VillageOptions): {
  ground: TileCell[];
  buildings: TileCell[];
  details: TileCell[];
} {
  const {
    centerX,
    centerY,
    width,
    height,
    houseCount = DEFAULT_HOUSE_COUNT,
    seed = 42,
  } = options;
  const palette = { ...DEFAULT_PALETTE, ...options.palette };
  const rng = seededRandom(seed);

  const startX = centerX - Math.floor(width / 2);
  const startY = centerY - Math.floor(height / 2);

  // Fill ground
  const ground = fillRectTiles(startX, startY, width, height, palette.ground);

  const buildings: TileCell[] = [];
  const details: TileCell[] = [];
  const houses: House[] = [];

  // Place houses
  for (let i = 0; i < houseCount; i++) {
    const houseW = MIN_HOUSE_WIDTH + Math.floor(rng() * MAX_HOUSE_WIDTH_EXTRA);
    const houseH = MIN_HOUSE_HEIGHT + Math.floor(rng() * MAX_HOUSE_HEIGHT_EXTRA);

    let placed = false;
    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt++) {
      const hx = startX + 1 + Math.floor(rng() * (width - houseW - HOUSE_MARGIN));
      const hy = startY + 1 + Math.floor(rng() * (height - houseH - HOUSE_MARGIN));

      // Check overlap with existing houses (with 1-tile margin)
      const overlaps = houses.some(h =>
        hx < h.x + h.w + HOUSE_MARGIN && hx + houseW + HOUSE_MARGIN > h.x &&
        hy < h.y + h.h + HOUSE_MARGIN && hy + houseH + HOUSE_MARGIN > h.y
      );

      if (!overlaps) {
        houses.push({ x: hx, y: hy, w: houseW, h: houseH });

        // Walls (perimeter)
        for (let dx = 0; dx < houseW; dx++) {
          for (let dy = 0; dy < houseH; dy++) {
            if (dx === 0 || dx === houseW - 1 || dy === 0 || dy === houseH - 1) {
              buildings.push(makeTile(hx + dx, hy + dy, palette.wall));
            }
          }
        }

        // Roof (top row)
        for (let dx = 0; dx < houseW; dx++) {
          buildings.push(makeTile(hx + dx, hy, palette.roof));
        }

        // Door (bottom center)
        const doorX = hx + Math.floor(houseW / 2);
        buildings.push(makeTile(doorX, hy + houseH - 1, palette.door));

        placed = true;
        break;
      }
    }
  }

  // Connect houses with paths
  if (houses.length >= 2) {
    for (let i = 0; i < houses.length - 1; i++) {
      const from = {
        x: houses[i].x + Math.floor(houses[i].w / 2),
        y: houses[i].y + houses[i].h,
      };
      const to = {
        x: houses[i + 1].x + Math.floor(houses[i + 1].w / 2),
        y: houses[i + 1].y + houses[i + 1].h,
      };

      // L-shaped path
      const midX = from.x;
      const midY = to.y;

      // Horizontal segment
      const xStart = Math.min(from.x, to.x);
      const xEnd = Math.max(from.x, to.x);
      for (let x = xStart; x <= xEnd; x++) {
        details.push(makeTile(x, midY, palette.path));
      }

      // Vertical segment
      const yStart = Math.min(from.y, midY);
      const yEnd = Math.max(from.y, midY);
      for (let y = yStart; y <= yEnd; y++) {
        details.push(makeTile(midX, y, palette.path));
      }
    }
  }

  return { ground, buildings, details };
}
