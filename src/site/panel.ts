import type { Panel, PanelRow } from "../config/language.ts";

/** The rows of the details panel's two lists, the outputs then the context:
    every row that can link somewhere. */
export const panelRows = (panel: Panel): PanelRow[] => [...(panel.outputs?.rows ?? []), ...(panel.context?.rows ?? [])];
