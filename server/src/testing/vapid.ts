import { createECDH } from "node:crypto";

/**
 * A VAPID key pair made for this test run only, the shape
 * `npm run vapid-keys -w @almanac/server` prints. Tests make one each time:
 * a fixed pair in a file would be a key in the repo.
 */
export function makeVapidPair(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  // The private key can come back shorter than 32 bytes when it starts with zeros.
  const raw = ecdh.getPrivateKey();
  const privateKey = Buffer.alloc(32);
  raw.copy(privateKey, 32 - raw.length);
  return { publicKey: ecdh.getPublicKey().toString("base64url"), privateKey: privateKey.toString("base64url") };
}

/** `VAPID_*` environment values with a fresh pair, for `startTestApp` and `loadConfig`. */
export function vapidEnv(subject = "mailto:johndoe@example.com"): Record<string, string> {
  const { publicKey, privateKey } = makeVapidPair();
  return { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject };
}
