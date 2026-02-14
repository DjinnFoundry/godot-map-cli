/**
 * Encode/decode Godot 4 TileMapLayer PackedByteArray tile data.
 *
 * Binary format (little-endian):
 *   Header: 2 bytes (uint16 format version)
 *   Per cell: 12 bytes
 *     0-1   int16   cell X
 *     2-3   int16   cell Y
 *     4-5   uint16  source_id
 *     6-7   uint16  atlas_coords.x
 *     8-9   uint16  atlas_coords.y
 *     10-11 uint16  alternative_tile
 *
 * Reference: godotengine/godot scene/2d/tile_map_layer.cpp
 */

import type { TileCell } from '../types/index.js';

const HEADER_SIZE = 2;
const CELL_SIZE = 12;

export function decodeTileData(base64: string): TileCell[] {
  if (!base64 || base64.length === 0) return [];

  const buf = Buffer.from(base64, 'base64');
  if (buf.length < HEADER_SIZE) return [];

  const dataLen = buf.length - HEADER_SIZE;
  const cellCount = Math.floor(dataLen / CELL_SIZE);
  const cells: TileCell[] = [];

  for (let i = 0; i < cellCount; i++) {
    const off = HEADER_SIZE + i * CELL_SIZE;
    cells.push({
      x: buf.readInt16LE(off),
      y: buf.readInt16LE(off + 2),
      source_id: buf.readUInt16LE(off + 4),
      atlas_x: buf.readUInt16LE(off + 6),
      atlas_y: buf.readUInt16LE(off + 8),
      alt: buf.readUInt16LE(off + 10),
    });
  }

  return cells;
}

export function encodeTileData(cells: TileCell[]): string {
  if (!cells || cells.length === 0) {
    // Return valid empty tile data (just the 2-byte header) so Godot recognizes it
    const emptyBuf = Buffer.alloc(HEADER_SIZE);
    emptyBuf.writeUInt16LE(0, 0);
    return emptyBuf.toString('base64');
  }

  const buf = Buffer.alloc(HEADER_SIZE + cells.length * CELL_SIZE);
  buf.writeUInt16LE(0, 0); // format version

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const off = HEADER_SIZE + i * CELL_SIZE;
    buf.writeInt16LE(c.x, off);
    buf.writeInt16LE(c.y, off + 2);
    buf.writeUInt16LE(c.source_id, off + 4);
    buf.writeUInt16LE(c.atlas_x, off + 6);
    buf.writeUInt16LE(c.atlas_y, off + 8);
    buf.writeUInt16LE(c.alt ?? 0, off + 10);
  }

  return buf.toString('base64');
}
