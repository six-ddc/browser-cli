#!/usr/bin/env node
/**
 * Simple test script to verify semantic locator parsing.
 * Run with: node test-semantic-parser.js
 */

// Import from the shared package
import {
  parseSemanticLocator,
  formatSemanticLocator,
  isSemanticLocator,
} from './packages/shared/src/protocol/semantic-locators.ts';

const tests = [
  // Role locators
  { input: 'role:button:Submit:exact', expected: { type: 'role', role: 'button', name: 'Submit', options: { exact: true, ignoreCase: true } } },
  { input: 'role:button:Submit', expected: { type: 'role', role: 'button', name: 'Submit', options: { exact: true, ignoreCase: true } } },
  { input: 'role:textbox:Email', expected: { type: 'role', role: 'textbox', name: 'Email', options: { exact: true, ignoreCase: true } } },
  { input: 'role:button', expected: { type: 'role', role: 'button', name: undefined, options: { exact: true, ignoreCase: true } } },

  // Text locators
  { input: 'text:Sign In', expected: { type: 'text', text: 'Sign In', options: { exact: false, ignoreCase: true } } },
  { input: 'text:Click here:exact', expected: { type: 'text', text: 'Click here', options: { exact: true, ignoreCase: true } } },

  // Label locators
  { input: 'label:Email', expected: { type: 'label', labelText: 'Email', options: { exact: false, ignoreCase: true } } },
  { input: 'label:Password:exact', expected: { type: 'label', labelText: 'Password', options: { exact: true, ignoreCase: true } } },

  // Placeholder locators
  { input: 'placeholder:Search...', expected: { type: 'placeholder', text: 'Search...', options: { exact: false, ignoreCase: true } } },

  // Alt locators
  { input: 'alt:Logo', expected: { type: 'alt', text: 'Logo', options: { exact: false, ignoreCase: true } } },

  // Title locators
  { input: 'title:Help', expected: { type: 'title', text: 'Help', options: { exact: false, ignoreCase: true } } },

  // TestID locators
  { input: 'testid:login-button', expected: { type: 'testid', value: 'login-button', options: { exact: true, ignoreCase: false } } },
];

console.log('Testing semantic locator parser...\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`Testing: ${test.input}`);

  // Check if it's recognized as a semantic locator
  if (!isSemanticLocator(test.input)) {
    console.log('  ❌ FAIL: Not recognized as semantic locator');
    failed++;
    continue;
  }

  // Parse the locator
  const result = parseSemanticLocator(test.input);

  if (!result) {
    console.log('  ❌ FAIL: Parser returned null');
    failed++;
    continue;
  }

  // Check type
  if (result.type !== test.expected.type) {
    console.log(`  ❌ FAIL: Type mismatch. Expected ${test.expected.type}, got ${result.type}`);
    failed++;
    continue;
  }

  // Check role-specific fields
  if (test.expected.type === 'role') {
    if (result.role !== test.expected.role) {
      console.log(`  ❌ FAIL: Role mismatch. Expected ${test.expected.role}, got ${result.role}`);
      failed++;
      continue;
    }
    if (result.name !== test.expected.name) {
      console.log(`  ❌ FAIL: Name mismatch. Expected ${test.expected.name}, got ${result.name}`);
      failed++;
      continue;
    }
  }

  // Check text-based fields
  if (test.expected.type === 'text' && result.text !== test.expected.text) {
    console.log(`  ❌ FAIL: Text mismatch. Expected ${test.expected.text}, got ${result.text}`);
    failed++;
    continue;
  }

  if (test.expected.type === 'label' && result.labelText !== test.expected.labelText) {
    console.log(`  ❌ FAIL: LabelText mismatch. Expected ${test.expected.labelText}, got ${result.labelText}`);
    failed++;
    continue;
  }

  // Format and check round-trip (optional)
  const formatted = formatSemanticLocator(result);
  console.log(`  ✅ PASS (formatted: ${formatted})`);
  passed++;
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Tests passed: ${passed}/${tests.length}`);
console.log(`Tests failed: ${failed}/${tests.length}`);

if (failed === 0) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}
