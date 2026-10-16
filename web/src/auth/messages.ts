import type { AuthError } from "../../vendor/ward/ward-auth-react.js";

/**
 * Almanac's words for the codes the auth hooks hand back. The library names
 * the failure and the app says it (Ward's adoption guide, "Error codes"); an
 * error names the problem, then what to do. A code this list doesn't know
 * reads like `unknown`.
 */

const UNREACHABLE = "Almanac can't be reached. Check your connection and try again.";

/** "45 seconds", "10 minutes". */
export function waitText(seconds: number): string {
  if (seconds < 90) {
    const whole = Math.max(1, Math.ceil(seconds));
    return `${whole} ${whole === 1 ? "second" : "seconds"}`;
  }
  return `${Math.ceil(seconds / 60)} minutes`;
}

function tooManyTries(error: AuthError): string {
  return error.retryAfterSeconds === undefined
    ? "Too many tries. Wait a few minutes, then try again."
    : `Too many tries. Wait ${waitText(error.retryAfterSeconds)}, then try again.`;
}

/** A failed sign-in with a password. */
export function loginMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong username or password.";
    case "too_many_attempts":
      return tooManyTries(error);
    case "cross_site":
      return "Open Almanac from its own address to sign in.";
    case "network":
      return UNREACHABLE;
    default:
      return "Couldn't sign in. Try again.";
  }
}

/** A failed "Sign in with Ward": from the button, or from Ward sending the browser back. */
export function wardSignInMessage(error: AuthError): string {
  switch (error.code) {
    case "access_denied":
      return "Ward didn't let you in to Almanac. Sign in with your password, or ask the owner to allow Almanac for your account in Ward.";
    case "ward_unavailable":
      return "Ward isn't answering. Sign in with your password instead.";
    case "ward_misconfigured":
      return "Sign in with Ward isn't set up right on this server. Sign in with your password.";
    case "invalid_callback":
      return "That Ward sign-in expired. Try again.";
    case "network":
      return UNREACHABLE;
    default:
      return "Couldn't sign in with Ward. Try again, or sign in with your password.";
  }
}

/** Why the last session ended, shown on the login page. Nothing for a plain sign-out. */
export function sessionReasonMessage(reason: string | undefined): string | null {
  switch (reason) {
    case "ward_unavailable":
      return "Ward is unreachable right now, so your Ward sign-in has paused. Sign in with your password.";
    case "ward_session_ended":
      return "Your Ward session ended. Sign in again.";
    case "ward_misconfigured":
      return "Sign in with Ward isn't set up right on this server. Sign in with your password.";
    default:
      return null;
  }
}

/** What an account action (password, Ward link) says went wrong. */
export function accountMessage(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "That isn't your current password.";
    case "password_too_short":
      return "Use at least 8 characters.";
    case "password_too_long":
      return "That password is too long. Use at most 1,024 characters.";
    case "too_many_attempts":
      return tooManyTries(error);
    case "already_linked":
      return "A Ward account is already linked.";
    case "ward_account_in_use":
      return "That Ward account is linked to another Almanac user.";
    case "ward_account_mismatch":
      return "That was a different Ward account. Use the one you linked.";
    case "access_denied":
      return "Ward didn't let you in to Almanac. Allow Almanac for your account in Ward, then try again.";
    case "invalid_callback":
      return "That Ward round trip expired. Try again.";
    case "ward_unavailable":
      return "Ward isn't answering right now. Try again later.";
    case "ward_misconfigured":
      return "Ward isn't set up right on this server. Check the WARD_OIDC settings.";
    case "no_local_password":
      return "Set an Almanac password first (Change password), so you can still sign in without Ward.";
    case "not_linked":
      return "No Ward account is linked.";
    case "reauthentication_required":
      return "Confirm it's you with Ward first, then set the password.";
    case "unauthorized":
      return "Your session ended. Sign in again.";
    case "network":
      return UNREACHABLE;
    default:
      return "That didn't work. Try again.";
  }
}
