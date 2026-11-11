import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("keeps a size and a colour, which the app names itself", () => {
    expect(cn("text-ink", "text-body")).toBe("text-ink text-body");
    expect(cn("text-muted", "text-small")).toBe("text-muted text-small");
    expect(cn("font-regular", "font-semibold")).toBe("font-semibold");
  });

  it("keeps a line height when a size follows it, as the sizes carry none", () => {
    expect(cn("text-meta leading-tight", "text-mini")).toBe("leading-tight text-mini");
  });

  it("lets the later of two sizes, colours, radii, shadows or z values win", () => {
    expect(cn("text-meta", "text-small")).toBe("text-small");
    expect(cn("text-muted", "text-accent")).toBe("text-accent");
    expect(cn("rounded-control", "rounded-pill")).toBe("rounded-pill");
    expect(cn("shadow-raised", "shadow-float")).toBe("shadow-float");
    expect(cn("z-bar", "z-toast")).toBe("z-toast");
    expect(cn("px-2", "p-0")).toBe("p-0");
  });

  it("drops what is false", () => {
    const hidden = false;
    expect(cn("h-9", hidden && "opacity-50")).toBe("h-9");
  });
});
