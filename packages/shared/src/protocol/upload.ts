/**
 * Upload protocol types for file upload operations.
 *
 * IMPORTANT: Browser security limitations:
 * - Programmatic file uploads without user interaction are restricted
 * - File paths must be accessible to the browser's sandbox
 * - Some browsers may block or warn about programmatic file selection
 * - This implementation uses DataTransfer API which has better support
 *   than directly setting input.files (which is read-only)
 *
 * Compared to Playwright's setInputFiles:
 * - Less powerful: Cannot bypass browser security restrictions
 * - May require manual file selection dialog in some cases
 * - Works within browser extension security model
 *
 * Workarounds:
 * - For local files: Use file:// URLs or drag-and-drop simulation
 * - For testing: Consider using data URLs or blob URLs
 * - For automation: May need user to grant file access permissions
 */

export interface UploadParams {
  /** CSS selector or @ref for the file input element */
  selector: string;
  /** File path(s) to upload. Can be local path or data URL */
  files: string | string[];
  /** Optional: Clear existing files before upload */
  clear?: boolean;
}

export interface UploadResult {
  uploaded: true;
  /** Number of files successfully uploaded */
  fileCount: number;
}
