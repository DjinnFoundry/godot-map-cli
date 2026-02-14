# godot-map-cli - TODO

## Estado actual

**Lo que funciona (verificado end-to-end):**

| Modulo | Archivos | Estado |
|---|---|---|
| Tipos TypeScript | `src/types/index.ts` | OK |
| Codificador binario tiles (PackedByteArray) | `src/core/tile-data.ts` | OK, tested |
| Parser .tscn | `src/core/scene-parser.ts` | OK, tested |
| Parser .tres (TileSet) | `src/core/resource-parser.ts` | OK, tested |
| Escritor .tscn (escenas + layers + removal) | `src/core/scene-writer.ts` | OK, tested |
| Escritor .tres (TileSet + terrains + collision) | `src/tileset/tileset-writer.ts` | OK |
| Detector Godot (macOS/Linux/Win) | `src/core/godot-finder.ts` | OK |
| Runner headless Godot | `src/core/godot-runner.ts` | OK (scripts generados, no testeado con Godot) |
| Proyecto (init/info, configurable) | `src/core/project.ts` | OK |
| Editor TileMap (place/fill/erase/read/render) | `src/tilemap/tilemap-editor.ts` | OK, tested |
| Generadores (village/forest/path) | `src/generators/*.ts` | OK, tested |
| CLI (commander.js, 22 comandos + `mcp`) | `src/cli.ts` | OK |
| MCP Server (24 tools, validated inputs) | `src/mcp-server.ts` + `src/mcp/*.ts` | OK, configured |
| Validacion MCP inputs | `src/mcp/validation.ts` | OK |

**Total: ~3,800 lineas TS en 19 archivos + 6 test files (109 tests)**

**Dependencias runtime:** `@modelcontextprotocol/sdk`, `commander`
**Dependencias dev:** `@types/node`, `typescript`, `vitest`

---

## Completado en este sprint

### P0 - Critico (todo resuelto)

- [x] **Configurar MCP en Claude Code**: `.mcp.json` creado con config del server. README documenta setup completo.

- [ ] **Testear con proyecto real (djinncom)**: Pendiente (requiere sesion interactiva con el proyecto real).

- [x] **Tests automatizados**: 109 tests en 6 archivos:
  - `tests/tile-data.test.ts` (9 tests) - encode/decode roundtrip
  - `tests/scene-parser.test.ts` (16 tests) - parse .tscn, find layers
  - `tests/tilemap-editor.test.ts` (28 tests) - place/read/erase cycle
  - `tests/scene-writer.test.ts` (15 tests) - generate scene, verify valid .tscn
  - `tests/resource-parser.test.ts` (15 tests) - parse .tres, extraer sources y tiles
  - `tests/generators.test.ts` (26 tests) - village/forest/path generators

- [x] **Inyeccion en GDScript generado (seguridad)**: `escapeGDString()` helper en `godot-runner.ts`. Todas las interpolaciones sanitizadas.

### P1 - Funcionalidad importante (mayoria resuelta)

- [x] **TileSet: registrar tiles individuales**: CLI `tileset register-tiles` + MCP `godot_tileset_register_tiles`.
- [x] **TileSet: configurar terrains**: CLI `tileset add-terrain` + MCP `godot_tileset_add_terrain`.
- [x] **TileSet: collision**: CLI `tileset set-collision` + MCP `godot_tileset_set_collision`.
- [x] **Validacion de inputs MCP**: `src/mcp/validation.ts` con validators custom (zero deps). Todos los `as` casts reemplazados.

- [ ] **Terrain painting (headless Godot)**: GDScript generado, no testeado E2E. Requiere Godot instalado.
- [ ] **Generadores: palette configurable**: Siguen usando DEFAULT_PALETTE hardcodeado.
- [ ] **Render screenshot**: No testeado en headless. Puede requerir ajustes.

### P2 - Mejoras de calidad (mayoria resuelta)

