/**
 * MCP tool definitions for the Godot Map CLI.
 * These define the interface that Claude Code sees.
 */

export const TOOL_DEFINITIONS = [
  // ---- Project ----
  {
    name: 'godot_project_init',
    description: 'Create a new Godot 4 project with standard RPG directory structure (scenes/, assets/, scripts/, tilesets/). Creates project.godot and .gitignore.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path for the new project.' },
        name: { type: 'string', description: 'Project name (shown in Godot editor).' },
      },
      required: ['path', 'name'],
    },
  },
  {
    name: 'godot_project_info',
    description: 'Get metadata about a Godot project: name, scene count, script count, asset count.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to the Godot project directory.' },
      },
      required: ['path'],
    },
  },

  // ---- TileSet ----
  {
    name: 'godot_tileset_create',
    description: 'Create a new TileSet .tres resource from a PNG tileset image. Copies the image into the project and generates a valid Godot 4 TileSet with TileSetAtlasSource.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Path to the Godot project.' },
        name: { type: 'string', description: 'Name for the tileset.' },
        image_path: { type: 'string', description: 'Path to the tileset PNG image.' },
        tile_size: { type: 'integer', description: 'Tile size in pixels (e.g., 16).' },
        output_path: { type: 'string', description: 'Where to save the .tres file (relative to project).' },
        physics_layer: { type: 'boolean', description: 'Add a physics/collision layer. Default: false.' },
      },
      required: ['project_path', 'name', 'image_path', 'tile_size', 'output_path'],
    },
  },
  {
    name: 'godot_tileset_inspect',
    description: 'Parse a .tres TileSet file and return its full structure: tile_size, atlas sources, terrains, physics layers, custom data.',
    inputSchema: {
      type: 'object',
      properties: {
        tileset_path: { type: 'string', description: 'Path to the .tres TileSet file.' },
      },
      required: ['tileset_path'],
    },
  },

  // ---- Scene / Layer ----
  {
    name: 'godot_scene_create',
    description: 'Create a new .tscn scene with TileMapLayer nodes. Specify layers with their tileset references, z-index, and visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        output_path: { type: 'string', description: 'Where to save the .tscn file (absolute path).' },
        root_type: { type: 'string', description: 'Root node type. Default: Node2D.' },
        root_name: { type: 'string', description: 'Root node name. Default: World.' },
        layers: {
          type: 'array',
          description: 'TileMapLayer configurations.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Layer name (e.g., "Ground", "Buildings").' },
              tileset_path: { type: 'string', description: 'res:// path to the .tres TileSet.' },
              z_index: { type: 'integer', description: 'Z-index for rendering order.' },
              visible: { type: 'boolean', description: 'Layer visibility. Default: true.' },
            },
            required: ['name', 'tileset_path'],
          },
        },
      },
      required: ['output_path'],
    },
  },
  {
    name: 'godot_layer_add',
    description: 'Add a TileMapLayer node to an existing scene. Handles ext_resource references and load_steps automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        name: { type: 'string', description: 'Layer name.' },
        tileset_path: { type: 'string', description: 'res:// path to the .tres TileSet.' },
        z_index: { type: 'integer', description: 'Z-index. Default: 0.' },
      },
      required: ['scene_path', 'name', 'tileset_path'],
    },
  },

  // ---- TileMap Read ----
  {
    name: 'godot_tilemap_list',
    description: 'Scan a Godot project for all scenes containing TileMapLayer nodes. Returns scene paths, layer names, tile counts.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Path to the Godot project.' },
      },
      required: ['project_path'],
    },
  },
  {
    name: 'godot_tilemap_info',
    description: 'Get metadata for TileMapLayer nodes: bounds, tile count, tileset, z_index, visibility.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Optional: filter to a specific layer.' },
      },
      required: ['scene_path'],
    },
  },
  {
    name: 'godot_tilemap_read',
    description: 'Read tiles from a TileMapLayer. Returns array of {x, y, source_id, atlas_x, atlas_y, alt}. Optional region filter.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        region: {
          type: 'object',
          description: 'Optional rectangular region filter.',
          properties: {
            x: { type: 'integer' }, y: { type: 'integer' },
            width: { type: 'integer' }, height: { type: 'integer' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      required: ['scene_path', 'layer_name'],
    },
  },
  {
    name: 'godot_tilemap_render',
    description: 'Render a TileMapLayer as ASCII art. Modes: "source" (source_id chars), "atlas" (atlas coordinates).',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        mode: { type: 'string', enum: ['source', 'atlas'], description: 'Display mode. Default: source.' },
        region: {
          type: 'object',
          properties: {
            x: { type: 'integer' }, y: { type: 'integer' },
            width: { type: 'integer' }, height: { type: 'integer' },
          },
          required: ['x', 'y', 'width', 'height'],
        },
      },
      required: ['scene_path', 'layer_name'],
    },
  },

  // ---- TileMap Write ----
  {
    name: 'godot_tilemap_set_tiles',
    description: 'Place or overwrite tiles on a TileMapLayer. Merges with existing data.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        tiles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              x: { type: 'integer' }, y: { type: 'integer' },
              source_id: { type: 'integer' }, atlas_x: { type: 'integer' },
              atlas_y: { type: 'integer' }, alt: { type: 'integer' },
            },
            required: ['x', 'y', 'source_id', 'atlas_x', 'atlas_y'],
          },
        },
      },
      required: ['scene_path', 'layer_name', 'tiles'],
    },
  },
  {
    name: 'godot_tilemap_fill_rect',
    description: 'Fill a rectangular area of a TileMapLayer with a single tile type.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        x: { type: 'integer' }, y: { type: 'integer' },
        width: { type: 'integer' }, height: { type: 'integer' },
        source_id: { type: 'integer' }, atlas_x: { type: 'integer' },
        atlas_y: { type: 'integer' }, alt: { type: 'integer' },
      },
      required: ['scene_path', 'layer_name', 'x', 'y', 'width', 'height', 'source_id', 'atlas_x', 'atlas_y'],
    },
  },
  {
    name: 'godot_tilemap_erase_tiles',
    description: 'Remove tiles at specific positions from a TileMapLayer.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        positions: {
          type: 'array',
          items: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'] },
        },
      },
      required: ['scene_path', 'layer_name', 'positions'],
    },
  },
  {
    name: 'godot_tilemap_erase_rect',
    description: 'Clear all tiles in a rectangular area of a TileMapLayer.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        x: { type: 'integer' }, y: { type: 'integer' },
        width: { type: 'integer' }, height: { type: 'integer' },
      },
      required: ['scene_path', 'layer_name', 'x', 'y', 'width', 'height'],
    },
  },

  // ---- Generators ----
  {
    name: 'godot_generate_village',
    description: 'Generate a village layout with houses connected by paths. Returns tiles for ground, buildings, and details layers.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        center_x: { type: 'integer' }, center_y: { type: 'integer' },
        width: { type: 'integer' }, height: { type: 'integer' },
        house_count: { type: 'integer', description: 'Number of houses (default: 3).' },
        ground_layer: { type: 'string', description: 'Layer name for ground tiles.' },
        building_layer: { type: 'string', description: 'Layer name for building tiles.' },
        detail_layer: { type: 'string', description: 'Layer name for path/detail tiles.' },
        seed: { type: 'integer', description: 'RNG seed for reproducibility.' },
      },
      required: ['scene_path', 'center_x', 'center_y', 'width', 'height'],
    },
  },
  {
    name: 'godot_generate_forest',
    description: 'Generate a forest with clustered trees. Returns ground and tree tiles.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        x: { type: 'integer' }, y: { type: 'integer' },
        width: { type: 'integer' }, height: { type: 'integer' },
        density: { type: 'number', description: 'Tree density 0.0-1.0. Default: 0.5.' },
        ground_layer: { type: 'string', description: 'Layer name for ground tiles.' },
        tree_layer: { type: 'string', description: 'Layer name for tree tiles.' },
        seed: { type: 'integer' },
      },
      required: ['scene_path', 'x', 'y', 'width', 'height'],
    },
  },
  {
    name: 'godot_generate_path',
    description: 'Generate a path between two points. Styles: straight, winding, l-shaped.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Layer name for the path.' },
        from_x: { type: 'integer' }, from_y: { type: 'integer' },
        to_x: { type: 'integer' }, to_y: { type: 'integer' },
        width: { type: 'integer', description: 'Path width 1-3. Default: 1.' },
        style: { type: 'string', enum: ['straight', 'winding', 'l-shaped'] },
        seed: { type: 'integer' },
      },
      required: ['scene_path', 'layer_name', 'from_x', 'from_y', 'to_x', 'to_y'],
    },
  },

  // ---- TileSet Management ----
  {
    name: 'godot_tileset_register_tiles',
    description: 'Register specific tile definitions in a TileSet so Godot recognizes them. Required before setting collision or terrain data.',
    inputSchema: {
      type: 'object',
      properties: {
        tileset_path: { type: 'string', description: 'Path to the .tres TileSet file.' },
        tiles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              atlas_x: { type: 'integer' }, atlas_y: { type: 'integer' },
              alt: { type: 'integer', description: 'Alternative tile ID. Default: 0.' },
            },
            required: ['atlas_x', 'atlas_y'],
          },
        },
      },
      required: ['tileset_path', 'tiles'],
    },
  },
  {
    name: 'godot_tileset_set_collision',
    description: 'Add a collision polygon to a specific tile in a TileSet. Requires a physics layer.',
    inputSchema: {
      type: 'object',
      properties: {
        tileset_path: { type: 'string', description: 'Path to the .tres TileSet file.' },
        atlas_x: { type: 'integer' }, atlas_y: { type: 'integer' },
        tile_size: { type: 'integer', description: 'Tile size in pixels.' },
        polygon: {
          type: 'array',
          description: 'Polygon points. Defaults to full tile rectangle if omitted.',
          items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
        },
        alt: { type: 'integer', description: 'Alternative tile ID. Default: 0.' },
      },
      required: ['tileset_path', 'atlas_x', 'atlas_y', 'tile_size'],
    },
  },
  {
    name: 'godot_tileset_add_terrain',
    description: 'Add a terrain set with named terrains to a TileSet. Optionally assign peering bits to tiles.',
    inputSchema: {
      type: 'object',
      properties: {
        tileset_path: { type: 'string', description: 'Path to the .tres TileSet file.' },
        terrain_set: { type: 'integer', description: 'Terrain set index. Default: 0.' },
        terrains: {
          type: 'array',
          description: 'Terrain definitions.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              color: { type: 'string', description: 'Godot Color format. Default: Color(0.2, 0.6, 0.3, 1).' },
              mode: { type: 'integer', description: '0=Corners+Sides, 1=Corners, 2=Sides. Default: 0.' },
            },
            required: ['name'],
          },
        },
        peering_bits: {
          type: 'array',
          description: 'Assign peering bits to specific tiles.',
          items: {
            type: 'object',
            properties: {
              atlas_x: { type: 'integer' }, atlas_y: { type: 'integer' },
              alt: { type: 'integer' },
              terrain_set: { type: 'integer' }, terrain: { type: 'integer' },
              bits: { type: 'object', description: 'Map of peering bit name to terrain index.' },
            },
            required: ['atlas_x', 'atlas_y', 'terrain_set', 'terrain', 'bits'],
          },
        },
      },
      required: ['tileset_path', 'terrains'],
    },
  },

  // ---- Layer Management ----
  {
    name: 'godot_layer_remove',
    description: 'Remove a TileMapLayer node from a scene file.',
    inputSchema: {
      type: 'object',
      properties: {
        scene_path: { type: 'string', description: 'Path to the .tscn scene file.' },
        layer_name: { type: 'string', description: 'Name of the layer to remove.' },
      },
      required: ['scene_path', 'layer_name'],
    },
  },

  // ---- Headless Godot ----
  {
    name: 'godot_terrain_resolve',
    description: 'Run headless Godot to resolve terrain autotiling on a TileMapLayer. Requires Godot installed.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Path to the Godot project.' },
        scene_path: { type: 'string', description: 'res:// path to the scene.' },
        layer_name: { type: 'string', description: 'Name of the TileMapLayer.' },
        terrain_set: { type: 'integer', description: 'Terrain set index.' },
        terrain: { type: 'integer', description: 'Terrain index within the set.' },
        cells: {
          type: 'array',
          items: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'] },
          description: 'Cells to resolve terrain for.',
        },
      },
      required: ['project_path', 'scene_path', 'layer_name', 'terrain_set', 'terrain', 'cells'],
    },
  },
  {
    name: 'godot_render_screenshot',
    description: 'Render a scene to PNG using headless Godot. Requires Godot installed.',
    inputSchema: {
      type: 'object',
      properties: {
        project_path: { type: 'string', description: 'Path to the Godot project.' },
        scene_path: { type: 'string', description: 'res:// path to the scene.' },
        output_path: { type: 'string', description: 'Where to save the PNG.' },
        width: { type: 'integer', description: 'Viewport width. Default: 1280.' },
        height: { type: 'integer', description: 'Viewport height. Default: 720.' },
      },
      required: ['project_path', 'scene_path', 'output_path'],
    },
  },
] as const;
