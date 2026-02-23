/**
 * Type declarations for chrome.userScripts API (Chrome 135+).
 * Declared as optional since the API may not be available (requires Developer Mode
 * or "Allow User Scripts" toggle, and Chrome 135+).
 * @see https://developer.chrome.com/docs/extensions/reference/api/userScripts
 */

interface ChromeUserScriptsInjectionTarget {
  tabId: number;
  frameIds?: number[];
  allFrames?: boolean;
}

interface ChromeUserScriptsSource {
  code: string;
}

interface ChromeUserScriptsInjectionResult {
  result?: unknown;
  error?: string;
}

interface ChromeUserScriptsWorldProperties {
  csp?: string;
}

interface ChromeUserScriptsAPI {
  execute(options: {
    target: ChromeUserScriptsInjectionTarget;
    js: ChromeUserScriptsSource[];
  }): Promise<ChromeUserScriptsInjectionResult[]>;

  configureWorld(properties: ChromeUserScriptsWorldProperties): Promise<void>;
}

declare namespace chrome {
  const userScripts: ChromeUserScriptsAPI | undefined;
}
