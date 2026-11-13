/** A few letters in a small square, drawn where an .i-* icon would be. */
export type Badge = { className: string; text: string };

/** Each logo's badge, by the icon name the config uses for it. */
export const BADGES = new Map<string, Badge>([
  ["github", { className: "logo", text: "GH" }],
  ["linkedin", { className: "logo linkedin", text: "in" }],
]);

/** The classes that draw an icon: an .i-* icon's, or none for a logo,
    which Logo.astro draws inside the element instead. */
export const iconClass = (icon: string): string | undefined => (BADGES.has(icon) ? undefined : `icon i-${icon}`);
