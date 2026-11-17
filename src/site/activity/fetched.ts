/* The repos the panel's GitHub activity lists. As a file this has none, and
   that's what the type checker, the config's checks and the tests read. A
   build or the dev server fetches them, then gives this module their list
   in place of its own (src/integrations/activity.ts), as it does the
   Writing tab's posts (../writing/fetched.ts). */
import type { Repo } from "./github.ts";

const fetched: Repo[] = [];

export default fetched;
