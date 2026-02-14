#!/usr/bin/env node
/**
 * godot-map-cli - CLI for AI-driven Godot 4 TileMap editing
 *
 * Usage:
 *   godot-map-cli init <path> --name "My RPG"
 *   godot-map-cli tileset create overworld --image overworld.png --tile-size 16
 *   godot-map-cli map create world.tscn --layers Ground,Buildings --tileset res://tilesets/overworld.tres
 *   godot-map-cli map place world.tscn --layer Ground --at 5,5 --tile 0,0
 *   godot-map-cli map read world.tscn --layer Ground --rect 0,0,10,10
 *   godot-map-cli map render world.tscn --layer Ground
 */

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { createProject, getProjectInfo, isGodotProject } from './core/project.js';
import { createTileSet, registerTiles, setTileCollision, addTerrain } from './tileset/tileset-writer.js';
import { parseTileSet } from './core/resource-parser.js';
import { generateScene, generateTileMapScene, addLayerToScene, removeLayerFromScene } from './core/scene-writer.js';
import {
  listTileMaps,
  getTileMapInfo,
  readTiles,
  renderTileMap,
  setTiles,
  fillRect,
  eraseTiles,
  eraseRect,
} from './tilemap/tilemap-editor.js';
import { generateVillage } from './generators/village.js';
import { generateForest } from './generators/forest.js';
import { generatePath } from './generators/path.js';
import { findGodot, getGodotVersion } from './core/godot-finder.js';
import { runGDScript, generateTerrainScript, generateScreenshotScript } from './core/godot-runner.js';
import { writeFile } from 'node:fs/promises';

const program = new Command();

program
  .name('godot-map-cli')
  .description('CLI for AI-driven Godot 4 TileMap editing')
  .version('0.1.0');

// ---- Project commands ----

program
  .command('init <path>')
  .description('Create a new Godot 4 project')
  .option('-n, --name <name>', 'Project name', 'My RPG')
  .action(async (path: string, opts: { name: string }) => {
    const fullPath = resolve(path);
    await createProject(fullPath, opts.name);
    console.log(`Project "${opts.name}" created at ${fullPath}`);
  });

program
  .command('info [path]')
  .description('Show project info')
  .action(async (path?: string) => {
    const projectPath = resolve(path || '.');
    const info = await getProjectInfo(projectPath);
    console.log(JSON.stringify(info, null, 2));
  });

program
  .command('godot-version')
  .description('Show detected Godot version')
  .action(async () => {
    const godotPath = await findGodot();
    if (!godotPath) {
      console.error('Godot not found. Set GODOT_PATH or install Godot 4.');
      process.exit(1);
    }
    const version = await getGodotVersion(godotPath);
    console.log(`Godot: ${godotPath}\nVersion: ${version}`);
  });

// ---- TileSet commands ----

const tileset = program.command('tileset').description('TileSet management');

tileset
  .command('create <name>')
  .description('Create a TileSet from a PNG')
  .requiredOption('--image <path>', 'Path to tileset PNG')
  .requiredOption('--tile-size <size>', 'Tile size in pixels', parseInt)
  .option('--output <path>', 'Output .tres path (relative to project)')
  .option('--project <path>', 'Godot project path', '.')
  .option('--physics', 'Add physics layer')
  .action(async (name: string, opts: { image: string; tileSize: number; output?: string; project: string; physics?: boolean }) => {
    const projectPath = resolve(opts.project);
    const outputPath = opts.output || `tilesets/${name}.tres`;
    const resPath = await createTileSet({
      name,
      imagePath: resolve(opts.image),
      tileSize: opts.tileSize,
      outputPath: join(projectPath, outputPath),
      projectPath,
      physicsLayer: opts.physics,
    });
    console.log(`TileSet created: ${resPath}`);
  });

tileset
  .command('inspect <path>')
  .description('Inspect a TileSet .tres file')
  .action(async (path: string) => {
    const info = await parseTileSet(resolve(path));
    console.log(JSON.stringify(info, null, 2));
  });

tileset
  .command('register-tiles <path>')
  .description('Register tile definitions in a TileSet')
  .requiredOption('--tiles <coords>', 'Tile coords as ax,ay;ax,ay;... (e.g., 0,0;1,0;2,0)')
  .action(async (path: string, opts: { tiles: string }) => {
    const tiles = opts.tiles.split(';').map(c => {
      const [ax, ay] = c.split(',').map(Number);
      return { atlas_x: ax, atlas_y: ay };
    });
    await registerTiles(resolve(path), tiles);
    console.log(`Registered ${tiles.length} tiles in ${path}`);
  });

