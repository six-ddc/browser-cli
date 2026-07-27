import { describe, it, expect } from 'vitest';
import type { z } from 'zod';
import { BrowserCliError, schemas } from '@browser-cli/shared';
import type { Command as BrowserCommand } from '@browser-cli/shared';
import { DEFAULT_PROFILES, parseProfiles, TOOL_PROFILES } from '../src/mcp/profiles.js';
import { allTools, toolsForProfiles, type McpTool } from '../src/mcp/tools.js';

class Stop extends Error {}
const STOP = new Stop('stop');

/** Run a tool far enough to capture the protocol command it would have sent. */
async function capture(tool: McpTool, args: Record<string, unknown>): Promise<BrowserCommand> {
  let captured: BrowserCommand | undefined;
  try {
    await tool.run(args, (command) => {
      captured = command;
      throw STOP;
    });
  } catch (err) {
    if (err !== STOP) throw err;
  }
  if (!captured) throw new Error(`${tool.name} did not send a command`);
  return captured;
}

/** Smallest value the field accepts, or undefined when the field is optional. */
function sampleFor(schema: z.ZodType): unknown {
  if (schema.safeParse(undefined).success) return undefined;
  const candidates: unknown[] = [];
  const options = (schema as unknown as { options?: unknown[] }).options;
  if (Array.isArray(options)) candidates.push(...options);
  candidates.push('https://example.com/page', 1, true, [], {});
  for (const candidate of candidates) {
    if (schema.safeParse(candidate).success) return candidate;
  }
  throw new Error('no sample value fits the schema');
}

function sampleArgs(tool: McpTool): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(tool.config.inputSchema)) {
    const value = sampleFor(schema as z.ZodType);
    if (value !== undefined) args[key] = value;
  }
  return args;
}

function toolNamed(name: string): McpTool {
  const tool = allTools().find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
}

