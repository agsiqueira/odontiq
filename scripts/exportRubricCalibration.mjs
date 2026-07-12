import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(repoRoot, "src");
const outputRoot = path.join(repoRoot, "dev-output", "rubric-calibration");
const loadedModules = new Map();
const nodeRequire = createRequire(import.meta.url);

function resolveModule(request, parentFilename) {
  if (request.startsWith("@/")) {
    const base = path.join(srcRoot, request.slice(2));
    return resolveCandidate(base);
  }

  if (request.startsWith(".")) {
    return resolveCandidate(path.resolve(path.dirname(parentFilename), request));
  }

  return request;
}

function resolveCandidate(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.json`,
    path.join(base, "index.ts"),
  ];

  return (
    candidates.find(
      (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    ) ?? `${base}.ts`
  );
}

function loadModule(filename) {
  if (loadedModules.has(filename)) {
    return loadedModules.get(filename).exports;
  }

  if (filename.endsWith(".json")) {
    const jsonModule = { exports: JSON.parse(fs.readFileSync(filename, "utf8")) };
    loadedModules.set(filename, jsonModule);
    return jsonModule.exports;
  }

  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      resolveJsonModule: true,
      strict: true,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  }).outputText;
  const cjsModule = { exports: {} };
  loadedModules.set(filename, cjsModule);

  const requireFromFile = (request) => {
    const resolved = resolveModule(request, filename);

    if (request === "server-only") {
      return {};
    }

    if (resolved === request && !path.isAbsolute(resolved)) {
      return nodeRequire(request);
    }

    return loadModule(resolved);
  };

  new Function("exports", "require", "module", "__filename", "__dirname", output)(
    cjsModule.exports,
    requireFromFile,
    cjsModule,
    filename,
    path.dirname(filename),
  );

  return cjsModule.exports;
}

const {
  buildFacultyRubricCalibrationCsv,
  buildFacultyRubricCalibrationExport,
  validateFacultyRubricCalibration,
} = loadModule(path.join(srcRoot, "lib", "facultyRubric", "index.ts"));

const validation = validateFacultyRubricCalibration();

if (!validation.valid) {
  console.error(JSON.stringify(validation.issues, null, 2));
  process.exit(1);
}

const exportData = buildFacultyRubricCalibrationExport();
const csv = buildFacultyRubricCalibrationCsv(exportData.rows);

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(
  path.join(outputRoot, "faculty-rubric-calibration.json"),
  `${JSON.stringify(exportData, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputRoot, "faculty-rubric-calibration.csv"),
  `${csv}\n`,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputRoot,
      rows: exportData.rows.length,
      summaries: exportData.summaries.length,
    },
    null,
    2,
  ),
);
