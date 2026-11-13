/* Who's asking: the address Cloudflare gives, an IPv6 one as its /64 (what
   one home or phone is given), and only ever kept or sent on hashed. */
import ipaddr from "ipaddr.js";

/** The header Cloudflare puts the visitor's address in. */
export const VISITOR_ADDRESS_HEADER = "CF-Connecting-IP";

/** What stands for the address of a request that came without one. */
export const UNKNOWN_VISITOR_ADDRESS = "unknown";

/** How much of the hash is kept: the first half of a SHA-256, which is 32
    hex characters. Changing it starts every visitor's count afresh. */
export const VISITOR_HASH_BYTES = 16;

/** How many of an IPv6 address's eight groups name its network: the first
    64 bits, which one home or phone is given all of. */
const IPV6_NETWORK_GROUPS = 4;

/** The visitor's address as the limits count it. What this returns is
    hashed into the keys their rate limit, count and block are kept under,
    so each kind of address has to go on reading as it does:
    - an IPv4 address, as Cloudflare gives it ("203.0.113.9");
    - an IPv4 address written as IPv6 ("::ffff:203.0.113.9"), as the IPv4
      address, so it's the same visitor either way;
    - any other IPv6 address, as the network it's in ("2001:db8:1:2::/64"):
      every address in a /64 is one visitor;
    - anything else (no address, or text that isn't one), as it is. */
export function visitorAddress(request: Request): string {
  const address = request.headers.get(VISITOR_ADDRESS_HEADER) ?? UNKNOWN_VISITOR_ADDRESS;
  if (!ipaddr.IPv6.isValid(address)) return address;
  const ipv6 = ipaddr.IPv6.parse(address);
  return ipv6.isIPv4MappedAddress() ? ipv6.toIPv4Address().toString() : network64(ipv6);
}

// Its first four groups in lower-case hex with no leading zeros, then
// "::/64": "2001:db8:1:2::/64", and "0:0:0:0::/64" for ::1.
function network64(ipv6: ipaddr.IPv6): string {
  const networkGroups = ipv6.parts.slice(0, IPV6_NETWORK_GROUPS).map((group) => group.toString(16));
  return `${networkGroups.join(":")}::/64`;
}

/** An address as 32 hex characters (the first half of a salted SHA-256). */
export async function hashAddress(address: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}${address}`));
  return [...new Uint8Array(digest)]
    .slice(0, VISITOR_HASH_BYTES)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
