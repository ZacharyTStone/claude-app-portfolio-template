/* The checks of the config's `writing`: that it names a place to fetch
   posts from, and that each account and feed looks like one before the build
   asks for it. */
import type { Writing } from "../../config/writing.ts";
import type { Site } from "../site.ts";
import { isAccountName, isDomainName, isMediumUserName, isSubdomainName, isWebAddress } from "./formats.ts";
import type { ProblemUnless } from "./reporting.ts";

type SiteCheck = (site: Site, problemUnless: ProblemUnless) => void;

/** Each account `writing` can name, what it has to look like, and how a
    problem says so. */
const ACCOUNTS = [
  {
    field: "qiita",
    looksRight: isAccountName,
    shouldBe: `a Qiita user id, as in your profile's address (qiita.com/alex-example is "alex-example")`,
  },
  {
    field: "zenn",
    looksRight: isAccountName,
    shouldBe: `a Zenn user name, as in your profile's address (zenn.dev/alex_example is "alex_example")`,
  },
  {
    field: "dev",
    looksRight: isAccountName,
    shouldBe: `a DEV user name, as in your profile's address (dev.to/alex-example is "alex-example")`,
  },
  {
    field: "note",
    looksRight: isAccountName,
    shouldBe: `a note id, as in your profile's address (note.com/alex_example is "alex_example")`,
  },
  {
    field: "medium",
    looksRight: isMediumUserName,
    shouldBe: `a Medium user name, without its "@" (medium.com/@alex-example is "alex-example")`,
  },
  {
    field: "substack",
    looksRight: isSubdomainName,
    shouldBe: `a Substack's name, as in its address (alexexample.substack.com is "alexexample")`,
  },
  {
    field: "hatena",
    looksRight: isDomainName,
    shouldBe: `a Hatena Blog's address, without "https://", like "alex-example.hatenablog.com"`,
  },
] as const satisfies readonly { field: keyof Writing; looksRight: (value: unknown) => boolean; shouldBe: string }[];

/** A site with `writing` names somewhere to fetch its posts from. */
const checkHasAPlace: SiteCheck = ({ config }, problemUnless) => {
  const { writing } = config;
  if (!writing) return;
  const names = ACCOUNTS.some(({ field }) => writing[field] != null) || (writing.feeds ?? []).length > 0;
  problemUnless(
    names,
    "writing should name at least one place your posts are: qiita, zenn, dev, note, medium, substack, hatena or feeds",
  );
};

/** Each account the build asks a place for looks like one. */
const checkAccounts: SiteCheck = ({ config }, problemUnless) => {
  const { writing } = config;
  if (!writing) return;
  for (const { field, looksRight, shouldBe } of ACCOUNTS) {
    const value = writing[field];
    problemUnless(value == null || looksRight(value), `writing.${field} should be ${shouldBe}`);
  }
};

/** Each feed is a web address, read by the build. */
const checkFeeds: SiteCheck = ({ config }, problemUnless) => {
  for (const [at, feed] of (config.writing?.feeds ?? []).entries()) {
    problemUnless(isWebAddress(feed.url), `writing.feeds[${at}].url should be a feed's web address, like "https://…"`);
    problemUnless(
      feed.name === undefined || feed.name.trim() !== "",
      `writing.feeds[${at}].name should have words in it`,
    );
  }
};

/** The checks of `writing`, in the order their problems are listed. */
export const WRITING_CHECKS: SiteCheck[] = [checkHasAPlace, checkAccounts, checkFeeds];
