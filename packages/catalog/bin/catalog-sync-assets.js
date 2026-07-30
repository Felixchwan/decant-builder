#!/usr/bin/env node

import { homedir } from "node:os";
import {
  copyFile,
  lstat,
  mkdir,
  readdir,
  realpath,
  rm,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const CATALOG_ASSET_SOURCE = path.join(PACKAGE_ROOT, "assets");
const PACKAGE_SOURCE = path.join(PACKAGE_ROOT, "src");
const REPOSITORY_ROOT = path.resolve(PACKAGE_ROOT, "../..");

function samePath(left, right) {
  return path.resolve(left).toLocaleLowerCase("en-US") === path.resolve(right).toLocaleLowerCase("en-US");
}

function isWithin(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function validateDestination(destination) {
  if (typeof destination !== "string" || !destination.trim()) {
    throw new Error("A destination is required.");
  }

  const requested = path.resolve(destination);
  const parent = path.dirname(requested);
  await mkdir(parent, { recursive: true });
  const resolvedParent = await realpath(parent);
  const resolved = path.join(resolvedParent, path.basename(requested));
  const root = path.parse(resolved).root;

  if (path.basename(resolved).toLocaleLowerCase("en-US") !== "catalog-assets") {
    throw new Error("Destination directory must be named catalog-assets.");
  }
  if (
    samePath(resolved, root)
    || samePath(resolved, homedir())
    || samePath(resolved, REPOSITORY_ROOT)
    || samePath(resolved, PACKAGE_ROOT)
    || samePath(resolved, CATALOG_ASSET_SOURCE)
    || isWithin(resolved, PACKAGE_SOURCE)
    || isWithin(resolved, CATALOG_ASSET_SOURCE)
  ) {
    throw new Error(`Unsafe catalog asset destination: ${resolved}`);
  }
  if (await pathExists(resolved)) {
    const destinationEntry = await lstat(resolved);
    if (destinationEntry.isSymbolicLink()) {
      throw new Error("Destination must not be a symbolic link.");
    }
  }
  return resolved;
}

async function collectSourceFiles(directory, relativeDirectory = "", seen = new Map()) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  const files = [];

  for (const entry of entries) {
    const sourcePath = path.join(directory, entry.name);
    const relativePath = relativeDirectory
      ? path.posix.join(relativeDirectory, entry.name)
      : entry.name;
    const details = await lstat(sourcePath);
    if (details.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed: ${relativePath}`);
    }
    const collisionKey = relativePath.toLocaleLowerCase("en-US");
    if (seen.has(collisionKey)) {
      throw new Error(`Case-insensitive asset collision: ${seen.get(collisionKey)} and ${relativePath}`);
    }
    seen.set(collisionKey, relativePath);

    if (details.isDirectory()) {
      files.push(...await collectSourceFiles(sourcePath, relativePath, seen));
    } else if (details.isFile()) {
      files.push(relativePath);
    } else {
      throw new Error(`Unsupported asset entry: ${relativePath}`);
    }
  }
  return files;
}

export async function syncCatalogAssets({ destination } = {}) {
  const sourceDetails = await lstat(CATALOG_ASSET_SOURCE).catch((error) => {
    throw new Error(`Catalog asset source is unavailable: ${error.message}`);
  });
  if (!sourceDetails.isDirectory() || sourceDetails.isSymbolicLink()) {
    throw new Error("Catalog asset source must be a real directory.");
  }

  const resolvedDestination = await validateDestination(destination);
  if (samePath(resolvedDestination, CATALOG_ASSET_SOURCE)) {
    throw new Error("Source and destination must differ.");
  }
  const files = await collectSourceFiles(CATALOG_ASSET_SOURCE);
  await rm(resolvedDestination, { recursive: true, force: true });
  for (const relativePath of files) {
    const sourcePath = path.join(CATALOG_ASSET_SOURCE, ...relativePath.split("/"));
    const destinationPath = path.join(resolvedDestination, ...relativePath.split("/"));
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }

  return { copied: files.length, destination: resolvedDestination };
}

function parseDestination(argumentsList) {
  const index = argumentsList.indexOf("--destination");
  if (index === -1 || !argumentsList[index + 1] || argumentsList.length !== 2) {
    throw new Error("Usage: catalog-sync-assets --destination <path>");
  }
  return argumentsList[index + 1];
}

if (
  process.argv[1] &&
  samePath(await realpath(process.argv[1]), await realpath(fileURLToPath(import.meta.url)))
) {
  try {
    const result = await syncCatalogAssets({ destination: parseDestination(process.argv.slice(2)) });
    console.log(`Copied ${result.copied} catalog assets to ${result.destination}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
