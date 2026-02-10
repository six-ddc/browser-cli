import { Command } from 'commander';
import { sendCommand } from './shared.js';

const networkCmd = new Command('network')
  .description('Network interception (block/redirect/track requests)');

networkCmd
  .command('route <pattern>')
  .description('Add a network route (block or redirect requests matching pattern)')
  .option('--block', 'Block requests matching this pattern')
  .option('--redirect <url>', 'Redirect requests to this URL')
  .action(async (pattern: string, opts: { block?: boolean; redirect?: string }, cmd: Command) => {
    if (!opts.block && !opts.redirect) {
      console.error('Error: Must specify either --block or --redirect <url>');
      process.exit(1);
    }
    if (opts.block && opts.redirect) {
      console.error('Error: Cannot specify both --block and --redirect');
      process.exit(1);
    }

    const action = opts.block ? 'block' : 'redirect';
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
      const routes = (result as { routes: Array<{ id: number; pattern: string; action: string; redirectUrl?: string; createdAt: number }> }).routes;
      if (routes.length === 0) {
        console.log('(no active routes)');
        return;
      }

      for (const route of routes) {
        const age = Math.floor((Date.now() - route.createdAt) / 1000);
        const action = route.action === 'redirect' && route.redirectUrl
          ? `redirect → ${route.redirectUrl}`
          : route.action;
        console.log(`#${route.id}  ${route.pattern}  [${action}]  (${age}s ago)`);
      }
    }
  });

networkCmd
  .command('requests')
  .description('List tracked network requests')
  .option('--pattern <pattern>', 'Filter by URL pattern')
  .option('--tab <tabId>', 'Filter by tab ID')
  .option('--blocked', 'Only show blocked/redirected requests')
  .option('--limit <n>', 'Limit number of results', '50')
  .action(async (opts: { pattern?: string; tab?: string; blocked?: boolean; limit: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'getRequests',
      params: {
        pattern: opts.pattern,
        tabId: opts.tab ? parseInt(opts.tab, 10) : undefined,
        blockedOnly: opts.blocked,
        limit: parseInt(opts.limit, 10),
      },
    });

    if (result) {
      const data = result as { requests: Array<{ id: string; url: string; method: string; type: string; timestamp: number; tabId: number; blocked?: boolean; redirectedTo?: string }>; total: number };
      const { requests, total } = data;

      if (requests.length === 0) {
        console.log('(no requests)');
        return;
      }

      console.log(`Showing ${requests.length} of ${total} requests:\n`);

      for (const req of requests) {
        const status = req.blocked ? '[BLOCKED]' : req.redirectedTo ? `[REDIRECT → ${req.redirectedTo}]` : '';
        const age = Math.floor((Date.now() - req.timestamp) / 1000);
        console.log(`${req.method} ${req.url}`);
        console.log(`  Type: ${req.type}  Tab: ${req.tabId}  ${status}  (${age}s ago)`);
      }
    }
  });

networkCmd
  .command('clear')
  .description('Clear all tracked requests')
  .action(async (opts: unknown, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'clearRequests',
      params: {},
    });

    if (result) {
      const cleared = (result as { cleared: number }).cleared;
      console.log(`Cleared ${cleared} requests`);
    }
  });

export { networkCmd as networkCommand };