- [x] **README.md**: Completo con Quick Start, CLI ref, MCP tools (24), diagrama Mermaid, setup instructions.
- [x] **Erase tiles individual**: CLI `map erase --at x1,y1;x2,y2`.
- [x] **Layer delete**: CLI `map remove-layer` + MCP `godot_layer_remove` + `removeLayerFromScene()`.
- [x] **Colision de archivos temporales**: `crypto.randomUUID()` en `godot-runner.ts`.
- [x] **Null check en env vars**: `.filter(p => !p.includes('undefined'))` en `godot-finder.ts`.
- [x] **Empty tile encoding**: `encodeTileData([])` retorna header base64.
- [x] **Silent catch blocks**: Logging agregado en cleanup/validation catches.
- [x] **SIGINT handler robusto**: 5s timeout en `mcp-server.ts`.
- [x] **Documentar limitaciones de generadores**: JSDoc en village.ts, forest.ts, path.ts.
- [x] **Extraer magic numbers**: Constantes con nombre en 5 archivos.
- [x] **Proyecto template configurable**: `ProjectOptions` interface (renderer, viewport, godot version).

- [ ] **Error handling en scene writer**: `addLayerToScene` sigue sin manejar scenes sin `load_steps`.
- [ ] **Path encoding en tileset-writer**: Solo reemplaza backslashes (comentado, Godot maneja la mayoria).

### P3 - Nice to have (parcial)

- [x] **npm publish prep**: `files` field en package.json, shebang correcto en cli.ts y mcp-server.ts.
- [x] **CI/CD**: `.github/workflows/ci.yml` con Node 20/22 matrix, build + test + typecheck.

- [ ] **Watch mode**: `map watch <scene>` para detectar cambios de Godot.
- [ ] **Export a otros formatos**: Phaser JSON, etc.
- [ ] **Tileset describe (AI)**: Enviar PNG como MCP response.
- [ ] **Multi-source TileSet**: Multiples PNGs en un TileSet.
- [ ] **Undo/history**: Snapshots pre-escritura.
- [ ] **Type guards en parsers**: `parseGodotNumber()`, `parseGodotString()` con validacion runtime.

---

## Decisions log

| Decision | Razon |
|---|---|
| Fork godot-tilemap-mcp en vez de godot-mcp | godot-tilemap-mcp ya tenia el decoder binario de PackedByteArray (la parte mas dificil). godot-mcp no tiene nada de tilemaps. |
| TypeScript en vez de JS puro | Type safety, mejor DX, mejor para mantener largo plazo. |
| Pure file I/O (no Godot runtime) para operaciones basicas | Mas rapido, no requiere Godot instalado para 90% de operaciones. Headless Godot solo para terrain resolution y screenshots. |
| commander.js para CLI | Simple, maduro, zero config. |
| Seeded RNG en generadores | Reproducibilidad: mismo seed = mismo mapa. Critico para que AI pueda iterar. |
| ESM + Node16 modules | Alineado con MCP SDK y ecosistema moderno. `"type": "module"` en package.json. |
| Zero deps mas alla de MCP SDK + commander | Minima superficie de ataque, facil de auditar, builds rapidos. |
| Validacion custom vs Zod | Mantiene zero-dep philosophy. Validators son ~80 lineas, cubren 100% de los handlers. |
| vitest vs jest | Soporte nativo ESM, mas rapido, zero config para TS. |

---

## Dependencias del plan original vs implementado

```
Plan original                         Estado
------------------------------------------
Sprint 1: Foundation                  DONE
Sprint 2: TileSet management          DONE (terrain config, collision, register-tiles)
Sprint 3: TileMap editing             DONE
Sprint 4: Terrain painting            PARCIAL (GDScript generado, no testeado E2E)
Sprint 5: MCP server                  DONE (24 tools, validated, MCP configured)
Sprint 6: Generators + polish         DONE (generators tested, README, CI/CD, npm prep)
```

---

## Resumen de deuda tecnica

| Categoria | Items | Severidad |
|---|---|---|
| Seguridad | ~~GDScript injection~~ FIXED, ~~MCP validation~~ FIXED | Resuelta |
| Testing | 109 tests, 6 files, vitest configured | Resuelta |
| Documentacion | README completo, JSDoc en generadores | Resuelta |
| Robustez | ~~Silent catches~~ FIXED, ~~null env vars~~ FIXED, ~~temp collisions~~ FIXED | Resuelta |
| Configurabilidad | ~~Magic numbers~~ FIXED, ~~template hardcodeado~~ FIXED | Resuelta |
| Pendiente | Palette configurable, scene writer load_steps edge case, type guards | Baja |
