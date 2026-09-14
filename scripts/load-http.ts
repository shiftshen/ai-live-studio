import { createApp } from "../src/server/app.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
// Isolated HTTP/SQLite load. Workers are disabled: no printers, AI or TTS are called.
const duration = Number(process.argv[2] ?? 600);
const dir = resolve(`var/evidence/http-load-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const token = randomBytes(24).toString("hex");
const x = await createApp({ dir, workers: false, bootstrapToken: token });
const base = await x.app.listen({ host: "127.0.0.1", port: 0 });
const headers = {
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
};
const room = x.store.list("rooms")[0];
const latencies: number[] = [];
let stored = 0,
  errors = 0,
  reads = 0,
  maxReadMs = 0,
  maxLagMs = 0;
const started = Date.now();
try {
  for (let sec = 0; sec < duration; sec++) {
    const burst = Date.now();
    const requests = Array.from({ length: 100 }, (_, n) =>
      fetch(base + "/api/v1/simulate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          roomId: room.id,
          type: "comment",
          text: n % 5 === 0 ? "hello" : "普通消息",
          nickname: "HTTP负载测试",
          userId: `http-${sec}-${n}`,
        }),
      })
        .then(async (r) => {
          await r.arrayBuffer();
          if (r.ok) stored++;
          else errors++;
        })
        .catch(() => {
          errors++;
        }),
    );
    const readStart = Date.now();
    requests.push(
      fetch(base + "/api/v1/state", { headers }).then(async (r) => {
        await r.arrayBuffer();
        if (!r.ok) errors++;
        reads++;
        maxReadMs = Math.max(maxReadMs, Date.now() - readStart);
      }),
    );
    await Promise.all(requests);
    latencies.push(Date.now() - burst);
    maxLagMs = Math.max(maxLagMs, Date.now() - (started + (sec + 1) * 1000));
    if (sec % 30 === 0)
      writeFileSync(
        dir + "/progress.json",
        JSON.stringify({
          seconds: sec + 1,
          stored,
          errors,
          reads,
          maxReadMs,
          maxLagMs,
        }),
      );
    await new Promise((r) =>
      setTimeout(r, Math.max(0, started + (sec + 1) * 1000 - Date.now())),
    );
  }
  const count = x.store.count("events"),
    jobs = x.store.count("jobs");
  const sorted = [...latencies].sort((a, b) => a - b);
  const report = {
    startedAt: new Date(started).toISOString(),
    endedAt: new Date().toISOString(),
    durationSeconds: (Date.now() - started) / 1000,
    requested: duration * 100,
    accepted: stored,
    stored: count,
    jobs,
    errors,
    reads,
    maxReadMs,
    maxLagMs,
    p95BatchMs: sorted[Math.floor(sorted.length * 0.95)],
    maxBatchMs: Math.max(...latencies),
    passed: count === duration * 100 && errors === 0 && maxLagMs < 1000,
    scope:
      "Isolated local HTTP, authentication, real SQLite transactions, 20% matching multilingual rules and concurrent state reads. All injected events simulated; workers disabled; no real platform, AI, speech, OBS or physical output evidence.",
  };
  writeFileSync(dir + "/result.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  await x.app.close();
}
