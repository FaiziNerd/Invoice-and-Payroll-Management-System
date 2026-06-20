/**
 * Clean .next cache, free the dev port, and start Next.js.
 * Usage: npm run dev:clean
 */
import { rmSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn, execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const nextDir = resolve(rootDir, ".next");
const port = process.env.PORT || "3000";

function killProcessOnPort(targetPort) {
  if (process.platform === "win32") {
    try {
      const output = execSync("netstat -ano", { encoding: "utf8" });
      const pids = new Set();
      for (const line of output.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        if (!line.includes(`:${targetPort} `) && !line.includes(`]:${targetPort} `)) {
          continue;
        }
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid) && pid !== "0") {
          pids.add(pid);
        }
      }
      for (const pid of pids) {
        console.log(`Stopping process ${pid} on port ${targetPort}...`);
        execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
      }
    } catch {
      // Port may already be free
    }
    return;
  }

  try {
    execSync(`fuser -k ${targetPort}/tcp`, { stdio: "ignore" });
  } catch {
    try {
      execSync(`lsof -ti:${targetPort} | xargs kill -9`, { stdio: "ignore", shell: true });
    } catch {
      // Port may already be free
    }
  }
}

function removeNextCache() {
  if (!existsSync(nextDir)) return;
  try {
    rmSync(nextDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.log("Removed .next cache");
  } catch (err) {
    console.warn("Could not fully remove .next:", err.message);
  }
}

killProcessOnPort(port);
removeNextCache();

console.log(`Starting dev server on http://localhost:${port}`);
console.log("Hard-refresh the browser (Ctrl+Shift+R) if you see ChunkLoadError.");

const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  cwd: rootDir,
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 0));
