/**
 * Tests for DOM interaction handlers: drag, keydown, keyup.
 * Also covers existing interactions (click, press) for event sequence validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleInteraction } from '../src/content-lib/dom-interact';
import type { Command } from '@browser-cli/shared';

beforeEach(() => {
  document.body.innerHTML = '';
});

// ─── Drag and Drop ───────────────────────────────────────────────────

describe('drag', () => {
  it('dispatches full drag event sequence', async () => {
    document.body.innerHTML = `
      <div id="source" style="width:50px;height:50px;">Source</div>
      <div id="target" style="width:50px;height:50px;">Target</div>
    `;

    const source = document.getElementById('source')!;
    const target = document.getElementById('target')!;
    const sourceEvents: string[] = [];
    const targetEvents: string[] = [];

    source.addEventListener('dragstart', () => sourceEvents.push('dragstart'));
    source.addEventListener('drag', () => sourceEvents.push('drag'));
    source.addEventListener('dragend', () => sourceEvents.push('dragend'));
    target.addEventListener('dragenter', () => targetEvents.push('dragenter'));
    target.addEventListener('dragover', () => targetEvents.push('dragover'));
    target.addEventListener('drop', () => targetEvents.push('drop'));

    const result = await handleInteraction({
      action: 'drag',
      params: { source: '#source', target: '#target' },
    } as Command);

    expect(result).toEqual({ dragged: true });
    expect(sourceEvents).toEqual(['dragstart', 'drag', 'dragend']);
    expect(targetEvents).toEqual(['dragenter', 'dragover', 'drop']);
  });

  it('throws on invalid source selector', async () => {
    document.body.innerHTML = '<div id="target">Target</div>';

    await expect(
      handleInteraction({
        action: 'drag',
        params: { source: '#nonexistent', target: '#target' },
      } as Command),
    ).rejects.toThrow('Element not found');
  });

  it('throws on invalid target selector', async () => {
    document.body.innerHTML = '<div id="source">Source</div>';

    await expect(
      handleInteraction({
        action: 'drag',
        params: { source: '#source', target: '#nonexistent' },
      } as Command),
    ).rejects.toThrow('Element not found');
  });

  it('creates DragEvent with DataTransfer', async () => {
    document.body.innerHTML = `
      <div id="source" style="width:50px;height:50px;">Source</div>
      <div id="target" style="width:50px;height:50px;">Target</div>
    `;

    let receivedDataTransfer: DataTransfer | null = null;
    const target = document.getElementById('target')!;
    target.addEventListener('drop', (e: Event) => {
      receivedDataTransfer = (e as DragEvent).dataTransfer;
    });

    await handleInteraction({
      action: 'drag',
      params: { source: '#source', target: '#target' },
    } as Command);

    expect(receivedDataTransfer).not.toBeNull();
  });
});

// ─── Keydown ─────────────────────────────────────────────────────────

describe('keydown', () => {
  it('dispatches keydown event on active element', async () => {
    document.body.innerHTML = '<input id="input" />';
    const input = document.getElementById('input')!;
    (input as HTMLInputElement).focus();

    let receivedKey: string | null = null;
    let receivedType: string | null = null;
    input.addEventListener('keydown', (e: Event) => {
      receivedKey = (e as KeyboardEvent).key;
      receivedType = e.type;
    });

    const result = await handleInteraction({
      action: 'keydown',
      params: { key: 'Shift' },
    } as Command);

    expect(result).toEqual({ pressed: true });
    expect(receivedKey).toBe('Shift');
    expect(receivedType).toBe('keydown');
  });

  it('dispatches keydown on specific selector', async () => {
    document.body.innerHTML = '<button id="btn">Click</button>';
    const btn = document.getElementById('btn')!;

    let receivedKey: string | null = null;
    btn.addEventListener('keydown', (e: Event) => {
      receivedKey = (e as KeyboardEvent).key;
    });

    await handleInteraction({
      action: 'keydown',
      params: { key: 'Control', selector: '#btn' },
    } as Command);

    expect(receivedKey).toBe('Control');
  });

  it('does NOT dispatch keyup or keypress', async () => {
    document.body.innerHTML = '<input id="input" />';
    const input = document.getElementById('input')!;
    (input as HTMLInputElement).focus();

    const events: string[] = [];
    input.addEventListener('keydown', () => events.push('keydown'));
    input.addEventListener('keyup', () => events.push('keyup'));
    input.addEventListener('keypress', () => events.push('keypress'));

    await handleInteraction({
      action: 'keydown',
      params: { key: 'A' },
    } as Command);

    expect(events).toEqual(['keydown']);
  });
});

// ─── Keyup ───────────────────────────────────────────────────────────

describe('keyup', () => {
  it('dispatches keyup event on active element', async () => {
    document.body.innerHTML = '<input id="input" />';
    const input = document.getElementById('input')!;
    (input as HTMLInputElement).focus();

    let receivedKey: string | null = null;
    let receivedType: string | null = null;
    input.addEventListener('keyup', (e: Event) => {
      receivedKey = (e as KeyboardEvent).key;
      receivedType = e.type;
    });

    const result = await handleInteraction({
      action: 'keyup',
      params: { key: 'Shift' },
    } as Command);

    expect(result).toEqual({ released: true });
    expect(receivedKey).toBe('Shift');
    expect(receivedType).toBe('keyup');
  });

  it('dispatches keyup on specific selector', async () => {
    document.body.innerHTML = '<div id="target">Target</div>';
    const target = document.getElementById('target')!;

    let receivedKey: string | null = null;
    target.addEventListener('keyup', (e: Event) => {
      receivedKey = (e as KeyboardEvent).key;
    });

    await handleInteraction({
      action: 'keyup',
      params: { key: 'Meta', selector: '#target' },
    } as Command);

    expect(receivedKey).toBe('Meta');
  });

  it('does NOT dispatch keydown or keypress', async () => {
    document.body.innerHTML = '<input id="input" />';
    const input = document.getElementById('input')!;
    (input as HTMLInputElement).focus();

    const events: string[] = [];
    input.addEventListener('keydown', () => events.push('keydown'));
    input.addEventListener('keyup', () => events.push('keyup'));
    input.addEventListener('keypress', () => events.push('keypress'));

    await handleInteraction({
      action: 'keyup',
      params: { key: 'A' },
    } as Command);

    expect(events).toEqual(['keyup']);
  });
});

// ─── keydown + keyup combined (stateful usage) ──────────────────────

describe('keydown + keyup combined', () => {
  it('simulates hold-and-release sequence', async () => {
    document.body.innerHTML = '<input id="input" />';
    const input = document.getElementById('input')!;
    (input as HTMLInputElement).focus();

    const events: string[] = [];
    input.addEventListener('keydown', (e: Event) =>
      events.push(`down:${(e as KeyboardEvent).key}`),
    );
    input.addEventListener('keyup', (e: Event) => events.push(`up:${(e as KeyboardEvent).key}`));

    await handleInteraction({ action: 'keydown', params: { key: 'Shift' } } as Command);
    await handleInteraction({ action: 'keydown', params: { key: 'a' } } as Command);
    await handleInteraction({ action: 'keyup', params: { key: 'a' } } as Command);
    await handleInteraction({ action: 'keyup', params: { key: 'Shift' } } as Command);

    expect(events).toEqual(['down:Shift', 'down:a', 'up:a', 'up:Shift']);
  });
});

// ─── press (existing, for contrast) ─────────────────────────────────

describe('press (dispatches full keydown+keypress+keyup)', () => {
  it('dispatches all three events', async () => {
    document.body.innerHTML = '<input id="input" />';
    const input = document.getElementById('input')!;
    (input as HTMLInputElement).focus();

    const events: string[] = [];
    input.addEventListener('keydown', () => events.push('keydown'));
    input.addEventListener('keypress', () => events.push('keypress'));
    input.addEventListener('keyup', () => events.push('keyup'));

    await handleInteraction({
      action: 'press',
      params: { key: 'Enter' },
    } as Command);

    expect(events).toEqual(['keydown', 'keypress', 'keyup']);
  });
});

// ─── click (existing, event sequence verification) ───────────────────

describe('click event sequence', () => {
  it('dispatches pointer and mouse events in correct order', async () => {
    document.body.innerHTML = '<button id="btn" style="width:50px;height:50px;">Click</button>';
    const btn = document.getElementById('btn')!;

    const events: string[] = [];
    btn.addEventListener('pointerdown', () => events.push('pointerdown'));
    btn.addEventListener('mousedown', () => events.push('mousedown'));
    btn.addEventListener('pointerup', () => events.push('pointerup'));
    btn.addEventListener('mouseup', () => events.push('mouseup'));
    btn.addEventListener('click', () => events.push('click'));

    await handleInteraction({
      action: 'click',
      params: { selector: '#btn' },
    } as Command);

    expect(events).toEqual(['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']);
  });
});
