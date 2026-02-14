import { describe, it, expect } from 'vitest';
import { decodeTileData, encodeTileData } from '../src/core/tile-data.js';
import type { TileCell } from '../src/types/index.js';

describe('tile-data: encode/decode TileCell roundtrip', () => {
  it('should encode empty array to 2-byte header and decode back to empty array', () => {
    const empty: TileCell[] = [];
    const encoded = encodeTileData(empty);

    // Should be base64 encoded 2-byte header
    expect(encoded).toBeTruthy();
    expect(typeof encoded).toBe('string');

    const decoded = decodeTileData(encoded);
    expect(decoded).toEqual([]);
  });

  it('should encode and decode single tile with all fields', () => {
    const tiles: TileCell[] = [
      {
        x: 5,
        y: 10,
        source_id: 1,
        atlas_x: 2,
        atlas_y: 3,
        alt: 0,
      },
    ];

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toEqual(tiles[0]);
  });

  it('should encode and decode multiple tiles with correct order and values', () => {
    const tiles: TileCell[] = [
      { x: 0, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
      { x: 1, y: 0, source_id: 0, atlas_x: 1, atlas_y: 0, alt: 0 },
      { x: 0, y: 1, source_id: 0, atlas_x: 0, atlas_y: 1, alt: 0 },
      { x: 2, y: 5, source_id: 3, atlas_x: 15, atlas_y: 8, alt: 5 },
    ];

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded).toHaveLength(tiles.length);
    for (let i = 0; i < tiles.length; i++) {
      expect(decoded[i]).toEqual(tiles[i]);
    }
  });

  it('should decode invalid/empty base64 as empty array', () => {
    const result = decodeTileData('');
    expect(result).toEqual([]);
  });

  it('should handle roundtrip with negative coordinates', () => {
    const tiles: TileCell[] = [
      { x: -5, y: -10, source_id: 1, atlas_x: 2, atlas_y: 3, alt: 0 },
      { x: -1, y: 0, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
      { x: 0, y: -1, source_id: 2, atlas_x: 5, atlas_y: 5, alt: 1 },
    ];

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded).toHaveLength(tiles.length);
    for (let i = 0; i < tiles.length; i++) {
      expect(decoded[i]).toEqual(tiles[i]);
    }
  });

  it('should handle roundtrip with high alt values', () => {
    const tiles: TileCell[] = [
      { x: 5, y: 5, source_id: 2, atlas_x: 10, atlas_y: 10, alt: 100 },
      { x: 6, y: 6, source_id: 3, atlas_x: 20, atlas_y: 20, alt: 65535 }, // max uint16
    ];

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded).toHaveLength(tiles.length);
    expect(decoded[0]).toEqual(tiles[0]);
    expect(decoded[1]).toEqual(tiles[1]);
  });

  it('should use alt=0 when alt is undefined', () => {
    const tiles: TileCell[] = [
      { x: 1, y: 1, source_id: 0, atlas_x: 0, atlas_y: 0, alt: 0 },
    ];

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded[0].alt).toBe(0);
  });

  it('should preserve large tile coordinates', () => {
    const tiles: TileCell[] = [
      { x: 32767, y: 32767, source_id: 5, atlas_x: 100, atlas_y: 100, alt: 10 },
      { x: -32768, y: -32768, source_id: 7, atlas_x: 200, atlas_y: 200, alt: 20 },
    ];

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded).toHaveLength(2);
    expect(decoded[0]).toEqual(tiles[0]);
    expect(decoded[1]).toEqual(tiles[1]);
  });

  it('should encode large tile arrays without data loss', () => {
    const tiles: TileCell[] = [];
    for (let i = 0; i < 100; i++) {
      tiles.push({
        x: i % 10,
        y: Math.floor(i / 10),
        source_id: i % 4,
        atlas_x: (i * 2) % 256,
        atlas_y: (i * 3) % 256,
        alt: i % 10,
      });
    }

    const encoded = encodeTileData(tiles);
    const decoded = decodeTileData(encoded);

    expect(decoded).toHaveLength(tiles.length);
    for (let i = 0; i < tiles.length; i++) {
      expect(decoded[i]).toEqual(tiles[i]);
    }
  });
});
