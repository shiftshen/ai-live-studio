import { Store } from "../src/server/store.ts";
import { Engine } from "../src/server/engine.ts";
import { mkdirSync, writeFileSync } from "node:fs";
mkdirSync("var/evidence", { recursive: true });
const path = `var/evidence/load-${Date.now()}.sqlite3`;
const s = new Store(path),
  e = new Engine(s);
const room = s.list("rooms")[0];
const seconds = Number(process.argv[2] ?? 600);
const start = Date.now();
let maxBatchMs = 0;
let count = 0;
for (let sec = 0; sec < seconds; sec++) {
  const t = Date.now();
  for (let n = 0; n < 100; n++) {
    e.ingest({
      roomId: room.id,
      sessionId: room.sessionId,
      platform: room.platform,
      sourceId: `load-${sec}-${n}`,
      userId: `load-${n}`,
      nickname: "性能测试",
      origin: "simulated",
      type: "comment",
      text: "普通消息",
      count: 1,
      occurredAt: Date.now(),
    });
    count++;
  }
  maxBatchMs = Math.max(maxBatchMs, Date.now() - t);
  if (sec % 30 === 0)
    writeFileSync(
      "var/evidence/load-progress.json",
      JSON.stringify({ seconds: sec, count, maxBatchMs }),
    );
  await new Promise((r) =>
    setTimeout(r, Math.max(0, start + (sec + 1) * 1000 - Date.now())),
  );
}
const result = {
  durationSeconds: (Date.now() - start) / 1000,
  requested: count,
  stored: s.count("events"),
  jobs: s.count("jobs"),
  maxBatchMs,
  passed: s.count("events") === count,
};
s.close();
writeFileSync("var/evidence/load-result.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
