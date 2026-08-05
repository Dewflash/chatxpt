import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROLE_OWNERS = Object.freeze({
  "role-1": "Dewflash",
  "role-2": "joelyrk",
  "role-3": "L0pch",
  "role-4": "JYL1m",
  "role-5": "drdexe",
});

const EVIDENCE_CLASSES = new Set([
  "real",
  "memory-backed",
  "fixture-only",
  "inspection-only",
  "unverified",
]);
const RESULTS = new Set(["passed", "failed", "partial", "planned"]);
const RESOURCE_STATUSES = new Set(["assigned", "owner-action-required", "ready", "blocked"]);
const RESOURCE_CUSTODY = new Set(["private-team-channel", "private-team-drive", "local-only"]);
const DEVICE_CLASSES = new Set(["server", "desktop", "mobile", "tablet", "obs", "multi-client"]);
const INPUT_KINDS = new Set(["real", "memory", "fixture", "inspection", "unverified"]);
const ARTIFACT_STORAGE = new Set([
  "repository",
  "private-team-drive",
  "github-pr",
  "local-only",
  "none",
]);
const BLOCKED_KEYS = /(?:token|secret|password|authorization|cookie|email|accountname|viewerid)/i;
const BLOCKED_VALUES = [
  /https?:\/\//i,
  /\bBearer\s+[A-Za-z0-9._~-]+/i,
  /\b(?:gh[opsu]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,})\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeText(value, min = 1, max = 300) {
  return typeof value === "string" && value.trim().length >= min && value.length <= max;
}

function checkExactKeys(value, allowedKeys, path, errors) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key} is not part of evidence manifest v1`);
  }
}

function checkOwner(value, path, errors) {
  if (!isObject(value)) {
    errors.push(`${path} must be an owner object`);
    return;
  }
  checkExactKeys(value, new Set(["role", "github"]), path, errors);
  if (!Object.hasOwn(ROLE_OWNERS, value.role)) {
    errors.push(`${path}.role must name role-1 through role-5`);
    return;
  }
  if (value.github !== ROLE_OWNERS[value.role]) {
    errors.push(`${path}.github must be ${ROLE_OWNERS[value.role]} for ${value.role}`);
  }
}

function checkPrivacy(value, path, errors, parentKey = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkPrivacy(item, `${path}[${index}]`, errors, parentKey));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (BLOCKED_KEYS.test(key)) {
        errors.push(`${path}.${key} is not allowed in the committed evidence manifest`);
      }
      checkPrivacy(child, `${path}.${key}`, errors, key);
    }
    return;
  }
  if (typeof value !== "string" || parentKey === "github") return;
  for (const pattern of BLOCKED_VALUES) {
    if (pattern.test(value)) {
      errors.push(`${path} contains a private URL, credential, or personal contact value`);
      break;
    }
  }
}

function checkResource(resource, index, errors) {
  const path = `resources[${index}]`;
  if (!isObject(resource)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkExactKeys(
    resource,
    new Set(["id", "label", "owner", "status", "requiredBy", "custody", "notes"]),
    path,
    errors,
  );
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(resource.id ?? "")) {
    errors.push(`${path}.id must be a lowercase kebab-case identifier`);
  }
  if (!isSafeText(resource.label, 1, 120)) errors.push(`${path}.label is required`);
  checkOwner(resource.owner, `${path}.owner`, errors);
  if (!RESOURCE_STATUSES.has(resource.status)) errors.push(`${path}.status is invalid`);
  if (!isSafeText(resource.requiredBy, 1, 120)) errors.push(`${path}.requiredBy is required`);
  if (!RESOURCE_CUSTODY.has(resource.custody)) errors.push(`${path}.custody is invalid`);
  if (!isSafeText(resource.notes)) errors.push(`${path}.notes is required`);
}

function checkArtifact(artifact, entryPath, index, repositoryRoot, errors) {
  const path = `${entryPath}.artifacts[${index}]`;
  if (!isObject(artifact)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkExactKeys(
    artifact,
    new Set(["storage", "reference", "mediaType", "privacyReviewed", "sha256"]),
    path,
    errors,
  );
  if (!ARTIFACT_STORAGE.has(artifact.storage)) errors.push(`${path}.storage is invalid`);
  if (!isSafeText(artifact.reference, 1, 240)) errors.push(`${path}.reference is required`);
  if (!isSafeText(artifact.mediaType, 1, 80)) errors.push(`${path}.mediaType is required`);
  if (typeof artifact.privacyReviewed !== "boolean") {
    errors.push(`${path}.privacyReviewed must be boolean`);
  }
  if (artifact.sha256 !== undefined && artifact.sha256 !== null && !/^[a-f0-9]{64}$/.test(artifact.sha256)) {
    errors.push(`${path}.sha256 must be null or a lowercase SHA-256 digest`);
  }

  if (artifact.storage === "repository" && typeof artifact.reference === "string") {
    if (!artifact.reference.startsWith("docs/evidence/artifacts/")) {
      errors.push(`${path}.reference must stay under docs/evidence/artifacts/`);
    } else {
      const absolute = resolve(repositoryRoot, artifact.reference);
      const relativePath = relative(repositoryRoot, absolute);
      if (relativePath.startsWith("..") || !existsSync(absolute)) {
        errors.push(`${path}.reference must point to an existing repository artifact`);
      }
    }
  }
  if (artifact.storage === "github-pr" && !/^PR #[1-9][0-9]*$/.test(artifact.reference ?? "")) {
    errors.push(`${path}.reference must use PR #<number>`);
  }
  if (
    artifact.storage === "private-team-drive" &&
    !/^team-drive-item:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifact.reference ?? "")
  ) {
    errors.push(`${path}.reference must use a non-link team-drive-item:<id> label`);
  }
  if (
    artifact.storage === "local-only" &&
    !/^local-artifact:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(artifact.reference ?? "")
  ) {
    errors.push(`${path}.reference must use a non-link local-artifact:<id> label`);
  }
  if (artifact.storage === "none" && artifact.reference !== "not-captured") {
    errors.push(`${path}.reference must be not-captured when storage is none`);
  }
}

