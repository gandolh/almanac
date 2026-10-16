import { createStore, useStore } from "../data/store";
import { CloseIcon } from "./icons";

/**
 * A short message at the bottom of the screen, Google's snackbar: "Event
 * deleted", with an optional action ("Undo"). One at a time: a new one
 * replaces the last. It goes by itself after a few seconds, or with its
 * action or ✕. `showToast` works from anywhere; `<Toaster/>` is mounted
 * once, by the shell.
 */

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** How long it stays, in ms. Default 5 s, 8 s with an action. */
  duration?: number;
}

interface ToastState {
  id: number;
  message: string;
  action?: ToastAction;
}

const toasts = createStore<ToastState | null>(null);
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Show a toast; returns a function that takes it away early (if it is still the one shown). */
export function showToast(message: string, options: ToastOptions = {}): () => void {
  const id = nextId++;
  clearTimeout(timer);
  toasts.setState({ id, message, action: options.action });
  const dismiss = () => {
    if (toasts.getState()?.id !== id) return;
    clearTimeout(timer);
    toasts.setState(null);
  };
  timer = setTimeout(dismiss, options.duration ?? (options.action ? 8000 : 5000));
  return dismiss;
}

/** Take away whatever toast is shown. */
export function dismissToast(): void {
  clearTimeout(timer);
  toasts.setState(null);
}

/** The toast's place on screen. The live region is always there, so a new message is read out. */
export function Toaster() {
  const toast = useStore(toasts);
  return <ToastView toast={toast} onDismiss={dismissToast} />;
}

/** The toast without the store, for tests. */
export function ToastView({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className="toast">
          <span className="toast__message">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="toast__action"
              onClick={() => {
                onDismiss();
                toast.action?.onAction();
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={onDismiss}>
            <CloseIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
