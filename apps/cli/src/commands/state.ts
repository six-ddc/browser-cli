import { Command } from 'commander';
import { readFileSync, writeFileSync } from 'node:fs';
import { fail, getRootOpts, sendCommand } from './shared.js';
import { logger } from '../util/logger.js';

export const stateCommand = new Command('state').description(
  'Save or load browser state (cookies + storage)',
);

stateCommand
  .command('save')
  .description('Export cookies + storage to a JSON file')
  .argument('<path>', 'File path to save state')
  .action(async (filePath: string, _opts: unknown, cmd: Command) => {
    // skipJson so the file is written before any output — under plain --json
    // sendCommand exits as soon as it prints.
    const result = await sendCommand(
      cmd,
      { action: 'stateExport', params: {} },
      { skipJson: true },
    );
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

    if (getRootOpts(cmd).json) {
      console.log(
        JSON.stringify(
          {
            success: true,
            data: {
              path: filePath,
              url: result.url,
              cookies,
              localStorage: local,
              sessionStorage: session,
            },
          },
          null,
          2,
        ),
      );
      return;
    }

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
    } catch (err) {
      fail(
        cmd,
        'INVALID_ARGS',
        `Failed to read state file ${filePath}: ${(err as Error).message}`,
        "Pass the path of a file written by 'state save'.",
      );
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
    } catch (err) {
      fail(
        cmd,
        'INVALID_ARGS',
        `Invalid JSON in state file ${filePath}: ${(err as Error).message}`,
        "Regenerate it with 'state save <path>'.",
      );
    }

    if (stateData.version !== 1) {
      fail(
        cmd,
        'INVALID_ARGS',
        `Unsupported state file version: ${String(stateData.version)} (expected 1)`,
        "Regenerate it with 'state save <path>'.",
      );
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
