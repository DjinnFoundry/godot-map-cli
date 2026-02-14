/**
 * Execute headless Godot operations via temporary GDScript files.
 * Used for terrain resolution, autotiling, and other engine-dependent ops.
 */

import { writeFile, unlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const execFileAsync = promisify(execFile);

function escapeGDString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runGDScript(
  godotPath: string,
  projectPath: string,
  script: string,
  timeoutMs = 30000
): Promise<RunResult> {
  // Write script to a temp file inside the project (Godot needs res:// access)
  const scriptPath = join(projectPath, `_tmp_cli_${randomUUID()}.gd`);

  try {
    await writeFile(scriptPath, script, 'utf-8');

    const args = [
      '--headless',
      '--path', projectPath,
      '--script', scriptPath,
    ];

    try {
      const { stdout, stderr } = await execFileAsync(godotPath, args, {
        timeout: timeoutMs,
        cwd: projectPath,
      });
      return { stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'stdout' in error) {
        const execError = error as { stdout: string; stderr: string; code?: number };
        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.code ?? 1,
        };
      }
      throw error;
    }
  } finally {
    try {
      await unlink(scriptPath);
    } catch (e) {
      console.error('[godot-runner] cleanup failed:', e);
    }
  }
}

/**
 * Generate GDScript that resolves terrain autotiling for a TileMapLayer.
 */
export function generateTerrainScript(
  scenePath: string,
  layerName: string,
  terrainSet: number,
  terrain: number,
  cells: Array<{ x: number; y: number }>
): string {
  const coordsArray = cells.map(c => `Vector2i(${c.x}, ${c.y})`).join(', ');

  return `@tool
extends SceneTree

func _init():
	var scene = load("${escapeGDString(scenePath)}") as PackedScene
	if not scene:
		print("ERROR: Could not load scene: ${escapeGDString(scenePath)}")
		quit(1)
		return

	var root = scene.instantiate()
	var layer: TileMapLayer = null

	for child in root.get_children():
		if child is TileMapLayer and child.name == "${escapeGDString(layerName)}":
			layer = child as TileMapLayer
			break

	if not layer:
		print("ERROR: TileMapLayer '${escapeGDString(layerName)}' not found")
		quit(1)
		return

	var coords: Array[Vector2i] = [${coordsArray}]
	layer.set_cells_terrain_connect(coords, ${terrainSet}, ${terrain})

	var packed = PackedScene.new()
	packed.pack(root)
	ResourceSaver.save(packed, "${escapeGDString(scenePath)}")
	print("OK: Terrain resolved for ${escapeGDString(layerName)}")
	quit(0)
`;
}

/**
 * Generate GDScript that renders a scene to PNG.
 */
export function generateScreenshotScript(
  scenePath: string,
  outputPath: string,
  width = 1280,
  height = 720
): string {
  return `@tool
extends SceneTree

func _init():
	var scene = load("${escapeGDString(scenePath)}") as PackedScene
	if not scene:
		print("ERROR: Could not load scene: ${escapeGDString(scenePath)}")
		quit(1)
		return

	var viewport = SubViewport.new()
	viewport.size = Vector2i(${width}, ${height})
	viewport.transparent_bg = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE

	var root_node = scene.instantiate()
	viewport.add_child(root_node)

	# Need to add to tree for rendering
	get_root().add_child(viewport)

	# Wait for render
	await get_process_frame()
	await get_process_frame()

	var image = viewport.get_texture().get_image()
	image.save_png("${escapeGDString(outputPath)}")
	print("OK: Screenshot saved to ${escapeGDString(outputPath)}")
	quit(0)
`;
}
