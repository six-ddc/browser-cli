import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Browser-CLI',
    description: 'Browser automation from the command line — extension bridge',
    permissions: [
      'activeTab',
      'tabs',
      'cookies',
      'scripting',
      'storage',
      'alarms',
      'declarativeNetRequest',
      'declarativeNetRequestFeedback',
      'webRequest',
    ],
    host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages:
        "default-src 'self'; script-src 'self'; object-src 'self'; frame-src 'self'; connect-src ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*",
    },
  },
});
