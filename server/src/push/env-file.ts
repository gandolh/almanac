/**
 * Writing a VAPID key pair into a `.env` file's text (`vapid-keys.ts`, brief
 * 14). Pure, so the rules are tested without touching a real `.env`.
 */

export interface VapidLines {
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
}

/** `KEY=value` with the value trimmed; `undefined` when the line is not there. A later line wins, as in `process.loadEnvFile`. */
export function envValue(text: string, key: string): string | undefined {
  let found: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match?.[1] === key) found = (match[2] ?? "").trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return found;
}

/**
 * `text` with `lines` in it: an empty `KEY=` (as copied from `.env.example`)
 * is filled where it stands, a key that isn't there goes at the end, and a
 * key that already has a value is left as it is. The caller refuses to run
 * over a pair already set, so in practice only `VAPID_SUBJECT` is ever kept.
 */
export function withVapidLines(text: string, lines: VapidLines): string {
  let out = text;
  const missing: string[] = [];
  for (const [key, value] of Object.entries(lines)) {
    const current = envValue(out, key);
    if (current === undefined) missing.push(`${key}=${value}`);
    else if (current === "") out = out.replace(new RegExp(`^(\\s*)${key}\\s*=.*$`, "m"), `$1${key}=${value}`);
  }
  if (missing.length === 0) return out;
  const separator = out === "" || out.endsWith("\n") ? "" : "\n";
  return `${out}${separator}${missing.join("\n")}\n`;
}
