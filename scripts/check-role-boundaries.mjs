import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const areas = [
  { name: "core", owner: "role-1", root: "src/core" },
  { name: "integrations", owner: "role-1", root: "src/integrations" },
  { name: "realtime", owner: "role-1", root: "src/realtime" },
  { name: "app", owner: "app", root: "src/app" },
  { name: "ai", owner: "role-2", root: "src/ai" },
  { name: "extraction", owner: "role-2", root: "src/extraction" },
  { name: "quest-engine", owner: "role-3", root: "src/quest-engine" },
  { name: "streamer", owner: "role-4", root: "src/streamer" },
  { name: "design-system", owner: "role-4", root: "src/design-system" },
  { name: "viewer", owner: "role-5", root: "src/viewer" },
  { name: "integration-tests", owner: "integration-tests", root: "tests/integration" },
  { name: "legacy-lib", owner: "legacy", root: "src/lib" },
  { name: "legacy-components", owner: "legacy", root: "src/components" },
];

const scannedAreas = areas.filter((area) => area.owner !== "legacy");
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".mts", ".ts", ".tsx"]);

function normalise(value) {
  return value.split(path.sep).join("/").replace(/^\.\//, "");
}

function areaFor(projectPath) {
  const normalised = normalise(projectPath).replace(/\.(?:js|jsx|mjs|mts|ts|tsx)$/, "");
  return areas
    .filter((area) => normalised === area.root || normalised.startsWith(`${area.root}/`))
    .sort((left, right) => right.root.length - left.root.length)[0] ?? null;
}

function resolveLocalTarget(sourceProjectPath, specifier) {
  if (specifier.startsWith("@/")) {
    return normalise(path.join("src", specifier.slice(2)));
  }
  if (!specifier.startsWith(".")) return null;
  return normalise(path.relative(repositoryRoot, path.resolve(repositoryRoot, path.dirname(sourceProjectPath), specifier)));
}

function publicRootTarget(targetProjectPath, targetArea) {
  const target = targetProjectPath.replace(/\.(?:js|jsx|mjs|mts|ts|tsx)$/, "").replace(/\/index$/, "");
  return (
    target === targetArea.root ||
    target === "src/realtime/server" ||
    target === "src/integrations/server"
  );
}

function isTestFile(sourceProjectPath) {
  return /(?:^|\/)tests?\//.test(sourceProjectPath) || /\.test\.[^.]+$/.test(sourceProjectPath);
}

function allowedTargetAreas(sourceArea) {
  switch (sourceArea.name) {
    case "core":
      return new Set(["core"]);
    case "integrations":
      return new Set(["integrations", "core"]);
    case "realtime":
      return new Set(["realtime", "core"]);
    case "ai":
    case "extraction":
      return new Set(["ai", "extraction", "core"]);
    case "quest-engine":
      return new Set(["quest-engine", "core"]);
    case "streamer":
    case "design-system":
      return new Set(["streamer", "design-system", "core"]);
    case "viewer":
      return new Set(["viewer", "core", "design-system"]);
    case "app":
      return new Set(areas.map((area) => area.name));
    case "integration-tests":
      return new Set(areas.filter((area) => area.owner !== "legacy").map((area) => area.name));
    default:
      return new Set([sourceArea.name]);
  }
}

function validateImport(sourceProjectPath, specifier) {
  const sourceArea = areaFor(sourceProjectPath);
  const targetProjectPath = resolveLocalTarget(sourceProjectPath, specifier);
  if (sourceArea === null || targetProjectPath === null) return null;

  const targetArea = areaFor(targetProjectPath);
  if (targetArea === null || targetArea.name === sourceArea.name) return null;

  const allowedAreas = allowedTargetAreas(sourceArea);
  if (!allowedAreas.has(targetArea.name)) {
    return `${sourceArea.name} cannot depend on ${targetArea.name}`;
  }

  if (targetArea.owner === sourceArea.owner) return null;

  // Temporary D1-01/D1-03 exception: thin app routes may keep the checked-in
  // legacy prototype reachable, while new role-owned modules may not depend on it.
  if (sourceArea.owner === "app" && targetArea.owner === "legacy") return null;

  const coreTestingTarget = targetProjectPath.replace(/\.(?:js|jsx|mjs|mts|ts|tsx)$/, "") === "src/core/testing";
  if (targetArea.name === "core" && coreTestingTarget && isTestFile(sourceProjectPath)) return null;

  if (!publicRootTarget(targetProjectPath, targetArea)) {
    return `${sourceArea.name} must import ${targetArea.name} through its public index, not ${specifier}`;
  }

  if (sourceArea.owner === "role-5" && targetArea.owner === "role-4" && targetArea.name !== "design-system") {
    return "viewer may consume Role 4 only through the design-system public entrypoint";
  }

  return null;
}

function importSpecifiers(source, file) {
  const found = [];
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push({ specifier: node.moduleSpecifier.text, index: node.moduleSpecifier.getStart(sourceFile) });
    }
    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      found.push({ specifier: node.arguments[0].text, index: node.arguments[0].getStart(sourceFile) });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

async function sourceFiles(projectDirectory) {
  const absoluteDirectory = path.join(repositoryRoot, projectDirectory);
  try {
    if (!(await stat(absoluteDirectory)).isDirectory()) return [];
  } catch {
    return [];
  }

  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (sourceExtensions.has(path.extname(entry.name))) {
        files.push(normalise(path.relative(repositoryRoot, absolute)));
      }
    }
  }
  await walk(absoluteDirectory);
  return files;
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function selfTest() {
  const cases = [
    ["src/ai/example.ts", "@/core", null],
    ["src/ai/example.ts", "@/quest-engine", "ai"],
    ["src/ai/example.ts", "@/integrations", "ai"],
    ["src/viewer/example.tsx", "@/design-system", null],
    ["src/viewer/example.tsx", "@/design-system/private-button", "public index"],
    ["src/streamer/example.test.ts", "@/core/testing", null],
    ["src/streamer/example.ts", "@/core/testing", "public index"],
    ["tests/integration/example.test.ts", "@/realtime/server", null],
    ["tests/integration/example.test.ts", "@/integrations/server", null],
    ["src/viewer/example.tsx", "@/realtime/server", "viewer"],
  ];
  for (const [source, specifier, expectedFragment] of cases) {
    const result = validateImport(source, specifier);
    if (expectedFragment === null ? result !== null : !result?.includes(expectedFragment)) {
      throw new Error(`Boundary guard self-test failed for ${source} -> ${specifier}: ${result}`);
    }
  }
}

async function main() {
  selfTest();
  const files = (await Promise.all(scannedAreas.map((area) => sourceFiles(area.root)))).flat();
  const violations = [];
  let localImportCount = 0;

  for (const file of files) {
    const source = await readFile(path.join(repositoryRoot, file), "utf8");
    for (const imported of importSpecifiers(source, file)) {
      if (resolveLocalTarget(file, imported.specifier) === null) continue;
      localImportCount += 1;
      const violation = validateImport(file, imported.specifier);
      if (violation !== null) {
        violations.push(`${file}:${lineAt(source, imported.index)} ${violation}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error("Role-boundary violations:\n");
    for (const violation of violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Role boundary check passed (${files.length} files, ${localImportCount} local imports).`);
}

await main();
