/* The details panel's rows (src/components/Panel.astro), for everything
   that reads them all: the config's checks, and llms.txt. */

import type { Panel, PanelRow } from "../shared/config.ts";

/** The rows of the panel's two lists, the outputs then the context: every
    row that can link somewhere. A list the language leaves out has none. */
export const panelRows = (panel: Panel): PanelRow[] => [...(panel.outputs?.rows ?? []), ...(panel.context?.rows ?? [])];
