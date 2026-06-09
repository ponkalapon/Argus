#!/usr/bin/env node

/**
 * Argus CLI — Local AI Agent
 *
 * Usage:
 *   argus                  → Start CLI (REPL)
 *   argus cli              → Start CLI (REPL)
 *   argus api              → Start HTTP API server
 *   argus --help           → Show this help
 */

import { ArgusCore } from './core/index.js';
import { CLI } from './cli/index.js';
import { startApiServer } from './api/server.js';

// ─── Config from env / defaults ───
const config = {
  baseUrl: process.env.ARGUS_BASE_URL || 'https://api.openai.com/v1',
  model: process.env.ARGUS_MODEL || 'gpt-4o-mini',
  apiKey: process.env.ARGUS_API_KEY || '',
  dataDir: process.env.ARGUS_DATA_DIR || '',
  port: parseInt(process.env.ARGUS_PORT || '3456', 10),
};

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'cli';

  // Help
  if (mode === '--help' || mode === '-h') {
    console.log(`
Argus CLI — Local AI Agent

Usage:
  argus              Start interactive CLI (REPL)
  argus cli          Start interactive CLI (REPL)
  argus api          Start HTTP API server

Environment:
  ARGUS_API_KEY      OpenAI/OpenRouter API key
  ARGUS_BASE_URL     API base URL (default: https://api.openai.com/v1)
  ARGUS_MODEL        Model name (default: gpt-4o-mini)
  ARGUS_DATA_DIR     Data directory (default: ./data)
  ARGUS_PORT         API server port (default: 3456)
`);
    process.exit(0);
  }

  // Init core
  const core = new ArgusCore(config);
  await core.init();

  // Show mode
  if (mode === 'api') {
    startApiServer(core);
  } else {
    const cli = new CLI(core);
    await cli.start();
  }
}

main().catch((err) => {
  console.error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
