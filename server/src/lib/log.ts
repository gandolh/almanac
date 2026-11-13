/**
 * The process's log settings, for `server.ts` (and the test that checks them).
 * No Fastify import: the object is pino's, which Fastify passes through.
 *
 * Fastify logs every request's URL. A calendar feed's URL holds the secret
 * that opens it (`/api/feed/<token>/almanac.ics`), so the token is replaced
 * before a line is written, and the log can be read without opening anyone's
 * feed.
 */

/** What stands in a logged URL for a feed's token. */
const REDACTED_TOKEN = "<token>";

/** A URL as the log keeps it: a feed link's token replaced, anything else as it was. */
export function redactFeedToken(url: string): string {
  return url.replace(/^(\/api\/feed\/)[^/?#]+/, `$1${REDACTED_TOKEN}`);
}

/** pino's `redact` option: the request's URL through `redactFeedToken`. */
export const LOG_REDACT = {
  paths: ["req.url"],
  censor: (value: unknown): unknown => (typeof value === "string" ? redactFeedToken(value) : value),
};
