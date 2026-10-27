import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import webpush from "web-push";
import { envValue, withVapidLines } from "./push/env-file.js";

/**
 * Makes the server's Web Push key pair (brief 14) and writes it into the repo's
 * `.env`, which git ignores:
 *
 *     npm run vapid-keys -w @almanac/server            (fills VAPID_* in .env)
 *     npm run vapid-keys -w @almanac/server -- --print (prints the three lines instead)
 *
 * The private key is a secret. Written, it goes only into `.env` (created
 * 0600 if it isn't there) and is never shown; `--print` is for copying a pair
 * into the deploy's secrets file. A `.env` that already has a pair is left
 * alone: a new pair turns notifications off in every browser until each turns
 * them on again, so replacing one is a choice to make by hand.
 *
 * `VAPID_SUBJECT` is who push services contact about this sender. Left empty,
 * it gets the placeholder `mailto:johndoe@example.com`; set a real address
 * before production.
 */

/** `src/` (tsx) and `dist/` (built) sit at the same depth, so this resolves the same from both. */
const ENV_FILE = fileURLToPath(new URL("../../.env", import.meta.url));
const PLACEHOLDER_SUBJECT = "mailto:johndoe@example.com";

function readEnvFile(): string {
  try {
    return readFileSync(ENV_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

function main(): void {
  const { publicKey, privateKey } = webpush.generateVAPIDKeys();
  if (process.argv.includes("--print")) {
    console.log(`VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=${PLACEHOLDER_SUBJECT}`);
    return;
  }

  const text = readEnvFile();
  if (envValue(text, "VAPID_PUBLIC_KEY") || envValue(text, "VAPID_PRIVATE_KEY")) {
    throw new Error(
      ".env already has VAPID keys; left as they are. A new pair turns notifications off in every browser until each turns them on again. To replace it anyway, empty VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env and run this again.",
    );
  }
  writeFileSync(
    ENV_FILE,
    withVapidLines(text, { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: PLACEHOLDER_SUBJECT }),
    { mode: 0o600 },
  );
  const subject = envValue(readEnvFile(), "VAPID_SUBJECT");
  console.log(`Wrote a new VAPID key pair into .env (VAPID_SUBJECT is ${subject}). Restart the server to turn push on.`);
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
