import { Command } from 'commander';
import { sendCommand } from './shared.js';

const networkCmd = new Command('network').description(
  'Network interception — block/redirect/watch requests (subcommands: route, unroute, routes, watch, unwatch)',
);

networkCmd
  .command('route <pattern>')
  .description('Add a network route (block or redirect requests matching pattern)')
  .option('--abort', 'Abort requests matching this pattern')
  .option('--redirect <url>', 'Redirect requests to this URL')
  .action(async (pattern: string, opts: { abort?: boolean; redirect?: string }, cmd: Command) => {
    if (!opts.abort && !opts.redirect) {
      console.error('Error: Must specify either --abort or --redirect <url>');
      process.exit(1);
    }
    if (opts.abort && opts.redirect) {
      console.error('Error: Cannot specify both --abort and --redirect');
      process.exit(1);
    }

    const action = opts.abort ? 'block' : 'redirect';
    const result = await sendCommand(cmd, {
      action: 'route',
      params: {
        pattern,
        action,
        redirectUrl: opts.redirect,
      },
    });

    if (result) {
      const r = result as { routeId: number; pattern: string; action: string };
      console.log(`Route #${r.routeId} added: ${r.action} ${r.pattern}`);
    }
  });

networkCmd
  .command('unroute <routeId>')
  .description('Remove a network route by ID')
  .action(async (routeId: string, opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'unroute',
      params: { routeId: parseInt(routeId, 10) },
    });

    if (result) {
      console.log(`Route #${routeId} removed`);
    }
  });

networkCmd
  .command('routes')
  .description('List all active network routes')
  .action(async (opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'getRoutes',
      params: {},
    });

    if (result) {
      const routes = (
        result as {
          routes: Array<{
            id: number;
            pattern: string;
            action: string;
            redirectUrl?: string;
            createdAt: number;
          }>;
        }
      ).routes;
      if (routes.length === 0) {
        console.log('(no active routes)');
        return;
      }

      for (const route of routes) {
        const age = Math.floor((Date.now() - route.createdAt) / 1000);
        const action =
          route.action === 'redirect' && route.redirectUrl
            ? `redirect → ${route.redirectUrl}`
            : route.action;
        console.log(`#${route.id}  ${route.pattern}  [${action}]  (${age}s ago)`);
      }
    }
  });

networkCmd
  .command('watch [pattern]')
  .description('Monitor API requests/responses via CDP (non-blocking, writes to file)')
  .option('--timeout <ms>', 'Auto-stop after ms', '30000')
  .option('--body', 'Capture response bodies (skips binary)')
  .option('--method <method>', 'Filter by HTTP method')
  .action(
    async (
      pattern: string | undefined,
      opts: { timeout: string; body?: boolean; method?: string },
      cmd: Command,
    ) => {
      const result = await sendCommand(cmd, {
        action: 'networkWatch',
        params: {
          pattern,
          timeout: parseInt(opts.timeout, 10),
          body: opts.body,
          method: opts.method,
        },
      });

      if (result) {
        const r = result as {
          watchId: string;
          tabId: number;
          pattern: string;
          timeout: number;
          filePath: string;
        };
        const timeoutSec = Math.round(r.timeout / 1000);
        console.log(
          `Watching network requests matching "${r.pattern}" for ${timeoutSec}s (tab ${r.tabId})`,
        );
        console.log(`Results → ${r.filePath}`);
      }
    },
  );

networkCmd
  .command('unwatch')
  .description('Stop an active network watch (use --tab to target specific tab)')
  .action(async (opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'networkUnwatch',
      params: {},
    });

    if (result) {
      const r = result as {
        watchId: string;
        requestCount: number;
        duration: number;
        filePath: string;
      };
      console.log(
        `Watch ${r.watchId} stopped — ${r.requestCount} requests captured in ${r.duration}s`,
      );
      console.log(`Results → ${r.filePath}`);
    }
  });

export { networkCmd as networkCommand };
