#!/usr/bin/env node
/**
 * One-time migration: legacy accounts.csv -> accounts.json
 *
 * Usage:
 *   node scripts/migrate-csv-to-json.mjs [csv_path] [json_path]
 *
 * Defaults:
 *   csv  = ~/.link1987/password/accounts.csv
 *   json = ~/.link1987/password/accounts.json
 *
 * Behavior:
 * - Skips if json already exists (unless --force given after the paths).
 * - Renames the csv to accounts.csv.migrated after a successful write.
 */

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2).filter((a) => a !== "--force");
const force = process.argv.includes("--force");
const defaultCsv = join(homedir(), ".link1987", "password", "accounts.csv");
const defaultJson = join(homedir(), ".link1987", "password", "accounts.json");
const [csvPath = defaultCsv, jsonPath = defaultJson] = args;

if (!existsSync(csvPath)) {
  console.error(`CSV not found: ${csvPath}`);
  process.exit(1);
}
if (existsSync(jsonPath) && !force) {
  console.error(`Refusing to overwrite existing ${jsonPath} (use --force)`);
  process.exit(1);
}

const accounts = readFileSync(csvPath, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0)
  .map((line) => {
    const comma = line.indexOf(",");
    if (comma === -1) return null;
    return {
      name: line.slice(0, comma).trim(),
      encryptedPassword: line.slice(comma + 1).trim(),
    };
  })
  .filter((acc) => acc && acc.name);

const store = { version: 1, accounts };
writeFileSync(jsonPath, JSON.stringify(store, null, 2) + "\n");
renameSync(csvPath, csvPath + ".migrated");

console.log(`Migrated ${accounts.length} accounts -> ${jsonPath}`);
console.log(`Old CSV kept as ${csvPath}.migrated`);