describe('parseProfiles', () => {
  it('defaults to core', () => {
    expect([...parseProfiles(undefined)]).toEqual(DEFAULT_PROFILES);
  });

  it('expands all', () => {
    expect([...parseProfiles('all')].sort()).toEqual([...TOOL_PROFILES].sort());
  });

  it('accepts a comma-separated list and trims whitespace', () => {
    expect([...parseProfiles('core, state')].sort()).toEqual(['core', 'state']);
  });

  it('deduplicates repeated profiles', () => {
    expect([...parseProfiles('core,core')]).toEqual(['core']);
  });

  it('rejects an unknown profile with INVALID_ARGS and a hint listing the valid names', () => {
    let error: unknown;
    try {
      parseProfiles('core,bogus');
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(BrowserCliError);
    const cliError = error as BrowserCliError;
    expect(cliError.code).toBe('INVALID_ARGS');
    expect(cliError.message).toContain('bogus');
    expect(cliError.hint).toContain('core');
    expect(cliError.hint).toContain('all');
  });

  it('rejects an empty list', () => {
    expect(() => parseProfiles(' , ')).toThrow(BrowserCliError);
  });
});

describe('tool registry', () => {
  it('exposes only snake_case, unique tool names', () => {
    const names = allTools().map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('gives every tool a title, an agent-facing description and annotations', () => {
    for (const tool of allTools()) {
      expect(tool.config.title.length).toBeGreaterThan(0);
      expect(tool.config.description.length).toBeGreaterThan(40);
      expect(tool.config.annotations.readOnlyHint).toBeTypeOf('boolean');
    }
  });

  it('assigns every tool to a known profile', () => {
    for (const tool of allTools()) {
      expect(TOOL_PROFILES).toContain(tool.profile);
    }
  });

  it('filters by profile', () => {
    const core = toolsForProfiles(parseProfiles('core'));
    expect(core.every((t) => t.profile === 'core')).toBe(true);
    expect(core.map((t) => t.name)).toContain('snapshot');
    expect(core.map((t) => t.name)).not.toContain('cdp');

    const all = toolsForProfiles(parseProfiles('all'));
    expect(all.length).toBe(allTools().length);
    expect(all.length).toBeGreaterThan(core.length);
  });

  it('keeps the core profile focused on perception and interaction', () => {
    const names = toolsForProfiles(parseProfiles('core')).map((t) => t.name);
    for (const expected of [
      'navigate',
      'snapshot',
      'click',
      'fill',
      'type_text',
      'press',
      'wait_for',
      'screenshot',
      'get_url',
      'get_title',
      'eval_js',
      'tab_list',
      'tab_new',
      'tab_select',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('tells the agent that snapshot is the primary perception tool', () => {
    const description = toolNamed('snapshot').config.description;
    expect(description).toContain('@e');
    expect(description.toLowerCase()).toContain('preferred');
  });
});

describe('tool commands', () => {
  it('builds a protocol-valid command for every tool that talks to the daemon', async () => {
    for (const tool of allTools()) {
      if (tool.name === 'daemon_logs') continue;
      const command = await capture(tool, sampleArgs(tool));
      const parsed = schemas.commandSchema.safeParse(command);
      expect(parsed.success, `${tool.name}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
    }
  });

  it('maps nth onto the position selector', async () => {
    const click = toolNamed('click');
    expect((await capture(click, { selector: 'button' })).params).toMatchObject({
      selector: 'button',
    });
    expect((await capture(click, { selector: 'button', nth: 1 })).params).toMatchObject({
      position: { type: 'first' },
    });
    expect((await capture(click, { selector: 'button', nth: -1 })).params).toMatchObject({
      position: { type: 'last' },
    });
    expect((await capture(click, { selector: 'button', nth: 3 })).params).toMatchObject({
      position: { type: 'nth', index: 3 },
    });
  });

  it('routes wait_for to waitForUrl only when a url pattern is given', async () => {
    const wait = toolNamed('wait_for');
    expect(await capture(wait, { url: '**/done' })).toEqual({
      action: 'waitForUrl',
      params: { pattern: '**/done', timeout: undefined },
    });
    expect((await capture(wait, { selector: '#ok' })).action).toBe('wait');
  });

  it('passes trusted through as the debugger flag', async () => {
    const command = await capture(toolNamed('fill'), {
      selector: '#a',
      value: 'x',
      trusted: true,
    });
    expect(command.params).toMatchObject({ debugger: true });
  });
});

describe('tool results', () => {
  const send = (data: unknown) => () => Promise.resolve(data);

  it('returns the snapshot text verbatim', async () => {
    const content = await toolNamed('snapshot').run(
      {},
      send({ snapshot: 'button "Save" @e1', refCount: 1 }),
    );
    expect(content).toEqual([{ type: 'text', text: 'button "Save" @e1' }]);
  });

  it('returns a screenshot as image content', async () => {
    const content = await toolNamed('screenshot').run(
      {},
      send({ data: 'AAAA', mimeType: 'image/png', width: 2, height: 2 }),
    );
    expect(content).toEqual([{ type: 'image', data: 'AAAA', mimeType: 'image/png' }]);
  });

  it('renders the tab list with the active tab marked', async () => {
    const content = await toolNamed('tab_list').run(
      {},
      send({
        tabs: [
          { id: 1, url: 'https://a.test/', title: 'A', active: false },
          { id: 2, url: 'https://b.test/', title: 'B', active: true },
        ],
      }),
    );
    expect(content[0]).toMatchObject({ type: 'text' });
    const rendered = (content[0] as { text: string }).text;
    expect(rendered).toContain('  [1] A — https://a.test/');
    expect(rendered).toContain('* [2] B — https://b.test/');
  });

  it('reports navigation warnings alongside the landed URL', async () => {
    const content = await toolNamed('navigate').run(
      { url: 'https://a.test/' },
      send({ url: 'https://a.test/home', title: 'Home', warning: 'content script not ready' }),
    );
    const rendered = (content[0] as { text: string }).text;
    expect(rendered).toContain('https://a.test/home');
    expect(rendered).toContain('Warning: content script not ready');
  });

  it('serializes eval results and attached console output', async () => {
    const content = await toolNamed('eval_js').run(
      { expression: '1 + 1' },
      send({ value: 2, logs: [{ level: 'log', args: ['hi'], timestamp: 0 }] }),
    );
    const rendered = (content[0] as { text: string }).text;
    expect(rendered).toContain('2');
    expect(rendered).toContain('[log] hi');
  });

  it('renders an undefined eval result rather than dropping the content block', async () => {
    const content = await toolNamed('eval_js').run(
      { expression: 'undefined' },
      send({ value: undefined }),
    );
    expect(content).toEqual([{ type: 'text', text: 'undefined' }]);
  });

  it('reads daemon logs without touching the socket', async () => {
    const content = await toolNamed('daemon_logs').run({ lines: 1 }, () => {
      throw new Error('daemon_logs must not send a command');
    });
    expect(content[0]).toMatchObject({ type: 'text' });
  });
});
