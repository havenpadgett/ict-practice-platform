# Design System

Single source of truth for visual tokens. Defined once in `src/app/globals.css`; everything else consumes these through Tailwind's theme mapping (`bg-background`, `text-muted`, `bg-accent`, ...) or the base element styles in that file, so a token change cascades to every consumer instead of needing to be hand-applied component by component.

**Do not hardcode colors, spacing, or typography in a component.** If something you're building needs a value not covered below, add a token to `globals.css` first.

## Color

*Updated 2026-09-25 (AI-DRAFTED): near-black surfaces, plus control, danger and chart tokens.*

| Token | Value | Use |
|---|---|---|
| `--background` | `#0d0e10` | Page background (near-black) |
| `--surface` | `#15171a` | Cards and panels, barely lighter than the background |
| `--line` | `#26292e` | Thin, subtle card borders and dividers (decorative) |
| `--control` | `#666b73` | Border of anything interactive: inputs, outline and option buttons. 3:1 against both surfaces (WCAG 1.4.11) |
| `--foreground` | `#ededea` | Headings, values, the user's own mark on a chart |
| `--muted` | `#9ca0a7` | Body copy, micro-labels, secondary text |
| `--accent` | `#34d399` (mint) | **The one accent.** Primary action, selected state, focus ring, the "correct" verdict, the correct answer drawn on a chart |
| `--accent-foreground` | `#0b1f16` | Text on a solid accent fill |
| `--danger` | `#f0766b` | Incorrect verdict, failed checks, errors. Always with a word or icon |
| `--candle-up` / `--candle-down` | `#2fb380` / `#e0625a` | Candle bodies and wicks, slightly desaturated so answer overlays sit on top |
| `--grid` | `#1c1f23` | Chart gridlines, deliberately faint |

Tailwind classes follow the token names: `bg-background`, `bg-surface`, `border-line`, `border-control`, `text-foreground`, `text-muted`, `bg-accent`, `text-accent`, `text-danger`, `stroke-candle-up`, `stroke-grid`, and so on.

**Accent discipline:** mint marks what matters now. That means the one primary button on a screen, a selected option, keyboard focus, a correct result, and the correct answer overlay. It never appears on secondary buttons, card borders, or as decoration.

**Hex values live only in `globals.css`.** The two exceptions: `global-error.tsx`, which renders without the stylesheet and mirrors the tokens inline, and the Google logo's brand colors.

### Contrast (WCAG AA)

| Pair | Ratio | Needs |
|---|---|---|
| foreground on background / surface | 16.5 / 15.3 | 4.5 |
| muted on background / surface | 7.4 / 6.8 | 4.5 |
| accent on background / surface | 10.1 / 9.3 | 4.5 |
| danger on background / surface | 6.9 / 6.4 | 4.5 |
| accent-foreground on accent | 8.9 | 4.5 |
| control border on background / surface | 3.6 / 3.4 | 3.0 (non-text) |

`--line` (1.3:1) is only used for decorative borders, never as the only boundary of a control.

## Typography

- **Headings** (`h1`–`h4`): `--foreground`, weight 600, `letter-spacing: -0.02em`, line-height 1.15. These are base styles. Page titles use `.page-title` (`text-2xl sm:text-3xl`), and the line under a title uses `.page-lede`.
- **Body text:** `--muted`, line-height 1.6 (set on `body`).
- **Eyebrows:** `.eyebrow`: 11px, uppercase, monospace (Geist Mono), muted, `0.08em` tracking. It goes above every section or stat. The old ad-hoc `text-xs uppercase tracking-wide` label is gone.
- **Numbers that line up** (stats, percentages) use `tabular-nums`.

## Spacing and layout

- `.page`: the standard page column (`max-w-3xl`, `pt-10 sm:pt-14`, `pb-16`). Wider tools add `max-w-5xl`.
- `--spacing-section` (3.5rem): the rhythm between major sections (`mt-section`, `space-y-section`).

## Components (classes in `globals.css`)

| Class | Use |
|---|---|
| `.card` | `rounded-lg border-line bg-surface p-5 sm:p-6`: thin border, flat fill, generous padding |
| `.btn-primary` | The one forward/commit action on a screen |
| `.btn-secondary` | Every other button, including an alternative commit such as "No FVG present" |
| `.btn-option` | A selectable answer or setting; `aria-pressed="true"` gives it the accent |
| `.btn-link` | Quiet text action (Back, Export CSV) |
| `.field` | Text inputs and textareas |
| `.text-error` | Error messages |

All buttons are at least 44×44px. Option buttons (selection) and commit buttons are always separated by a divider (`border-t border-line pt-5`).

`Verdict` / `CheckRow` (`src/components/verdict.tsx`) show correct/incorrect as an icon shape (check vs cross) plus a word, with color only reinforcing it.

Focus: one global `:focus-visible` style, a 2px mint ring offset by 2px.

## Scope note (2026-09-19)

This pass defined the token layer in `globals.css` and, per instruction, touched only one other file — `StatCard` — to swap its label onto the new `.eyebrow` class. `TopNav` and the existing buttons (`PrimaryButton`, the Submit/secondary buttons in `ExerciseControls`/`ChoiceControls`) needed no edits: they already build on the shared Tailwind classes (`bg-background`, `border-line`, `text-muted`, `bg-accent`, ...), so the new color values apply to them automatically. Everything else in the app (dashboard, analytics, exercise/session cards, section labels) re-themes the same way, but several of those places still use an ad-hoc `text-xs uppercase tracking-wide text-muted` label instead of the new `.eyebrow` class — tracked in `docs/POLISH-BACKLOG.md`. New components (e.g. Guided Entry) should use the tokens and recipes above directly rather than reintroducing the old pattern.
