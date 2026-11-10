/**
 * Generate this app's wire types from mytheus-backend's emitted OpenAPI documents.
 *
 *   node scripts/generate-api-types.mjs            # write src/api/generated/
 *   node scripts/generate-api-types.mjs --check    # fail if the committed output is stale
 *
 * The same approach as mytheus-ui `scripts/generate-api-types.mjs`: each backend service emits
 * its document from its FastAPI app (ADR-0022), openapi-typescript turns each into a module, and
 * the output is committed so the app builds with no sibling checkout. `--check` stops the
 * committed copy from becoming a second source of truth. Never hand-edit the generated files;
 * the shapes the app consumes are picked out of them in `src/api/types.ts`, so a server change
 * that drifts from what a screen reads fails `tsc`.
 *
 * Point MYTHEUS_OPENAPI_DIR at the documents when the sibling checkout is not on `main`.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const OUT_DIR = join(REPO, "src", "api", "generated");

/**
 * Only the documents this app consumes. Admin-ops, billing and integration-service are web-only by
 * design (CLAUDE.md: no admin, billing-purchase or integration-install flows on mobile), so their
 * types are not generated here and a screen cannot quietly start calling them.
 */
const DOCUMENTS = [
  "bff.yaml",
  "core-api.yaml",
  "identity-tenant-service.yaml",
  "meeting-service.yaml",
  "notification-service.yaml",
];

const CANDIDATES = [
  join(REPO, "..", "mytheus-backend", "design", "openapi"),
  join(REPO, "..", "..", "mytheus-backend", "design", "openapi"),
];

function specDir() {
  const override = process.env.MYTHEUS_OPENAPI_DIR;
  if (override) {
    const dir = resolve(override);
    if (existsSync(dir)) return dir;
    console.error(`MYTHEUS_OPENAPI_DIR is set to ${dir}, which does not exist.`);
    process.exit(2);
  }
  for (const candidate of CANDIDATES) {
    const dir = resolve(candidate);
    if (existsSync(dir)) return dir;
  }
  console.error(
    "Could not find mytheus-backend's emitted OpenAPI documents.\n" +
      "Set MYTHEUS_OPENAPI_DIR to the directory holding them.\nTried:\n" +
      CANDIDATES.map((c) => `  ${resolve(c)}`).join("\n"),
  );
  process.exit(2);
}

const BANNER = [
  "/**",
  " * GENERATED FILE - DO NOT EDIT.",
  " *",
  " * Emitted from mytheus-backend's OpenAPI document by `npm run generate:api`.",
  " * `npm run generate:api:check` fails when this file and the spec disagree.",
  " */",
  "",
].join("\n");

function generate(dir) {
  const present = new Set(readdirSync(dir).filter((f) => f.endsWith(".yaml")));
  const missing = DOCUMENTS.filter((d) => !present.has(d));
  if (missing.length) {
    console.error(`Missing from ${dir}: ${missing.join(", ")}`);
    process.exit(2);
  }
  const specs = [...DOCUMENTS].sort();
  const files = new Map();
  for (const spec of specs) {
    const stdout = execFileSync(
      process.execPath,
      [join(REPO, "node_modules", "openapi-typescript", "bin", "cli.js"), join(dir, spec)],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    files.set(spec.replace(/\.yaml$/, ".ts"), (BANNER + stdout).replace(/\r\n/g, "\n"));
  }
  return files;
}

function readExisting() {
  if (!existsSync(OUT_DIR)) return new Map();
  return new Map(
    readdirSync(OUT_DIR)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => [f, readFileSync(join(OUT_DIR, f), "utf8").replace(/\r\n/g, "\n")]),
  );
}

const check = process.argv.includes("--check");
const dir = specDir();
const generated = generate(dir);

if (check) {
  const existing = readExisting();
  const problems = [];
  for (const [name, content] of generated) {
    if (!existing.has(name)) problems.push(`${name}: missing from the committed output`);
    else if (existing.get(name) !== content) problems.push(`${name}: differs from the spec`);
  }
  for (const name of existing.keys()) {
    if (!generated.has(name)) problems.push(`${name}: committed but no longer emitted`);
  }
  if (problems.length) {
    console.error(
      "Generated API types are stale:\n" +
        problems.map((p) => `  ${p}`).join("\n") +
        "\n\nRun `npm run generate:api` and commit the result.",
    );
    process.exit(1);
  }
  console.log(`Generated API types match ${dir}`);
  process.exit(0);
}

rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of generated) {
  writeFileSync(join(OUT_DIR, name), content, "utf8");
  console.log(`wrote src/api/generated/${name}`);
}
console.log(`from ${dir}`);
