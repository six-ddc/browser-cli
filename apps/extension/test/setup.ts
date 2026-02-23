/**
 * jsdom test environment setup.
 *
 * jsdom lacks several browser APIs that the extension code uses.
 * Provide minimal polyfills so tests can exercise event dispatch and script injection.
 */

// PointerEvent — jsdom only has MouseEvent
if (typeof globalThis.PointerEvent === 'undefined') {
  (globalThis as Record<string, unknown>).PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, init?: PointerEventInit) {
      super(type, init);
      this.pointerId = init?.pointerId ?? 0;
      this.pointerType = init?.pointerType ?? '';
    }
  };
}

// DataTransfer — required by drag-and-drop (must come before DragEvent)
if (typeof globalThis.DataTransfer === 'undefined') {
  (globalThis as Record<string, unknown>).DataTransfer = class DataTransfer {
    dropEffect = 'none';
    effectAllowed = 'all';
    private items: { kind: string; type: string; data: string }[] = [];
    get types() {
      return this.items.map((i) => i.type);
    }
    setData(format: string, data: string) {
      this.items = this.items.filter((i) => i.type !== format);
      this.items.push({ kind: 'string', type: format, data });
    }
    getData(format: string) {
      return this.items.find((i) => i.type === format)?.data ?? '';
    }
    clearData() {
      this.items = [];
    }
    setDragImage() {}
  };
}

// DragEvent — jsdom doesn't implement drag events
if (typeof globalThis.DragEvent === 'undefined') {
  (globalThis as Record<string, unknown>).DragEvent = class DragEvent extends MouseEvent {
    readonly dataTransfer: DataTransfer | null;
    constructor(type: string, init?: DragEventInit) {
      super(type, init);
      this.dataTransfer = init?.dataTransfer ?? null;
    }
  };
}

// CSS.escape — jsdom doesn't implement CSS.escape
if (!globalThis.CSS?.escape) {
  globalThis.CSS = {
    ...globalThis.CSS,
    escape: (value: string) => {
      return value.replace(/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    },
  } as typeof CSS;
}

// document.elementFromPoint — jsdom doesn't implement hit testing
if (typeof document.elementFromPoint !== 'function') {
  document.elementFromPoint = () => document.body;
}

// navigator.geolocation — setGeo injects a <script> that modifies it
if (!navigator.geolocation) {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: () => {},
      watchPosition: () => 0,
      clearWatch: () => {},
    },
    writable: true,
    configurable: true,
  });
}
