import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  setTiles,
  fillRect,
  eraseTiles,
  eraseRect,
  renderTileMap,
  getTileMapInfo,
  readTiles,
} from '../src/tilemap/tilemap-editor.js';
import { generateTileMapScene } from '../src/core/scene-writer.js';
import type { TileCell } from '../src/types/index.js';

describe('tilemap-editor: core editing operations', () => {
  let tempDir: string;
  let sceneFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-tilemap-'));
    sceneFile = join(tempDir, 'test.tscn');

    // Generate a test scene with a Ground layer
    const scene = generateTileMapScene([
      {
        name: 'Ground',
        tileSetPath: 'res://tilesets/main.tres',
      },
    ]);

    await writeFile(sceneFile, scene, 'utf-8');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('setTiles', () => {
    it('should place tiles in empty layer', async () => {
      const tiles: TileCell[] = [
        { x: 0, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
        { x: 1, y: 0, source_id: 0, atlas_x: 1, atlas_y: 0, alt: 0 },
      ];

      const result = await setTiles(sceneFile, 'Ground', tiles);

      expect(result.tiles_set).toBe(2);
      expect(result.total_tiles).toBe(2);
    });

    it('should read back placed tiles', async () => {
      const tiles: TileCell[] = [
        { x: 5, y: 5, source_id: 0, atlas_x: 2, atlas_y: 3, alt: 0 },
        { x: 6, y: 5, source_id: 1, atlas_x: 5, atlas_y: 2, alt: 1 },
      ];

      await setTiles(sceneFile, 'Ground', tiles);
      const read = await readTiles(sceneFile, 'Ground');

      expect(read.tile_count).toBe(2);
      expect(read.tiles).toHaveLength(2);

      // Verify all fields match
      for (let i = 0; i < tiles.length; i++) {
        expect(read.tiles[i]).toEqual(tiles[i]);
      }
    });

    it('should preserve existing tiles (merge behavior)', async () => {
      const tiles1: TileCell[] = [
        { x: 0, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
        { x: 1, y: 0, source_id: 0, atlas_x: 1, atlas_y: 0, alt: 0 },
      ];

      await setTiles(sceneFile, 'Ground', tiles1);

      const tiles2: TileCell[] = [
        { x: 2, y: 0, source_id: 0, atlas_x: 2, atlas_y: 0, alt: 0 },
      ];

      const result = await setTiles(sceneFile, 'Ground', tiles2);

      // Should now have 3 total tiles
      expect(result.total_tiles).toBe(3);
      expect(result.tiles_set).toBe(1);

      const read = await readTiles(sceneFile, 'Ground');
      expect(read.tile_count).toBe(3);
    });

    it('should overwrite existing tile at same position', async () => {
      const tiles1: TileCell[] = [
        { x: 0, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
      ];

      await setTiles(sceneFile, 'Ground', tiles1);

      const tiles2: TileCell[] = [
        { x: 0, y: 0, source_id: 1, atlas_x: 5, atlas_y: 5, alt: 2 },
      ];

      const result = await setTiles(sceneFile, 'Ground', tiles2);

      // Should still be 1 tile total
      expect(result.total_tiles).toBe(1);

      const read = await readTiles(sceneFile, 'Ground');
      expect(read.tiles[0].source_id).toBe(1);
      expect(read.tiles[0].atlas_x).toBe(5);
      expect(read.tiles[0].atlas_y).toBe(5);
    });
  });

  describe('fillRect', () => {
    it('should fill rectangular area with tiles', async () => {
      const result = await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 3, height: 3 }, 0, 0, 0);

      expect(result.tiles_filled).toBe(9);
      expect(result.total_tiles).toBe(9);
    });

    it('should read back all filled tiles', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 2, height: 2 }, 0, 1, 1);

      const read = await readTiles(sceneFile, 'Ground');

      expect(read.tile_count).toBe(4);
      for (const tile of read.tiles) {
        expect(tile.source_id).toBe(0);
        expect(tile.atlas_x).toBe(1);
        expect(tile.atlas_y).toBe(1);
      }
    });

    it('should fill with correct atlas coordinates', async () => {
      await fillRect(sceneFile, 'Ground', { x: 5, y: 5, width: 2, height: 2 }, 2, 7, 8);

      const read = await readTiles(sceneFile, 'Ground');

      for (const tile of read.tiles) {
        expect(tile.source_id).toBe(2);
        expect(tile.atlas_x).toBe(7);
        expect(tile.atlas_y).toBe(8);
      }
    });

    it('should support 1x1 fill', async () => {
      const result = await fillRect(sceneFile, 'Ground', { x: 10, y: 10, width: 1, height: 1 }, 0, 0, 0);

      expect(result.tiles_filled).toBe(1);

      const read = await readTiles(sceneFile, 'Ground');
      expect(read.tile_count).toBe(1);
      expect(read.tiles[0]).toEqual({
        x: 10,
        y: 10,
        source_id: 0,
        atlas_x: 0,
        atlas_y: 0,
        alt: 0,
      });
    });

    it('should fill large areas', async () => {
      const result = await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 50, height: 50 }, 0, 1, 1);

      expect(result.tiles_filled).toBe(2500);
      expect(result.total_tiles).toBe(2500);
    });
  });

  describe('eraseTiles', () => {
    it('should erase specific tiles by position', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 5, height: 5 }, 0, 0, 0);

      const toErase = [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];

      const result = await eraseTiles(sceneFile, 'Ground', toErase);

      expect(result.tiles_erased).toBe(3);
      expect(result.total_tiles).toBe(22); // 25 - 3

      const read = await readTiles(sceneFile, 'Ground');
      expect(read.tile_count).toBe(22);
    });

    it('should handle erasing non-existent tiles', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 3, height: 3 }, 0, 0, 0);

      const toErase = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];

      const result = await eraseTiles(sceneFile, 'Ground', toErase);

      // Should erase 0 tiles
      expect(result.tiles_erased).toBe(0);
      expect(result.total_tiles).toBe(9);
    });

    it('should erase all tiles when erasing all positions', async () => {
      const tiles: TileCell[] = [
        { x: 0, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
        { x: 1, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
      ];

      await setTiles(sceneFile, 'Ground', tiles);

      const result = await eraseTiles(sceneFile, 'Ground', [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]);

      expect(result.tiles_erased).toBe(2);
      expect(result.total_tiles).toBe(0);

      const read = await readTiles(sceneFile, 'Ground');
      expect(read.tile_count).toBe(0);
    });
  });

  describe('eraseRect', () => {
    it('should erase rectangular area', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 10, height: 10 }, 0, 0, 0);

      const result = await eraseRect(sceneFile, 'Ground', { x: 2, y: 2, width: 4, height: 4 });

      expect(result.tiles_erased).toBe(16); // 4x4
      expect(result.total_tiles).toBe(84); // 100 - 16
    });

    it('should handle erasing entire area', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 5, height: 5 }, 0, 0, 0);

      const result = await eraseRect(sceneFile, 'Ground', { x: 0, y: 0, width: 5, height: 5 });

      expect(result.tiles_erased).toBe(25);
      expect(result.total_tiles).toBe(0);
    });

    it('should erase partial overlap correctly', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 5, height: 5 }, 0, 0, 0);

      // Erase outside bounds
      const result = await eraseRect(sceneFile, 'Ground', { x: 3, y: 3, width: 5, height: 5 });

      // Should erase 2x2 overlap (only (3,3), (3,4), (4,3), (4,4))
      expect(result.tiles_erased).toBe(4);
      expect(result.total_tiles).toBe(21);
    });
  });

  describe('renderTileMap', () => {
    it('should render empty layer', async () => {
      const result = await renderTileMap(sceneFile, 'Ground');

      expect(result.render).toContain('empty');
      expect(result.tile_count).toBe(0);
      expect(result.bounds).toBeNull();
    });

    it('should render tiles in source mode', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 3, height: 3 }, 0, 0, 0);

      const result = await renderTileMap(sceneFile, 'Ground', 'source');

      expect(result.render).toBeTruthy();
      expect(result.tile_count).toBe(9);
      expect(result.bounds).toBeDefined();
      expect(result.bounds!.width).toBe(3);
      expect(result.bounds!.height).toBe(3);
    });

    it('should render with atlas coordinates', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 2, height: 2 }, 1, 5, 7);

      const result = await renderTileMap(sceneFile, 'Ground', 'atlas');

      expect(result.render).toContain('5');
      expect(result.render).toContain('7');
    });

    it('should respect region filter', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 10, height: 10 }, 0, 0, 0);

      const result = await renderTileMap(sceneFile, 'Ground', 'source', { x: 2, y: 2, width: 3, height: 3 });

      expect(result.tile_count).toBe(9);
      expect(result.bounds!.width).toBe(3);
      expect(result.bounds!.height).toBe(3);
    });

    it('should handle render of large area message', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 200, height: 200 }, 0, 0, 0);

      const result = await renderTileMap(sceneFile, 'Ground');

      // Should warn about large region
      expect(result.render).toContain('large');
    });
  });

  describe('getTileMapInfo', () => {
    it('should return layer information', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 5, height: 5 }, 0, 0, 0);

      const info = await getTileMapInfo(sceneFile);

      expect(info).toHaveLength(1);
      expect(info[0].name).toBe('Ground');
      expect(info[0].tile_count).toBe(25);
      expect(info[0].tileset_ref).toBe('res://tilesets/main.tres');
      expect(info[0].z_index).toBe(0);
      expect(info[0].visible).toBe(true);
    });

    it('should compute bounds correctly', async () => {
      await setTiles(sceneFile, 'Ground', [
        { x: -5, y: -5, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
        { x: 5, y: 5, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
      ]);

      const info = await getTileMapInfo(sceneFile);

      expect(info[0].bounds).toBeDefined();
      expect(info[0].bounds!.min_x).toBe(-5);
      expect(info[0].bounds!.max_x).toBe(5);
      expect(info[0].bounds!.min_y).toBe(-5);
      expect(info[0].bounds!.max_y).toBe(5);
      expect(info[0].bounds!.width).toBe(11);
      expect(info[0].bounds!.height).toBe(11);
    });

    it('should filter by layer name', async () => {
      const multiLayerScene = generateTileMapScene([
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres' },
        { name: 'Buildings', tileSetPath: 'res://tilesets/main.tres' },
      ]);

      const multiLayerFile = join(tempDir, 'multi.tscn');
      await writeFile(multiLayerFile, multiLayerScene, 'utf-8');

      const info = await getTileMapInfo(multiLayerFile, 'Ground');

      expect(info).toHaveLength(1);
      expect(info[0].name).toBe('Ground');
    });
  });

  describe('readTiles', () => {
    it('should read tiles from empty layer', async () => {
      const result = await readTiles(sceneFile, 'Ground');

      expect(result.layer).toBe('Ground');
      expect(result.tile_count).toBe(0);
      expect(result.tiles).toEqual([]);
    });

    it('should read all tiles', async () => {
      const tiles: TileCell[] = [
        { x: 0, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
        { x: 1, y: 1, source_id: 1, atlas_x: 5, atlas_y: 5, alt: 1 },
      ];

      await setTiles(sceneFile, 'Ground', tiles);

      const result = await readTiles(sceneFile, 'Ground');

      expect(result.tile_count).toBe(2);
      expect(result.tiles).toEqual(tiles);
    });

    it('should read tiles within region filter', async () => {
      await fillRect(sceneFile, 'Ground', { x: 0, y: 0, width: 10, height: 10 }, 0, 0, 0);

      const result = await readTiles(sceneFile, 'Ground', { x: 2, y: 2, width: 3, height: 3 });

      expect(result.tile_count).toBe(9);
      for (const tile of result.tiles) {
        expect(tile.x).toBeGreaterThanOrEqual(2);
        expect(tile.x).toBeLessThan(5);
        expect(tile.y).toBeGreaterThanOrEqual(2);
        expect(tile.y).toBeLessThan(5);
      }
    });
  });

  describe('error handling', () => {
    it('should throw for non-existent layer', async () => {
      await expect(setTiles(sceneFile, 'NonExistent', [])).rejects.toThrow();
    });

    it('should throw for non-existent layer in readTiles', async () => {
      await expect(readTiles(sceneFile, 'NonExistent')).rejects.toThrow();
    });
  });
});
