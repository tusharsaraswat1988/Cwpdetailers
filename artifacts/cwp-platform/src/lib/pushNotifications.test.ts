import { describe, expect, it } from "vitest";
import { toApplicationServerKey } from "./pushNotifications";

function toUrlBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("toApplicationServerKey", () => {
  it("decodes a 65-byte VAPID public key to an exact Uint8Array", () => {
    const raw = new Uint8Array(65);
    raw[0] = 4;
    raw.fill(7, 1);
    const encoded = toUrlBase64(raw);
    const decoded = toApplicationServerKey(`  ${encoded}  `);
    expect(decoded).toBeInstanceOf(ArrayBuffer);
    expect(decoded.byteLength).toBe(65);
    const view = new Uint8Array(decoded);
    expect(view[0]).toBe(4);
    expect(view[64]).toBe(7);
  });
});
