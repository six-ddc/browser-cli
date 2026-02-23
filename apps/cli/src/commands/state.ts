import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { sendCommand } from './shared.js';
import { logger } from '../util/logger.js';

export const stateCommand = new Command('state').description(
  'Save or load browser state (cookies + storage)',
);

stateCommand
  .command('save')
  .description('Export cookies + storage to a JSON file')
  .argument('<path>', 'File path to save state')
  .action(async (filePath: string, _opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, { action: 'stateExport', params: {} });
    if (!result) return;

    const stateData = {
      version: 1,
      timestamp: new Date().toISOString(),
      url: result.url,
      cookies: result.cookies,
      localStorage: result.localStorage,
      sessionStorage: result.sessionStorage,
    };

    writeFileSync(filePath, JSON.stringify(stateData, null, 2));
    const cookies = Array.isArray(result.cookies) ? result.cookies.length : 0;
    const local = Object.keys(result.localStorage).length;
    const session = Object.keys(result.sessionStorage).length;
    logger.success(
      `State saved to ${filePath} (${cookies} cookies, ${local} localStorage, ${session} sessionStorage)`,
    );
  });

stateCommand
  .command('load')
  .description('Import cookies + storage from a JSON file')
  .argument('<path>', 'File path to load state from')
  .action(async (filePath: string, _opts: unknown, cmd: Command) => {
    let raw: string;
    try {
      raw = readFileSync(filePath, 'utf-8');
    } catch {
      logger.error(`Failed to read file: ${filePath}`);
      process.exit(1);
    }

    let stateData: {
      version?: number;
      cookies?: Array<{
        url?: string;
        name: string;
        value: string;
        domain?: string;
        path?: string;
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: string;
        expirationDate?: number;
      }>;
      localStorage?: Record<string, string>;
      sessionStorage?: Record<string, string>;
    };
    try {
      stateData = JSON.parse(raw) as typeof stateData;
    } catch {
      logger.error('Invalid JSON in state file');
      process.exit(1);
    }

    if (stateData.version !== 1) {
      logger.error(`Unsupported state file version: ${stateData.version}`);
      process.exit(1);
    }

    // Transform cookies for import: add url from domain if missing, normalize sameSite
    type SameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';
    const validSameSite = new Set<string>(['no_restriction', 'lax', 'strict', 'unspecified']);
    const cookies = stateData.cookies?.map((c) => {
      const domain = c.domain?.replace(/^\./, '') || '';
      const protocol = c.secure ? 'https' : 'http';
      const url = c.url || `${protocol}://${domain}${c.path || '/'}`;
      const sameSite =
        c.sameSite && validSameSite.has(c.sameSite) ? (c.sameSite as SameSite) : undefined;
      return { ...c, url, sameSite };
    });

    const result = await sendCommand(cmd, {
      action: 'stateImport',
      params: {
        cookies,
        localStorage: stateData.localStorage,
        sessionStorage: stateData.sessionStorage,
      },
    });

    if (result) {
      const { imported } = result;
      logger.success(
        `State loaded from ${filePath} (${imported.cookies} cookies, ${imported.localStorage} localStorage, ${imported.sessionStorage} sessionStorage)`,
      );
    }
  });
