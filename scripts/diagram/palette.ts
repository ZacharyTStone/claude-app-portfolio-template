/** The site's dark theme, written out: a picture can't read the page's stylesheet. */
export const COLOR = {
  /** Behind everything. */
  ground: "#1f1f1f",
  /** A box, and the line around it. */
  box: "#2b2b2b",
  boxLine: "#3d3d3d",
  /** A panel that holds boxes. */
  panel: "#242424",
  /** Something drawn faintly, behind what matters: a map's dots. */
  faint: "#3b3b3b",
  /** A bar that stands for a line of text. */
  mark: "#4f4f4f",
  /** A line that isn't what the picture is about. */
  line: "#757575",
  /** Text, and text that's secondary. */
  text: "#ededed",
  quiet: "#a6a6a6",
  /** What the picture is about: its lines, and the one box it's about. */
  accent: "#d97757",
  accentBright: "#f0a184",
  accentBox: "#3a2a24",
  accentInner: "#2a201c",
  accentLine: "#6b4435",
  /** Something refused. */
  refused: "#8f8f8f",
} as const;

/** The site's fonts. A picture can't load the site's font files, so each list ends in what every computer has. */
export const FONT = {
  sans: "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif",
  mono: "'Geist Mono', ui-monospace, Menlo, Consolas, 'Hiragino Sans', 'Yu Gothic', Meiryo, monospace",
} as const;
