import { Command } from 'commander';
import { BrowserCliError } from '@browser-cli/shared';
import { parseProfiles, TOOL_PROFILES } from '../mcp/profiles.js';
import { runMcpServer } from '../mcp/server.js';
import { logger, reserveStdoutForProtocol } from '../util/logger.js';
import { fail, getBatchContext } from './shared.js';

export const mcpCommand = new Command('mcp')
  .description('Run as an MCP (Model Context Protocol) stdio server')
  .option(
    '--tools <profiles>',
    `Comma-separated tool profiles: ${TOOL_PROFILES.join(', ')}, all`,
    'core',
  )
  .addHelpText(
    'after',
    `
Profiles:
  core      navigation, snapshot, click/fill/type/press, wait, screenshot, eval, basic tabs
  network   request log and request interception
  state     cookies, web storage, state export/import
  debug     console, page errors, CDP, daemon logs
  tabs      tab close/groups and window management
  all       every profile

Example MCP client entry:
  { "browser-cli": { "command": "browser-cli", "args": ["mcp", "--tools", "core,state"] } }`,
  )
  .action(async (opts: { tools?: string }, cmd: Command) => {
    if (getBatchContext()) {
      fail(
        cmd,
        'INVALID_ARGS',
        "'mcp' cannot run inside batch or repl",
        'The MCP server owns stdin and stdout — run it as its own process.',
      );
    }

    let profiles;
    try {
      profiles = parseProfiles(opts.tools);
    } catch (err) {
      if (!(err instanceof BrowserCliError)) throw err;
      fail(cmd, err.code, err.message, err.hint);
    }

    reserveStdoutForProtocol();

    try {
      await runMcpServer({ profiles });
    } catch (err) {
      if (err instanceof BrowserCliError) fail(cmd, err.code, err.message, err.hint);
      logger.error(`MCP server stopped: ${(err as Error).message}`);
      process.exit(1);
    }
  });
