import { execFileSync } from "child_process";

export async function launch(tempPluginDir) {
  execFileSync("claude", ["--plugin-dir", tempPluginDir], {
    stdio: "inherit",
    env: { ...process.env },
  });
}
