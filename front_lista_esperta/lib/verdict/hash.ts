import { createHash } from "node:crypto";

/** JSON com chaves ordenadas e números arredondados: mesmo input ⇒ mesma string. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return typeof value === "number" ? JSON.stringify(Math.round(value * 100) / 100) : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

export function sha256(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}
