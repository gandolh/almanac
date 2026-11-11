import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge, told Almanac's @theme names (styles/index.css). Without the `text` list it reads `text-body`
 * as a colour, so `cn("text-ink", "text-body")` would drop one of the two. Keep the lists in step with @theme.
 *
 * The sizes carry no line height (rows inherit the body's, and set their own `leading-*`), so a size must not
 * remove a `leading-*`, which tailwind-merge does by default: `cn("leading-none", "text-mini")` keeps both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "title",
        "title-phone",
        "brand",
        "range",
        "range-phone",
        "heading",
        "action-large",
        "input-phone",
        "body",
        "meta",
        "small",
        "label",
        "mini",
        "badge",
        "day-number",
        "day-number-phone",
        "event",
      ],
      "font-weight": ["regular", "medium", "semibold", "bold"],
      tracking: ["title"],
      leading: ["body", "phone", "tight"],
      radius: ["small", "control", "field", "container", "sheet", "pill"],
      shadow: ["raised", "raised-hover", "float", "dialog"],
    },
    classGroups: {
      z: [{ z: ["bar", "drawer", "float", "toast"] }],
    },
  },
  override: {
    conflictingClassGroups: { "font-size": [] },
  },
});

/** Joins class names, and lets a later class win over an earlier one it conflicts with. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
