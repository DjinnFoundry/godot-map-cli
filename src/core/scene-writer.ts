/**
 * Create and modify Godot .tscn scene files programmatically.
 * Generates valid text-format scenes that Godot 4 can open.
 */

import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseTscnText, findTileMapLayers } from './scene-parser.js';

export interface SceneOptions {
  rootNodeType?: string;
  rootNodeName?: string;
}

export interface TileMapLayerOptions {
  name: string;
  tileSetPath: string;     // res:// path to the .tres TileSet
  tileSetUid?: string;     // optional uid
  zIndex?: number;
  visible?: boolean;
}

/**
 * Create a minimal .tscn scene file with a root node.
 */
export function generateScene(options: SceneOptions = {}): string {
  const rootType = options.rootNodeType || 'Node2D';
  const rootName = options.rootNodeName || 'Root';

  return `[gd_scene format=3]

[node name="${rootName}" type="${rootType}"]
`;
}

/**
 * Create a scene with TileMapLayer nodes pre-configured.
 * This generates a complete scene with ext_resource references and layers.
 */
export function generateTileMapScene(
  layers: TileMapLayerOptions[],
  options: SceneOptions = {}
): string {
  const rootType = options.rootNodeType || 'Node2D';
  const rootName = options.rootNodeName || 'World';

  // Collect unique tilesets for ext_resource declarations
  const tilesets = new Map<string, { id: string; path: string; uid?: string }>();
  let extId = 1;
  for (const layer of layers) {
    if (!tilesets.has(layer.tileSetPath)) {
      tilesets.set(layer.tileSetPath, {
        id: String(extId),
        path: layer.tileSetPath,
        uid: layer.tileSetUid,
      });
      extId++;
    }
  }

  const loadSteps = tilesets.size + 1;
  const lines: string[] = [];

  // Header
  lines.push(`[gd_scene load_steps=${loadSteps} format=3]`);
  lines.push('');

  // External resources (tilesets)
  for (const ts of tilesets.values()) {
    const uidPart = ts.uid ? ` uid="${ts.uid}"` : '';
    lines.push(`[ext_resource type="TileSet"${uidPart} path="${ts.path}" id="${ts.id}"]`);
  }
  lines.push('');

  // Root node
  lines.push(`[node name="${rootName}" type="${rootType}"]`);
  lines.push('');

  // TileMapLayer nodes
  for (const layer of layers) {
    const ts = tilesets.get(layer.tileSetPath)!;
    lines.push(`[node name="${layer.name}" type="TileMapLayer" parent="."]`);
    lines.push(`tile_set = ExtResource("${ts.id}")`);
    if (layer.zIndex !== undefined && layer.zIndex !== 0) {
      lines.push(`z_index = ${layer.zIndex}`);
    }
    if (layer.visible === false) {
      lines.push(`visible = false`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Add a TileMapLayer node to an existing scene file.
 */
export async function addLayerToScene(
  scenePath: string,
  layer: TileMapLayerOptions
): Promise<void> {
  const text = await readFile(scenePath, 'utf-8');
  const parsed = parseTscnText(text);

  // Check if a layer with this name already exists
  const existing = findTileMapLayers(parsed);
  if (existing.find(l => l.name === layer.name)) {
    throw new Error(`Layer "${layer.name}" already exists in ${scenePath}`);
  }

  // Find if the tileset is already an ext_resource
  let tileSetExtId: string | null = null;
  for (const s of parsed.sections) {
    if (s.type === 'ext_resource' && s.attrs.path === layer.tileSetPath) {
      tileSetExtId = s.attrs.id;
      break;
    }
  }

  const lines = parsed.lines.slice();

  // If tileset not yet referenced, add ext_resource
  if (!tileSetExtId) {
    // Find highest ext_resource id
    let maxId = 0;
    for (const s of parsed.sections) {
      if (s.type === 'ext_resource') {
        const id = parseInt(s.attrs.id, 10);
        if (id > maxId) maxId = id;
      }
    }
    tileSetExtId = String(maxId + 1);

    // Insert after the last ext_resource (or after the gd_scene header)
    let insertLine = 0;
    for (const s of parsed.sections) {
      if (s.type === 'ext_resource') {
        insertLine = s.endLine + 1;
      }
    }
    if (insertLine === 0) {
      // After the gd_scene header
      insertLine = parsed.sections[0]?.endLine ? parsed.sections[0].endLine + 1 : 1;
    }

    const uidPart = layer.tileSetUid ? ` uid="${layer.tileSetUid}"` : '';
    lines.splice(insertLine, 0,
      ``,
      `[ext_resource type="TileSet"${uidPart} path="${layer.tileSetPath}" id="${tileSetExtId}"]`
    );

    // Update load_steps in header
    const headerLine = lines[0];
    const loadStepsMatch = headerLine.match(/load_steps=(\d+)/);
    if (loadStepsMatch) {
      const newSteps = parseInt(loadStepsMatch[1], 10) + 1;
      lines[0] = headerLine.replace(/load_steps=\d+/, `load_steps=${newSteps}`);
    }
  }

  // Append the new layer node at the end
  const newLayerLines = [
    '',
    `[node name="${layer.name}" type="TileMapLayer" parent="."]`,
    `tile_set = ExtResource("${tileSetExtId}")`,
  ];
  if (layer.zIndex !== undefined && layer.zIndex !== 0) {
    newLayerLines.push(`z_index = ${layer.zIndex}`);
  }
  if (layer.visible === false) {
    newLayerLines.push(`visible = false`);
  }
  newLayerLines.push('');

  lines.push(...newLayerLines);

  await writeFile(scenePath, lines.join('\n'), 'utf-8');
}

/**
 * Remove a TileMapLayer node from an existing scene file.
 * Removes the [node] section and its properties. Does NOT remove
 * orphaned ext_resource refs (Godot handles that gracefully).
 */
export async function removeLayerFromScene(
  scenePath: string,
  layerName: string
): Promise<void> {
  const text = await readFile(scenePath, 'utf-8');
  const parsed = parseTscnText(text);
  const layers = findTileMapLayers(parsed);
  const layer = layers.find(l => l.name === layerName);

  if (!layer) {
    const available = layers.map(l => l.name).join(', ');
    throw new Error(`Layer "${layerName}" not found. Available: ${available}`);
  }

  const lines = parsed.lines.slice();
  const startLine = layer.section.startLine;
  let endLine = layer.section.endLine;

  // Include trailing blank line if present
  while (endLine + 1 < lines.length && lines[endLine + 1].trim() === '') {
    endLine++;
  }

  lines.splice(startLine, endLine - startLine + 1);
  await writeFile(scenePath, lines.join('\n'), 'utf-8');
}
