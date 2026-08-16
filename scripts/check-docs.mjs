import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsDirectory = path.join(repositoryRoot, "docs");
const catalogPath = path.join(docsDirectory, "catalog.json");
const allowedCategories = new Set(["Start", "Build", "Trust", "Direction"]);
const unfinishedPattern = /\b(?:TODO|FIXME)\b|\[PLACEHOLDER\]/i;

function fail(message) {
  process.stderr.write(`docs:check · ${message}\n`);
  process.exitCode = 1;
}

async function exists(target) {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
if (!Array.isArray(catalog)) throw new Error("docs/catalog.json must contain an array");

const markdownFiles = (await readdir(docsDirectory)).filter((file) => file.endsWith(".md")).sort();
const catalogFiles = catalog.map((entry) => entry.file).sort();
const slugs = new Set();
const files = new Set();
const orders = new Set();

for (const entry of catalog) {
  if (!entry || typeof entry !== "object") {
    fail("every catalog entry must be an object");
    continue;
  }

  for (const field of ["slug", "file", "title", "description", "category", "status", "reviewedAt", "order"]) {
    if (entry[field] === undefined || entry[field] === "") fail(`${entry.file ?? "unknown entry"} is missing ${field}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) fail(`${entry.file} has an invalid slug`);
  if (!entry.file.endsWith(".md") || path.basename(entry.file) !== entry.file) fail(`${entry.file} must be one Markdown filename`);
  if (!allowedCategories.has(entry.category)) fail(`${entry.file} has an unsupported category`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) fail(`${entry.file} has an invalid reviewedAt date`);
  if (!Number.isInteger(entry.order)) fail(`${entry.file} order must be an integer`);
  if (slugs.has(entry.slug)) fail(`duplicate slug ${entry.slug}`);
  if (files.has(entry.file)) fail(`duplicate file ${entry.file}`);
  if (orders.has(entry.order)) fail(`duplicate order ${entry.order}`);
  slugs.add(entry.slug);
  files.add(entry.file);
  orders.add(entry.order);

  const documentPath = path.join(docsDirectory, entry.file);
  if (!(await exists(documentPath))) {
    fail(`${entry.file} does not exist`);
    continue;
  }
  const source = await readFile(documentPath, "utf8");
  const heading = source.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading !== entry.title) fail(`${entry.file} heading "${heading ?? "missing"}" does not match catalog title "${entry.title}"`);
  if (unfinishedPattern.test(source)) fail(`${entry.file} contains unfinished documentation markers`);

  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const rawTarget = match[1]?.trim().replace(/^<|>$/g, "") ?? "";
    if (!rawTarget || /^(?:https?:|mailto:|#)/i.test(rawTarget)) continue;
    const relativeTarget = rawTarget.split("#", 1)[0]?.split("?", 1)[0];
    if (!relativeTarget) continue;
    const resolvedTarget = path.resolve(docsDirectory, relativeTarget);
    if (!resolvedTarget.startsWith(repositoryRoot + path.sep)) {
      fail(`${entry.file} links outside the repository: ${rawTarget}`);
      continue;
    }
    if (!(await exists(resolvedTarget))) fail(`${entry.file} has a broken link: ${rawTarget}`);
  }
}

for (const file of markdownFiles) {
  if (!catalogFiles.includes(file)) fail(`${file} is not listed in docs/catalog.json`);
}
for (const file of catalogFiles) {
  if (!markdownFiles.includes(file)) fail(`catalog references missing Markdown file ${file}`);
}

if (!process.exitCode) {
  process.stdout.write(`docs:check · ${catalog.length} documents are catalogued, linked and ready for the website\n`);
}
