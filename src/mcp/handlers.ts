/**
 * MCP tool handlers: route tool calls to core functions.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createProject, getProjectInfo } from '../core/project.js';
import { createTileSet, registerTiles, setTileCollision, addTerrain } from '../tileset/tileset-writer.js';
import { parseTileSet } from '../core/resource-parser.js';
import { generateScene, generateTileMapScene, addLayerToScene, removeLayerFromScene } from '../core/scene-writer.js';
import {
  listTileMaps,
  getTileMapInfo,
  readTiles,
  renderTileMap,
  setTiles,
  fillRect,
  eraseTiles,
  eraseRect,
} from '../tilemap/tilemap-editor.js';
import { generateVillage } from '../generators/village.js';
import { generateForest } from '../generators/forest.js';
import { generatePath } from '../generators/path.js';
import { findGodot } from '../core/godot-finder.js';
import { runGDScript, generateTerrainScript, generateScreenshotScript } from '../core/godot-runner.js';
import {
  requireString,
  optionalString,
  requireNumber,
  optionalNumber,
  requirePositiveInt,
  optionalBoolean,
  requireArray,
  optionalArray,
  optionalObject,
} from './validation.js';

type Args = Record<string, unknown>;

function json(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function text(msg: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: msg }] };
}

export async function handleTool(name: string, args: Args) {
  switch (name) {
    // ---- Project ----
    case 'godot_project_init': {
      const path = requireString(args, 'path');
      const name = requireString(args, 'name');
      await createProject(path, name);
      return text(`Project "${name}" created at ${path}`);
    }
    case 'godot_project_info': {
      const path = requireString(args, 'path');
      const info = await getProjectInfo(path);
      return json(info);
    }

    // ---- TileSet ----
    case 'godot_tileset_create': {
      const name = requireString(args, 'name');
      const imagePath = requireString(args, 'image_path');
      const tileSize = requirePositiveInt(args, 'tile_size');
      const projectPath = requireString(args, 'project_path');
      const outputPath = requireString(args, 'output_path');
      const physicsLayer = optionalBoolean(args, 'physics_layer');

      const resPath = await createTileSet({
        name,
        imagePath,
        tileSize,
        outputPath: join(projectPath, outputPath),
        projectPath,
        physicsLayer,
      });
      return text(`TileSet created: ${resPath}`);
    }
    case 'godot_tileset_inspect': {
      const tilesetPath = requireString(args, 'tileset_path');
      const info = await parseTileSet(tilesetPath);
      return json(info);
    }

    case 'godot_tileset_register_tiles': {
      const tilesetPath = requireString(args, 'tileset_path');
      const tiles = requireArray<{ atlas_x: number; atlas_y: number; alt?: number }>(args, 'tiles');
      await registerTiles(tilesetPath, tiles);
      return text(`Registered ${tiles.length} tiles in ${tilesetPath}`);
    }
    case 'godot_tileset_set_collision': {
      const tilesetPath = requireString(args, 'tileset_path');
      const atlasX = requireNumber(args, 'atlas_x');
      const atlasY = requireNumber(args, 'atlas_y');
      const tileSize = requirePositiveInt(args, 'tile_size');
      const alt = optionalNumber(args, 'alt') ?? 0;
      const polygon = optionalArray<{ x: number; y: number }>(args, 'polygon') || [
        { x: 0, y: 0 }, { x: tileSize, y: 0 }, { x: tileSize, y: tileSize }, { x: 0, y: tileSize },
      ];
      await setTileCollision(tilesetPath, atlasX, atlasY, polygon, tileSize, alt);
      return text(`Collision set for tile (${atlasX},${atlasY})`);
    }
    case 'godot_tileset_add_terrain': {
      const tilesetPath = requireString(args, 'tileset_path');
      const terrainSetIdx = optionalNumber(args, 'terrain_set') ?? 0;
      const terrains = requireArray<{ name: string; color?: string; mode?: number }>(args, 'terrains');
      const peeringBits = optionalArray<{
        atlas_x: number; atlas_y: number; alt?: number;
        terrain_set: number; terrain: number; bits: Record<string, number>;
      }>(args, 'peering_bits');
      await addTerrain(tilesetPath, terrainSetIdx, terrains, peeringBits);
      return text(`Added terrain set ${terrainSetIdx} with ${terrains.length} terrains`);
    }

    // ---- Scene / Layer ----
    case 'godot_scene_create': {
      const outputPath = requireString(args, 'output_path');
      const rootType = optionalString(args, 'root_type');
      const rootName = optionalString(args, 'root_name');
      const layers = optionalArray<{ name: string; tileset_path: string; z_index?: number; visible?: boolean }>(args, 'layers') || [];

      let content: string;
      if (layers.length > 0) {
        content = generateTileMapScene(
          layers.map(l => ({
            name: l.name,
            tileSetPath: l.tileset_path,
            zIndex: l.z_index,
            visible: l.visible,
          })),
          { rootNodeType: rootType, rootNodeName: rootName }
        );
      } else {
        content = generateScene({
          rootNodeType: rootType,
          rootNodeName: rootName,
        });
      }
      await writeFile(outputPath, content, 'utf-8');
      return text(`Scene created: ${outputPath}`);
    }
    case 'godot_layer_add': {
      const scenePath = requireString(args, 'scene_path');
      const name = requireString(args, 'name');
      const tilesetPath = requireString(args, 'tileset_path');
      const zIndex = optionalNumber(args, 'z_index');

      await addLayerToScene(scenePath, {
        name,
        tileSetPath: tilesetPath,
        zIndex,
      });
      return text(`Layer "${name}" added to ${scenePath}`);
    }

    case 'godot_layer_remove': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      await removeLayerFromScene(scenePath, layerName);
      return text(`Layer "${layerName}" removed from ${scenePath}`);
    }

    // ---- TileMap Read ----
    case 'godot_tilemap_list': {
      const projectPath = requireString(args, 'project_path');
      const result = await listTileMaps(projectPath);
      return json(result);
    }
    case 'godot_tilemap_info': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = optionalString(args, 'layer_name');
      const info = await getTileMapInfo(scenePath, layerName);
      return json(info);
    }
    case 'godot_tilemap_read': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const region = optionalObject(args, 'region') as { x: number; y: number; width: number; height: number } | undefined;

      const result = await readTiles(scenePath, layerName, region);
      return json(result);
    }
    case 'godot_tilemap_render': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const mode = (optionalString(args, 'mode') as 'source' | 'atlas') || 'source';
      const region = optionalObject(args, 'region') as { x: number; y: number; width: number; height: number } | undefined;

      const result = await renderTileMap(scenePath, layerName, mode, region);
      return text(result.render + (result.bounds ? `\n\nBounds: ${JSON.stringify(result.bounds)}  Tiles: ${result.tile_count}` : ''));
    }

    // ---- TileMap Write ----
    case 'godot_tilemap_set_tiles': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const tiles = requireArray<{ x: number; y: number; source_id: number; atlas_x: number; atlas_y: number; alt?: number }>(args, 'tiles');

      const result = await setTiles(
        scenePath,
        layerName,
        tiles.map(t => ({ ...t, alt: t.alt ?? 0 }))
      );
      return json({ success: true, ...result });
    }
    case 'godot_tilemap_fill_rect': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const x = requireNumber(args, 'x');
      const y = requireNumber(args, 'y');
      const width = requireNumber(args, 'width');
      const height = requireNumber(args, 'height');
      const sourceId = requireNumber(args, 'source_id');
      const atlasX = requireNumber(args, 'atlas_x');
      const atlasY = requireNumber(args, 'atlas_y');
      const alt = optionalNumber(args, 'alt') ?? 0;

      const result = await fillRect(
        scenePath,
        layerName,
        { x, y, width, height },
        sourceId,
        atlasX,
        atlasY,
        alt
      );
      return json({ success: true, ...result });
    }
    case 'godot_tilemap_erase_tiles': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const positions = requireArray<{ x: number; y: number }>(args, 'positions');

      const result = await eraseTiles(scenePath, layerName, positions);
      return json({ success: true, ...result });
    }
    case 'godot_tilemap_erase_rect': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const x = requireNumber(args, 'x');
      const y = requireNumber(args, 'y');
      const width = requireNumber(args, 'width');
      const height = requireNumber(args, 'height');

      const result = await eraseRect(scenePath, layerName, { x, y, width, height });
      return json({ success: true, ...result });
    }

    // ---- Generators ----
    case 'godot_generate_village': {
      const scenePath = requireString(args, 'scene_path');
      const centerX = requireNumber(args, 'center_x');
      const centerY = requireNumber(args, 'center_y');
      const width = requireNumber(args, 'width');
      const height = requireNumber(args, 'height');
      const houseCount = optionalNumber(args, 'house_count');
      const seed = optionalNumber(args, 'seed');
      const groundLayer = optionalString(args, 'ground_layer') || 'Ground';
      const buildingLayer = optionalString(args, 'building_layer') || 'Buildings';
      const detailLayer = optionalString(args, 'detail_layer') || 'Details';

      const village = generateVillage({
        centerX,
        centerY,
        width,
        height,
        houseCount,
        seed,
      });

      const results: Record<string, unknown> = {};
      if (village.ground.length > 0) {
        results.ground = await setTiles(scenePath, groundLayer, village.ground);
      }
      if (village.buildings.length > 0) {
        results.buildings = await setTiles(scenePath, buildingLayer, village.buildings);
      }
      if (village.details.length > 0) {
        results.details = await setTiles(scenePath, detailLayer, village.details);
      }

      return json({ success: true, ...results });
    }
    case 'godot_generate_forest': {
      const scenePath = requireString(args, 'scene_path');
      const x = requireNumber(args, 'x');
      const y = requireNumber(args, 'y');
      const width = requireNumber(args, 'width');
      const height = requireNumber(args, 'height');
      const density = optionalNumber(args, 'density');
      const seed = optionalNumber(args, 'seed');
      const groundLayer = optionalString(args, 'ground_layer') || 'Ground';
      const treeLayer = optionalString(args, 'tree_layer') || 'Trees';

      const forest = generateForest({
        x,
        y,
        width,
        height,
        density,
        seed,
      });

      const results: Record<string, unknown> = {};
      if (forest.ground.length > 0) {
        results.ground = await setTiles(scenePath, groundLayer, forest.ground);
      }
      if (forest.trees.length > 0) {
        results.trees = await setTiles(scenePath, treeLayer, forest.trees);
      }

      return json({ success: true, ...results });
    }
    case 'godot_generate_path': {
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const fromX = requireNumber(args, 'from_x');
      const fromY = requireNumber(args, 'from_y');
      const toX = requireNumber(args, 'to_x');
      const toY = requireNumber(args, 'to_y');
      const width = optionalNumber(args, 'width');
      const seed = optionalNumber(args, 'seed');
      const style = optionalString(args, 'style') as 'straight' | 'winding' | 'l-shaped' | undefined;

      const pathTiles = generatePath({
        fromX,
        fromY,
        toX,
        toY,
        width,
        style,
        seed,
      });

      const result = await setTiles(scenePath, layerName, pathTiles);
      return json({ success: true, path_tiles: pathTiles.length, ...result });
    }

    // ---- Headless Godot ----
    case 'godot_terrain_resolve': {
      const godotPath = await findGodot();
      if (!godotPath) return text('Error: Godot not found. Set GODOT_PATH or install Godot 4.');

      const projectPath = requireString(args, 'project_path');
      const scenePath = requireString(args, 'scene_path');
      const layerName = requireString(args, 'layer_name');
      const terrainSet = requireNumber(args, 'terrain_set');
      const terrain = requireNumber(args, 'terrain');
      const cells = requireArray<{ x: number; y: number }>(args, 'cells');

      const script = generateTerrainScript(scenePath, layerName, terrainSet, terrain, cells);

      const result = await runGDScript(godotPath, projectPath, script);
      return text(result.stdout || result.stderr || 'Terrain resolved');
    }
    case 'godot_render_screenshot': {
      const godotPath = await findGodot();
      if (!godotPath) return text('Error: Godot not found. Set GODOT_PATH or install Godot 4.');

      const projectPath = requireString(args, 'project_path');
      const scenePath = requireString(args, 'scene_path');
      const outputPath = requireString(args, 'output_path');
      const width = optionalNumber(args, 'width') || 1280;
      const height = optionalNumber(args, 'height') || 720;

      const script = generateScreenshotScript(scenePath, outputPath, width, height);

      const result = await runGDScript(godotPath, projectPath, script);
      return text(result.stdout || result.stderr || `Screenshot saved to ${outputPath}`);
    }

    default:
      return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true };
  }
}
