import { createElement, type ReactNode } from "react";

/**
 * Base UI's `Dialog` for the static-markup tests. Its portal waits for a DOM
 * node, so `renderToStaticMarkup` sees nothing of an open dialog; this one
 * renders the parts in place, so a test can read what the dialog holds. The
 * behaviour (focus, Esc, the backdrop) is Base UI's and is checked in the
 * browser. A test file that renders a dialog says:
 *
 *   vi.mock("@base-ui/react/dialog", () => import("../components/dialog-stub"));
 */
interface PartProps {
  children?: ReactNode;
  className?: string;
  [prop: string]: unknown;
}

/** The attributes worth seeing in markup: the class, ids, `aria-*`, `data-*`. Callbacks and refs are Base UI's. */
function attributes({ className, ...rest }: PartProps): Record<string, unknown> {
  const kept = Object.entries(rest).filter(([name, value]) => (name === "id" || name.startsWith("aria-") || name.startsWith("data-")) && typeof value !== "function");
  return { className, ...Object.fromEntries(kept) };
}

const part = (tag: string, fixed: Record<string, string> = {}) =>
  function StaticPart(props: PartProps) {
    return createElement(tag, { ...fixed, ...attributes(props) }, props.children);
  };

export const Dialog = {
  Root: ({ open, children }: { open?: boolean; children?: ReactNode }) => (open ? children : null),
  Portal: ({ children }: { children?: ReactNode }) => children,
  Backdrop: () => null,
  Popup: part("div", { role: "dialog" }),
  Title: part("h2"),
  Close: part("button", { type: "button" }),
};
