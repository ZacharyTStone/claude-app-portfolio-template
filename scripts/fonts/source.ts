/* The whole fonts the site's subsets are cut from: Google's own files, at one commit of its fonts repository,
   and refused unless they are byte for byte the files this script was written against. So a rebuild cuts the
   same font whenever and wherever it runs, and nothing it downloads is taken on trust. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A font in google/fonts: its path there, and the SHA-256 of the file at `GOOGLE_FONTS_COMMIT`. */
export type SourceFont = { path: string; sha256: string };

const GOOGLE_FONTS_COMMIT = "3e5667764ccfea32ce0c3d58a3a4756de890adc1";

export const NOTO_SANS_JP: SourceFont = {
  path: "ofl/notosansjp/NotoSansJP[wght].ttf",
  sha256: "c2f3b4d463500a2ddcd3849cded1fceeb9fd6d1c32e6cbecd568453ba50fc68f",
};
export const NOTO_SERIF_JP: SourceFont = {
  path: "ofl/notoserifjp/NotoSerifJP[wght].ttf",
  sha256: "2fd527ba12b6a44ec30d796d633360da0aeba6c5d4af1304ce12bb4dc15a7dfc",
};

const addressOf = ({ path }: SourceFont): string =>
  `https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_COMMIT}/${path.split("/").map(encodeURIComponent).join("/")}`;

const sha256Of = (file: Buffer): string => createHash("sha256").update(file).digest("hex");

/** How a source font is got: where a downloaded one is kept for next time, and what downloads one. */
export type Fetching = { cacheFolder: string; download: (address: string) => Promise<Buffer> };

/** The source font: the kept copy if there's a sound one, or else downloaded, checked and kept. The two fonts
    are 23 MB between them, so a rebuild doesn't download them again while the kept copies last. */
export async function sourceFont(source: SourceFont, { cacheFolder, download }: Fetching): Promise<Buffer> {
  const kept = join(cacheFolder, `${source.sha256}.ttf`);
  if (existsSync(kept)) {
    const font = readFileSync(kept);
    if (sha256Of(font) === source.sha256) return font;
  }
  const font = await download(addressOf(source));
  const sha256 = sha256Of(font);
  if (sha256 !== source.sha256)
    throw new Error(
      `${addressOf(source)} isn't the font this script expects (its SHA-256 is ${sha256}, not ${source.sha256}): nothing was written.`,
    );
  mkdirSync(cacheFolder, { recursive: true });
  writeFileSync(kept, font);
  return font;
}

export async function downloaded(address: string): Promise<Buffer> {
  const response = await fetch(address).catch((error: Error) => {
    throw new Error(`Couldn't download ${address} (${error.message}). Behind a proxy, set NODE_USE_ENV_PROXY=1.`);
  });
  if (!response.ok) throw new Error(`Couldn't download ${address}: the server answered ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}
