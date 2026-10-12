import assert from "node:assert/strict";
/** Only the two explicit loopback spellings at the fixture's actual port. */
export function localApplicationURL(input, applicationOrigin) {
  const url = new URL(input);
  const origin = new URL(applicationOrigin);
  assert.ok(
    url.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === origin.port &&
      !url.username &&
      !url.password,
    "External application redirect refused",
  );
  url.hostname = "127.0.0.1";
  return url;
}
