import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Geist (SIL Open Font License, src/assets/fonts/LICENSE.txt), the app's own
// typeface, for generated images. Read once at module scope: the files don't
// depend on the request.
const regular = await readFile(join(process.cwd(), "src/assets/fonts/Geist-Regular.ttf"));
const semiBold = await readFile(join(process.cwd(), "src/assets/fonts/Geist-SemiBold.ttf"));

export const cardFonts = [
  { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Geist", data: semiBold, weight: 600 as const, style: "normal" as const },
];