tileset
  .command('set-collision <path>')
  .description('Add collision polygon to a tile')
  .requiredOption('--tile <ax,ay>', 'Atlas coords (e.g., 0,0)')
  .requiredOption('--tile-size <size>', 'Tile size in pixels', parseInt)
  .option('--polygon <points>', 'Polygon points as x,y;x,y;... (defaults to full tile rect)')
  .action(async (path: string, opts: { tile: string; tileSize: number; polygon?: string }) => {
    const [ax, ay] = opts.tile.split(',').map(Number);
    const ts = opts.tileSize;
    const polygon = opts.polygon
      ? opts.polygon.split(';').map(p => { const [x, y] = p.split(',').map(Number); return { x, y }; })
      : [{ x: 0, y: 0 }, { x: ts, y: 0 }, { x: ts, y: ts }, { x: 0, y: ts }];
    await setTileCollision(resolve(path), ax, ay, polygon, ts);
    console.log(`Collision set for tile (${ax},${ay})`);
  });

tileset
  .command('add-terrain <path>')
  .description('Add terrain set with terrains to a TileSet')
  .requiredOption('--terrains <names>', 'Comma-separated terrain names (e.g., "grass,dirt,water")')
  .option('--terrain-set <n>', 'Terrain set index', '0')
  .option('--mode <n>', 'Mode: 0=Corners+Sides, 1=Corners, 2=Sides', '0')
  .action(async (path: string, opts: { terrains: string; terrainSet: string; mode: string }) => {
    const terrainNames = opts.terrains.split(',').map(n => n.trim());
    const terrains = terrainNames.map(name => ({ name, mode: parseInt(opts.mode, 10) }));
    await addTerrain(resolve(path), parseInt(opts.terrainSet, 10), terrains);
    console.log(`Added terrain set ${opts.terrainSet} with terrains: ${terrainNames.join(', ')}`);
  });

// ---- Map commands ----

const map = program.command('map').description('TileMap editing');

map
  .command('create <scene>')
  .description('Create a scene with TileMapLayers')
  .requiredOption('--tileset <path>', 'res:// path to the TileSet')
  .option('--layers <names>', 'Comma-separated layer names', 'Ground')
  .option('--root-type <type>', 'Root node type', 'Node2D')
  .option('--root-name <name>', 'Root node name', 'World')
  .action(async (scene: string, opts: { tileset: string; layers: string; rootType: string; rootName: string }) => {
    const layerNames = opts.layers.split(',').map(n => n.trim());
    const content = generateTileMapScene(
      layerNames.map((name, i) => ({
        name,
        tileSetPath: opts.tileset,
        zIndex: i,
      })),
      { rootNodeType: opts.rootType, rootNodeName: opts.rootName }
    );
    await writeFile(resolve(scene), content, 'utf-8');
    console.log(`Scene created: ${scene} with layers: ${layerNames.join(', ')}`);
  });

map
  .command('list [project]')
  .description('List all tilemaps in a project')
  .action(async (project?: string) => {
    const result = await listTileMaps(resolve(project || '.'));
    console.log(JSON.stringify(result, null, 2));
  });

map
  .command('info <scene>')
  .description('Get tilemap layer info')
  .option('--layer <name>', 'Filter by layer name')
  .action(async (scene: string, opts: { layer?: string }) => {
    const info = await getTileMapInfo(resolve(scene), opts.layer);
    console.log(JSON.stringify(info, null, 2));
  });

map
  .command('place <scene>')
  .description('Place a tile')
  .requiredOption('--layer <name>', 'Layer name')
  .requiredOption('--at <x,y>', 'Position (e.g., 5,10)')
  .requiredOption('--tile <ax,ay>', 'Atlas coords (e.g., 0,0)')
  .option('--source <id>', 'Source ID', '0')
  .action(async (scene: string, opts: { layer: string; at: string; tile: string; source: string }) => {
    const [x, y] = opts.at.split(',').map(Number);
    const [ax, ay] = opts.tile.split(',').map(Number);
    const result = await setTiles(resolve(scene), opts.layer, [{
      x, y,
      source_id: parseInt(opts.source, 10),
      atlas_x: ax,
      atlas_y: ay,
      alt: 0,
    }]);
    console.log(`Placed tile at (${x},${y}). Total: ${result.total_tiles}`);
  });

