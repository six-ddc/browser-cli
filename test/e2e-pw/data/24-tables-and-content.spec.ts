import { test, expect } from '../fixtures';
import { PAGES } from '../helpers/constants';

// ===========================================================================
// Tables (tables.html)
// ===========================================================================

test.describe('tables', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.TABLES);
  });

  test('get text on table cell', async ({ bcli }) => {
    const r = bcli('get', 'text', '#table1 tbody tr:first-child td.last-name');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('Smith');
  });

  test('get text on another cell', async ({ bcli }) => {
    const r = bcli('get', 'text', '#table1 tbody tr:nth-child(2) td.first-name');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('Frank');
  });

  test('get count for table rows', async ({ bcli }) => {
    const r = bcli('get', 'count', '#table1 tbody tr');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('4');
  });

  test('get count for table2 rows (fewer rows)', async ({ bcli }) => {
    const r = bcli('get', 'count', '#table2 tbody tr');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('2');
  });

  test('get html for table structure', async ({ bcli }) => {
    const r = bcli('get', 'html', '#table1 thead');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('Last Name');
    expect(r.stdout).toContain('First Name');
    expect(r.stdout).toContain('Email');
  });

  test('get attr on table element', async ({ bcli }) => {
    const r = bcli('get', 'attr', '#table1', 'class');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('tablesorter');
  });

  test('get text on email cell', async ({ bcli }) => {
    const r = bcli('get', 'text', '#table1 tbody tr:first-child td.email');
    expect(r).toBcliSuccess();
    expect(r.stdout).toContain('jsmith@gmail.com');
  });

  test('snapshot of table page contains table content', async ({ bcli }) => {
    const r = bcli('snapshot', '-ic');
    expect(r).toBcliSuccess();
    // Verify the snapshot includes recognizable table content
    expect(r.stdout).toContain('Smith');
    expect(r.stdout).toContain('jsmith');
  });
});

// ===========================================================================
// Horizontal Slider (horizontal-slider.html)
// ===========================================================================

test.describe('horizontal slider', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.HORIZONTAL_SLIDER);
  });

  test('get value for range input', async ({ bcli }) => {
    const r = bcli('get', 'value', '#slider');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('0');
  });

  test('eval changes slider value', async ({ bcli }) => {
    // Set slider value via eval (fill does not work on range inputs)
    bcli('eval', "document.getElementById('slider').value = '3'; document.getElementById('slider').dispatchEvent(new Event('input'))");

    const r = bcli('get', 'value', '#slider');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('3');
  });

  test('get attr min/max/step on slider', async ({ bcli }) => {
    const min = bcli('get', 'attr', '#slider', 'min');
    expect(min).toBcliSuccess();
    expect(min.stdout).toBe('0');

    const max = bcli('get', 'attr', '#slider', 'max');
    expect(max).toBcliSuccess();
    expect(max.stdout).toBe('5');

    const step = bcli('get', 'attr', '#slider', 'step');
    expect(step).toBcliSuccess();
    expect(step.stdout).toBe('0.5');
  });
});

// ===========================================================================
// Broken Images (broken-images.html)
// ===========================================================================

test.describe('broken images', () => {
  test.beforeEach(async ({ navigateAndWait }) => {
    await navigateAndWait(PAGES.BROKEN_IMAGES);
  });

  test('get count for img elements', async ({ bcli }) => {
    const r = bcli('get', 'count', '.example img');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('3');
  });

  test('get attr src on first image', async ({ bcli }) => {
    const r = bcli('get', 'attr', '.example img:first-of-type', 'src');
    expect(r).toBcliSuccess();
    // First image has a data URI
    expect(r.stdout).toContain('data:image/svg+xml');
  });

  test('get attr alt on broken image', async ({ bcli }) => {
    const r = bcli('get', 'attr', '.example img:nth-of-type(2)', 'alt');
    expect(r).toBcliSuccess();
    expect(r.stdout).toBe('Broken Image 1');
  });

  test('snapshot handles pages with broken images', async ({ bcli }) => {
    const r = bcli('snapshot', '-c');
    expect(r).toBcliSuccess();
    // Verify the snapshot includes image-related content from the page
    expect(r.stdout).toContain('Broken Images');
  });
});
