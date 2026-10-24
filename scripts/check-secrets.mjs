// Fails if any git-tracked or staged file contains a MongoDB URI with inline credentials.
// Placeholders like <user>:<password> are allowed. Usage: npm run check:secrets
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const credentialUri = /mongodb(\+srv)?:\/\/([^\s:/@<>"']+):([^\s@<>"']+)@/g;
const findings = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const match of text.matchAll(credentialUri)) {
    findings.push(`${file}: credentialed MongoDB URI (user "${match[2]}")`);
  }
}

if (findings.length) {
  console.error("Possible secrets found:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`No secrets found in ${files.length} files.`);
