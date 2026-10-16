import { useSession, useWardResult, type SessionState } from "../../vendor/ward/ward-auth-react.js";
import { accountMessage } from "../auth/messages";
import { authClient } from "../auth/session";
import { LOGIN, pathFor } from "../router";
import { openChangePassword } from "./ChangePassword";

/**
 * What the account menu does (`layout/AccountMenu.tsx` calls these). Each
 * action resolves when done; a rejection's `message` is shown to the user beside the control, so it says
 * what went wrong and what to do. An action that opens its own dialog
 * resolves once it has opened it.
 */

/** Whether "Sign in with Ward" is offered (the server has the WARD_OIDC_* settings) and linked to this account. */
export interface WardLink {
  available: boolean;
  linked: boolean;
}

/** The menu's Ward row, from a session state: nothing to offer unless signed in to a server with Ward. */
export function wardLinkOf(state: SessionState): WardLink {
  return state.status === "signed_in"
    ? { available: state.ward.enabled, linked: state.ward.linked }
    : { available: false, linked: false };
}

/** The Ward state for the menu, from the session. */
export function useWardLink(): WardLink {
  return wardLinkOf(useSession());
}

/** Open the change-password dialog (account/ChangePassword.tsx). */
export async function changePassword(): Promise<void> {
  openChangePassword();
}

/**
 * Link this account to a Ward account, so "Sign in with Ward" works: off to
 * Ward, which comes back to home with the result (`useWardNotice`).
 * Rejects only when it couldn't get to Ward.
 */
export async function linkWard(): Promise<void> {
  const result = await authClient().startWardLink();
  if (!result.ok) throw new Error(accountMessage(result.error));
}

/**
 * Unlink Ward from this account; the password still signs in. Refused until
 * the account has a password. A session that began with Ward ends with it,
 * and then the login page loads afresh, as on signing out.
 */
export async function unlinkWard(): Promise<void> {
  const client = authClient();
  const result = await client.unlinkWard();
  if (!result.ok) throw new Error(accountMessage(result.error));
  if (client.getState().status === "signed_out") window.location.replace(pathFor(LOGIN));
}

/**
 * End the session, then load the login page afresh, so nothing of the
 * user's calendar stays in the page's memory for the next person at the
 * browser. Signs out of Almanac only; a Ward session stays signed in at Ward.
 */
export async function signOut(): Promise<void> {
  const result = await authClient().logout();
  if (!result.ok) throw new Error(accountMessage(result.error));
  window.location.replace(pathFor(LOGIN));
}

/**
 * What a Ward round trip that landed on this page has to say, for the account
 * notice: a link made, or why a link or a confirmation failed (`failed`).
 * Empty when there is nothing; a confirmation that worked is the password
 * dialog's. `clear` dismisses it for good.
 */
export function useWardNotice(): { message: string; failed: boolean; clear: () => void } {
  const { result, error, clear } = useWardResult();
  if (error !== undefined) return { message: accountMessage(error), failed: true, clear };
  const message = result === "linked" ? "Ward is linked. You can sign in with Ward now." : "";
  return { message, failed: false, clear };
}
