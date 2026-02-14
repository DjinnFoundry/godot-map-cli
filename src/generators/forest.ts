/**
 * Forest generator: creates clusters of trees with clearings.
 */

import type { TileCell } from '../types/index.js';
import { makeTile, fillRectTiles, seededRandom, type TilePalette, DEFAULT_PALETTE } from './base-generator.js';

const DEFAULT_DENSITY = 0.5;
const EDGE_BORDER = 1;
const EDGE_FACTOR_DIVISOR = 3;

export interface ForestOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  density?: number; // 0.0 - 1.0
  seed?: number;
  palette?: Partial<TilePalette>;
}

/**
 * Generate a forest with clustered trees.
 *
 * Limitations:
 * - 1-tile border is always ground (trees never at edges)
 * - Clustering uses distance-from-edge only (no Perlin noise)
 * - Actual tree density is not uniform; decreases near edges
 */
export function generateForest(options: ForestOptions): {
  ground: TileCell[];
  trees: TileCell[];
} {
  const {
    x, y, width, height,
    density = DEFAULT_DENSITY,
    seed = 42,
  } = options;
  const palette = { ...DEFAULT_PALETTE, ...options.palette };
  const rng = seededRandom(seed);

  // Fill with ground
  const ground = fillRectTiles(x, y, width, height, palette.ground);

  // Place trees using noise-like distribution
  const trees: TileCell[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      // Skip edges (1-tile border of ground)
      if (dx === 0 || dx === width - EDGE_BORDER || dy === 0 || dy === height - EDGE_BORDER) continue;

      // Weighted random with clustering
      const cx = x + dx;
      const cy = y + dy;
      const noiseVal = rng();

      // Create natural-looking clusters using a simple approach:
      // higher density in the center, clearings near edges
      const edgeDist = Math.min(dx, dy, width - EDGE_BORDER - dx, height - EDGE_BORDER - dy);
      const edgeFactor = Math.min(1, edgeDist / EDGE_FACTOR_DIVISOR);
      const threshold = 1.0 - (density * edgeFactor);

      if (noiseVal > threshold) {
        trees.push(makeTile(cx, cy, palette.tree));
      }
    }
  }

  return { ground, trees };
}
