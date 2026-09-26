import { describe, expect, it } from "vitest";
import { attemptsToCsv, EXPORT_COLUMNS, SESSION_EXPORT_COLUMNS, sessionsToCsv, type ExportSession } from "@/lib/export";
import { attempt } from "./fixtures";

function parse(csv: string): string[][] {
  // Minimal RFC 4180 reader for the test.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const text = csv.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  return rows;
}

describe("attempts CSV export", () => {
  const user = { id: "u", email: 'trader,"x"@example.com' };
  const rows = [
    attempt("FVG", true, { exercise_id: "fvg-001", difficulty: 1 }),
    attempt("MSS", false, { exercise_id: "real-mss-001", failure_reason: "off_level" }),
    attempt("GuidedEntry", false, { exercise_id: "guided-001", answer_type: "guided", guided_bias_correct: true, guided_entry_correct: false }),
    attempt("FreeTrade", true, { exercise_id: "ft-003", answer_type: "free", free_outcome: "loss", free_result_r: -1 }),
  ];
  const table = parse(attemptsToCsv(rows, user));
  const header = table[0];
  const col = (r: number, name: string) => table[r][header.indexOf(name)];

  it("has one header row plus one row per attempt, every row the same width", () => {
    expect(header).toEqual(EXPORT_COLUMNS.map((c) => c.name));
    expect(table).toHaveLength(rows.length + 1);
    for (const r of table) expect(r).toHaveLength(header.length);
  });

  it("denormalizes mode, concept label and real-vs-constructed", () => {
    expect([col(1, "mode"), col(3, "mode"), col(4, "mode")]).toEqual(["recognition", "guided_entry", "free_trade"]);
    expect(col(1, "concept_label")).toBe("Fair Value Gap");
    expect([col(1, "data_source"), col(2, "data_source")]).toEqual(["constructed", "real"]);
    expect(col(2, "real_trading_date")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("writes booleans as 1/0 and unknowns as blank, and keeps process separate from outcome", () => {
    expect(col(1, "is_correct")).toBe("1");
    expect([col(3, "guided_bias_correct"), col(3, "guided_entry_correct"), col(3, "guided_stop_correct")]).toEqual(["1", "0", ""]);
    expect([col(4, "is_correct"), col(4, "free_is_win"), col(4, "free_result_r")]).toEqual(["1", "0", "-1"]);
  });

  it("escapes commas and quotes", () => {
    expect(col(1, "user_email")).toBe('trader,"x"@example.com');
  });
});

describe("session columns and sessions CSV", () => {
  const user = { id: "u", email: "t@example.com" };
  const session: ExportSession = {
    session_id: "s1",
    started_at: "2026-09-26T10:00:00Z",
    mode: "recognition",
    concept: "FVG",
    source: "recommendation",
    planned_length: 10,
    completed: false,
    exercises_answered: 3,
    ended_at: "2026-09-26T10:05:00Z",
    hours_since_previous: 26.456,
  };

  it("joins each attempt to its session, blank when there's no session row", () => {
    const rows = [attempt("FVG", true, { session_id: "s1" }), attempt("FVG", true, { session_id: "other" })];
    const table = parse(attemptsToCsv(rows, user, [session]));
    const h = table[0];
    const col = (r: number, name: string) => table[r][h.indexOf(name)];
    expect([col(1, "session_source"), col(1, "session_planned_length"), col(1, "session_completed")]).toEqual(["recommendation", "10", "0"]);
    expect([col(2, "session_source"), col(2, "session_completed")]).toEqual(["", ""]);
  });

  it("writes one row per session", () => {
    const table = parse(sessionsToCsv([session], user));
    expect(table[0]).toEqual(SESSION_EXPORT_COLUMNS.map((c) => c.name));
    const col = (name: string) => table[1][table[0].indexOf(name)];
    expect([col("source"), col("completed"), col("exercises_answered"), col("hours_since_previous")]).toEqual(["recommendation", "0", "3", "26.46"]);
  });
});
