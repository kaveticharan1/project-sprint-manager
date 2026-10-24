// One-shot local setup: Python venv + backend deps, frontend deps, env files.
// Usage: npm run setup
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const frontend = join(root, "frontend");
const isWin = process.platform === "win32";

function run(cmd, args, cwd = root) {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: isWin && cmd === "npm" });
  if (r.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function pythonVersionOk(cmd, args) {
  const r = spawnSync(cmd, [...args, "-c", "import sys; print(sys.version_info >= (3, 11))"], {
    encoding: "utf8",
  });
  return r.status === 0 && r.stdout.trim() === "True";
}

function findPython() {
  const candidates = isWin
    ? [
        ["py", ["-3.13"]],
        ["py", ["-3.12"]],
        ["py", ["-3.11"]],
        ["python", []],
      ]
    : [
        ["python3.13", []],
        ["python3.12", []],
        ["python3.11", []],
        ["python3", []],
        ["python", []],
      ];
  return candidates.find(([cmd, args]) => pythonVersionOk(cmd, args));
}

// 1. Env files
for (const [dir, target] of [
  [backend, ".env"],
  [frontend, ".env.local"],
]) {
  const dest = join(dir, target);
  if (!existsSync(dest)) {
    copyFileSync(join(dir, ".env.example"), dest);
    console.log(`Created ${dest} from .env.example - edit it with your settings.`);
  }
}

// 2. Python venv + deps
const venvPython = isWin
  ? join(backend, ".venv", "Scripts", "python.exe")
  : join(backend, ".venv", "bin", "python");
if (!existsSync(venvPython)) {
  const py = findPython();
  if (!py) {
    console.error("Python 3.11+ not found. Install it from https://www.python.org/downloads/");
    process.exit(1);
  }
  run(py[0], [...py[1], "-m", "venv", ".venv"], backend);
}
run(venvPython, ["-m", "pip", "install", "--upgrade", "pip", "-q"], backend);
run(venvPython, ["-m", "pip", "install", "-r", "requirements-dev.txt", "-q"], backend);

// 3. Node deps (root orchestration scripts + the frontend app)
run("npm", ["install"], root);
run("npm", ["install"], frontend);
run("npm", ["exec", "--", "playwright", "install", "chromium"], frontend);

console.log("\nSetup complete. Next: `npm run seed`, then `npm run dev`.");
