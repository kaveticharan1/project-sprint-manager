// Runs a command with the backend virtualenv's Python, from inside /backend.
// Usage: node scripts/py.mjs <python args...>
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const python =
  process.platform === "win32"
    ? join(backend, ".venv", "Scripts", "python.exe")
    : join(backend, ".venv", "bin", "python");

if (!existsSync(python)) {
  console.error("Backend virtualenv not found. Run `npm run setup` first.");
  process.exit(1);
}

const result = spawnSync(python, process.argv.slice(2), { cwd: backend, stdio: "inherit" });
process.exit(result.status ?? 1);
