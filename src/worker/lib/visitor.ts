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
const IPV6_VISITOR_GROUPS = 4;

/** An IPv6 /48 is what one site (a home, an office) is given; an IPv4 /24
    is the smallest block that is routed on its own. */
const IPV6_NETWORK_GROUPS = 3;
const IPV4_NETWORK_PARTS = 3;

const BITS_PER_GROUP = 16;

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
  return ipv6.isIPv4MappedAddress() ? ipv6.toIPv4Address().toString() : prefixOf(ipv6, IPV6_VISITOR_GROUPS);
}

/** The network the visitor's address is in, which its neighbours share: an
    IPv4 address's /24 ("203.0.113.0/24"), an IPv6 address's /48
    ("2001:db8:1::/48"). Anything that isn't an address, as it is. */
export function visitorNetwork(request: Request): string {
  const address = request.headers.get(VISITOR_ADDRESS_HEADER) ?? UNKNOWN_VISITOR_ADDRESS;
  if (ipaddr.IPv4.isValidFourPartDecimal(address)) return network24(address);
  if (!ipaddr.IPv6.isValid(address)) return address;
  const ipv6 = ipaddr.IPv6.parse(address);
  return ipv6.isIPv4MappedAddress() ? network24(ipv6.toIPv4Address().toString()) : prefixOf(ipv6, IPV6_NETWORK_GROUPS);
}

const network24 = (ipv4: string): string => `${ipv4.split(".").slice(0, IPV4_NETWORK_PARTS).join(".")}.0/24`;

// Its first groups in lower-case hex with no leading zeros, then "::" and
// how many bits that is: "2001:db8:1:2::/64", and "0:0:0:0::/64" for ::1.
function prefixOf(ipv6: ipaddr.IPv6, groups: number): string {
  const kept = ipv6.parts.slice(0, groups).map((group) => group.toString(16));
  return `${kept.join(":")}::/${groups * BITS_PER_GROUP}`;
}

/** An address as 32 hex characters (the first half of a salted SHA-256). */
export async function hashAddress(address: string, salt: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}${address}`));
  return [...new Uint8Array(digest)]
    .slice(0, VISITOR_HASH_BYTES)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
