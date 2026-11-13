/* A built site, served as its host serves it: under the site's base path,
   every response with the real security headers, so the page's policy and
   Trusted Types apply to what the checks do. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { frameOrigins, securityHeaders } from "../../src/site/security-headers.ts";
import { basePath } from "../../src/site/url.ts";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};
const UNKNOWN_CONTENT_TYPE = "application/octet-stream";

const NOT_FOUND_PAGE = "404.html";

// A page's opening tag, attributes and all: <html lang="en" data-ask="/ask">.
const HTML_TAG = /<html\b[^>]*>/;

/** Whether a built page has Ask on, so its policy lets it connect to /ask. */
function hasAsk(html: string): boolean {
  const htmlTag = html.match(HTML_TAG)?.[0] ?? "";
  return new RegExp(`\\s${DATA.ask}=`).test(htmlTag);
}

/** The file or folder a path on the site names, or null for one that
    can't be read or that leaves `root`: nothing outside the built site is
    ever served. */
function fileIn(root: string, sitePath: string): string | null {
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(sitePath);
  } catch {
    return null;
  }
  const file = join(root, decodedPath);
  return file === root || file.startsWith(root + sep) ? file : null;
}

const isFolder = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/** What a request gets: a file with its status, or a redirect. */
type Answer = { file: string; status: number } | { redirectTo: string };

/** What a host answers a request for `pathname` with. */
function answerTo({ pathname, search }: URL, root: string, base: string): Answer {
  const notFound = { file: join(root, NOT_FOUND_PAGE), status: 404 };
  if (`${pathname}/` === base) return { redirectTo: base + search };
  if (!pathname.startsWith(base)) return notFound;
  const named = fileIn(root, pathname.slice(base.length));
  if (!named) return notFound;
  // As hosts do: /ja goes to /ja/, so the page's relative links work.
  if (isFolder(named) && !pathname.endsWith("/")) return { redirectTo: `${pathname}/${search}` };
  const file = isFolder(named) ? join(named, "index.html") : named;
  return existsSync(file) ? { file, status: 200 } : notFound;
}

export type Served = {
  /** The main page's address: the server's origin and the site's base path. */
  home: string;
  /** Stops serving, and drops the connections still open. */
  close(): Promise<void>;
};

/** Serves the site `config` describes, built in `builtFolder`, on a free
    port of 127.0.0.1. */
export async function serve(config: SiteConfig, builtFolder: string): Promise<Served> {
  const root = resolve(builtFolder);
  const base = basePath(config.url);
  const ask = hasAsk(readFileSync(join(root, "index.html"), "utf8"));
  const headers = Object.fromEntries(securityHeaders({ ask, frames: frameOrigins(config.viewer), hsts: config.hsts }));

  const send = (response: ServerResponse, answer: Answer) => {
    if ("redirectTo" in answer) {
      response.writeHead(301, { ...headers, Location: answer.redirectTo });
      response.end();
      return;
    }
    const contentType = CONTENT_TYPES[extname(answer.file)] ?? UNKNOWN_CONTENT_TYPE;
    response.writeHead(answer.status, { ...headers, "Content-Type": contentType });
    response.end(readFileSync(answer.file));
  };

  const server = createServer((request, response) => {
    // Only the path and the query are read: any origin does to parse them.
    const asked = new URL(request.url ?? "/", "http://localhost");
    send(response, answerTo(asked, root, base));
  });
  await new Promise<void>((listening) => server.listen(0, "127.0.0.1", listening));
  const { port } = server.address() as AddressInfo;
  return {
    home: `http://127.0.0.1:${port}${base}`,
    close: () =>
      new Promise<void>((closed) => {
        server.closeAllConnections();
        server.close(() => closed());
      }),
  };
}
