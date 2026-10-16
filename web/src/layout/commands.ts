/**
 * Commands a key or a button can run without knowing who answers: brief 07's
 * editor registers "create" (the `c` key), brief 10's search box
 * "focusSearch" (the `/` key). The newest registration of a name answers;
 * when it goes, the one before it answers again.
 */

export type CommandName = "create" | "focusSearch";

const handlers = new Map<CommandName, (() => void)[]>();

/** Answer `name` with `fn` until the returned function is called (an effect's cleanup). */
export function registerCommand(name: CommandName, fn: () => void): () => void {
  const list = handlers.get(name) ?? [];
  list.push(fn);
  handlers.set(name, list);
  return () => {
    const current = handlers.get(name);
    const index = current?.lastIndexOf(fn) ?? -1;
    if (current && index >= 0) current.splice(index, 1);
  };
}

/** Run `name`; false when nothing answers it yet. */
export function runCommand(name: CommandName): boolean {
  const fn = handlers.get(name)?.at(-1);
  if (!fn) return false;
  fn();
  return true;
}
