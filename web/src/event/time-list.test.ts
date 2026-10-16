import { describe, expect, it } from "vitest";
import { placeTimeList, type Box } from "./time-list";

/** A box from its left and top edges and its size. */
function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height };
}

// The end time's list: "14:30 (30 mins)" makes it 153 px wide; 240 px is the stylesheet's height.
const list = { width: 153, height: 240 };

describe("placeTimeList", () => {
  it("hangs under the field from its left edge when there is room", () => {
    const desktopBody = box(280, 140, 720, 600);
    expect(placeTimeList(box(500, 220, 88, 36), list, desktopBody)).toEqual({ align: "start", side: "below", maxHeight: null });
  });

  it("lines up with the field's right edge on a 390 px phone, where the times are the right column", () => {
    // The form's body is the whole width; the end time ends 16 px from the right. From its left edge the
    // list would end at 439; from its right one it spans 221 to 374.
    expect(placeTimeList(box(286, 174, 88, 44), list, box(0, 56, 390, 788))).toEqual({ align: "end", side: "below", maxHeight: null });
  });

  it("is cut to the room above the buttons in a short window", () => {
    // 480 px high: the body ends at 411, where the footer with Cancel and Save starts.
    const body = box(0, 56, 390, 355);
    expect(placeTimeList(box(286, 174, 88, 44), list, body)).toEqual({ align: "end", side: "below", maxHeight: 181 });
  });

  it("opens upwards when there is more room above than below", () => {
    const body = box(0, 56, 390, 355);
    // The field near the bottom: 77 px under it, 263 above.
    expect(placeTimeList(box(286, 330, 88, 44), list, body)).toEqual({ align: "end", side: "above", maxHeight: null });
    // Not all of it fits above either: cut to the room there.
    expect(placeTimeList(box(286, 300, 88, 44), { width: 153, height: 300 }, body)).toEqual({ align: "end", side: "above", maxHeight: 232 });
  });

  it("takes the side it runs past less when it fits on neither", () => {
    expect(placeTimeList(box(20, 100, 88, 36), { width: 400, height: 100 }, box(0, 0, 300, 600)).align).toBe("start");
    expect(placeTimeList(box(200, 100, 88, 36), { width: 400, height: 100 }, box(0, 0, 300, 600)).align).toBe("end");
  });
});
