/* Who's asking: the address Cloudflare gives, an IPv6 one as its /64 (what
   one home or phone is given), and only ever kept or sent on hashed. */

/** The visitor's address as Cloudflare gives it: IPv4, or IPv6 cut to the
    network it's in ("2001:db8:1:2::/64"). */
export function visitorAddress(request: Request): string {
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return address.includes(":") ? network64(address) : address;
}

// The first four groups of an IPv6 address, written out in full; an IPv4
// address in IPv6 ("::ffff:203.0.113.9") is the IPv4 one. Anything that
// isn't an IPv6 address is left as it is.
function network64(address: string): string {
  const ipv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (ipv4?.[1]) return ipv4[1];
  const halves = address.toLowerCase().split("::");
  if (halves.length > 2) return address;
  const [head = [], tail = []] = halves.map((half) => (half ? half.split(":") : []));
  const zeros = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (zeros < 0) return address;
  const groups = [...head, ...Array<string>(zeros).fill("0"), ...tail];
  if (groups.length !== 8 || !groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return address;
  const network = groups.slice(0, 4).map((group) => group.replace(/^0+(?=.)/, ""));
  return `${network.join(":")}::/64`;
}

/** An address as 32 hex characters (the first half of a salted SHA-256). */
export async function hashAddress(address: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}${address}`));
  return [...new Uint8Array(digest)]
    .slice(0, 16)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
