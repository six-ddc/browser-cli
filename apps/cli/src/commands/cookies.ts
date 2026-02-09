import { Command } from 'commander';
import { sendCommand } from './shared.js';

const cookiesCmd = new Command('cookies')
  .description('Cookie management');

cookiesCmd
  .command('get [name]')
  .description('Get cookies (optionally filter by name)')
  .option('--url <url>', 'URL to get cookies for')
  .option('--domain <domain>', 'Domain to filter by')
  .action(async (name: string | undefined, opts: { url?: string; domain?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'cookiesGet',
      params: { name, url: opts.url, domain: opts.domain },
    });
    if (result) {
      const cookies = result.cookies as Array<{
        name: string;
        value: string;
        domain: string;
        path: string;
        secure: boolean;
        httpOnly: boolean;
        sameSite: string;
      }>;
      if (cookies.length === 0) {
        console.log('(no cookies)');
        return;
      }
      for (const c of cookies) {
        const flags = [
          c.secure ? 'Secure' : '',
          c.httpOnly ? 'HttpOnly' : '',
          c.sameSite !== 'unspecified' ? `SameSite=${c.sameSite}` : '',
        ]
          .filter(Boolean)
          .join(', ');
        console.log(`${c.name}=${c.value.substring(0, 50)}${c.value.length > 50 ? '...' : ''}`);
        console.log(`  Domain: ${c.domain}  Path: ${c.path}  ${flags}`);
      }
    }
  });

cookiesCmd
  .command('set')
  .description('Set a cookie')
  .requiredOption('--url <url>', 'URL for the cookie')
  .requiredOption('--name <name>', 'Cookie name')
  .requiredOption('--value <value>', 'Cookie value')
  .option('--domain <domain>', 'Cookie domain')
  .option('--path <path>', 'Cookie path')
  .option('--secure', 'Secure flag')
  .option('--httponly', 'HttpOnly flag')
  .option('--samesite <v>', 'SameSite: no_restriction, lax, strict')
  .action(async (opts: {
    url: string;
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httponly?: boolean;
    samesite?: string;
  }, cmd: Command) => {
    await sendCommand(cmd, {
      action: 'cookiesSet',
      params: {
        url: opts.url,
        name: opts.name,
        value: opts.value,
        domain: opts.domain,
        path: opts.path,
        secure: opts.secure,
        httpOnly: opts.httponly,
        sameSite: opts.samesite as 'no_restriction' | 'lax' | 'strict' | undefined,
      },
    });
    console.log('Cookie set');
  });

cookiesCmd
  .command('clear')
  .description('Clear cookies')
  .option('--url <url>', 'URL to clear cookies for')
  .option('--domain <domain>', 'Domain to clear cookies for')
  .action(async (opts: { url?: string; domain?: string }, cmd: Command) => {
    const result = await sendCommand(cmd, {
      action: 'cookiesClear',
      params: { url: opts.url, domain: opts.domain },
    });
    if (result) console.log(`Cleared ${result.cleared} cookies`);
  });

export { cookiesCmd as cookiesCommand };
