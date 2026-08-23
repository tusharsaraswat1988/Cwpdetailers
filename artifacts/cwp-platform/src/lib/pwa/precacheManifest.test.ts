import { describe, expect, it } from "vitest";
import { sanitizePrecacheManifest } from "./precacheManifest";

describe("sanitizePrecacheManifest", () => {
  it("drops unrevisioned index.html so Workbox cannot pin a stale app shell", () => {
    expect(
      sanitizePrecacheManifest([
        { url: "/index.html" },
        { url: "/index.html", revision: null },
        { url: "/assets/index-a1b2c3d4.js", revision: null },
        { url: "/assets/index-a1b2c3d4.js" },
        { url: "/index.html", revision: "9f3c" },
        "/offline.html",
      ]),
    ).toEqual([
      { url: "/assets/index-a1b2c3d4.js", revision: null },
      { url: "/assets/index-a1b2c3d4.js" },
      { url: "/index.html", revision: "9f3c" },
      "/offline.html",
    ]);
  });
});
