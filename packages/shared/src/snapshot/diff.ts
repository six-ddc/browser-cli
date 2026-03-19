/**
 * Snapshot diff utilities.
 * Compares two accessibility tree snapshots using Myers diff algorithm
 * and outputs git-style unified diff format.
 */

/** Remove transient element refs like ` [@e1]` from snapshot text */
export function stripRefs(text: string): string {
  return text.replace(/ \[@e\d+\]/g, '');
}

/** A single diff operation */
export interface DiffOp {
  type: 'equal' | 'insert' | 'delete';
  oldIndex?: number;
  newIndex?: number;
}

/** Helper to safely read Int32Array with default */
function vAt(arr: Int32Array, idx: number): number {
  return arr[idx] ?? -1;
}

/**
 * Myers diff algorithm on line arrays.
 * Returns a list of operations to transform `a` into `b`.
 * O((N+M)*D) time — fine for typical snapshots (50–500 lines).
 */
export function myersDiff(a: string[], b: string[]): DiffOp[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;

  // Shortcut: both empty
  if (max === 0) return [];

  // V stores furthest-reaching x for each diagonal k
  // offset so negative diagonals map to positive indices
  const size = 2 * max + 1;
  const v = new Int32Array(size);
  v.fill(-1);
  v[max] = 0; // diagonal 0 starts at x=0

  // Store traces for backtracking
  const traces: Int32Array[] = [];

  outer: for (let d = 0; d <= max; d++) {
    traces.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const idx = k + max;
      let x: number;
      if (k === -d || (k !== d && vAt(v, idx - 1) < vAt(v, idx + 1))) {
        x = vAt(v, idx + 1); // move down (insert)
      } else {
        x = vAt(v, idx - 1) + 1; // move right (delete)
      }
      let y = x - k;
      // Follow diagonal (equal lines)
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[idx] = x;
      if (x >= n && y >= m) break outer;
    }
  }

  // Backtrack to recover edit script
  const ops: DiffOp[] = [];
  let x = n;
  let y = m;

  for (let d = traces.length - 1; d > 0; d--) {
    const prev = traces[d] ?? new Int32Array(0);
    const k = x - y;
    const idx = k + max;

    let prevK: number;
    if (k === -d || (k !== d && vAt(prev, idx - 1) < vAt(prev, idx + 1))) {
      prevK = k + 1; // came from down (insert)
    } else {
      prevK = k - 1; // came from right (delete)
    }

    const prevX = vAt(prev, prevK + max);
    const prevY = prevX - prevK;

    // Diagonal moves (equal)
    while (x > prevX && y > prevY) {
      x--;
      y--;
      ops.push({ type: 'equal', oldIndex: x, newIndex: y });
    }

    if (x === prevX) {
      // Insert (moved down)
      y--;
      ops.push({ type: 'insert', newIndex: y });
    } else {
      // Delete (moved right)
      x--;
      ops.push({ type: 'delete', oldIndex: x });
    }
  }

  // Remaining diagonal at d=0
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ type: 'equal', oldIndex: x, newIndex: y });
  }

  ops.reverse();
  return ops;
}

export interface UnifiedDiffOptions {
  /** Label for old snapshot (e.g., file path) */
  oldLabel: string;
  /** Lines from the old snapshot (refs already stripped) */
  oldLines: string[];
  /** Lines from the new snapshot (WITH refs) */
  newLines: string[];
  /** Lines from the new snapshot (refs stripped, for comparison) */
  strippedNewLines: string[];
  /** Number of interactive elements in new snapshot */
  refCount: number;
}

export interface UnifiedDiffResult {
  /** The unified diff text (empty string if no changes) */
  diff: string;
  /** Change summary */
  summary: { added: number; removed: number; changed: number };
}

/**
 * Produce git-style unified diff between old and new snapshot text.
 * - `-` lines come from old (no refs)
 * - `+` lines come from new WITH refs (so AI can interact)
 * - Context lines have no refs
 */