function checkEntry(entry, index, repositoryRoot, errors) {
  const path = `entries[${index}]`;
  if (!isObject(entry)) {
    errors.push(`${path} must be an object`);
    return;
  }
  checkExactKeys(
    entry,
    new Set([
      "id",
      "capturedAt",
      "owner",
      "reviewer",
      "evidenceClass",
      "result",
      "claim",
      "resourceIds",
      "surfaces",
      "source",
      "authoritativeState",
      "inputs",
      "commands",
      "artifacts",
      "limitations",
    ]),
    path,
    errors,
  );
  if (!/^E-[0-9]{8}-R[1-5]-[0-9]{3}$/.test(entry.id ?? "")) {
    errors.push(`${path}.id must use E-YYYYMMDD-R<role>-NNN`);
  }
  if (
    !isSafeText(entry.capturedAt, 1, 40) ||
    Number.isNaN(Date.parse(entry.capturedAt)) ||
    !/(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(entry.capturedAt)
  ) {
    errors.push(`${path}.capturedAt must be an ISO timestamp with timezone`);
  }
  checkOwner(entry.owner, `${path}.owner`, errors);
  const idRole = /^E-[0-9]{8}-R([1-5])-[0-9]{3}$/.exec(entry.id ?? "")?.[1];
  if (idRole !== undefined && entry.owner?.role !== `role-${idRole}`) {
    errors.push(`${path}.id role must match ${path}.owner.role`);
  }
  const idDate = /^E-([0-9]{8})-R[1-5]-[0-9]{3}$/.exec(entry.id ?? "")?.[1];
  if (idDate !== undefined && entry.capturedAt?.slice(0, 10).replaceAll("-", "") !== idDate) {
    errors.push(`${path}.id date must match capturedAt`);
  }
  if (entry.reviewer !== null) checkOwner(entry.reviewer, `${path}.reviewer`, errors);
  if (!EVIDENCE_CLASSES.has(entry.evidenceClass)) errors.push(`${path}.evidenceClass is invalid`);
  if (!RESULTS.has(entry.result)) errors.push(`${path}.result is invalid`);
  if (!isSafeText(entry.claim)) errors.push(`${path}.claim is required`);
  if (
    !Array.isArray(entry.resourceIds) ||
    new Set(entry.resourceIds).size !== entry.resourceIds.length ||
    entry.resourceIds.some((id) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
  ) {
    errors.push(`${path}.resourceIds must be unique lowercase kebab-case identifiers`);
  }

  if (!Array.isArray(entry.surfaces) || entry.surfaces.length === 0) {
    errors.push(`${path}.surfaces must contain at least one surface`);
  } else {
    entry.surfaces.forEach((surface, surfaceIndex) => {
      const surfacePath = `${path}.surfaces[${surfaceIndex}]`;
      if (!isObject(surface)) {
        errors.push(`${surfacePath} must be an object`);
        return;
      }
      checkExactKeys(surface, new Set(["name", "deviceClass", "viewport"]), surfacePath, errors);
      if (!isSafeText(surface.name, 1, 80)) errors.push(`${surfacePath}.name is required`);
      if (!DEVICE_CLASSES.has(surface.deviceClass)) errors.push(`${surfacePath}.deviceClass is invalid`);
      if (surface.viewport !== null && !isSafeText(surface.viewport, 1, 40)) {
        errors.push(`${surfacePath}.viewport must be null or a short label`);
      }
    });
  }

  if (!isObject(entry.source)) {
    errors.push(`${path}.source must be an object`);
  } else {
    checkExactKeys(entry.source, new Set(["gitCommit", "branch", "prNumber"]), `${path}.source`, errors);
    if (!/^[a-f0-9]{7,40}$/.test(entry.source.gitCommit ?? "")) {
      errors.push(`${path}.source.gitCommit must be an immutable 7-40 character commit SHA`);
    }
    if (!isSafeText(entry.source.branch, 1, 160)) errors.push(`${path}.source.branch is required`);
    if (entry.source.prNumber !== null && (!Number.isInteger(entry.source.prNumber) || entry.source.prNumber < 1)) {
      errors.push(`${path}.source.prNumber must be null or a positive integer`);
    }
  }

  if (!isObject(entry.authoritativeState)) {
    errors.push(`${path}.authoritativeState must be an object`);
  } else {
    checkExactKeys(
      entry.authoritativeState,
      new Set(["sessionRef", "questCycleRef", "revision"]),
      `${path}.authoritativeState`,
      errors,
    );
    for (const key of ["sessionRef", "questCycleRef"]) {
      const value = entry.authoritativeState[key];
      if (value !== null && !isSafeText(value, 1, 80)) {
        errors.push(`${path}.authoritativeState.${key} must be null or a safe reference`);
      }
    }
    const revision = entry.authoritativeState.revision;
    if (revision !== null && (!Number.isInteger(revision) || revision < 0)) {
      errors.push(`${path}.authoritativeState.revision must be null or a non-negative integer`);
    }
  }

  const inputs = Array.isArray(entry.inputs) ? entry.inputs : [];
  if (!Array.isArray(entry.inputs)) {
    errors.push(`${path}.inputs must be an array`);
  } else {
    entry.inputs.forEach((input, inputIndex) => {
      const inputPath = `${path}.inputs[${inputIndex}]`;
      if (!isObject(input)) {
        errors.push(`${inputPath} must contain a valid kind and description`);
        return;
      }
      checkExactKeys(input, new Set(["kind", "description"]), inputPath, errors);
      if (!INPUT_KINDS.has(input.kind) || !isSafeText(input.description, 1, 240)) {
        errors.push(`${inputPath} must contain a valid kind and description`);
      }
    });
  }
  if (!Array.isArray(entry.commands) || entry.commands.some((command) => !isSafeText(command, 1, 240))) {
    errors.push(`${path}.commands must be an array of safe command descriptions`);
  }
  const artifacts = Array.isArray(entry.artifacts) ? entry.artifacts : [];
  if (!Array.isArray(entry.artifacts)) {
    errors.push(`${path}.artifacts must be an array`);
  } else {
    entry.artifacts.forEach((artifact, artifactIndex) =>
      checkArtifact(artifact, path, artifactIndex, repositoryRoot, errors),
    );
  }
  if (!Array.isArray(entry.limitations) || entry.limitations.some((item) => !isSafeText(item))) {
    errors.push(`${path}.limitations must be an array of safe limitation statements`);
  }

  const classInput = {
    real: "real",
    "memory-backed": "memory",
    "fixture-only": "fixture",
    "inspection-only": "inspection",
    unverified: "unverified",
  }[entry.evidenceClass];
  if (classInput && !inputs.some((input) => input.kind === classInput)) {
    errors.push(`${path} must include a ${classInput} input for ${entry.evidenceClass} evidence`);
  }
  if (entry.evidenceClass === "unverified") {
    if (!new Set(["planned", "partial"]).has(entry.result)) {
      errors.push(`${path} unverified evidence must be planned or partial`);
    }
  } else {
    if (entry.result === "planned") errors.push(`${path} executed evidence cannot have a planned result`);
    if (entry.reviewer === null) errors.push(`${path} executed evidence requires a reviewer`);
    if (entry.commands?.length === 0 && entry.evidenceClass !== "inspection-only") {
      errors.push(`${path} executed runtime evidence requires at least one command or interaction`);
    }
    if (artifacts.length === 0) errors.push(`${path} executed evidence requires an artifact reference`);
  }
  if (entry.evidenceClass === "real" && artifacts.some((artifact) => !artifact.privacyReviewed)) {
    errors.push(`${path} real evidence artifacts must be privacy reviewed`);
  }
}

export function validateEvidenceManifest(manifest, options = {}) {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const errors = [];
  if (!isObject(manifest)) return ["manifest must be an object"];
  checkExactKeys(manifest, new Set(["schemaVersion", "updatedAt", "resources", "entries"]), "manifest", errors);
  if (manifest.schemaVersion !== "1.0.0") errors.push("schemaVersion must be 1.0.0");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(manifest.updatedAt ?? "") ||
    Number.isNaN(Date.parse(`${manifest.updatedAt}T00:00:00Z`))
  ) {
    errors.push("updatedAt must use YYYY-MM-DD");
  }
  if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
    errors.push("resources must contain at least one assigned test resource");
  } else {
    manifest.resources.forEach((resource, index) => checkResource(resource, index, errors));
    const ids = manifest.resources.map((resource) => resource?.id);
    if (new Set(ids).size !== ids.length) errors.push("resource IDs must be unique");
  }
  if (!Array.isArray(manifest.entries)) {
    errors.push("entries must be an array");
  } else {
    manifest.entries.forEach((entry, index) => checkEntry(entry, index, repositoryRoot, errors));
    const ids = manifest.entries.map((entry) => entry?.id);
    if (new Set(ids).size !== ids.length) errors.push("evidence entry IDs must be unique");
    const resourceIds = new Set(manifest.resources?.map((resource) => resource?.id) ?? []);
    for (const [index, entry] of manifest.entries.entries()) {
      for (const resourceId of Array.isArray(entry?.resourceIds) ? entry.resourceIds : []) {
        if (!resourceIds.has(resourceId)) {
          errors.push(`entries[${index}].resourceIds references unknown resource ${resourceId}`);
        }
      }
      if (entry?.capturedAt?.slice(0, 10) > manifest.updatedAt) {
        errors.push(`entries[${index}].capturedAt is later than manifest.updatedAt`);
      }
    }
    for (const [index, resource] of (manifest.resources ?? []).entries()) {
      if (
        resource?.status === "ready" &&
        !manifest.entries.some(
          (entry) =>
            entry?.evidenceClass !== "unverified" && entry?.resourceIds?.includes(resource.id),
        )
      ) {
        errors.push(`resources[${index}] cannot be ready without an executed evidence entry`);
      }
    }
  }
  checkPrivacy(manifest, "manifest", errors);
  return errors;
}

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");

if (resolve(process.argv[1] ?? "") === scriptPath) {
  const manifestPath = join(repositoryRoot, "docs/evidence/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const errors = validateEvidenceManifest(manifest, { repositoryRoot });
  if (errors.length > 0) {
    console.error(`Evidence manifest failed validation:\n- ${errors.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log(
      `Evidence manifest passed (${manifest.resources.length} resources, ${manifest.entries.length} entries).`,
    );
  }
}
