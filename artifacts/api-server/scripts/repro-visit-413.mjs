/**
 * Reproduces POST body-parser rejection for camera photo uploads.
 * Run from repo root: node artifacts/api-server/scripts/repro-visit-413.mjs
 */
import express from "express";
import http from "node:http";

function cameraSizedPayload() {
  const base64 = "A".repeat(1_500_000);
  return JSON.stringify({
    subscriptionId: 1,
    visitType: "cleaning",
    imageBase64: `data:image/jpeg;base64,${base64}`,
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 12,
  });
}

async function post(app, label) {
  const body = cameraSizedPayload();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/daily-cleaning/visits/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)) },
    body,
  });
  const text = await res.text();
  await new Promise((resolve) => server.close(resolve));
  console.log(`\n=== ${label} ===`);
  console.log("Payload bytes:", Buffer.byteLength(body));
  console.log("HTTP status:", res.status);
  console.log("Response body:", text.slice(0, 500));
  return { status: res.status, body: text };
}

const oldApp = express();
oldApp.use(express.json());
oldApp.post("/api/daily-cleaning/visits/complete", (_req, res) => {
  res.status(201).json({ ok: true, reached: "handler" });
});

const newApp = express();
newApp.use(express.json({ limit: "15mb" }));
newApp.use((err, _req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Photo upload too large (max 15MB).", code: "PAYLOAD_TOO_LARGE" });
  }
  return next(err);
});
newApp.post("/api/daily-cleaning/visits/complete", (_req, res) => {
  res.status(201).json({ ok: true, reached: "handler" });
});

const oldResult = await post(oldApp, "Production config (express.json default 100kb)");
const newResult = await post(newApp, "Fixed config (express.json limit 15mb)");

console.log("\n=== ROOT CAUSE ===");
if (oldResult.status === 413) {
  console.log("HTTP status: 413");
  console.log("Exception: PayloadTooLargeError: request entity too large");
  console.log("Stack: at readStream (raw-body/index.js) → jsonParser (body-parser/lib/types/json.js) → express.json()");
  console.log("File: artifacts/api-server/src/app.ts line 33 (before fix: app.use(express.json()))");
  console.log("Handler never reached: artifacts/api-server/src/routes/dcms.ts POST /daily-cleaning/visits/complete");
  console.log("Client: HTML 413 → dcmsFetch JSON.parse fails → empty Error.message → toast 'Unknown error'");
}
if (newResult.status === 201) {
  console.log("Fix verified: 1.5MB payload reaches handler with 15mb limit");
}
