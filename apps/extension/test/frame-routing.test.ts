import { describe, it, expect } from 'vitest';
import { pickChildFrameId, urlsMatch } from '../src/lib/frame-routing';

const children = (...entries: Array<[number, string]>) =>
  entries.map(([frameId, url]) => ({ frameId, url }));

describe('urlsMatch', () => {
  it('matches identical urls', () => {
    expect(urlsMatch('http://a/x', 'http://a/x')).toBe(true);
  });

  it('ignores the fragment', () => {
    expect(urlsMatch('http://a/x#top', 'http://a/x')).toBe(true);
  });

  it('tolerates the .html extension being stripped by a redirect', () => {
    expect(urlsMatch('http://a/page', 'http://a/page.html')).toBe(true);
  });

  it('does not match different origins', () => {
    expect(urlsMatch('http://a/x', 'http://b/x')).toBe(false);
  });

  it('never matches an empty url', () => {
    expect(urlsMatch('', '')).toBe(false);
    expect(urlsMatch('http://a/x', '')).toBe(false);
  });
});

describe('pickChildFrameId', () => {
  it('uses the browsing-context index when both views agree on the child count', () => {
    const result = pickChildFrameId(children([5, 'http://a/one'], [6, 'http://a/two']), {
      index: 1,
      total: 2,
      src: 'http://a/two',
    });
    expect(result).toEqual({ frameId: 6, matchedBy: 'index' });
  });

  it('resolves duplicate urls by index', () => {
    const result = pickChildFrameId(children([5, 'http://a/same'], [6, 'http://a/same']), {
      index: 1,
      total: 2,
      src: 'http://a/same',
    });
    expect(result).toEqual({ frameId: 6, matchedBy: 'index' });
  });

  it('handles about:blank and srcdoc frames that carry no matching url', () => {
    const result = pickChildFrameId(children([5, 'about:blank'], [6, 'http://a/two']), {
      index: 0,
      total: 2,
      src: '',
    });
    expect(result).toEqual({ frameId: 5, matchedBy: 'index' });
  });

  it('falls back to a unique url match when the child counts disagree', () => {
    const result = pickChildFrameId(
      children([5, 'http://a/one'], [6, 'http://a/two'], [7, 'http://a/three']),
      { index: 1, total: 2, src: 'http://a/two' },
    );
    expect(result).toEqual({ frameId: 6, matchedBy: 'url' });
  });

  it('prefers a unique url match over an index that contradicts it', () => {
    const result = pickChildFrameId(children([5, 'http://a/one'], [6, 'http://a/two']), {
      index: 0,
      total: 2,
      src: 'http://a/two',
    });
    expect(result).toEqual({ frameId: 6, matchedBy: 'url' });
  });

  it('returns null when neither index nor url can identify the frame', () => {
    const result = pickChildFrameId(
      children([5, 'http://a/one'], [6, 'http://a/one'], [7, 'http://a/one']),
      { index: 1, total: 2, src: 'http://a/one' },
    );
    expect(result).toBeNull();
  });

  it('returns null when the element has no browsing context', () => {
    const result = pickChildFrameId(children([5, 'http://a/one']), {
      index: -1,
      total: 1,
      src: '',
    });
    expect(result).toBeNull();
  });
});
