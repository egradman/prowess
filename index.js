#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import simpleGit from "simple-git";
import matter from "gray-matter";
import { isAbsolute, resolve, join, normalize, sep, basename, dirname } from "path";
import { mkdtemp, rm, readdir, readFile, stat, mkdir, cp } from "fs/promises";
import { tmpdir, homedir } from "os";

// ── Source parsing (from add-skill) ──────────────────────────────────────────

function isLocalPath(input) {
  return (
    isAbsolute(input) ||
    input.startsWith("./") ||
    input.startsWith("../") ||
    input === "." ||
    input === ".." ||
    /^[a-zA-Z]:[/\\]/.test(input)
  );
}

function isDirectSkillUrl(input) {
  if (!input.startsWith("http://") && !input.startsWith("https://")) return false;
  if (!input.toLowerCase().endsWith("/skill.md")) return false;
  if (input.includes("github.com/") && !input.includes("raw.githubusercontent.com")) {
    if (!input.includes("/blob/") && !input.includes("/raw/")) return false;
  }
  if (input.includes("gitlab.com/") && !input.includes("/-/raw/")) return false;
  return true;
}

function parseSource(input) {
  if (isLocalPath(input)) {
    const resolvedPath = resolve(input);
    return { type: "local", url: resolvedPath, localPath: resolvedPath };
  }
  if (isDirectSkillUrl(input)) {
    return { type: "direct-url", url: input };
  }
  const githubTreeWithPathMatch = input.match(
    /github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/
  );
  if (githubTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = githubTreeWithPathMatch;
    return { type: "github", url: `https://github.com/${owner}/${repo}.git`, ref, subpath };
  }
  const githubTreeMatch = input.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)$/);
  if (githubTreeMatch) {
    const [, owner, repo, ref] = githubTreeMatch;
    return { type: "github", url: `https://github.com/${owner}/${repo}.git`, ref };
  }
  const githubRepoMatch = input.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (githubRepoMatch) {
    const [, owner, repo] = githubRepoMatch;
    const cleanRepo = repo.replace(/\.git$/, "");
    return { type: "github", url: `https://github.com/${owner}/${cleanRepo}.git` };
  }
  const gitlabTreeWithPathMatch = input.match(
    /gitlab\.com\/([^/]+)\/([^/]+)\/-\/tree\/([^/]+)\/(.+)/
  );
  if (gitlabTreeWithPathMatch) {
    const [, owner, repo, ref, subpath] = gitlabTreeWithPathMatch;
    return { type: "gitlab", url: `https://gitlab.com/${owner}/${repo}.git`, ref, subpath };
  }
  const gitlabTreeMatch = input.match(/gitlab\.com\/([^/]+)\/([^/]+)\/-\/tree\/([^/]+)$/);
  if (gitlabTreeMatch) {
    const [, owner, repo, ref] = gitlabTreeMatch;
    return { type: "gitlab", url: `https://gitlab.com/${owner}/${repo}.git`, ref };
  }
  const gitlabRepoMatch = input.match(/gitlab\.com\/([^/]+)\/([^/]+)/);
  if (gitlabRepoMatch) {
    const [, owner, repo] = gitlabRepoMatch;
    const cleanRepo = repo.replace(/\.git$/, "");
    return { type: "gitlab", url: `https://gitlab.com/${owner}/${cleanRepo}.git` };
  }
  const shorthandMatch = input.match(/^([^/]+)\/([^/]+)(?:\/(.+))?$/);
  if (shorthandMatch && !input.includes(":") && !input.startsWith(".") && !input.startsWith("/")) {
    const [, owner, repo, subpath] = shorthandMatch;
    return { type: "github", url: `https://github.com/${owner}/${repo}.git`, subpath };
  }
  return { type: "git", url: input };
}

// ── Skill discovery (from add-skill) ────────────────────────────────────────

const SKIP_DIRS = ["node_modules", ".git", "dist", "build", "__pycache__"];

async function hasSkillMd(dir) {
  try {
    const s = await stat(join(dir, "SKILL.md"));
    return s.isFile();
  } catch {
    return false;
  }
}

async function parseSkillMd(skillMdPath) {
  try {
    const content = await readFile(skillMdPath, "utf-8");
    const { data } = matter(content);
    if (!data.name || !data.description) return null;
    return {
      name: data.name,
      description: data.description,
      path: dirname(skillMdPath),
      rawContent: content,
      metadata: data.metadata,
    };
  } catch {
    return null;
  }
}

