/* What every check is given: the site it runs on, served with the real
   security headers and read once; /ask stood in for; and a failure for any
   error the page or its console reports, a request the page's policy
   blocked among them. */
import { devices, expect, test as base, type Request } from "@playwright/test";
import type { Prompt } from "../../src/config/home.ts";
import type { PersonalAnswer } from "../../src/config/question-card.ts";
import type { AskResponse } from "../../src/contracts/ask.ts";
import { serve, type Served } from "./server.ts";
import {
  readSite,
  type Clock,
  type ComesIntoView,
  type MovingPicture,
  type PlayedPicture,
  type SidebarGroup,
  type Site,
  type Thread,
  type ViewerLink,
} from "./site.ts";
import { OWN_SITE, type SiteUnderTest } from "./sites.ts";

export { expect };

/** What the stand-in /ask says: a reply, or "fail" for no answer at all. */
export type Reply = AskResponse | "fail";

/** /ask finding no answer on the site: the page then shows its "Something
    else" reply, as it does to every question when Ask is off. */
export const NO_ANSWER: Reply = { id: null };

/** A reply /ask never sends, which an AskResponse can't be written as: for
    a check of what the page does with one all the same. */
export const impossibleReply = (reply: Record<string, unknown>): Reply => reply as unknown as Reply;

type AskStandIn = {
  /** Every request /ask has had, in order. */
  requests: Request[];
  /** Whether a request was failed, as a check asked. */
  readonly failedOnPurpose: boolean;
  /** From now on /ask says `replies` to every question, or, given a list,
      each of them in turn and then fails. */
  returns(replies: Reply | Reply[]): Promise<void>;
};

/** The parts only some sites have. A check that asks for one is skipped,
    with the reason, on a site without it. */
type SiteParts = {
  otherThread: Thread;
  foldingGroup: SidebarGroup;
  startingPrompt: Prompt;
  personalAnswer: PersonalAnswer;
  clock: Clock;
  viewerLink: ViewerLink;
  playedPicture: PlayedPicture;
  movingPicture: MovingPicture;
  comingIntoView: ComesIntoView;
};

type PageErrors = {
  /** Says the check brings about, on purpose, errors that match: they
      aren't failures of it. */
  expected(matching: RegExp): void;
};

type ForEachCheck = SiteParts & {
  site: Site;
  /** Where the visitor is: the time zone playwright.config.ts gives every check. */
  visitorZone: string;
  ask: AskStandIn;
  /** Every check fails on an error the page or its console reports. */
  pageErrors: PageErrors;
};

type ForEachWorker = {
  /** Which site a project's checks run on: an option of the project. */
  siteUnderTest: SiteUnderTest;
  served: Served;
  siteAsBuilt: Site;
};

type Use<Value> = (value: Value) => Promise<void>;

/** A fixture for a part only some sites have. */
const partOrSkip =
  <Part>(partOf: (site: Site) => Part | null | undefined, whyNot: string) =>
  async ({ site }: { site: Site }, use: Use<Part>): Promise<void> => {
    const part = partOf(site);
    base.skip(part === null || part === undefined, whyNot);
    await use(part as Part);
  };

export const test = base.extend<ForEachCheck, ForEachWorker>({
  siteUnderTest: [OWN_SITE, { option: true, scope: "worker" }],
  served: [
    async ({ siteUnderTest }, use) => {
      const served = await serve(siteUnderTest.config, siteUnderTest.builtFolder);
      await use(served);
      await served.close();
    },
    { scope: "worker" },
  ],
  siteAsBuilt: [async ({ browser, served }, use) => use(await readSite(browser, served.home)), { scope: "worker" }],

  baseURL: async ({ served }, use) => use(served.home),
  site: async ({ siteAsBuilt }, use) => use(siteAsBuilt),
  visitorZone: async ({ timezoneId }, use) => {
    if (!timezoneId) throw new Error("playwright.config.ts gives the checks' visitor no time zone");
    await use(timezoneId);
  },

  ask: async ({ page, site }, use) => {
    const requests: Request[] = [];
    let failedOnPurpose = false;
    await use({
      requests,
      get failedOnPurpose() {
        return failedOnPurpose;
      },
      async returns(replies) {
        await page.route(site.askUrl, (route) => {
          requests.push(route.request());
          const reply = Array.isArray(replies) ? replies[requests.length - 1] : replies;
          if (reply !== undefined && reply !== "fail") return route.fulfill({ json: reply });
          failedOnPurpose = true;
          return route.abort();
        });
      },
    });
  },

  pageErrors: [
    async ({ context, site, ask }, use, testInfo) => {
      const errors: string[] = [];
      const onPurpose: RegExp[] = [];
      context.on("weberror", (webError) => errors.push(webError.error().message));
      context.on("console", (message) => {
        if (message.type() !== "error") return;
        if (ask.failedOnPurpose && message.location().url === site.askUrl) return;
        errors.push(message.text());
      });
      await use({ expected: (matching) => void onPurpose.push(matching) });
      const unexpected = errors.filter((error) => !onPurpose.some((expected) => expected.test(error)));
      if (testInfo.status !== "skipped") expect.soft(unexpected, "errors in the page or its console").toEqual([]);
    },
    { auto: true },
  ],

  otherThread: partOrSkip(
    (site) => (site.secondThread.id === site.firstThread.id ? null : site.secondThread),
    "the sidebar has one thread",
  ),
  foldingGroup: partOrSkip((site) => site.foldingGroup, "the sidebar has no groups"),
  startingPrompt: partOrSkip((site) => site.prompts[0], "the home screen has no questions to start with"),
  personalAnswer: partOrSkip((site) => site.questions.personal[0], "the site has no personal answers"),
  clock: partOrSkip((site) => site.clock, "the account menu has no clock"),
  viewerLink: partOrSkip((site) => site.viewer, "the site has no viewer"),
  playedPicture: partOrSkip((site) => site.playedPictures[0], "the site has no picture a visitor plays"),
  movingPicture: partOrSkip((site) => site.movingPictures[0], "the site has no picture that moves all the time"),
  comingIntoView: partOrSkip((site) => site.comesIntoView, "no answer on the site has a quote or a file card"),
});

// Chromium with a phone's screen, touch and user agent: the device's own
// browser isn't what the checks install.
const { defaultBrowserType: _itsOwnBrowser, ...iPhone13 } = devices["iPhone 13"];

/** A phone: a narrow screen, where the sidebar is a drawer and a visit
    starts in a new chat. For `test.use()`. */
export const A_PHONE = iPhone13;
