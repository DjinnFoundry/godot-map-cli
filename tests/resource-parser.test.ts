import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTileSet } from '../src/core/resource-parser.js';

describe('resource-parser: .tres TileSet parsing', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-tileset-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should parse basic tileset with tile_size', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.tileSize).toEqual({ x: 16, y: 16 });
  });

  it('should parse tileset sources', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].sourceIndex).toBe(0);
    expect(result.sources[0].texture).toBe('res://assets/tiles.png');
    expect(result.sources[0].textureRegionSize).toEqual({ x: 16, y: 16 });
  });

  it('should parse tile definitions in source', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)
0:0/0 = 0
1:0/0 = 0

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.sources[0].tiles).toHaveLength(2);
    expect(result.sources[0].tiles[0].atlas_x).toBe(0);
    expect(result.sources[0].tiles[0].atlas_y).toBe(0);
    expect(result.sources[0].tiles[1].atlas_x).toBe(1);
    expect(result.sources[0].tiles[1].atlas_y).toBe(0);
  });

  it('should extract texture reference from ext_resource', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/my_tileset.png" id="2"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("2")
texture_region_size = Vector2i(32, 32)

[resource]
tile_size = Vector2i(32, 32)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.sources[0].texture).toBe('res://assets/my_tileset.png');
    expect(result.extResources['2']).toBeDefined();
    expect(result.extResources['2'].path).toBe('res://assets/my_tileset.png');
  });

  it('should parse texture_region_size correctly', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(32, 48)

[resource]
tile_size = Vector2i(32, 48)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.sources[0].textureRegionSize).toEqual({ x: 32, y: 48 });
  });

  it('should handle custom data layers', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[resource]
tile_size = Vector2i(16, 16)
custom_data_layer_0/name = "walkable"
custom_data_layer_0/type = 1
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.customDataLayers).toHaveLength(1);
    expect(result.customDataLayers[0].name).toBe('walkable');
    expect(result.customDataLayers[0].type).toBe(1);
  });

  it('should handle terrain sets', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[resource]
tile_size = Vector2i(16, 16)
terrain_set_0/mode = 0
terrain_set_0/terrains/0/name = "grass"
terrain_set_0/terrains/0/color = Color(0.5, 0.8, 0.2, 1)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.terrainSets).toHaveLength(1);
    expect(result.terrainSets[0].mode).toBe(0);
    expect(result.terrainSets[0].terrains).toHaveLength(1);
    expect(result.terrainSets[0].terrains[0].name).toBe('grass');
  });

  it('should handle physics layers', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[resource]
tile_size = Vector2i(16, 16)
physics_layer_0/collision_layer = 1
physics_layer_0/collision_mask = 1
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.physicsLayers).toHaveLength(1);
    expect(result.physicsLayers[0].collision_layer).toBe(1);
    expect(result.physicsLayers[0].collision_mask).toBe(1);
  });

  it('should parse multiple sources', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles1.png" id="1"]
[ext_resource type="Texture2D" path="res://assets/tiles2.png" id="2"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_2"]
texture = ExtResource("2")
texture_region_size = Vector2i(32, 32)

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
sources/1 = SubResource("TileSetAtlasSource_2")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].sourceIndex).toBe(0);
    expect(result.sources[0].texture).toBe('res://assets/tiles1.png');
    expect(result.sources[1].sourceIndex).toBe(1);
    expect(result.sources[1].texture).toBe('res://assets/tiles2.png');
    expect(result.sources[1].textureRegionSize).toEqual({ x: 32, y: 32 });
  });

  it('should parse tile definitions with alternatives', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)
0:0/0 = 0
0:0/1 = 0
0:0/2 = 0
1:0/0 = 0

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    const source = result.sources[0];
    // Should have 3 tiles for position (0,0) with different alternatives
    const tile00s = source.tiles.filter(t => t.atlas_x === 0 && t.atlas_y === 0);
    expect(tile00s.length).toBe(3);
    expect(tile00s[0].alt).toBe(0);
    expect(tile00s[1].alt).toBe(1);
    expect(tile00s[2].alt).toBe(2);
  });

  it('should handle tiles with custom data', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)
0:0/0 = 0
0:0/0/custom_data_0 = true

[resource]
tile_size = Vector2i(16, 16)
custom_data_layer_0/name = "walkable"
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    const tile = result.sources[0].tiles[0];
    expect(tile.customData).toBeDefined();
    expect(tile.customData[0]).toBe(true);
  });

  it('should throw error if no resource section found', async () => {
    const INVALID_TRES = `[gd_resource type="TileSet" format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]
`;

    const filePath = join(tempDir, 'invalid.tres');
    await writeFile(filePath, INVALID_TRES, 'utf-8');

    await expect(parseTileSet(filePath)).rejects.toThrow('No [resource] section found');
  });

  it('should handle default values', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")

[resource]
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    // Should have default tile_size
    expect(result.tileSize).toEqual({ x: 16, y: 16 });
    // Should have default textureRegionSize
    expect(result.sources[0].textureRegionSize).toEqual({ x: 16, y: 16 });
  });

  it('should parse resource_name for sources', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=2 format=3]

[ext_resource type="Texture2D" path="res://assets/tiles.png" id="1"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)
resource_name = "MainTileset"

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(result.sources[0].resourceName).toBe('MainTileset');
  });

  it('should preserve ext_resources mapping', async () => {
    const TILESET_TRES = `[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="Texture2D" uid="uid://abc" path="res://assets/tiles.png" id="1"]
[ext_resource type="Script" path="res://TileSetScript.gd" id="2"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_1"]
texture = ExtResource("1")
texture_region_size = Vector2i(16, 16)

[resource]
tile_size = Vector2i(16, 16)
sources/0 = SubResource("TileSetAtlasSource_1")
`;

    const filePath = join(tempDir, 'test.tres');
    await writeFile(filePath, TILESET_TRES, 'utf-8');

    const result = await parseTileSet(filePath);

    expect(Object.keys(result.extResources)).toHaveLength(2);
    expect(result.extResources['1'].type).toBe('Texture2D');
    expect(result.extResources['1'].uid).toBe('uid://abc');
    expect(result.extResources['2'].type).toBe('Script');
  });
});
