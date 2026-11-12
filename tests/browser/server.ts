/* The built site, served as its host serves it: dist/ under the site's
   base path (the path in site.config.ts's `url`: "/" for most sites,
   "/portfolio/" for a GitHub project site), every response with exactly
   the security headers in src/shared/headers.ts (so the CSP and Trusted
   Types apply), a folder's index.html for the folder, and 404.html for
   anything that isn't there. No network, no packages. */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";
import siteConfig from "../../site.config.ts";
import { OUTPUT, ROOT } from "../../src/site/constants.ts";
import type { SiteConfig } from "../../src/shared/config.ts";
import { frameOrigins, securityHeaders } from "../../src/shared/headers.ts";
import { DATA } from "../../src/shared/page-data.ts";

// As SiteConfig, so a field this site leaves out (hsts) reads as undefined.
const config: SiteConfig = siteConfig;

const TYPES: Record<string, string> = {
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

/** Whether a built page has Ask on (data-ask on its <html>), so it may
    connect to /ask. */
function hasAsk(html: string): boolean {
  const root = html.match(/<html\b[^>]*>/)?.[0] ?? "";
  return new RegExp(`\\s${DATA.ask}=`).test(root);
}

type Served = {
  /** The main page's address: the server's origin and the base path. */
  home: string;
  close(): Promise<void>;
};

/** Serves `root` (the built site) at `base` on a free port of 127.0.0.1. */
export async function serve({
  root: folder = join(ROOT, OUTPUT),
  base = "/",
}: { root?: string; base?: string } = {}): Promise<Served> {
  const root = resolve(folder);
  const ask = hasAsk(readFileSync(join(root, "index.html"), "utf8"));
  const headers = Object.fromEntries(securityHeaders({ ask, frames: frameOrigins(config.viewer), hsts: config.hsts }));

  const send = (res: ServerResponse, status: number, file: string) => {
    res.writeHead(status, { ...headers, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  };
  const redirect = (res: ServerResponse, to: string) => {
    res.writeHead(301, { ...headers, Location: to });
    res.end();
  };

  const server = createServer((req, res) => {
    const { pathname, search } = new URL(req.url ?? "/", "http://localhost");
    const notFound = () => send(res, 404, join(root, "404.html"));
    if (`${pathname}/` === base) return redirect(res, base + search);
    if (!pathname.startsWith(base)) return notFound();
    let file: string;
    try {
      file = join(root, decodeURIComponent(pathname.slice(base.length)));
    } catch {
      return notFound();
    }
    if (file !== root && !file.startsWith(root + sep)) return notFound();
    if (existsSync(file) && statSync(file).isDirectory()) {
      // As hosts do: /ja → /ja/, so the page's relative links work.
      if (!pathname.endsWith("/")) return redirect(res, `${pathname}/${search}`);
      file = join(file, "index.html");
    }
    return existsSync(file) ? send(res, 200, file) : notFound();
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  return {
    home: `http://127.0.0.1:${port}${base}`,
    close: () =>
      new Promise<void>((done) => {
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}