async function findSkillDirs(dir, depth = 0, maxDepth = 5) {
  const skillDirs = [];
  if (depth > maxDepth) return skillDirs;
  try {
    if (await hasSkillMd(dir)) skillDirs.push(dir);
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !SKIP_DIRS.includes(entry.name)) {
        const subDirs = await findSkillDirs(join(dir, entry.name), depth + 1, maxDepth);
        skillDirs.push(...subDirs);
      }
    }
  } catch {}
  return skillDirs;
}

async function discoverSkills(basePath, subpath) {
  const skills = [];
  const seenNames = new Set();
  const searchPath = subpath ? join(basePath, subpath) : basePath;
  if (await hasSkillMd(searchPath)) {
    const skill = await parseSkillMd(join(searchPath, "SKILL.md"));
    if (skill) {
      skills.push(skill);
      return skills;
    }
  }
  const prioritySearchDirs = [
    searchPath,
    join(searchPath, "skills"),
    join(searchPath, "skills/.curated"),
    join(searchPath, "skills/.experimental"),
    join(searchPath, "skills/.system"),
    join(searchPath, ".agent/skills"),
    join(searchPath, ".agents/skills"),
    join(searchPath, ".claude/skills"),
    join(searchPath, ".cline/skills"),
    join(searchPath, ".codex/skills"),
    join(searchPath, ".commandcode/skills"),
    join(searchPath, ".cursor/skills"),
    join(searchPath, ".github/skills"),
    join(searchPath, ".goose/skills"),
    join(searchPath, ".kilocode/skills"),
    join(searchPath, ".kiro/skills"),
    join(searchPath, ".neovate/skills"),
    join(searchPath, ".opencode/skills"),
    join(searchPath, ".openhands/skills"),
    join(searchPath, ".pi/skills"),
    join(searchPath, ".qoder/skills"),
    join(searchPath, ".roo/skills"),
    join(searchPath, ".trae/skills"),
    join(searchPath, ".windsurf/skills"),
    join(searchPath, ".zencoder/skills"),
  ];
  for (const dir of prioritySearchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = join(dir, entry.name);
          if (await hasSkillMd(skillDir)) {
            const skill = await parseSkillMd(join(skillDir, "SKILL.md"));
            if (skill && !seenNames.has(skill.name)) {
              skills.push(skill);
              seenNames.add(skill.name);
            }
          }
        }
      }
    } catch {}
  }
  if (skills.length === 0) {
    const allSkillDirs = await findSkillDirs(searchPath);
    for (const skillDir of allSkillDirs) {
      const skill = await parseSkillMd(join(skillDir, "SKILL.md"));
      if (skill && !seenNames.has(skill.name)) {
        skills.push(skill);
        seenNames.add(skill.name);
      }
    }
  }
  return skills;
}

function getSkillDisplayName(skill) {
  return skill.name || basename(skill.path);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeName(name) {
  let sanitized = name.replace(/[/\\:\0]/g, "");
  sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, "");
  sanitized = sanitized.replace(/^\.+/, "");
  if (!sanitized || sanitized.length === 0) sanitized = "unnamed-skill";
  if (sanitized.length > 255) sanitized = sanitized.substring(0, 255);
  return sanitized;
}

async function copyDirectory(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await cp(srcPath, destPath);
    }
  }
}

// ── Direct URL fetching ─────────────────────────────────────────────────────

