import { BRAND, type BrandId } from "@/lib/brand";

/**
 * The colours the 3D drawing is made of, per brand. Bygga's are its manual look (black ink on white boards, the new
 * part tinted yellow); rehber's are warm oak with dark brown lines and the new part tinted light terracotta. Plain
 * strings and numbers, so scripts can read them without three.js.
 */
export interface DrawPalette {
  /** edge lines and outlines of the parts being worked on */
  ink: string;
  /** edge lines of parts from earlier steps */
  inkOld: string;
  /** the tint of the part a step adds */
  tintNew: string;
  /** face colours by material, fittings and the wall */
  face: Record<"board" | "fiber" | "wood" | "metal" | "soft" | "glass" | "hwMetal" | "hwWood" | "hwPlastic" | "wall", string>;
  /** the flat shading of faces turned away from the light, from the least to the most turned away */
  shade: [number, number, number];
  /** an adhesive pad */
  tape: string;
  /** the paper backing on an adhesive pad */
  film: string;
  /** pencil lines and drilled marks on the wall */
  graphite: string;
  /** the soft floor shadow, as r, g, b (0 to 255) */
  shadow: [number, number, number];
  /** the ground of the close-up circle */
  closeUp: string;
}

export const PALETTES: Record<BrandId, DrawPalette> = {
  bygga: {
    ink: "#141414",
    inkOld: "#94918b",
    tintNew: "#fff3c4",
    face: {
      board: "#ffffff",
      fiber: "#f5f1e8",
      wood: "#fdfaf4",
      metal: "#eceef0",
      soft: "#f6f6f4",
      glass: "#e9f1f4",
      hwMetal: "#dfe1e3",
      hwWood: "#f1e2c3",
      hwPlastic: "#f4f4f2",
      wall: "#f3f2ee",
    },
    shade: [0.968, 0.938, 0.915],
    tape: "#c4c3bd",
    film: "#f7f5ef",
    graphite: "#5b5850",
    shadow: [20, 20, 20],
    closeUp: "#ffffff",
  },
  rehber: {
    ink: "#6e5646",
    // 2.9:1 on the boards, as Bygga's earlier lines are about 3:1 on its white boards
    inkOld: "#978373",
    // mixed into a face a third of the way (more when lit), so a new part shows a light terracotta
    tintNew: "#f2b48f",
    // A face shows the linear value of its colour (the face shader writes it without sRGB encoding, and Bygga's
    // look is tuned that way): "#f3e3cc" would show as a deep caramel. Faces among the boards are set so they show
    // the tone after "shows"; fittings, metal and glass keep a colour that shows darker, so they stand apart from
    // the oak the way Bygga's do from its white boards.
    face: {
      // shows #f4e2cc, the warm oak #f3e3cc as near as 8 bits allow
      board: "#faf2e7",
      // fibre backs: shows #e9dcd0, a step under the boards and greyer, so a back reads apart from the oak and
      // keeps the edge lines at 3:1 or more on its least-lit face with the new part's tint
      fiber: "#f5efe9",
      // solid wood: shows #efd8ba, a touch deeper and redder than the boards
      wood: "#f8edde",
      // shows #c6bcb1, a warm grey
      metal: "#e4dfd9",
      // shows #f2e9de
      soft: "#f9f5f0",
      // shows #c4d4ce, a cool tint, so glass reads apart from the oak boards
      glass: "#e3ebe8",
      // shows #afa498
      hwMetal: "#d8d2cb",
      // dowels and knobs: shows #ce9f64
      hwWood: "#e8cfa8",
      // shows #f2efeb, a whitish plastic on the oak
      hwPlastic: "#f9f8f6",
      // shows #f6efe7, a warm stone lighter than the boards
      wall: "#fbf8f4",
    },
    // deeper than Bygga's 0.968, 0.938, 0.915, so faces read apart on the oak; the deepest stays light enough that
    // edge lines hold 3:1 on a new part's least-lit face (scripts/brand/check.ts)
    shade: [0.95, 0.92, 0.89],
    tape: "#c9bdb0",
    film: "#fbf6ee",
    graphite: "#5b4a40",
    shadow: [45, 34, 28],
    closeUp: "#fffaf3",
  },
};

export const PALETTE: DrawPalette = PALETTES[BRAND];
