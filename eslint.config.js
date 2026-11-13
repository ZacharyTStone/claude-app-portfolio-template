import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

// A site's own content is held by the config's checks and the type checker, not by these rules.
const A_SITES_OWN_CONTENT = ["site.config.ts", "diagrams/", "examples/"];
const WHAT_IS_BUILT = ["dist/", ".astro/", "public/"];

const CODE_LINES_ONLY = { skipBlankLines: true, skipComments: true };

/** Which folders of src/ each folder of src/ may import from, besides itself. */
const MAY_IMPORT = {
  config: [],
  contracts: ["config"],
  shared: ["config"],
  app: ["config", "contracts"],
  worker: ["config", "contracts"],
  site: ["config", "contracts"],
  integrations: ["config", "contracts", "site"],
  layouts: ["config", "contracts", "site", "styles"],
  components: ["config", "contracts", "site", "layouts"],
  pages: ["config", "contracts", "site", "layouts", "components"],
  styles: [],
};
const FOLDERS = Object.keys(MAY_IMPORT);

const IMPORTS_EVERYWHERE = [
  {
    regex: String.raw`^\.{1,2}(/([^/]*/)*[^./]*)?$|^\.{1,2}/.*\.[cm]?js$`,
    message: "Name the file as it is on disk, with its .ts: Node runs these files without a bundler.",
  },
  {
    regex: String.raw`(^|/)shared/config\.ts$`,
    message: "src/shared/config.ts is only for sites made before src/config: import from src/config.",
  },
];

function importsAllowedIn(folder, allowedFolders = MAY_IMPORT[folder]) {
  const otherFolders = FOLDERS.filter((other) => other !== folder && !allowedFolders.includes(other));
  const reachesAnother = {
    regex: String.raw`^(\.\./)+(${otherFolders.join("|")})/`,
    message: `Here, src/${folder} may import only from ${[folder, ...allowedFolders].join(", ")} (MAY_IMPORT in eslint.config.js).`,
  };
  return { "no-restricted-imports": ["error", { patterns: [...IMPORTS_EVERYWHERE, reachesAnother] }] };
}

/** A component's <script> runs in the browser: it may import what src/app may, and src/app. */
const A_COMPONENTS_SCRIPT = "src/components/**/*.astro/*.ts";
const WHAT_THE_BROWSER_RUNS = ["app", ...MAY_IMPORT.app];

const TRUSTED_TYPES = "The page's policy refuses HTML from a string: make elements with make() (src/app/lib/dom.ts).";
const NOTHING_INLINE = "The page's policy allows nothing inline: styles are files in src/styles.";

export default defineConfig(
  globalIgnores([...WHAT_IS_BUILT, ...A_SITES_OWN_CONTENT]),
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    rules: {
      // The type checker holds this one (noUnusedLocals, noUnusedParameters), with _unused allowed.
      "@typescript-eslint/no-unused-vars": "off",
      // The config's checks and the diagram kit look for control characters on purpose.
      "no-control-regex": "off",
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "no-nested-ternary": "error",
      "no-warning-comments": ["error", { terms: ["----"], location: "anywhere" }],
      "no-restricted-imports": ["error", { patterns: IMPORTS_EVERYWHERE }],
    },
  },
  {
    ignores: ["tests/**"],
    rules: {
      "max-lines": ["error", { max: 300, ...CODE_LINES_ONLY }],
      "max-lines-per-function": ["error", { max: 50, ...CODE_LINES_ONLY }],
    },
  },
  {
    files: ["src/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name=/^(inner|outer)HTML$/]", message: TRUSTED_TYPES },
        { selector: "CallExpression[callee.property.name='insertAdjacentHTML']", message: TRUSTED_TYPES },
        {
          selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
          message: TRUSTED_TYPES,
        },
        {
          selector: "JSXAttribute[name.name='style'], JSXElement[openingElement.name.name='style']",
          message: NOTHING_INLINE,
        },
        {
          selector:
            "JSXNamespacedName[namespace.name='is'][name.name='inline'], JSXNamespacedName[namespace.name='client']",
          message: "No is:inline and no client: directives: the pages' only script is src/app.",
        },
      ],
    },
  },
  ...FOLDERS.map((folder) => ({ files: [`src/${folder}/**`], rules: importsAllowedIn(folder) })),
  { files: [A_COMPONENTS_SCRIPT], rules: importsAllowedIn("components", WHAT_THE_BROWSER_RUNS) },
);
