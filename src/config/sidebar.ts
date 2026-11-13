/* Each language's `sidebar`: the column of tabs on the left. */

/** Under your name: "New tab" and a few rows with icons, then groups of
    tabs under headings. A thread no row links to can still be opened by
    its address, and by the question card. */
export type Sidebar = {
  /** The first row: "New tab". It's a link to the home screen; with
      JavaScript it starts a new chat. */
  newTab: string;
  /** The rows under it, each a thread with an icon ("About", "Skills"). */
  nav: SidebarNavRow[];
  /** The groups of tabs under those, each under its heading. */
  groups: SidebarGroup[];
};

type SidebarNavRow = {
  /** The id of the thread it opens. */
  tab: string;
  /** One of the .i-* classes in src/styles, by its name without the "i-".
      "about", "skills", "file", "contact", "work" and "globe" are the ones
      drawn for content. */
  icon: string;
  /** What the row says: "About". */
  label: string;
};

/** Rows under a heading. With JavaScript the heading folds its rows away. */
type SidebarGroup = {
  /** What the page remembers a folded group by: ID_PATTERN, like a
      thread's. Each group's is different, and none is "chats", the group
      the browser code adds for the visitor's chats. */
  id: string;
  /** The heading: "Work history". */
  label: string;
  /** The group's rows, top to bottom. */
  tabs: SidebarRow[];
};

/** A row in a sidebar group: two lines, a name over a note. */
type SidebarRow = {
  /** The id of the thread it opens. */
  tab: string;
  /** The first line: "Acme". The question card names the thread by it,
      unless its choice has a `label`. */
  title: string;
  /** The second line, smaller: "Senior Engineer · 2020 – now". The
      question card uses it as a choice's hint, unless the choice has one. */
  subtitle: string;
  /** Shows a blue dot after the title, with this as its tooltip ("Current
      role"). Leave out for no dot. */
  live?: string;
};
