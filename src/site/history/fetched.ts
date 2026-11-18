/* The GitHub history the parts draw. As a file this has none, and that's
   what the type checker, the config's checks and the tests read. A build
   or the dev server fetches it, then gives this module what it fetched in
   place of its own (src/integrations/history.ts), as it does the Writing
   tab's posts (../writing/fetched.ts). */
import type { History } from "./history.ts";

const fetched: History | null = null;

export default fetched;
