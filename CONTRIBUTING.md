# Contributing to Browser-CLI

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/six-ddc/browser-cli.git
cd browser-cli

# Install dependencies (requires pnpm and Node.js >= 20)
pnpm install

# Build all packages
pnpm build
```

## Project Structure

```
apps/
  cli/         — CLI client + daemon process
  extension/   — Chrome extension (WXT + React)
packages/
  shared/      — Protocol types, Zod schemas, constants
```

## Development Workflow

1. **Create a branch** from `main` for your changes.
2. **Make changes** and ensure quality checks pass:
   ```bash
   pnpm lint        # ESLint
   pnpm typecheck   # TypeScript strict mode
   pnpm test        # Vitest
   ```
3. **Submit a pull request** with a clear description of the change.

## Extension Development

```bash
# Start extension in dev mode (with hot reload)
pnpm --filter @browser-cli/extension dev

# Prepare WXT types before type-checking
pnpm --filter @browser-cli/extension typecheck
```

Load the unpacked extension from `apps/extension/.output/chrome-mv3-dev` in `chrome://extensions`.

## CLI Development

```bash
# Build CLI
pnpm --filter @browser-cli/cli build

# Run locally
node apps/cli/dist/index.js --help
```

## Code Style

- TypeScript strict mode is enforced.
- ESLint and Prettier are configured — run `pnpm format` to auto-format.
- Use `type X = Record<string, never>` for empty parameter types.

## Reporting Issues

- Use [GitHub Issues](https://github.com/six-ddc/browser-cli/issues) for bugs and feature requests.
- Include steps to reproduce, expected behavior, and browser/OS version when reporting bugs.
