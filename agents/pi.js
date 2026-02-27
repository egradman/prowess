import { execFileSync } from "child_process";
import { readdir } from "fs/promises";
import { join } from "path";

export async function launch(tempPluginDir) {
  const skillsDir = join(tempPluginDir, "skills");
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const args = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      args.push("--skill", join(skillsDir, entry.name));
    }
  }
  execFileSync("pi", args, {
    stdio: "inherit",
    env: { ...process.env },
  });
}
