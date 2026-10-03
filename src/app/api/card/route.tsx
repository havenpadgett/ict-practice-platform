import { ImageResponse } from "next/og";
import { buildCard, parseCardRequest } from "@/lib/card/model";
import { cardFonts } from "@/lib/card/fonts";
import { CARD_SIZE, CardView } from "@/lib/card/render";

// POST /api/card: a share card as a PNG. Public, like the challenge pages
// it serves, so it takes no free text (src/lib/card/model.ts): ids, numbers
// and the learner's own marks in, a picture out. It grades the mark itself
// rather than trusting a verdict from the request, and draws the correct
// answer only for exercises that are public anyway. Nothing is stored.

const MAX_BODY = 4_000;
const NO_STORE = { "Cache-Control": "no-store" };

function bad(status: number, error: string) {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return bad(413, "That request is too large.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return bad(400, "That request couldn't be read.");
  }
  const parsed = parseCardRequest(body);
  if (!parsed) return bad(400, "That request couldn't be read.");
  const card = buildCard(parsed);
  if (!card) return bad(404, "That card isn't available.");
  const view = <CardView card={card} />;
  try {
    return new ImageResponse(view, { ...CARD_SIZE, fonts: cardFonts, headers: NO_STORE });
  } catch {
    return bad(500, "The card couldn't be drawn.");
  }
}
