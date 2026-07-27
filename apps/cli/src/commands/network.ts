import { Command } from 'commander';
import { sendCommand, fail } from './shared.js';

const networkCmd = new Command('network').description(
  'Network interception — block/redirect/watch requests (subcommands: route, unroute, routes, watch, unwatch, watch-file, requests, request)',
);

networkCmd
  .command('route <pattern>')
  .description('Add a network route (block or redirect requests matching pattern)')
  .option('--abort', 'Abort requests matching this pattern')
  .option('--redirect <url>', 'Redirect requests to this URL')
  .action(async (pattern: string, opts: { abort?: boolean; redirect?: string }, cmd: Command) => {
    if (!opts.abort && !opts.redirect) {
      fail(
        cmd,
        'INVALID_ARGS',
        'Must specify either --abort or --redirect <url>',
        'Add --abort to block matching requests, or --redirect <url> to redirect them.',
      );
    }
    if (opts.abort && opts.redirect) {
      fail(
        cmd,
        'INVALID_ARGS',
        'Cannot specify both --abort and --redirect',
        'Pick one: --abort or --redirect <url>, not both.',
      );
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
      console.log(`Route #${result.routeId} added: ${result.action} ${result.pattern}`);
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
      const { routes } = result;
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
  .option('--ndjson', 'Write the output file as NDJSON (one JSON record per line)')
  .action(
    async (
      pattern: string | undefined,
      opts: { timeout: string; body?: boolean; method?: string; ndjson?: boolean },
      cmd: Command,
    ) => {
      const result = await sendCommand(cmd, {
        action: 'networkWatch',
        params: {
          pattern,
          timeout: parseInt(opts.timeout, 10),
          body: opts.body,
          method: opts.method,
          json: opts.ndjson,
        },
      });

      if (result) {
        const timeoutSec = Math.round(result.timeout / 1000);
        console.log(
          `Watching network requests matching "${result.pattern}" for ${timeoutSec}s (tab ${result.tabId})`,
        );
        console.log(`Results -> ${result.filePath}`);
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
      console.log(
        `Watch ${result.watchId} stopped - ${result.requestCount} requests captured in ${result.duration}s` +
          (result.pendingCount > 0 ? ` (${result.pendingCount} still pending)` : ''),
      );
      console.log(`Results -> ${result.filePath}`);
    }
  });

networkCmd
  .command('watch-file [watchId]')
  .description(
    'Print the output file path for a watch (omit id, or use "latest", for the most recent)',
  )
  .action(async (watchId: string | undefined, opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'networkWatchFile',
      params: { watchId },
    });

    if (result) {
      console.log(result.filePath);
    }
  });

networkCmd
  .command('requests')
  .description('List recently observed network requests (no CDP required)')
  .option('--filter <substr>', 'Only show requests whose URL contains this substring')
  .option('--limit <n>', 'Max requests to show (default 50)')
  .option('--all', 'Include requests from every tab, not just the target tab')
  .option('--clear', 'Clear the recorded requests instead of listing them')
  .action(
    async (
      opts: { filter?: string; limit?: string; all?: boolean; clear?: boolean },
      cmd: Command,
    ) => {
      const result = await sendCommand(cmd, {
        action: 'networkRequests',
        params: {
          filter: opts.filter,
          limit: opts.limit ? parseInt(opts.limit, 10) : undefined,
          all: opts.all,
          clear: opts.clear,
        },
      });

      if (!result) return;

      if (opts.clear) {
        console.log(`Cleared ${result.cleared ?? 0} recorded requests`);
        return;
      }

      if (result.requests.length === 0) {
        console.log('(no requests recorded)');
        return;
      }

      const idWidth = Math.max(...result.requests.map((r) => r.id.length));
      const methodWidth = Math.max(...result.requests.map((r) => r.method.length));
      for (const r of result.requests) {
        const status = r.status != null ? String(r.status) : r.error ? 'ERR' : '...';
        const duration = r.duration != null ? `${r.duration}ms` : '';
        console.log(
          `${r.id.padEnd(idWidth)}  ${r.method.padEnd(methodWidth)} ${r.url}  ${status}  ${duration}`,
        );
      }
    },
  );

networkCmd
  .command('request <id>')
  .description('Show full details for one recorded request (see: network requests)')
  .action(async (id: string, opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'networkRequest',
      params: { id },
    });

    if (result) {
      const r = result.request;
      console.log(`id: ${r.id}`);
      console.log(`method: ${r.method}`);
      console.log(`url: ${r.url}`);
      console.log(`type: ${r.type}`);
      console.log(`tabId: ${r.tabId}`);
      console.log(`timestamp: ${new Date(r.timestamp).toISOString()}`);
      if (r.status != null) console.log(`status: ${r.status}`);
      if (r.statusLine) console.log(`statusLine: ${r.statusLine}`);
      if (r.duration != null) console.log(`duration: ${r.duration}ms`);
      if (r.fromCache != null) console.log(`fromCache: ${r.fromCache}`);
      if (r.ip) console.log(`ip: ${r.ip}`);
      if (r.frameId != null) console.log(`frameId: ${r.frameId}`);
      if (r.initiator) console.log(`initiator: ${r.initiator}`);
      if (r.error) console.log(`error: ${r.error}`);
    }
  });

export { networkCmd as networkCommand };
