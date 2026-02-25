import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  runner: {
    disabled: false,
    chromiumArgs: ['--auto-open-devtools-for-tabs'],
  },
  manifest: ({ browser }) => ({
    name: 'Browser-CLI',
    description: 'Browser automation from the command line — extension bridge',
    permissions: [
      'activeTab',
      'tabs',
      'cookies',
      'scripting',
      'storage',
      'alarms',
      'bookmarks',
      'history',
      // Chrome: declarativeNetRequest for network interception
      // Firefox: webRequest + webRequestBlocking
      ...(browser !== 'firefox'
        ? [
            'declarativeNetRequest',
            'declarativeNetRequestFeedback',
            'webRequest',
            'userScripts',
            'tabGroups', // Chrome-only: tab group management
          ]
        : ['webRequest', 'webRequestBlocking', 'contextualIdentities']),
    ],
    host_permissions: ['<all_urls>'],
    // Firefox requires a gecko add-on ID
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: { id: 'browser-cli@browser-cli.dev' },
      },
    }),
    content_security_policy: {
      extension_pages:
        "default-src 'self'; script-src 'self'; object-src 'self'; frame-src 'self'; connect-src ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*",
    },
  }),
});
