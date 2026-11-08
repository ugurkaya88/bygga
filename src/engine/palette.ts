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
    inkOld: "#ad9a8a",
    tintNew: "#f2b48f",
    face: {
      board: "#f3e3cc",
      // fibre backs: a darker, browner sheet than the boards
      fiber: "#e6d2b8",
      // solid wood: a touch deeper and redder than the boards
      wood: "#efd8bb",
      metal: "#e4dfd9",
      soft: "#f1e8de",
      // still a cool pale tint, so glass reads apart from the oak boards
      glass: "#e3ebe8",
      hwMetal: "#d8d2cb",
      hwWood: "#e8cfa8",
      hwPlastic: "#f0e9e0",
      // a warm stone, lighter than the boards
      wall: "#f6efe6",
    },
    shade: [0.94, 0.89, 0.85],
    tape: "#c9bdb0",
    film: "#fbf6ee",
    graphite: "#5b4a40",
    shadow: [45, 34, 28],
    closeUp: "#fffaf3",
  },
};

export const PALETTE: DrawPalette = PALETTES[BRAND];
