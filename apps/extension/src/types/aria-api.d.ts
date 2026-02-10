/**
 * Type definitions for aria-api
 * aria-api doesn't include built-in TypeScript definitions
 */

declare module 'aria-api' {
  /**
   * Get the ARIA role of an element
   * @param element - DOM element to check
   * @returns ARIA role name or null if no role
   */
  export function getRole(element: Element): string | null;
}
