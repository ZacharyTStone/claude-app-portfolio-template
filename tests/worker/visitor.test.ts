/* Who a visitor is counted as (src/worker/lib/visitor.ts). These strings are
   hashed into the keys the rate limit, the day's count and a block are kept
   under, so a change to any of them here is every visitor starting afresh. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  UNKNOWN_VISITOR_ADDRESS,
  VISITOR_ADDRESS_HEADER,
  VISITOR_HASH_BYTES,
  hashAddress,
  visitorAddress,
} from "../../src/worker/lib/visitor.ts";

const addressOf = (address: string) =>
  visitorAddress(new Request("https://site.example/ask", { headers: { [VISITOR_ADDRESS_HEADER]: address } }));

test("an IPv4 address is counted as it is", () => {
  for (const address of ["203.0.113.9", "127.0.0.1", "0.0.0.0", "255.255.255.255"]) {
    assert.equal(addressOf(address), address);
  }
});

test("an IPv4 address written as IPv6 is counted as the IPv4 address", () => {
  assert.equal(addressOf("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(addressOf("::FFFF:203.0.113.9"), "203.0.113.9");
});

test("any other IPv6 address is counted as its /64: four groups, lower case, no leading zeros", () => {
  for (const [address, network] of [
    ["2001:db8:1:2::1", "2001:db8:1:2::/64"],
    ["2001:db8:1:2:aaaa:bbbb:cccc:dddd", "2001:db8:1:2::/64"],
    ["2001:DB8:1:2:AAAA:BBBB:CCCC:DDDD", "2001:db8:1:2::/64"],
    ["2001:0db8:0001:0002:0000:0000:0000:0001", "2001:db8:1:2::/64"],
    ["2001:db8:0:0:0:0:0:1", "2001:db8:0:0::/64"],
    ["2001:db8::", "2001:db8:0:0::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:db8:0:a0::1", "2001:db8:0:a0::/64"],
    ["fe80::1", "fe80:0:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["::", "0:0:0:0::/64"],
    ["1:2:3:4:5:6:7:8", "1:2:3:4::/64"],
    ["::2:3:4:5:6:7:8", "0:2:3:4::/64"],
    ["1:2:3:4:5:6:7::", "1:2:3:4::/64"],
  ] as const) {
    assert.equal(addressOf(address), network, address);
  }
});

test("text that isn't an address is left as it is, and no address at all is 'unknown'", () => {
  for (const text of [
    "not:an:address",
    "localhost",
    "1:2:3",
    "1::2::3",
    ":::",
    "g::1",
    "12345::1",
    "1:2:3:4:5:6:7:8:9",
  ]) {
    assert.equal(addressOf(text), text);
  }
  assert.equal(visitorAddress(new Request("https://site.example/ask")), UNKNOWN_VISITOR_ADDRESS);
  assert.equal(UNKNOWN_VISITOR_ADDRESS, "unknown");
});

// Where ipaddr.js reads text differently from the hand-written parser it
// replaced. Cloudflare sends none of these forms (it writes IPv4 dotted, and
// IPv6 in hex groups with "::" for a run of zeros), so no visitor's key
// changed with the parser; they're pinned so the next change is a choice.
test("forms Cloudflare doesn't send: an address is read as the address it is, anything else left as it is", () => {
  for (const [text, counted] of [
    // An IPv4 address in IPv6, however it's written: the IPv4 address.
    ["::ffff:cb00:7109", "203.0.113.9"],
    ["0:0:0:0:0:ffff:203.0.113.9", "203.0.113.9"],
    ["::203.0.113.9", "203.0.113.9"],
    // An IPv6 address that ends in dotted IPv4, or names an interface: its /64.
    ["64:ff9b::192.0.2.33", "64:ff9b:0:0::/64"],
    ["fe80::1%eth0", "fe80:0:0:0::/64"],
    // "::" beside all eight groups stands for nothing, and a part of an
    // IPv4 address over 255 is no part of one: neither is an address.
    ["1:2:3:4:5:6:7::8", "1:2:3:4:5:6:7::8"],
    ["::ffff:999.0.113.9", "::ffff:999.0.113.9"],
  ] as const) {
    assert.equal(addressOf(text), counted, text);
  }
});

test("visitorAddress: IPv4 as it is, IPv6 as its /64, an IPv4 in IPv6 as the IPv4", () => {
  const address = (ip: string) =>
    visitorAddress(new Request("https://site.example/ask", { headers: { [VISITOR_ADDRESS_HEADER]: ip } }));
  assert.equal(address("203.0.113.9"), "203.0.113.9");
  assert.equal(address("2001:db8:1:2::1"), "2001:db8:1:2::/64");
  assert.equal(address("::1"), "0:0:0:0::/64");
  assert.equal(address("2001:db8::"), "2001:db8:0:0::/64");
  assert.equal(address("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(address("not:an:address"), "not:an:address");
});

test("an address is hashed with the salt, to the first half of a SHA-256 in hex", async () => {
  const hash = await hashAddress("203.0.113.9", "a salt:");
  assert.match(hash, /^[0-9a-f]{32}$/);
  assert.equal(hash.length, VISITOR_HASH_BYTES * 2);
  assert.equal(hash, createHash("sha256").update("a salt:203.0.113.9").digest("hex").slice(0, 32));
  assert.notEqual(hash, await hashAddress("203.0.113.9", "another salt:"));
  assert.notEqual(hash, await hashAddress("203.0.113.10", "a salt:"));
});
