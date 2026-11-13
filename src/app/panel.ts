/* The details panel on the right: shown and hidden (it shows again on every
   visit), with sections that fold and can be moved into another order by
   their grips (remembered per browser). */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { ATTRIBUTE_SELECTOR } from "../contracts/page-selectors.ts";
import { findAll, make, onClick } from "./lib/dom.ts";
import { local } from "./lib/storage.ts";
import { foldable } from "./folding.ts";
import { detailsPanel, shell, words } from "./page.ts";
import { sectionAbove, sectionBelow, startDrag } from "./panel-drag.ts";
import { sectionOrder } from "./panel-order.ts";
import { closeViewer, isViewerOpen } from "./viewer.ts";

/** In localStorage: the ids of the sections' headings, in the order they
    were left. */
const ORDER_KEY = "portfolio:panel-order";

/** From the panel itself. */
const SECTION = ":scope > section";
const SECTION_HEADING = "h2";

export function initPanel(): void {
  onClick(ATTRIBUTE_SELECTOR.panelToggle, togglePanel);
  tellPanelToggles(document);
  findAll(detailsPanel, SECTION_HEADING).forEach(foldable);
  restoreSectionOrder();
  panelSections().forEach(addGrip);
}

/** Tells the panel's buttons in `place` whether the panel is showing: all
    of them when it's shown or hidden, and a tab's own as the tab is made. */
export function tellPanelToggles(place: ParentNode): void {
  for (const button of findAll(place, ATTRIBUTE_SELECTOR.panelToggle)) {
    button.setAttribute("aria-expanded", String(!isPanelHidden()));
  }
}

/** A press of one of the panel's buttons (one in each top bar, and the
    panel's own). While the viewer is in the panel's place, it brings the
    panel back instead. */
function togglePanel(): void {
  if (isViewerOpen()) {
    closeViewer();
    showPanel();
  } else if (isPanelHidden()) showPanel();
  else hidePanel();
}

const isPanelHidden = (): boolean => shell.classList.contains(PAGE_CLASSES.noPanel);

function showPanel(): void {
  shell.classList.remove(PAGE_CLASSES.noPanel);
  tellPanelToggles(document);
}

function hidePanel(): void {
  shell.classList.add(PAGE_CLASSES.noPanel);
  tellPanelToggles(document);
}

const panelSections = (): HTMLElement[] => findAll(detailsPanel, SECTION);

const headingIdOf = (section: HTMLElement): string => section.getAttribute("aria-labelledby") ?? "";

function rememberSectionOrder(): void {
  local.setJson(ORDER_KEY, panelSections().map(headingIdOf));
}

function restoreSectionOrder(): void {
  const sectionByHeadingId = new Map(panelSections().map((section) => [headingIdOf(section), section]));
  for (const headingId of sectionOrder([...sectionByHeadingId.keys()], local.getJson(ORDER_KEY))) {
    const section = sectionByHeadingId.get(headingId);
    if (section) detailsPanel.append(section);
  }
}

/** Gives a section a six-dot grip, to drag it into another order; the
    arrow keys on it move it too. */
function addGrip(section: HTMLElement): void {
  const sectionName = section.querySelector(SECTION_HEADING)?.textContent ?? "";
  const label = words.moveSection.replace("{name}", sectionName);
  const grip = make("button", {
    type: "button",
    class: `${PAGE_CLASSES.grip} icon i-grip`,
    "aria-label": label,
    title: label,
  });
  section.append(grip);
  grip.addEventListener("keydown", (event) => {
    const above = sectionAbove(section);
    const below = sectionBelow(section);
    if (event.key === "ArrowUp" && above) above.before(section);
    else if (event.key === "ArrowDown" && below) below.after(section);
    else return;
    event.preventDefault();
    // Moving the section in the page takes focus off its grip.
    grip.focus();
    rememberSectionOrder();
  });
  grip.addEventListener("pointerdown", (event) => {
    const isMainButton = event.button === 0;
    if (!isMainButton) return;
    event.preventDefault();
    startDrag(section, grip, event, rememberSectionOrder);
  });
}
