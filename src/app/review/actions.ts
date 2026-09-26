"use server";

import { revalidatePath } from "next/cache";
import { getReviewer } from "@/lib/review/access";
import { approveScenario, flagAmbiguous, rejectScenario } from "@/lib/review/store";

const TEXT_PREFIX = "text:";

export type ReviewActionState = { error: string | null; done: string | null };

async function run(fn: (email: string) => Promise<string>): Promise<ReviewActionState> {
  // Server Actions are reachable by direct POST — authorize every call.
  const reviewer = await getReviewer();
  if (!reviewer) return { error: "Not authorized to review scenarios.", done: null };
  try {
    const done = await fn(reviewer.email);
    revalidatePath("/review");
    return { error: null, done };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Something went wrong.", done: null };
  }
}

export async function approveAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "");
  return run(async (email) => {
    const texts: Record<string, string> = {};
    for (const [name, value] of formData.entries()) {
      if (name.startsWith(TEXT_PREFIX)) texts[name.slice(TEXT_PREFIX.length)] = String(value);
    }
    await approveScenario(id, email, texts, String(formData.get("notes") ?? ""));
    return `${id} approved.`;
  });
}

export async function rejectAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "");
  return run(async (email) => {
    await rejectScenario(id, email, String(formData.get("reason") ?? ""), String(formData.get("note") ?? ""));
    return `${id} rejected and logged.`;
  });
}

export async function ambiguousAction(_prev: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const id = String(formData.get("id") ?? "");
  return run(async (email) => {
    await flagAmbiguous(id, email, String(formData.get("note") ?? ""));
    return `${id} flagged ambiguous.`;
  });
}