export function formatUnifiedDiff(options: UnifiedDiffOptions): UnifiedDiffResult {
  const { oldLabel, oldLines, newLines, strippedNewLines } = options;
  const CONTEXT = 3;

  const ops = myersDiff(oldLines, strippedNewLines);

  // Check if there are any changes
  const hasChanges = ops.some((op) => op.type !== 'equal');
  if (!hasChanges) {
    return { diff: '', summary: { added: 0, removed: 0, changed: 0 } };
  }

  // Compute summary: adjacent delete+insert = changed
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op?.type === 'delete') {
      const next = ops[i + 1];
      if (next?.type === 'insert') {
        changed++;
        i++; // skip the insert
      } else {
        removed++;
      }
    } else if (op?.type === 'insert') {
      added++;
    }
  }

  // Build unified diff hunks
  const header = `--- snapshot  ${oldLabel}\n+++ snapshot  (current)\n`;
  const hunks: string[] = [];

  // Identify change regions and group with context
  interface HunkRange {
    startIdx: number;
    endIdx: number;
  }
  const changeRanges: HunkRange[] = [];
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op && op.type !== 'equal') {
      const start = i;
      while (i < ops.length) {
        const cur = ops[i];
        if (!cur || cur.type === 'equal') break;
        i++;
      }
      changeRanges.push({ startIdx: start, endIdx: i });
    }
  }

  // Merge ranges that are within CONTEXT*2 of each other
  const mergedRanges: HunkRange[] = [];
  for (const range of changeRanges) {
    const contextStart = Math.max(0, range.startIdx - CONTEXT);
    const contextEnd = Math.min(ops.length, range.endIdx + CONTEXT);
    const last = mergedRanges[mergedRanges.length - 1];
    if (last && contextStart <= last.endIdx) {
      last.endIdx = contextEnd;
    } else {
      mergedRanges.push({ startIdx: contextStart, endIdx: contextEnd });
    }
  }

  // Generate each hunk
  for (const range of mergedRanges) {
    const lines: string[] = [];
    let oldStart = -1;
    let newStart = -1;
    let oldCount = 0;
    let newCount = 0;

    for (let i = range.startIdx; i < range.endIdx && i < ops.length; i++) {
      const op = ops[i];
      if (!op) continue;

      if (op.type === 'equal') {
        const lineNum = op.oldIndex ?? 0;
        if (oldStart === -1) oldStart = lineNum + 1;
        if (newStart === -1) newStart = (op.newIndex ?? 0) + 1;
        lines.push(` ${oldLines[lineNum] ?? ''}`);
        oldCount++;
        newCount++;
      } else if (op.type === 'delete') {
        const oi = op.oldIndex ?? 0;
        if (oldStart === -1) oldStart = oi + 1;
        if (newStart === -1) {
          // Find next insert or equal to determine newStart
          for (let j = i + 1; j < ops.length; j++) {
            const fwd = ops[j];
            if (fwd && fwd.newIndex != null) {
              newStart = fwd.newIndex + 1;
              break;
            }
          }
          if (newStart === -1) newStart = 1;
        }
        lines.push(`-${oldLines[oi] ?? ''}`);
        oldCount++;
      } else {
        // insert
        const ni = op.newIndex ?? 0;
        if (newStart === -1) newStart = ni + 1;
        if (oldStart === -1) {
          for (let j = i + 1; j < ops.length; j++) {
            const fwd = ops[j];
            if (fwd && fwd.oldIndex != null) {
              oldStart = fwd.oldIndex + 1;
              break;
            }
          }
          if (oldStart === -1) oldStart = 1;
        }
        // Use newLines WITH refs for + lines
        lines.push(`+${newLines[ni] ?? ''}`);
        newCount++;
      }
    }

    if (oldStart === -1) oldStart = 1;
    if (newStart === -1) newStart = 1;
    hunks.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${lines.join('\n')}`);
  }

  return {
    diff: header + hunks.join('\n'),
    summary: { added, removed, changed },
  };
}
