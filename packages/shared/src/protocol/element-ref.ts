/**
 * Element reference system: @e1, @e2, etc.
 *
 * During snapshot, interactive elements are assigned refs like @e1.
 * These refs map to CSS selectors stored in the content script's RefMap.
 * CLI commands can use @e1 instead of a CSS selector.
 */

/** A ref string like "@e1", "@e2" */
export type ElementRef = `@e${number}`;

/** A single entry in the ref map */
export interface RefEntry {
  ref: ElementRef;
  selector: string;
  /** Human-readable label for display */
  label?: string;
}

/** Map of ref string → CSS selector */
export type RefMap = Map<string, RefEntry>;

/** Regex pattern matching @e followed by digits */
const REF_PATTERN = /^@e(\d+)$/;

/** Check if a string is a valid element ref */
export function isElementRef(value: string): value is ElementRef {
  return REF_PATTERN.test(value);
}

/** Parse an element ref string, returning the numeric index or null */
export function parseElementRef(value: string): number | null {
  const match = value.match(REF_PATTERN);
  return match?.[1] != null ? parseInt(match[1], 10) : null;
}

/** Create an element ref from an index */
export function createElementRef(index: number): ElementRef {
  return `@e${index}`;
}
