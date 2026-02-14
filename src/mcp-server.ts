#!/usr/bin/env node
/**
 * godot-map-cli MCP Server
 *
 * Exposes Godot tilemap operations as MCP tools for Claude Code.
 * Run with: node dist/mcp-server.js
 * Set GODOT_PROJECT_PATH to default project path.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS } from './mcp/tools.js';
import { handleTool } from './mcp/handlers.js';

class GodotMapMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: 'godot-map-cli', version: '0.1.0' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_DEFINITIONS as unknown as Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await handleTool(name, (args || {}) as Record<string, unknown>);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    });
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[godot-map-cli] Server error:', error);
    };
    process.on('SIGINT', async () => {
      const forceExit = setTimeout(() => process.exit(1), 5000);
      try {
        await this.server.close();
      } finally {
        clearTimeout(forceExit);
        process.exit(0);
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`[godot-map-cli] MCP server running. Project: ${process.env.GODOT_PROJECT_PATH || '(not set)'}`);
  }
}

const server = new GodotMapMCPServer();
server.run().catch(console.error);
