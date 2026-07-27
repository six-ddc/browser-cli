import { describe, it, expect } from 'vitest';
import { renderCheck, summarize, type DoctorCheck } from '../src/commands/doctor.js';

describe('doctor pure helpers', () => {
  describe('renderCheck', () => {
    it('renders a passing check as a single line with a checkmark', () => {
      const check: DoctorCheck = { name: 'daemon process', ok: true, detail: 'running (PID 1)' };
      expect(renderCheck(check)).toEqual(['✓ daemon process: running (PID 1)']);
    });

    it('renders a failing check with a hint line', () => {
      const check: DoctorCheck = {
        name: 'daemon process',
        ok: false,
        detail: 'not running',
        hint: 'run: browser-cli start',
      };
      expect(renderCheck(check)).toEqual([
        '✗ daemon process: not running',
        '  → run: browser-cli start',
      ]);
    });

    it('renders a failing check without a hint as a single line', () => {
      const check: DoctorCheck = { name: 'ws port', ok: false, detail: 'unreachable' };
      expect(renderCheck(check)).toEqual(['✗ ws port: unreachable']);
    });
  });

  describe('summarize', () => {
    it('counts all passed', () => {
      const checks: DoctorCheck[] = [
        { name: 'a', ok: true, detail: '' },
        { name: 'b', ok: true, detail: '' },
      ];
      expect(summarize(checks)).toEqual({ passed: 2, failed: 0 });
    });

    it('counts mixed pass/fail', () => {
      const checks: DoctorCheck[] = [
        { name: 'a', ok: true, detail: '' },
        { name: 'b', ok: false, detail: '' },
        { name: 'c', ok: false, detail: '' },
      ];
      expect(summarize(checks)).toEqual({ passed: 1, failed: 2 });
    });

    it('counts all failed', () => {
      const checks: DoctorCheck[] = [{ name: 'a', ok: false, detail: '' }];
      expect(summarize(checks)).toEqual({ passed: 0, failed: 1 });
    });
  });
});
