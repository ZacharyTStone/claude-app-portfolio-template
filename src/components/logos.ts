/* The icon names that are drawn as lettered badges (Logo.astro), not as
   .i-* icons: a link card, a panel row or the account menu can name one
   wherever it could name an icon. */

/** A badge: a few letters in a small square. */
export type Badge = {
  /** The classes that draw it, in src/styles. */
  className: string;
  /** Its letters. */
  text: string;
};

/** Each logo's badge, by the icon name the config uses for it. */
export const BADGES = new Map<string, Badge>([
  ["github", { className: "logo", text: "GH" }],
  ["linkedin", { className: "logo linkedin", text: "in" }],
]);

/** The icon names that are logos. */
export const LOGOS = [...BADGES.keys()];

/** The classes that draw an icon: an .i-* icon's, or none for a logo,
    which Logo.astro draws inside the element instead. */
export const iconClass = (icon: string): string | undefined => (BADGES.has(icon) ? undefined : `icon i-${icon}`);
