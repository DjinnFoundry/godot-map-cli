import { describe, it, expect } from 'vitest';
import { parseTscnText, findTileMapLayers, buildExtResourceMap } from '../src/core/scene-parser.js';

describe('scene-parser: .tscn file parsing', () => {
  const MINIMAL_SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]
`;

  const SCENE_WITH_LAYERS = `[gd_scene load_steps=2 format=3]

[ext_resource type="TileSet" uid="uid://abc" path="res://tilesets/main.tres" id="1"]

[node name="World" type="Node2D"]

[node name="Ground" type="TileMapLayer" parent="."]
tile_set = ExtResource("1")
z_index = 0
tile_map_data = PackedByteArray("AAAAAAAAAAAAAAAAAAA=")

[node name="Buildings" type="TileMapLayer" parent="."]
tile_set = ExtResource("1")
z_index = 1
visible = false
`;

  describe('parseTscnText', () => {
    it('should parse minimal scene with gd_scene and node sections', () => {
      const result = parseTscnText(MINIMAL_SCENE);

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].type).toBe('gd_scene');
      expect(result.sections[1].type).toBe('node');
      expect(result.sections[1].attrs.name).toBe('Root');
      expect(result.sections[1].attrs.type).toBe('Node2D');
    });

    it('should parse scene header attributes correctly', () => {
      const result = parseTscnText(SCENE_WITH_LAYERS);

      const gd_scene = result.sections[0];
      expect(gd_scene.type).toBe('gd_scene');
      expect(gd_scene.attrs.load_steps).toBe('2');
      expect(gd_scene.attrs.format).toBe('3');
    });

    it('should parse ext_resource section attributes', () => {
      const result = parseTscnText(SCENE_WITH_LAYERS);

      const extRes = result.sections.find(s => s.type === 'ext_resource');
      expect(extRes).toBeDefined();
      expect(extRes!.attrs.type).toBe('TileSet');
      expect(extRes!.attrs.uid).toBe('uid://abc');
      expect(extRes!.attrs.path).toBe('res://tilesets/main.tres');
      expect(extRes!.attrs.id).toBe('1');
    });

    it('should parse node properties with values', () => {
      const result = parseTscnText(SCENE_WITH_LAYERS);

      const groundLayer = result.sections.find(s => s.type === 'node' && s.attrs.name === 'Ground');
      expect(groundLayer).toBeDefined();

      const tileSetProp = groundLayer!.properties.find(p => p.key === 'tile_set');
      expect(tileSetProp).toBeDefined();
      expect(tileSetProp!.value).toContain('ExtResource("1")');

      const tileMapDataProp = groundLayer!.properties.find(p => p.key === 'tile_map_data');
      expect(tileMapDataProp).toBeDefined();
      expect(tileMapDataProp!.value).toContain('PackedByteArray');
    });
  });

  describe('buildExtResourceMap', () => {
    it('should create map of ext_resources keyed by id', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const map = buildExtResourceMap(parsed);

      expect(map).toHaveProperty('1');
      expect(map['1'].type).toBe('TileSet');
      expect(map['1'].path).toBe('res://tilesets/main.tres');
      expect(map['1'].uid).toBe('uid://abc');
    });

    it('should return empty map when no ext_resources exist', () => {
      const parsed = parseTscnText(MINIMAL_SCENE);
      const map = buildExtResourceMap(parsed);

      expect(map).toEqual({});
    });
  });

  describe('findTileMapLayers', () => {
    it('should find TileMapLayer nodes with all metadata', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      expect(layers).toHaveLength(2);
    });

    it('should extract Ground layer metadata correctly', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      const groundLayer = layers.find(l => l.name === 'Ground');
      expect(groundLayer).toBeDefined();
      expect(groundLayer!.name).toBe('Ground');
      expect(groundLayer!.parent).toBe('.');
      expect(groundLayer!.zIndex).toBe(0);
      expect(groundLayer!.visible).toBe(true);
      expect(groundLayer!.tileSetExtId).toBe('1');
      expect(groundLayer!.tileSetRef).toBe('res://tilesets/main.tres');
    });

    it('should extract Building layer with visible=false', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      const buildingLayer = layers.find(l => l.name === 'Buildings');
      expect(buildingLayer).toBeDefined();
      expect(buildingLayer!.name).toBe('Buildings');
      expect(buildingLayer!.zIndex).toBe(1);
      expect(buildingLayer!.visible).toBe(false);
    });

    it('should extract tile_map_data as base64 string', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      const groundLayer = layers.find(l => l.name === 'Ground');
      expect(groundLayer!.tileMapDataB64).toBe('AAAAAAAAAAAAAAAAAAA=');
    });

    it('should handle layers without tile_map_data', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      const buildingLayer = layers.find(l => l.name === 'Buildings');
      expect(buildingLayer!.tileMapDataB64).toBeNull();
    });

    it('should return empty array when no TileMapLayers exist', () => {
      const parsed = parseTscnText(MINIMAL_SCENE);
      const layers = findTileMapLayers(parsed);

      expect(layers).toEqual([]);
    });

    it('should handle default position when not specified', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      const groundLayer = layers[0];
      expect(groundLayer.position).toEqual({ x: 0, y: 0 });
    });

    it('should parse Vector2 position when specified', () => {
      const sceneWithPosition = `[gd_scene format=3]

[ext_resource type="TileSet" uid="uid://abc" path="res://tilesets/main.tres" id="1"]

[node name="World" type="Node2D"]

[node name="Layer" type="TileMapLayer" parent="."]
tile_set = ExtResource("1")
position = Vector2( 10.5, 20.5 )
`;

      const parsed = parseTscnText(sceneWithPosition);
      const layers = findTileMapLayers(parsed);

      expect(layers[0].position).toEqual({ x: 10.5, y: 20.5 });
    });

    it('should store reference to original section', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const layers = findTileMapLayers(parsed);

      expect(layers[0].section).toBeDefined();
      expect(layers[0].section.type).toBe('node');
      expect(layers[0].section.attrs.type).toBe('TileMapLayer');
    });
  });

  describe('integration: parsing complete scene', () => {
    it('should correctly parse scene with multiple layers and resources', () => {
      const parsed = parseTscnText(SCENE_WITH_LAYERS);
      const extResources = buildExtResourceMap(parsed);
      const layers = findTileMapLayers(parsed);

      expect(parsed.sections.length).toBeGreaterThan(0);
      expect(Object.keys(extResources)).toHaveLength(1);
      expect(layers).toHaveLength(2);

      // All layers should reference existing tileset
      for (const layer of layers) {
        expect(extResources[layer.tileSetExtId!]).toBeDefined();
      }
    });
  });
});
