// Palette for project areas.
//
// Tailwind v4 only emits classes it can see as literal strings, so every class
// here MUST be spelled out. Never build these with template interpolation.

export const AREA_COLORS = {
  blue: { chip: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  green: { chip: "bg-green-50 text-green-700", dot: "bg-green-500" },
  purple: { chip: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  orange: { chip: "bg-orange-50 text-orange-700", dot: "bg-orange-500" },
  pink: { chip: "bg-pink-50 text-pink-700", dot: "bg-pink-500" },
  teal: { chip: "bg-teal-50 text-teal-700", dot: "bg-teal-500" },
  amber: { chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  indigo: { chip: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500" },
  slate: { chip: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
} as const;

export type AreaColor = keyof typeof AREA_COLORS;

export const AREA_COLOR_KEYS = Object.keys(AREA_COLORS) as AreaColor[];

const FALLBACK = AREA_COLORS.slate;

/// Resolves a stored color key to its class pair, tolerating null/unknown values.
export function areaColor(color: string | null | undefined) {
  if (!color) return FALLBACK;
  return AREA_COLORS[color as AreaColor] ?? FALLBACK;
}
