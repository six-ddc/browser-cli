import { expect as baseExpect } from '@playwright/test';
import type { BcliResult } from '../fixtures/bcli';

export const expect = baseExpect.extend({
  toBcliSuccess(result: BcliResult) {
    const pass = result.exitCode === 0;
    return {
      pass,
      message: () =>
        pass
          ? `Expected CLI command to fail but it succeeded.\nstdout: ${result.stdout}`
          : `Expected CLI command to succeed but it failed (exit ${result.exitCode}).\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
    };
  },

  toBcliFailure(result: BcliResult) {
    const pass = result.exitCode !== 0;
    return {
      pass,
      message: () =>
        pass
          ? `Expected CLI command to succeed but it failed (exit ${result.exitCode}).\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
          : `Expected CLI command to fail but it succeeded.\nstdout: ${result.stdout}`,
    };
  },

  toContainOutput(result: BcliResult, text: string) {
    const combined = `${result.stdout}\n${result.stderr}`;
    const pass = combined.includes(text);
    return {
      pass,
      message: () =>
        pass
          ? `Expected output not to contain "${text}" but it did.\noutput: ${combined}`
          : `Expected output to contain "${text}" but it did not.\noutput: ${combined}`,
    };
  },
});
