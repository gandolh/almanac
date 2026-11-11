import { useEffect, useRef, useState } from "react";
import { useSession } from "../../vendor/ward/ward-auth-react.js";
import { changePassword, linkWard, signOut, unlinkWard, useWardLink, useWardNotice } from "../account/actions";
import { NotificationsDialog } from "../account/Notifications";
import { TimeZoneDialog } from "../account/TimeZoneDialog";
import { AlertIcon } from "../components/Field";
import { Menu, type MenuSection } from "../components/ui/Menu";
import { useSettings } from "../data/settings";
import { cn } from "../lib/cn";

const NOTICE_MS = 6000;

/** What an account action had to say. It takes no room while empty. */
const NOTICE_CLASS =
  "absolute top-[calc(100%+8px)] right-0 z-float w-max max-w-[min(300px,calc(100vw-32px))] text-meta leading-tight text-ink data-shown:rounded-control data-shown:bg-surface data-shown:px-3 data-shown:py-2.5 data-shown:shadow-float data-shown:motion-safe:animate-float-in";

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
 * Ward (link or unlink), Time zone…, Notifications, then Sign out.
 * The button is a disc with the username's initial, as Google's is with a photo.
 */
export function AccountMenu() {
  const session = useSession();
  const username = session.status === "signed_in" ? session.user.username : "";
  const ward = useWardLink();
  const { timeZone } = useSettings();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
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
        { label: "Notifications", onSelect: () => setNotificationsOpen(true) },
      ],
    },
    { items: [{ label: "Sign out", onSelect: run(signOut) }] },
  ];

  return (
    <div className="relative flex flex-none">
      <Menu
        label="Account"
        triggerLabel={username ? `Account: ${username}` : "Account"}
        triggerClassName="flex size-icon-button items-center justify-center rounded-pill bg-transparent p-0 transition-[background-color] duration-(--duration-fast) ease-out hover:bg-hover aria-expanded:bg-hover"
        align="end"
        trigger={
          <span
            className="flex size-account-disc items-center justify-center rounded-pill bg-accent text-meta leading-none font-medium text-on-accent select-none"
            aria-hidden="true"
          >
            {initialOf(username)}
          </span>
        }
        sections={sections}
      />
      <p
        className={cn(
          NOTICE_CLASS,
          failed && "data-shown:flex data-shown:items-start data-shown:gap-2 data-shown:font-semibold",
        )}
        role="status"
        data-shown={shown !== "" || undefined}
      >
        {failed && shown !== "" && <AlertIcon size={16} />}
        {shown}
      </p>
      <TimeZoneDialog open={zoneOpen} onClose={() => setZoneOpen(false)} />
      <NotificationsDialog open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </div>
  );
}