map
  .command('fill <scene>')
  .description('Fill a rectangle with a tile')
  .requiredOption('--layer <name>', 'Layer name')
  .requiredOption('--rect <x,y,w,h>', 'Rectangle (e.g., 0,0,10,10)')
  .requiredOption('--tile <ax,ay>', 'Atlas coords')
  .option('--source <id>', 'Source ID', '0')
  .action(async (scene: string, opts: { layer: string; rect: string; tile: string; source: string }) => {
    const [x, y, w, h] = opts.rect.split(',').map(Number);
    const [ax, ay] = opts.tile.split(',').map(Number);
    const result = await fillRect(resolve(scene), opts.layer,
      { x, y, width: w, height: h },
      parseInt(opts.source, 10), ax, ay
    );
    console.log(`Filled ${result.tiles_filled} tiles. Total: ${result.total_tiles}`);
  });

map
  .command('read <scene>')
  .description('Read tiles from a layer')
  .requiredOption('--layer <name>', 'Layer name')
  .option('--rect <x,y,w,h>', 'Region filter')
  .action(async (scene: string, opts: { layer: string; rect?: string }) => {
    let region;
    if (opts.rect) {
      const [x, y, w, h] = opts.rect.split(',').map(Number);
      region = { x, y, width: w, height: h };
    }
    const result = await readTiles(resolve(scene), opts.layer, region);
    console.log(JSON.stringify(result, null, 2));
  });

map
  .command('render <scene>')
  .description('ASCII render a tilemap layer')
  .requiredOption('--layer <name>', 'Layer name')
  .option('--mode <mode>', 'source or atlas', 'source')
  .option('--rect <x,y,w,h>', 'Region filter')
  .action(async (scene: string, opts: { layer: string; mode: string; rect?: string }) => {
    let region;
    if (opts.rect) {
      const [x, y, w, h] = opts.rect.split(',').map(Number);
      region = { x, y, width: w, height: h };
    }
    const result = await renderTileMap(resolve(scene), opts.layer, opts.mode as 'source' | 'atlas', region);
    console.log(result.render);
    if (result.bounds) {
      console.log(`\nBounds: ${JSON.stringify(result.bounds)}  Tiles: ${result.tile_count}`);
    }
  });

map
  .command('erase <scene>')
  .description('Erase tiles by rectangle or specific positions')
  .requiredOption('--layer <name>', 'Layer name')
  .option('--rect <x,y,w,h>', 'Rectangle to erase')
  .option('--at <positions>', 'Specific positions as x1,y1;x2,y2;...')
  .action(async (scene: string, opts: { layer: string; rect?: string; at?: string }) => {
    if (!opts.rect && !opts.at) {
      console.error('Either --rect or --at is required');
      process.exit(1);
    }
    if (opts.at) {
      const positions = opts.at.split(';').map(p => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      });
      const result = await eraseTiles(resolve(scene), opts.layer, positions);
      console.log(`Erased ${result.tiles_erased} tiles. Remaining: ${result.total_tiles}`);
    } else {
      const [x, y, w, h] = opts.rect!.split(',').map(Number);
      const result = await eraseRect(resolve(scene), opts.layer, { x, y, width: w, height: h });
      console.log(`Erased ${result.tiles_erased} tiles. Remaining: ${result.total_tiles}`);
    }
  });

map
  .command('remove-layer <scene>')
  .description('Remove a TileMapLayer from a scene')
  .requiredOption('--layer <name>', 'Layer name to remove')
  .action(async (scene: string, opts: { layer: string }) => {
    await removeLayerFromScene(resolve(scene), opts.layer);
    console.log(`Layer "${opts.layer}" removed from ${scene}`);
  });

// ---- Generator commands ----

const gen = program.command('generate').description('Procedural generation');

gen
  .command('village <scene>')
  .description('Generate a village')
  .requiredOption('--center <x,y>', 'Center position')
  .requiredOption('--size <w,h>', 'Village size')
  .option('--houses <n>', 'Number of houses', '3')
  .option('--seed <n>', 'RNG seed', '42')
  .option('--ground-layer <name>', 'Ground layer name', 'Ground')
  .option('--building-layer <name>', 'Building layer name', 'Buildings')
  .option('--detail-layer <name>', 'Detail layer name', 'Details')
  .action(async (scene: string, opts: {
    center: string; size: string; houses: string; seed: string;
    groundLayer: string; buildingLayer: string; detailLayer: string;
  }) => {
    const [cx, cy] = opts.center.split(',').map(Number);
    const [w, h] = opts.size.split(',').map(Number);
    const village = generateVillage({
      centerX: cx, centerY: cy, width: w, height: h,
      houseCount: parseInt(opts.houses, 10),
      seed: parseInt(opts.seed, 10),
    });
    const scenePath = resolve(scene);
    await setTiles(scenePath, opts.groundLayer, village.ground);
    await setTiles(scenePath, opts.buildingLayer, village.buildings);
    await setTiles(scenePath, opts.detailLayer, village.details);
    console.log(`Village generated: ${village.ground.length} ground, ${village.buildings.length} building, ${village.details.length} detail tiles`);
  });

