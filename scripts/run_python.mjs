import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const scriptArgs = process.argv.slice(2);
if (!scriptArgs.length) {
  console.error("Usage: node scripts/run_python.mjs <script.py> [arguments]");
  process.exit(2);
}

// Tried in order; the first interpreter that can import the PDF packages wins. The
// bundled runtime is kept as a fallback because the system Python often lacks them.
const candidates = [
  process.env.ESAT_PYTHON,
  "python",
  "python3",
  join(homedir(), ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "python", "python.exe"),
].filter(Boolean);

const required = "import pdfplumber, pypdfium2, PIL, pypdf";
const python = candidates.find((candidate) => {
  const check = spawnSync(candidate, ["-c", required], { stdio: "ignore" });
  return check.status === 0;
});

if (!python) {
  console.error("No compatible Python runtime was found. Install requirements.txt or set ESAT_PYTHON.");
  process.exit(1);
}

const result = spawnSync(python, scriptArgs, { stdio: "inherit" });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
