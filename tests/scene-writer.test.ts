import { describe, it, expect } from 'vitest';
import { generateScene, generateTileMapScene } from '../src/core/scene-writer.js';
import { parseTscnText, findTileMapLayers, buildExtResourceMap } from '../src/core/scene-parser.js';

describe('scene-writer: generate .tscn scenes', () => {
  describe('generateScene', () => {
    it('should generate minimal scene with Node2D root by default', () => {
      const scene = generateScene();

      expect(scene).toContain('[gd_scene format=3]');
      expect(scene).toContain('[node name="Root" type="Node2D"]');
    });

    it('should generate scene with custom root type and name', () => {
      const scene = generateScene({
        rootNodeType: 'Control',
        rootNodeName: 'Canvas',
      });

      expect(scene).toContain('[node name="Canvas" type="Control"]');
      expect(scene).not.toContain('type="Node2D"');
    });

    it('should generate valid .tscn that can be parsed', () => {
      const scene = generateScene();
      const parsed = parseTscnText(scene);

      expect(parsed.sections).toHaveLength(2);
      expect(parsed.sections[0].type).toBe('gd_scene');
      expect(parsed.sections[1].type).toBe('node');
    });
  });

  describe('generateTileMapScene', () => {
    it('should create scene with single layer', () => {
      const layers = [
        {
          name: 'Ground',
          tileSetPath: 'res://tilesets/main.tres',
        },
      ];

      const scene = generateTileMapScene(layers);

      expect(scene).toContain('[gd_scene load_steps=2 format=3]');
      expect(scene).toContain('[ext_resource type="TileSet"');
      expect(scene).toContain('path="res://tilesets/main.tres"');
      expect(scene).toContain('[node name="Ground" type="TileMapLayer"');
      expect(scene).toContain('tile_set = ExtResource("1")');
    });

    it('should generate correct load_steps for multiple layers with shared tileset', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres' },
        { name: 'Buildings', tileSetPath: 'res://tilesets/main.tres' },
      ];

      const scene = generateTileMapScene(layers);

      // Should have load_steps=2 (1 tileset + 1 root node)
      expect(scene).toContain('load_steps=2');
    });

    it('should generate unique ext_resource for each different tileset', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres' },
        { name: 'Details', tileSetPath: 'res://tilesets/details.tres' },
        { name: 'Objects', tileSetPath: 'res://tilesets/main.tres' }, // duplicate
      ];

      const scene = generateTileMapScene(layers);

      // Should have load_steps=3 (2 unique tilesets + 1 root node)
      expect(scene).toContain('load_steps=3');
      expect(scene).toContain('id="1"');
      expect(scene).toContain('id="2"');
      expect(scene).not.toContain('id="3"');
    });

    it('should set z_index when specified', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres', zIndex: 0 },
        { name: 'Buildings', tileSetPath: 'res://tilesets/main.tres', zIndex: 1 },
      ];

      const scene = generateTileMapScene(layers);

      expect(scene).toContain('z_index = 1');
    });

    it('should not set z_index when 0', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres', zIndex: 0 },
      ];

      const scene = generateTileMapScene(layers);

      // Should not output z_index = 0 (redundant)
      expect(scene).not.toContain('z_index = 0');
    });

    it('should set visible=false when specified', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres' },
        { name: 'Hidden', tileSetPath: 'res://tilesets/main.tres', visible: false },
      ];

      const scene = generateTileMapScene(layers);

      expect(scene).toContain('visible = false');
    });

    it('should include tileset uid when provided', () => {
      const layers = [
        {
          name: 'Ground',
          tileSetPath: 'res://tilesets/main.tres',
          tileSetUid: 'uid://abc123',
        },
      ];

      const scene = generateTileMapScene(layers);

      expect(scene).toContain('uid="uid://abc123"');
    });

    it('should use custom root node type and name', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres' },
      ];

      const scene = generateTileMapScene(layers, {
        rootNodeType: 'Node',
        rootNodeName: 'GameWorld',
      });

      expect(scene).toContain('[node name="GameWorld" type="Node"]');
    });

    it('should generate parseable scene output', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres', zIndex: 0 },
        { name: 'Buildings', tileSetPath: 'res://tilesets/main.tres', zIndex: 1 },
      ];

      const scene = generateTileMapScene(layers);
      const parsed = parseTscnText(scene);
      const extResources = buildExtResourceMap(parsed);
      const foundLayers = findTileMapLayers(parsed);

      expect(Object.keys(extResources)).toHaveLength(1);
      expect(foundLayers).toHaveLength(2);
      expect(foundLayers[0].name).toBe('Ground');
      expect(foundLayers[1].name).toBe('Buildings');
      expect(foundLayers[0].tileSetRef).toBe('res://tilesets/main.tres');
      expect(foundLayers[1].tileSetRef).toBe('res://tilesets/main.tres');
    });

    it('should generate scene with multiple tilesets and layers', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres', zIndex: 0 },
        { name: 'Water', tileSetPath: 'res://tilesets/water.tres', zIndex: 0 },
        { name: 'Buildings', tileSetPath: 'res://tilesets/main.tres', zIndex: 1 },
        { name: 'Details', tileSetPath: 'res://tilesets/details.tres', zIndex: 2 },
      ];

      const scene = generateTileMapScene(layers);
      const parsed = parseTscnText(scene);
      const extResources = buildExtResourceMap(parsed);

      expect(Object.keys(extResources)).toHaveLength(3);
      expect(extResources['1']).toBeDefined();
      expect(extResources['2']).toBeDefined();
      expect(extResources['3']).toBeDefined();
    });

    it('should handle empty layer list', () => {
      const scene = generateTileMapScene([]);

      expect(scene).toContain('[gd_scene load_steps=1 format=3]');
      expect(scene).toContain('[node name="World" type="Node2D"]');
    });
  });

  describe('integration: roundtrip', () => {
    it('should generate scene that parses and re-generates identically', () => {
      const layers = [
        { name: 'Ground', tileSetPath: 'res://tilesets/main.tres', zIndex: 0 },
        { name: 'Buildings', tileSetPath: 'res://tilesets/main.tres', zIndex: 1, visible: false },
      ];

      const scene1 = generateTileMapScene(layers);
      const parsed1 = parseTscnText(scene1);
      const foundLayers1 = findTileMapLayers(parsed1);

      // Verify we can read what we generated
      expect(foundLayers1).toHaveLength(2);
      expect(foundLayers1[0].zIndex).toBe(0);
      expect(foundLayers1[1].zIndex).toBe(1);
      expect(foundLayers1[1].visible).toBe(false);
    });
  });
});
