# Design System

Single source of truth for visual tokens. Defined once in `src/app/globals.css`; everything else consumes these through Tailwind's theme mapping (`bg-background`, `text-muted`, `bg-accent`, ...) or the base element styles in that file, so a token change cascades to every consumer instead of needing to be hand-applied component by component.

**Do not hardcode colors, spacing, or typography in a component.** If something you're building needs a value not covered below, add a token to `globals.css` first.

## Color

| Token | Value | Use |
|---|---|---|
| `--background` | `#1e1e1e` | Page background |
| `--surface` | `#262626` | Cards, panels — slightly lighter than background |
| `--line` | `#343434` | Thin, subtle borders on cards and dividers |
| `--foreground` | `#ececea` | Headings, high-contrast text |
| `--muted` | `#9b9b9b` | Body copy, micro-labels, secondary text |
| `--accent` | `#34d399` (mint green) | **The one accent.** Primary actions and active states only |
| `--accent-foreground` | `#0b1f16` | Text/icons on top of a solid `--accent` fill |

Tailwind classes: `bg-background`, `bg-surface`, `border-line`, `text-foreground`, `text-muted`, `bg-accent`, `text-accent`, `text-accent-foreground`.

**Accent discipline:** mint green is reserved for the primary Submit/CTA button and for marking an active/selected state (e.g. a chosen answer option, a current nav link). It does not appear on secondary buttons, borders, or as decoration — that's what makes it read as meaningful when it does show up. Secondary/outline actions use `border-line` + `text-foreground`, no accent.

## Typography

- **Headings** (`h1`–`h4`, and any element styled as one): `var(--foreground)`, weight 600, `letter-spacing: -0.02em` — large, tight, high-contrast. Applied globally as a base style; pair with a Tailwind size utility (`text-xl sm:text-2xl`, etc.) per heading. Existing headings already add `tracking-tight` explicitly, which matches this base.
- **Body text**: `var(--muted)` — comfortable line height (`line-height: 1.6`, set globally on `body`). Most paragraph/description text in the app already uses `text-muted` explicitly.
- **Micro-labels / section eyebrows**: the `.eyebrow` utility class — small (11px), uppercase, monospace (`--font-mono`, i.e. Geist Mono), muted, letter-spacing `0.08em`. Use for a short label sitting above a heading or a stat value (see `StatCard`). Do not use `.eyebrow` for anything that isn't acting as a section/stat label.

## Spacing

- `--spacing-section: 3.5rem` — generous vertical rhythm between major page sections. Available as any spacing utility: `mt-section`, `space-y-section`, `gap-section`, `py-section`. Prefer this over a one-off spacing value when stacking sections on a page (dashboard stat blocks, analytics sections, a multi-step exercise flow).

## Cards

Recipe (see `StatCard` for the reference implementation): `rounded-lg border border-line bg-surface p-4 sm:p-5` (or `p-5 sm:p-6` for a larger card) — thin subtle border, minimal fill (just `--surface`, no gradients/shadows), generous padding. A card's label uses `.eyebrow`; its primary value/content uses `text-foreground` at a large size.

## Buttons

- **Primary**: `bg-accent text-accent-foreground` (see `PrimaryButton`, and the Submit buttons in `ExerciseControls` / `ChoiceControls`). One per screen, reserved for the main forward action.
- **Secondary/outline**: `border border-line text-foreground hover:bg-surface`, no accent (see the "No [X] present" button in `ExerciseControls`, the "Back" link in `SessionLengthPicker`).
- **Active/selected state** (e.g. a picked choice option): `border-accent bg-accent/10 text-accent`.

## Scope note (2026-09-19)

This pass defined the token layer in `globals.css` and, per instruction, touched only one other file — `StatCard` — to swap its label onto the new `.eyebrow` class. `TopNav` and the existing buttons (`PrimaryButton`, the Submit/secondary buttons in `ExerciseControls`/`ChoiceControls`) needed no edits: they already build on the shared Tailwind classes (`bg-background`, `border-line`, `text-muted`, `bg-accent`, ...), so the new color values apply to them automatically. Everything else in the app (dashboard, analytics, exercise/session cards, section labels) re-themes the same way, but several of those places still use an ad-hoc `text-xs uppercase tracking-wide text-muted` label instead of the new `.eyebrow` class — tracked in `docs/POLISH-BACKLOG.md`. New components (e.g. Guided Entry) should use the tokens and recipes above directly rather than reintroducing the old pattern.