async function fetchDirectSkill(url) {
  let fetchUrl = url;
  // Convert GitHub blob URLs to raw
  if (url.includes("github.com") && url.includes("/blob/")) {
    fetchUrl = url
      .replace("github.com", "raw.githubusercontent.com")
      .replace("/blob/", "/");
  }
  // Convert GitLab blob URLs to raw
  if (url.includes("gitlab.com") && !url.includes("/-/raw/")) {
    fetchUrl = url.replace("/-/blob/", "/-/raw/");
  }
  const response = await fetch(fetchUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${fetchUrl}: ${response.status}`);
  const content = await response.text();
  const { data } = matter(content);
  if (!data.name || !data.description) {
    throw new Error("SKILL.md missing required name or description frontmatter");
  }
  return { name: data.name, description: data.description, content };
}

// ── Caching layer ───────────────────────────────────────────────────────────

const CACHE_DIR = join(homedir(), ".prowess", "cache");

function getCacheId(source) {
  if (source.type === "local") return null;
  if (source.type === "direct-url") {
    return source.url
      .replace(/^https?:\/\//, "")
      .replace(/[/\\:?#]/g, "-")
      .replace(/-+/g, "-");
  }
  // For git-based sources, derive from URL
  const cleaned = source.url
    .replace(/^https?:\/\//, "")
    .replace(/\.git$/, "")
    .replace(/[/\\]/g, "--");
  return cleaned;
}

async function getCachedOrClone(source) {
  if (source.type === "local") {
    return { path: source.localPath, subpath: undefined };
  }

  if (source.type === "direct-url") {
    const cacheId = getCacheId(source);
    const cacheDir = join(CACHE_DIR, cacheId);
    try {
      await stat(join(cacheDir, "SKILL.md"));
      console.log(chalk.dim("  Using cached skill"));
      return { path: cacheDir, subpath: undefined };
    } catch {}
    // Fetch and cache
    const skill = await fetchDirectSkill(source.url);
    await mkdir(cacheDir, { recursive: true });
    const { writeFile } = await import("fs/promises");
    await writeFile(join(cacheDir, "SKILL.md"), skill.content);
    return { path: cacheDir, subpath: undefined };
  }

  // Git-based source
  const cacheId = getCacheId(source);
  const cacheDir = join(CACHE_DIR, cacheId);
  try {
    await stat(join(cacheDir, ".git"));
    // Cache exists — pull to refresh
    console.log(chalk.dim("  Updating cached clone..."));
    const git = simpleGit(cacheDir);
    try {
      await git.pull();
    } catch {
      // Pull failed (e.g. offline), use stale cache
    }
    return { path: cacheDir, subpath: source.subpath };
  } catch {}

  // Fresh clone
  console.log(chalk.dim("  Cloning..."));
  await mkdir(cacheDir, { recursive: true });
  const git = simpleGit();
  const cloneOptions = source.ref
    ? ["--depth", "1", "--branch", source.ref]
    : ["--depth", "1"];
  await git.clone(source.url, cacheDir, cloneOptions);
  return { path: cacheDir, subpath: source.subpath };
}

// ── Temp plugin dir builder ─────────────────────────────────────────────────

async function buildTempPluginDir(skills) {
  const tempDir = await mkdtemp(join(tmpdir(), "prowess-"));
  const skillsDir = join(tempDir, "skills");
  await mkdir(skillsDir, { recursive: true });

  for (const skill of skills) {
    const name = sanitizeName(skill.name);
    const destDir = join(skillsDir, name);
    await copyDirectory(skill.path, destDir);
  }

  return tempDir;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

program
  .name("prowess")
  .description("Run agent sessions with temporary skills")
  .argument("<agent>", "Agent to launch (e.g. claude)")
  .argument("<source>", "Skill source (owner/repo, URL, or local path)")
  .option("-s, --skill <names...>", "Select specific skills by name")
  .action(async (agent, source, options) => {
    try {
      // 1. Parse source
      const parsed = parseSource(source);
      console.log(chalk.bold(`prowess → ${agent}`));
      console.log(chalk.dim(`  Source: ${source} (${parsed.type})`));

      // 2. Resolve from cache or clone
      const { path: repoPath, subpath } = await getCachedOrClone(parsed);

      // 3. Discover skills
      const skills = await discoverSkills(repoPath, subpath);
      if (skills.length === 0) {
        console.error(chalk.red("No skills found in source."));
        process.exit(1);
      }

      // 4. Filter by --skill if provided
      let selectedSkills;
      if (options.skill && options.skill.length > 0) {
        selectedSkills = skills.filter((s) =>
          options.skill.some(
            (name) =>
              s.name.toLowerCase() === name.toLowerCase() ||
              getSkillDisplayName(s).toLowerCase() === name.toLowerCase()
          )
        );
        if (selectedSkills.length === 0) {
          console.error(chalk.red(`No matching skills for: ${options.skill.join(", ")}`));
          console.log("Available skills:");
          for (const s of skills) {
            console.log(`  - ${getSkillDisplayName(s)}`);
          }
          process.exit(1);
        }
      } else {
        selectedSkills = skills;
      }

      console.log(
        chalk.green(
          `  Skills: ${selectedSkills.map((s) => getSkillDisplayName(s)).join(", ")}`
        )
      );

      // 5. Build temp plugin dir
      const tempPluginDir = await buildTempPluginDir(selectedSkills);

      // Register cleanup
      const cleanup = () => {
        rm(tempPluginDir, { recursive: true, force: true }).catch(() => {});
      };
      process.on("exit", cleanup);
      process.on("SIGINT", () => { cleanup(); process.exit(130); });
      process.on("SIGTERM", () => { cleanup(); process.exit(143); });

      // 6. Load agent launcher and exec
      let agentModule;
      try {
        agentModule = await import(`./agents/${agent}.js`);
      } catch (err) {
        console.error(chalk.red(`Unknown agent: ${agent}`));
        process.exit(1);
      }

      await agentModule.launch(tempPluginDir);
    } catch (err) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  });

program.parse();
