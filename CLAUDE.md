# @egradman/prowess

## Project overview
CLI that runs AI coding agents with temporary skills. Clones skill repos, caches locally, builds a temp plugin dir, launches the agent, cleans up on exit.

## Architecture
- `index.js` — CLI entry point: source parsing, skill discovery, caching, temp plugin dir builder
- `agents/claude.js` — Launches Claude Code with `--plugin-dir`
- `agents/pi.js` — Launches Pi Agent with `--skill` flags
- Cache dir: `~/.prowess/cache/`
- Temp plugin dir: `/tmp/prowess-XXXX/skills/<name>/SKILL.md`

## Publishing
- Package: `@egradman/prowess` on npm (scoped, public)
- Trusted publishing via GitHub Actions — no tokens needed
- Workflow: `.github/workflows/publish.yml` triggers on GitHub Release
- To release a new version:
  1. Bump `version` in `package.json`
  2. Commit and push
  3. `gh release create v<version> --generate-notes`
  4. GitHub Actions publishes to npm automatically

## Conventions
- ESM (`"type": "module"`)
- No build step — ship raw JS
- Agent launchers are single files in `agents/` exporting `launch(tempPluginDir)`
- Source parsing logic adapted from `add-skill` (npx skills)
