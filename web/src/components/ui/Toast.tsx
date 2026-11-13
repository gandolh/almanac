import { Toast } from "@base-ui/react/toast";
import { CloseIcon } from "../icons";

const VIEWPORT_CLASS =
  "pointer-events-none fixed bottom-6 left-6 z-toast flex max-w-[min(var(--container-toast),calc(100vw-48px))] max-md:right-2 max-md:bottom-[max(8px,env(safe-area-inset-bottom))] max-md:left-2 max-md:max-w-none";
const TOAST_CLASS =
  "pointer-events-auto flex min-h-12 [translate:var(--toast-swipe-movement-x,0)_var(--toast-swipe-movement-y,0)] items-center gap-1 rounded-control bg-toast-surface py-1.5 pr-2 pl-4 text-meta leading-tight text-toast-ink shadow-float motion-safe:animate-toast-in data-limited:hidden max-md:flex-1 [&_:focus-visible]:outline-toast-action";
const ACTION_CLASS =
  "min-h-9 rounded-small bg-transparent px-3 text-meta font-semibold text-toast-action hover:bg-toast-hover";
const CLOSE_CLASS =
  "flex size-9 flex-none items-center justify-center rounded-pill bg-transparent p-0 text-toast-ink hover:bg-toast-hover";

/**
 * A short message at the bottom of the screen, Google's snackbar: "Event
 * deleted", with an optional action ("Undo"). One at a time: a new one
 * replaces the last. It goes by itself after a few seconds, or with its
 * action or ✕; an error (`type: "error"`) stays until it is dismissed and is
 * announced at once. `showToast` works from anywhere (Base UI's toast
 * manager lives at module level); `<Toaster/>` is mounted once, by the shell.
 * The viewport is a labelled region that is always there, so a new message is
 * read out; F6 moves keyboard focus into it.
 */

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** How long it stays, in ms. Default 5 s, 8 s with an action. An error ignores it and stays. */
  duration?: number;
  /** `error` stays until dismissed. Default `info`. */
  type?: "info" | "error";
}

const manager = Toast.createToastManager();

/** What the manager is told for a toast: how long it stays, how loudly it is announced. */
export function toastTiming({ action, duration, type = "info" }: ToastOptions): {
  timeout: number;
  priority: "low" | "high";
} {
  if (type === "error") return { timeout: 0, priority: "high" };
  return { timeout: duration ?? (action ? 8000 : 5000), priority: "low" };
}

/** Show a toast, in place of the one shown; returns a function that takes it away early. */
export function showToast(message: string, options: ToastOptions = {}): () => void {
  manager.close();
  const { action } = options;
  const id = manager.add({
    title: message,
    type: options.type ?? "info",
    ...toastTiming(options),
    actionProps: action
      ? {
          children: action.label,
          onClick: () => {
            manager.close(id);
            action.onAction();
          },
        }
      : undefined,
  });
  return () => manager.close(id);
}

/** The toast's place on screen. */
export function Toaster() {
  return (
    <Toast.Provider toastManager={manager} limit={1}>
      <Toast.Portal>
        <Toast.Viewport className={VIEWPORT_CLASS}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} className={TOAST_CLASS}>
      <Toast.Title render={<span />} className="mr-2 flex-1 py-2" />
      <Toast.Action className={ACTION_CLASS} />
      <Toast.Close className={CLOSE_CLASS} aria-label="Dismiss">
        <CloseIcon size={18} />
      </Toast.Close>
    </Toast.Root>
  ));
}
