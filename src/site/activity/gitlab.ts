/* A GitLab user's recent public activity, from gitlab.com's REST API, as
   the details panel lists it: the public projects they pushed to most
   recently. GitLab's events name a project by its number alone, so the
   build asks for the user's number by their name, then for their pushes,
   then for each project the panel lists, which says whether it's public:
   one that isn't is left out. No token is sent. What comes back is checked
   before anything of it reaches a page, and only what the panel shows is
   kept. */
import * as v from "valibot";
import { ACTIVITY_REPOS } from "../../config/activity.ts";
import { ask, pageAfter, readPages, type AskOptions, type Asking, type EventPage } from "./asking.ts";
import { inUtc, latestOnceBy, type Repo } from "./repo.ts";

/** gitlab.com, where every project's page is. */
export const GITLAB = "https://gitlab.com";

const API = `${GITLAB}/api/v4`;

/** Where the user of a name is: a list of one, or of none. */
export const userAddress = (user: string): string => `${API}/users?username=${encodeURIComponent(user)}`;

/** Where the pushes of the user numbered `id` are, newest first, a page at
    a time. */
export const pushesAddress = (id: number, perPage: number): string =>
  `${API}/users/${id}/events?action=pushed&per_page=${perPage}`;

/** Where the project numbered `id` is, if anyone may see it. */
export const projectAddress = (id: number): string => `${API}/projects/${id}`;

/** The most events GitLab gives in a page. */
const PAGE_SIZE = 100;

const Id = v.pipe(v.number(), v.integer());

const UsersSchema = v.array(v.object({ id: Id, username: v.string() }));

/** A push, as action=pushed lists them: to a branch or a tag ("pushed
    to"), or of a new one ("pushed new"). One that only deletes a branch
    or a tag ("deleted") isn't counted. */
const PUSHES = ["pushed to", "pushed new"];

/** An event as GitLab's API has it, but for what the panel doesn't show:
    v.object leaves out every other field, what was pushed among them. */
const EventSchema = v.object({
  action_name: v.string(),
  author_id: Id,
  project_id: Id,
  created_at: v.pipe(v.string(), v.isoTimestamp()),
});

type Event = v.InferOutput<typeof EventSchema>;

/** A part of a project's path, as GitLab allows one: never "." or "..". */
const PATH_PART = "(?:[A-Za-z0-9_.][A-Za-z0-9_.-]*[A-Za-z0-9_-]|[A-Za-z0-9_])";

/** "alex-example/notes", "a-group/a-subgroup/notes": a namespace, any
    subgroups, and a project, as a path on gitlab.com. */
const PROJECT_PATH = new RegExp(`^${PATH_PART}(?:/${PATH_PART})+$`);

/** A project as GitLab's API has it, but for its path and who may see it. */
const ProjectSchema = v.object({
  path_with_namespace: v.pipe(v.string(), v.regex(PROJECT_PATH)),
  visibility: v.string(),
});

type Project = v.InferOutput<typeof ProjectSchema>;

/** A project pushed to, by its number, and when. */
type Push = { project: number; pushed: string };

const HEADERS = { accept: "application/json" };

const asking = <Got>(address: string, what: string, schema: v.GenericSchema<unknown, Got>): Asking<Got> => ({
  service: "gitlab",
  address,
  what,
  schema,
  headers: HEADERS,
});

/** The number GitLab knows `user` by. Throws if it has no user of that name. */
async function userIdOf(user: string, options: AskOptions): Promise<number> {
  const address = userAddress(user);
  const { got } = await ask(asking(address, "a list of users", UsersSchema), options);
  const found = got.find((one) => one.username.toLowerCase() === user.toLowerCase());
  if (!found) throw new Error(`GitLab has no user by that name, at ${address}`);
  return found.id;
}

/** Each project pushed to once, at its latest push, the latest first. Only
    a push counts, and only the user's. */
const projectsPushedTo = (events: Event[], userId: number): Push[] =>
  latestOnceBy(
    events
      .filter((event) => PUSHES.includes(event.action_name) && event.author_id === userId)
      .map((push) => ({ project: push.project_id, pushed: inUtc(push.created_at) })),
    (push) => String(push.project),
  );

/** The repo a push was to, or none if GitLab shows it to no one but its
    members: it answers 404 for that, or says it isn't public. */
async function publicRepoOf(push: Push, options: AskOptions): Promise<Repo | undefined> {
  const address = projectAddress(push.project);
  const projectAsking: Asking<Project | null> = {
    ...asking(address, "a project", v.nullable(ProjectSchema)),
    whenNotFound: null,
  };
  const { got: project } = await ask(projectAsking, options);
  if (project?.visibility !== "public") return undefined;
  const name = project.path_with_namespace;
  return { service: "gitlab", name, url: `${GITLAB}/${name}`, pushed: push.pushed };
}

/** The public repos of `pushes`, in their order, as many as the panel
    lists: the projects are asked for that many at a time, and more only
    for any that weren't public. */
async function publicRepos(pushes: Push[], options: AskOptions): Promise<Repo[]> {
  const repos: Repo[] = [];
  let rest = pushes;
  while (repos.length < ACTIVITY_REPOS && rest.length > 0) {
    const next = rest.slice(0, ACTIVITY_REPOS - repos.length);
    rest = rest.slice(next.length);
    const found = await Promise.all(next.map((push) => publicRepoOf(push, options)));
    repos.push(...found.filter((repo) => repo !== undefined));
  }
  return repos;
}

/** The public repos `user` pushed to most recently on gitlab.com, the
    latest first, as many as the panel lists, or fewer if their recent
    pushes name fewer. Throws if GitLab can't be reached, refuses, has no
    such user, or sends anything but what its API sends. */
export async function gitlabRepos(user: string, options: AskOptions): Promise<Repo[]> {
  const id = await userIdOf(user, options);
  const perPage = options.perPage ?? PAGE_SIZE;
  const readPage = async (address: string): Promise<EventPage<Event>> => {
    const { got } = await ask(asking(address, "a list of events", v.array(EventSchema)), options);
    return { events: got, next: pageAfter(address, got.length, perPage) };
  };
  const events = await readPages(pushesAddress(id, perPage), readPage, (read) => projectsPushedTo(read, id).length);
  return publicRepos(projectsPushedTo(events, id), options);
}
