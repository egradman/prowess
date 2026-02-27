# prowess

Run AI coding agents with temporary skills. No permanent installation — skills are cached locally and loaded via a temp plugin directory that's cleaned up on exit.

```
npx prowess claude vercel-labs/agent-skills -s web-design-guidelines
```

## How it works

1. Parses your skill source (GitHub repo, GitLab, local path, direct URL)
2. Clones it (or uses a cached copy from `~/.prowess/cache/`)
3. Discovers all `SKILL.md` files in the repo
4. Copies selected skills into a temp plugin directory
5. Launches the agent with the skills available
6. Cleans up the temp directory on exit

## Usage

```
prowess <agent> <source> [-s/--skill <name>...]
```

### Source formats

| Format | Example |
|---|---|
| `owner/repo` | `vercel-labs/agent-skills` |
| GitHub URL | `https://github.com/someone/skills` |
| GitHub URL with ref + subpath | `https://github.com/someone/skills/tree/main/advanced` |
| GitLab URL | `https://gitlab.com/someone/skills` |
| Direct SKILL.md URL | `https://raw.githubusercontent.com/.../SKILL.md` |
| Local path | `./my-skills` |
| Any git URL | `git@github.com:someone/skills.git` |

### Examples

```bash
# Load all skills from a repo
npx prowess claude vercel-labs/agent-skills

# Pick specific skills
npx prowess claude vercel-labs/agent-skills -s web-design-guidelines -s react-best-practices

# From a local directory
npx prowess claude ./my-custom-skills

# From a GitHub URL with a subpath
npx prowess claude https://github.com/someone/repo/tree/main/skills/advanced
```

### Caching

Cloned repos are cached in `~/.prowess/cache/`. On subsequent runs, prowess does a `git pull` to refresh the cache instead of re-cloning. To force a fresh clone, delete the cache directory:

```bash
rm -rf ~/.prowess/cache/
```

## Supported agents

- **claude** — Launches [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with `--plugin-dir`
- **pi** — Launches [Pi Agent](https://github.com/anthropics/pi-agent) with `--plugin-dir`

## Adding an agent

Each agent is a single file in `agents/` that exports a `launch(tempPluginDir)` function. For example, `agents/claude.js` is ~8 lines. If your agent supports a `--plugin-dir` flag or similar mechanism, adding support is straightforward.

PRs welcome for: Cursor, Codex, Windsurf, Amp, Cline, Roo, or anything else that can load skills.

## License

MIT
