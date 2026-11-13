/* The built site, served as its host serves it: dist/ under the site's
   base path (the path in site.config.ts's `url`: "/" for most sites,
   "/portfolio/" for a GitHub project site), every response with exactly
   the security headers in src/site/security-headers.ts (so the CSP and Trusted
   Types apply), a folder's index.html for the folder, and 404.html for
   anything that isn't there. No network, no packages. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import siteConfig from "../../site.config.ts";
import { OUTPUT, ROOT } from "../../src/site/constants.ts";
import type { SiteConfig } from "../../src/config/site-config.ts";
import { frameOrigins, securityHeaders } from "../../src/site/security-headers.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";

// As SiteConfig, so a field this site leaves out (hsts) reads as undefined.
const config: SiteConfig = siteConfig;

/** The Content-Type of each kind of file a built site has, by its
    extension; and of any other kind, which a browser then doesn't show. */
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

// A page's opening tag, attributes and all: <html lang="en" data-ask="/ask">.
const HTML_TAG = /<html\b[^>]*>/;

/** Whether a built page has Ask on (data-ask on its <html>), so it may
    connect to /ask. */
function hasAsk(html: string): boolean {
  const htmlTag = html.match(HTML_TAG)?.[0] ?? "";
  return new RegExp(`\\s${DATA.ask}=`).test(htmlTag);
}

/** The file or folder in `root` that a path on the site names ("ja/" or
    "assets/app.css"), whether or not it's there. Null for a path that
    can't be read (a % that escapes nothing) or that leaves `root` ("../"):
    nothing outside the built site is ever served. */
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

/** A site being served. */
type Served = {
  /** The main page's address: the server's origin and the base path. */
  home: string;
  /** Stops serving, and drops the connections still open. */
  close(): Promise<void>;
};

/** Serves `root` (the built site: dist/, unless another folder is given)
    at `base` on a free port of 127.0.0.1. */
export async function serve({
  root: folder = join(ROOT, OUTPUT),
  base = "/",
}: { root?: string; base?: string } = {}): Promise<Served> {
  const root = resolve(folder);
  const ask = hasAsk(readFileSync(join(root, "index.html"), "utf8"));
  const headers = Object.fromEntries(securityHeaders({ ask, frames: frameOrigins(config.viewer), hsts: config.hsts }));

  const sendFile = (response: ServerResponse, status: number, file: string) => {
    const contentType = CONTENT_TYPES[extname(file)] ?? UNKNOWN_CONTENT_TYPE;
    response.writeHead(status, { ...headers, "Content-Type": contentType });
    response.end(readFileSync(file));
  };
  const redirect = (response: ServerResponse, to: string) => {
    response.writeHead(301, { ...headers, Location: to });
    response.end();
  };

  const server = createServer((request, response) => {
    // Only the path and the query are read: any origin does to parse them.
    const { pathname, search } = new URL(request.url ?? "/", "http://localhost");
    const notFound = () => sendFile(response, 404, join(root, "404.html"));
    // The base path without its last slash: "/portfolio" → "/portfolio/".
    if (`${pathname}/` === base) return redirect(response, base + search);
    if (!pathname.startsWith(base)) return notFound();
    let file = fileIn(root, pathname.slice(base.length));
    if (!file) return notFound();
    if (isFolder(file)) {
      // As hosts do: /ja → /ja/, so the page's relative links work.
      if (!pathname.endsWith("/")) return redirect(response, `${pathname}/${search}`);
      file = join(file, "index.html");
    }
    return existsSync(file) ? sendFile(response, 200, file) : notFound();
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
