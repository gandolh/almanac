import { useEffect, useRef, useState } from "react";
import { useSession } from "../../vendor/ward/ward-auth-react.js";
import { changePassword, linkWard, signOut, unlinkWard, useWardLink, useWardNotice } from "../account/actions";
import { TimeZoneDialog } from "../account/TimeZoneDialog";
import { AlertIcon } from "../auth/icons";
import { Menu, type MenuSection } from "../components/Menu";
import { useSettings } from "../data/settings";

const NOTICE_MS = 6000;

/** "Europe/Bucharest" → "Bucharest", "America/Argentina/Buenos_Aires" → "Buenos Aires". */
export function zoneCity(timeZone: string): string {
  return (timeZone.split("/").at(-1) ?? timeZone).replaceAll("_", " ");
}

/** The account button's letter: the username's first, capitalised. */
export function initialOf(username: string): string {
  return (Array.from(username.trim())[0] ?? "?").toLocaleUpperCase("en");
}

/**
 * The account button and its menu, in place of a Settings page
 * (corpus/wiki/features.md "Account menu"): Change password, Sign in with
 * Ward (link or unlink), Time zone…, then Sign out. The button is a disc
 * with the username's initial, as Google's is with a photo.
 */
export function AccountMenu() {
  const session = useSession();
  const username = session.status === "signed_in" ? session.user.username : "";
  const ward = useWardLink();
  const { timeZone } = useSettings();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A Ward link comes back to the app with its result; it shows here like an action's, then goes.
  const { message: wardMessage, failed: wardFailed, clear: clearWardMessage } = useWardNotice();

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (wardMessage === "") return;
    const wardTimer = setTimeout(clearWardMessage, NOTICE_MS);
    return () => clearTimeout(wardTimer);
  }, [wardMessage, clearWardMessage]);
  const shown = notice || wardMessage;
  // Every action's notice is a failure; a Ward round trip's may be good news.
  const failed = notice !== "" || wardFailed;

  // An action that fails says so here, for a few seconds.
  const run = (action: () => Promise<void>) => () => {
    clearTimeout(timer.current);
    setNotice("");
    action().catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "That didn't work. Try again.");
      timer.current = setTimeout(() => setNotice(""), NOTICE_MS);
    });
  };

  const sections: MenuSection[] = [
    {
      items: [
        { label: "Change password", onSelect: run(changePassword) },
        ...(ward.available
          ? [
              {
                label: "Sign in with Ward",
                detail: ward.linked ? "Linked" : "Not linked",
                onSelect: run(ward.linked ? unlinkWard : linkWard),
              },
            ]
          : []),
        { label: "Time zone…", detail: zoneCity(timeZone), onSelect: () => setZoneOpen(true) },
      ],
    },
    { items: [{ label: "Sign out", onSelect: run(signOut) }] },
  ];

  return (
    <div className="account">
      <Menu
        label="Account"
        triggerLabel={username ? `Account: ${username}` : "Account"}
        triggerClassName="account__button"
        align="end"
        trigger={
          <span className="account__disc" aria-hidden="true">
            {initialOf(username)}
          </span>
        }
        sections={sections}
      />
      <p
        className={failed ? "account__notice account__notice--error" : "account__notice"}
        role="status"
        data-shown={shown !== "" || undefined}
      >
        {failed && shown !== "" && <AlertIcon size={16} />}
        {shown}
      </p>
      <TimeZoneDialog open={zoneOpen} onClose={() => setZoneOpen(false)} />
    </div>
  );
}
