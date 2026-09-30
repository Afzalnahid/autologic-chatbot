// Which tutorial a tool works on: TUT=<file name in scripts/> (e.g. TUT=01-account),
// the first script when unset. Every tool (capture, tts, check_voice, render,
// mix, build) loads its script through here.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SCRIPTS = path.join(HERE, "scripts");

export function scriptIds() {
  return fs.readdirSync(SCRIPTS).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
}
export function loadScript(id = process.env.TUT || scriptIds()[0]) {
  const file = path.join(SCRIPTS, `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`no tutorial script ${file}`);
  const s = JSON.parse(fs.readFileSync(file, "utf8"));
  if (s.id !== id) throw new Error(`${file}: its "id" must be "${id}"`);
  return s;
}
