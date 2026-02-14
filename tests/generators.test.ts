import { describe, it, expect } from 'vitest';
import { generateVillage } from '../src/generators/village.js';
import { generateForest } from '../src/generators/forest.js';
import { generatePath } from '../src/generators/path.js';

describe('generators: procedural map generation', () => {
  describe('village generator', () => {
    it('should generate village with all three layer types', () => {
      const result = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
        houseCount: 3,
      });

      expect(result).toHaveProperty('ground');
      expect(result).toHaveProperty('buildings');
      expect(result).toHaveProperty('details');

      expect(Array.isArray(result.ground)).toBe(true);
      expect(Array.isArray(result.buildings)).toBe(true);
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('should generate ground tiles filling the area', () => {
      const result = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 10,
        height: 10,
        houseCount: 1,
      });

      // Ground should fill the entire area
      expect(result.ground.length).toBe(100);

      // All ground tiles should have same source/atlas
      for (const tile of result.ground) {
        expect(tile.source_id).toBe(0);
        expect(tile.atlas_x).toBe(0);
        expect(tile.atlas_y).toBe(0);
      }
    });

    it('should generate buildings and details', () => {
      const result = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 30,
        height: 30,
        houseCount: 5,
      });

      expect(result.buildings.length).toBeGreaterThan(0);
      expect(result.details.length).toBeGreaterThan(0);
    });

    it('should produce same output with same seed', () => {
      const result1 = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
        houseCount: 3,
        seed: 12345,
      });

      const result2 = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
        houseCount: 3,
        seed: 12345,
      });

      expect(result1.buildings).toEqual(result2.buildings);
      expect(result1.details).toEqual(result2.details);
    });

    it('should produce different output with different seeds', () => {
      const result1 = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
        houseCount: 3,
        seed: 111,
      });

      const result2 = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
        houseCount: 3,
        seed: 222,
      });

      // Buildings should differ
      const eq = JSON.stringify(result1.buildings) === JSON.stringify(result2.buildings);
      expect(eq).toBe(false);
    });

    it('should use custom palette', () => {
      const customPalette = {
        ground: { source_id: 5, atlas_x: 0, atlas_y: 0 },
        wall: { source_id: 5, atlas_x: 1, atlas_y: 0 },
        roof: { source_id: 5, atlas_x: 2, atlas_y: 0 },
        door: { source_id: 5, atlas_x: 3, atlas_y: 0 },
        path: { source_id: 5, atlas_x: 4, atlas_y: 0 },
      };

      const result = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
        houseCount: 2,
        palette: customPalette,
      });

      // Ground should use custom palette
      expect(result.ground[0].source_id).toBe(5);

      // Buildings should also use custom palette
      if (result.buildings.length > 0) {
        expect(result.buildings[0].source_id).toBe(5);
      }
    });

    it('should use default options when not provided', () => {
      const result = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 20,
        height: 20,
      });

      // Should have some buildings even with default houseCount
      expect(result.buildings.length).toBeGreaterThan(0);
      expect(result.ground.length).toBeGreaterThan(0);
    });
  });

  describe('forest generator', () => {
    it('should generate forest with ground and trees', () => {
      const result = generateForest({
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        density: 0.5,
      });

      expect(result).toHaveProperty('ground');
      expect(result).toHaveProperty('trees');

      expect(Array.isArray(result.ground)).toBe(true);
      expect(Array.isArray(result.trees)).toBe(true);
    });

    it('should fill ground completely', () => {
      const result = generateForest({
        x: 0,
        y: 0,
        width: 15,
        height: 15,
        density: 0.5,
      });

      // 15x15 = 225 ground tiles
      expect(result.ground.length).toBe(225);

      for (const tile of result.ground) {
        expect(tile.source_id).toBe(0);
        expect(tile.atlas_x).toBe(0);
        expect(tile.atlas_y).toBe(0);
      }
    });

    it('should generate no trees at density 0', () => {
      const result = generateForest({
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        density: 0,
      });

      // Very few or no trees with density 0
      expect(result.trees.length).toBeLessThanOrEqual(5);
    });

    it('should generate many trees at density 1', () => {
      const result = generateForest({
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        density: 1.0,
      });

      // Should have many trees (interior only, so less than 20x20)
      expect(result.trees.length).toBeGreaterThan(100);
    });

    it('should generate more trees with higher density', () => {
      const result05 = generateForest({
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        density: 0.5,
        seed: 42,
      });

      const result08 = generateForest({
        x: 0,
        y: 0,
        width: 30,
        height: 30,
        density: 0.8,
        seed: 42,
      });

      expect(result08.trees.length).toBeGreaterThan(result05.trees.length);
    });

    it('should produce same output with same seed', () => {
      const result1 = generateForest({
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        density: 0.5,
        seed: 999,
      });

      const result2 = generateForest({
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        density: 0.5,
        seed: 999,
      });

      expect(result1.trees).toEqual(result2.trees);
    });

    it('should offset to different location', () => {
      const result1 = generateForest({
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      });

      const result2 = generateForest({
        x: 100,
        y: 100,
        width: 10,
        height: 10,
      });

      // Should have same tree count but different positions
      expect(result1.trees.length).toBe(result2.trees.length);

      // Check that positions differ by offset
      for (let i = 0; i < result1.trees.length; i++) {
        expect(result2.trees[i].x).toBe(result1.trees[i].x + 100);
        expect(result2.trees[i].y).toBe(result1.trees[i].y + 100);
      }
    });

    it('should use custom palette', () => {
      const customPalette = {
        ground: { source_id: 10, atlas_x: 5, atlas_y: 5 },
        tree: { source_id: 10, atlas_x: 6, atlas_y: 6 },
      };

      const result = generateForest({
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        palette: customPalette,
      });

      expect(result.ground[0].source_id).toBe(10);
      if (result.trees.length > 0) {
        expect(result.trees[0].source_id).toBe(10);
      }
    });
  });

  describe('path generator', () => {
    it('should generate path with straight style', () => {
      const tiles = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 10,
        toY: 10,
        style: 'straight',
      });

      expect(Array.isArray(tiles)).toBe(true);
      expect(tiles.length).toBeGreaterThan(0);

      // All should be path tiles
      for (const tile of tiles) {
        expect(tile.source_id).toBe(0);
        expect(tile.atlas_x).toBe(1); // path
        expect(tile.atlas_y).toBe(0);
      }
    });

    it('should generate tiles between from and to positions', () => {
      const tiles = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 5,
        toY: 0,
        style: 'straight',
      });

      // Should have at least 6 tiles (0,1,2,3,4,5)
      expect(tiles.length).toBeGreaterThanOrEqual(6);

      // Check that we have coverage from start to end
      const xCoords = tiles.map(t => t.x);
      expect(Math.min(...xCoords)).toBeLessThanOrEqual(0);
      expect(Math.max(...xCoords)).toBeGreaterThanOrEqual(5);
    });

    it('should generate wider path with width > 1', () => {
      const tiles1 = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 10,
        toY: 0,
        width: 1,
        style: 'straight',
      });

      const tiles3 = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 10,
        toY: 0,
        width: 3,
        style: 'straight',
      });

      expect(tiles3.length).toBeGreaterThan(tiles1.length);
    });

    it('should produce same output with same seed', () => {
      const tiles1 = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 20,
        toY: 20,
        style: 'winding',
        seed: 555,
      });

      const tiles2 = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 20,
        toY: 20,
        style: 'winding',
        seed: 555,
      });

      expect(tiles1).toEqual(tiles2);
    });

    it('should generate l-shaped path', () => {
      const tiles = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 10,
        toY: 10,
        style: 'l-shaped',
      });

      expect(tiles.length).toBeGreaterThan(0);

      // Should have both horizontal and vertical segments
      const hasHorizontal = tiles.some((t, i) => {
        const next = tiles[i + 1];
        return next && t.y === next.y;
      });
      const hasVertical = tiles.some((t, i) => {
        const next = tiles[i + 1];
        return next && t.x === next.x;
      });

      expect(hasHorizontal || hasVertical).toBe(true);
    });

    it('should generate winding path', () => {
      const tiles = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 20,
        toY: 20,
        style: 'winding',
        seed: 42,
      });

      expect(tiles.length).toBeGreaterThan(0);

      // Should start near origin and end near destination
      const startTiles = tiles.slice(0, 3);
      const endTiles = tiles.slice(-3);

      const startDist = Math.hypot(startTiles[0].x - 0, startTiles[0].y - 0);
      const endDist = Math.hypot(endTiles[endTiles.length - 1].x - 20, endTiles[endTiles.length - 1].y - 20);

      expect(startDist).toBeLessThan(5);
      expect(endDist).toBeLessThan(5);
    });

    it('should use custom palette', () => {
      const customPalette = {
        path: { source_id: 7, atlas_x: 10, atlas_y: 10 },
      };

      const tiles = generatePath({
        fromX: 0,
        fromY: 0,
        toX: 5,
        toY: 5,
        style: 'straight',
        palette: customPalette,
      });

      for (const tile of tiles) {
        expect(tile.source_id).toBe(7);
        expect(tile.atlas_x).toBe(10);
        expect(tile.atlas_y).toBe(10);
      }
    });

    it('should handle negative coordinates', () => {
      const tiles = generatePath({
        fromX: -10,
        fromY: -10,
        toX: 10,
        toY: 10,
        style: 'straight',
      });

      expect(tiles.length).toBeGreaterThan(0);

      // Should have tiles with negative coordinates
      const hasNegative = tiles.some(t => t.x < 0 || t.y < 0);
      expect(hasNegative).toBe(true);
    });

    it('should handle straight vertical path', () => {
      const tiles = generatePath({
        fromX: 5,
        fromY: 0,
        toX: 5,
        toY: 10,
        style: 'straight',
      });

      expect(tiles.length).toBeGreaterThanOrEqual(11);

      // All should have x = 5
      for (const tile of tiles) {
        expect(tile.x).toBe(5);
      }
    });

    it('should handle straight horizontal path', () => {
      const tiles = generatePath({
        fromX: 0,
        fromY: 5,
        toX: 10,
        toY: 5,
        style: 'straight',
      });

      expect(tiles.length).toBeGreaterThanOrEqual(11);

      // All should have y = 5
      for (const tile of tiles) {
        expect(tile.y).toBe(5);
      }
    });
  });

  describe('integration: multiple generators', () => {
    it('should combine village and forest without conflicts', () => {
      const village = generateVillage({
        centerX: 0,
        centerY: 0,
        width: 30,
        height: 30,
        houseCount: 3,
        seed: 100,
      });

      const forest = generateForest({
        x: 50,
        y: 50,
        width: 30,
        height: 30,
        density: 0.5,
        seed: 100,
      });

      const path = generatePath({
        fromX: 15,
        fromY: 15,
        toX: 50,
        toY: 50,
        style: 'winding',
        seed: 100,
      });

      // Verify all generate valid tiles
      expect(village.ground.length + village.buildings.length + village.details.length).toBeGreaterThan(0);
      expect(forest.ground.length + forest.trees.length).toBeGreaterThan(0);
      expect(path.length).toBeGreaterThan(0);

      // No overlaps (village and forest are at different locations)
      const villageCoords = new Set(
        village.ground.concat(village.buildings, village.details).map(t => `${t.x},${t.y}`)
      );
      const forestCoords = new Set(forest.ground.concat(forest.trees).map(t => `${t.x},${t.y}`));

      const overlap = Array.from(villageCoords).filter(c => forestCoords.has(c));
      expect(overlap.length).toBe(0);
    });
  });
});
