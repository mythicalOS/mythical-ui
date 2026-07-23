// Rewrite `workspace:` protocol dependencies to concrete semver ranges, in place,
// for every publishable package. `bun publish` does this automatically at pack time;
// `npm publish` does NOT, so when we publish with npm (required for provenance
// attestation, which bun cannot emit) we must do the rewrite ourselves first.
//
// `workspace:^`  -> `^<local version>`   `workspace:~` -> `~<local version>`
// `workspace:*`  -> `<local version>`    `workspace:<range>` -> `<range>`
//
// Only `@mythicalos/*` packages that live in THIS repo are resolved locally; a
// `workspace:` pointer to a package not found here is a hard error (fail closed).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PKG_DIRS = ["packages/ui-core", "packages/preact-ui", "packages/react-ui", "packages/shell"];

// name -> local version, for resolving workspace pointers
const localVersion: Record<string, string> = {};
for (const dir of PKG_DIRS) {
  const p = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  localVersion[p.name] = p.version;
}

const DEP_FIELDS = ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"];
let rewrites = 0;

for (const dir of PKG_DIRS) {
  const file = join(dir, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps) as [string, string][]) {
      if (!spec.startsWith("workspace:")) continue;
      const version = localVersion[name];
      if (!version) throw new Error(`${file}: ${field}.${name} is "${spec}" but ${name} is not a local package`);
      const suffix = spec.slice("workspace:".length); // ^ | ~ | * | <range>
      let resolved: string;
      if (suffix === "*" || suffix === "") resolved = version;
      else if (suffix === "^" || suffix === "~") resolved = suffix + version;
      else resolved = suffix; // an explicit range was given after workspace:
      deps[name] = resolved;
      console.log(`  ${dir}: ${field}.${name}  ${spec} -> ${resolved}`);
      rewrites++;
    }
  }
  writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
}

console.log(`resolve-workspace-deps: ${rewrites} rewrite(s) across ${PKG_DIRS.length} packages`);
if (rewrites === 0) console.log("  (none — nothing used the workspace: protocol)");