gen
  .command('forest <scene>')
  .description('Generate a forest')
  .requiredOption('--rect <x,y,w,h>', 'Area')
  .option('--density <n>', 'Tree density 0-1', '0.5')
  .option('--seed <n>', 'RNG seed', '42')
  .option('--ground-layer <name>', 'Ground layer', 'Ground')
  .option('--tree-layer <name>', 'Tree layer', 'Trees')
  .action(async (scene: string, opts: {
    rect: string; density: string; seed: string;
    groundLayer: string; treeLayer: string;
  }) => {
    const [x, y, w, h] = opts.rect.split(',').map(Number);
    const forest = generateForest({
      x, y, width: w, height: h,
      density: parseFloat(opts.density),
      seed: parseInt(opts.seed, 10),
    });
    const scenePath = resolve(scene);
    await setTiles(scenePath, opts.groundLayer, forest.ground);
    await setTiles(scenePath, opts.treeLayer, forest.trees);
    console.log(`Forest generated: ${forest.ground.length} ground, ${forest.trees.length} tree tiles`);
  });

gen
  .command('path <scene>')
  .description('Generate a path between two points')
  .requiredOption('--layer <name>', 'Layer name')
  .requiredOption('--from <x,y>', 'Start position')
  .requiredOption('--to <x,y>', 'End position')
  .option('--width <n>', 'Path width 1-3', '1')
  .option('--style <style>', 'straight, winding, l-shaped', 'winding')
  .option('--seed <n>', 'RNG seed', '42')
  .action(async (scene: string, opts: {
    layer: string; from: string; to: string; width: string; style: string; seed: string;
  }) => {
    const [fx, fy] = opts.from.split(',').map(Number);
    const [tx, ty] = opts.to.split(',').map(Number);
    const pathTiles = generatePath({
      fromX: fx, fromY: fy, toX: tx, toY: ty,
      width: parseInt(opts.width, 10),
      style: opts.style as 'straight' | 'winding' | 'l-shaped',
      seed: parseInt(opts.seed, 10),
    });
    await setTiles(resolve(scene), opts.layer, pathTiles);
    console.log(`Path generated: ${pathTiles.length} tiles`);
  });

// ---- Headless commands ----

program
  .command('render <scene>')
  .description('Render scene to PNG (requires Godot)')
  .requiredOption('--output <path>', 'Output PNG path')
  .option('--project <path>', 'Godot project path', '.')
  .option('--width <n>', 'Viewport width', '1280')
  .option('--height <n>', 'Viewport height', '720')
  .action(async (scene: string, opts: { output: string; project: string; width: string; height: string }) => {
    const godotPath = await findGodot();
    if (!godotPath) {
      console.error('Godot not found. Set GODOT_PATH or install Godot 4.');
      process.exit(1);
    }
    const script = generateScreenshotScript(
      scene, resolve(opts.output),
      parseInt(opts.width, 10), parseInt(opts.height, 10)
    );
    const result = await runGDScript(godotPath, resolve(opts.project), script);
    console.log(result.stdout || result.stderr);
  });

program
  .command('terrain-resolve')
  .description('Resolve terrain autotiling (requires Godot)')
  .requiredOption('--project <path>', 'Godot project path')
  .requiredOption('--scene <path>', 'res:// scene path')
  .requiredOption('--layer <name>', 'Layer name')
  .requiredOption('--terrain-set <n>', 'Terrain set index')
  .requiredOption('--terrain <n>', 'Terrain index')
  .requiredOption('--cells <coords>', 'Cells as x1,y1;x2,y2;...')
  .action(async (opts: {
    project: string; scene: string; layer: string;
    terrainSet: string; terrain: string; cells: string;
  }) => {
    const godotPath = await findGodot();
    if (!godotPath) {
      console.error('Godot not found. Set GODOT_PATH or install Godot 4.');
      process.exit(1);
    }
    const cells = opts.cells.split(';').map(c => {
      const [x, y] = c.split(',').map(Number);
      return { x, y };
    });
    const script = generateTerrainScript(
      opts.scene, opts.layer,
      parseInt(opts.terrainSet, 10), parseInt(opts.terrain, 10),
      cells
    );
    const result = await runGDScript(godotPath, resolve(opts.project), script);
    console.log(result.stdout || result.stderr);
  });

// ---- MCP mode ----

program
  .command('mcp')
  .description('Run as MCP server (for Claude Code integration)')
  .action(async () => {
    // Dynamic import to avoid loading MCP deps when not needed
    await import('./mcp-server.js');
  });

program.parse();
