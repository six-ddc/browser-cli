/**
 * File upload operations using DataTransfer API.
 *
 * Browser security limitations:
 * - Browsers restrict programmatic file uploads without user interaction
 * - File paths must be accessible within the browser's security context
 * - This implementation works within extension capabilities but has limitations
 *
 * Implementation notes:
 * - Uses DataTransfer API to set files on input elements
 * - Supports data URLs and blob URLs (recommended for testing)
 * - Local file paths may not work due to browser security
 * - Triggers appropriate events for framework compatibility
 */

import type { Command } from '@browser-cli/shared';
import { resolveElement } from './element-ref-store';

export async function handleUpload(command: Command): Promise<unknown> {
  if (command.action !== 'upload') {
    throw new Error(`Invalid upload command: ${command.action}`);
  }

  const { selector, files: filesParam, clear = false } = command.params;

  const el = resolveElement(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  if (!(el instanceof HTMLInputElement)) {
    throw new Error(`Element is not an <input>: ${selector}`);
  }
  if (el.type !== 'file') {
    throw new Error(`Element is not a file input: ${selector}`);
  }

  const filePaths = Array.isArray(filesParam) ? filesParam : [filesParam];

  if (clear && el.files && el.files.length > 0) {
    // Clear existing files by creating empty DataTransfer
    const emptyDt = new DataTransfer();
    el.files = emptyDt.files;
  }

  // Create DataTransfer object and add files
  const dataTransfer = new DataTransfer();

  for (const filePath of filePaths) {
    const file = await createFileFromPath(filePath);
    dataTransfer.items.add(file);
  }

  // Set files on input element
  el.files = dataTransfer.files;

  // Trigger events for framework compatibility
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  return {
    uploaded: true,
    fileCount: el.files.length,
  };
}

/**
 * Create a File object from a file path.
 * Supports:
 * - data: URLs (recommended for testing)
 * - blob: URLs
 * - Local file paths (limited by browser security)
 */
async function createFileFromPath(path: string): Promise<File> {
  // Handle data URLs
  if (path.startsWith('data:')) {
    const response = await fetch(path);
    const blob = await response.blob();
    const fileName = extractFileName(path);
    return new File([blob], fileName, { type: blob.type });
  }

  // Handle blob URLs
  if (path.startsWith('blob:')) {
    const response = await fetch(path);
    const blob = await response.blob();
    const fileName = extractFileName(path);
    return new File([blob], fileName, { type: blob.type });
  }

  // For local file paths, we need to fetch them
  // This may fail due to CORS or browser security restrictions
  try {
    // Try to fetch as a relative URL
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }
    const blob = await response.blob();
    const fileName = path.split('/').pop() || 'file';
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';
    return new File([blob], fileName, { type: mimeType });
  } catch (error) {
    // If fetch fails, provide helpful error message
    throw new Error(
      `Cannot access file: ${path}. ` +
        'Browser security restricts file access. ' +
        'Consider using data URLs or blob URLs instead. ' +
        `Original error: ${(error as Error).message}`,
    );
  }
}

/**
 * Extract a file name from a path or URL.
 */
function extractFileName(path: string): string {
  // For data URLs, try to extract from metadata
  if (path.startsWith('data:')) {
    const match = path.match(/name=([^;,]+)/);
    if (match) return decodeURIComponent(match[1]);
    return 'file';
  }

  // For other paths, extract last segment
  const segments = path.split('/');
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && lastSegment !== '') {
    // Remove query params
    return lastSegment.split('?')[0];
  }

  return 'file';
}
