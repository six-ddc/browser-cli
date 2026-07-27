/**
 * Short human-readable element descriptions used in error messages, so an
 * agent can tell which element it actually hit without another round trip.
 */

export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attrs: string[] = [];
  if (el.id) attrs.push(`id="${el.id}"`);
  const cls = el.getAttribute('class');
  if (cls) {
    const shortened = cls.trim().split(/\s+/).slice(0, 3).join(' ');
    if (shortened) attrs.push(`class="${shortened}"`);
  }
  const label = el.getAttribute('aria-label');
  if (label) attrs.push(`aria-label="${label}"`);
  const role = el.getAttribute('role');
  if (role) attrs.push(`role="${role}"`);

  const head = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>`;
  const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return text ? `${head} "${text}"` : head;
}

/** Page context appended to "not found" errors so the agent can self-diagnose. */
export function pageContext(): string {
  return `Page: ${document.title || '(untitled)'} — ${location.href}`;
}
