/* The posts the Writing tab lists. As a file this has none, and that's what
   the type checker, the config's checks and the tests read. A build or the
   dev server fetches them, then gives this module their list in place of
   its own (src/integrations/writing.ts), as astro.config.ts puts the config
   being built in place of site.config.ts. */
import type { Post } from "./post.ts";

const fetched: Post[] = [];

export default fetched;
