import fs from "fs";
import path from "path";
import type { ActivityEntry, Lead, Store } from "./schema";
import { freshStore } from "./seeds";

// A JSON file is the whole database. Reset rewrites it from seeds — instant
// and total, which is the point: this demo gets re-run on camera.
//
// On Vercel, process.cwd() is the deployed bundle — read-only. /tmp is the
// one writable path serverless functions get, so that's where this lives in
// production; resetting on every cold start is fine for a demo that's
// meant to be re-run from scratch anyway. Locally, ./data keeps the file
// next to the project the way it always has.

const STORE_PATH = path.join(
  process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data"),
  "store.json"
);

export function readStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    const store = freshStore();
    writeStore(store);
    return store;
  }
}

export function writeStore(store: Store): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = STORE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
}

export function resetStore(): Store {
  const store = freshStore();
  writeStore(store);
  return store;
}

export function findLead(store: Store, id: string): Lead | undefined {
  return store.leads.find((l) => l.id === id);
}

export function log(store: Store, t: string, line: string, kind: ActivityEntry["kind"] = "info") {
  store.activity.push({ t, line, kind });
}
