/* The icon names that are drawn as lettered badges (Logo.astro), not as
   .i-* icons. */

export const BADGES = new Map([
  ["github", { cls: "logo", text: "GH" }],
  ["linkedin", { cls: "logo li", text: "in" }],
]);

/** The icon names that are logos. */
export const LOGOS = [...BADGES.keys()];

/** The classes that draw an icon: an .i-* icon's, or none for a logo,
    which Logo.astro draws inside the element instead. */
export const iconClass = (icon: string): string | undefined => (BADGES.has(icon) ? undefined : `ic i-${icon}`);
