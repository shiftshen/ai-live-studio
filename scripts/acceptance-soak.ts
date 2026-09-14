import {
  appendFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

type Sample = {
  at: number;
  ok: boolean;
  uptime: number;
  pid: number;
  rssKb: number;
  rooms: any[];
  groups: any[];
  queue: any[];
  errors: string[];
  dbBytes: number;
};
export function assess(
  samples: Sample[],
  seconds: number,
  interval: number,
  platforms: string[],
) {
  const first = samples[0],
    last = samples.at(-1)!;
  const failures = new Set<string>();
  const elapsed = (last.at - first.at) / 1000;
  let restarts = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i],
      prev = samples[i - 1];
    if (!s.ok) failures.add("endpoint_or_sample_error");
    if (prev && (s.pid !== prev.pid || s.uptime < prev.uptime)) restarts++;
    if (prev && s.at - prev.at > interval * 2500) failures.add("sampling_gap");
    for (const p of platforms) {
      const rooms = s.rooms.filter((r) => r.platform === p);
      if (!rooms.length || rooms.some((r) => r.status !== "connected"))
        failures.add(`${p}:disconnected`);
      if (prev && !s.groups.some((g) => g.platform === p && g.n > 0))
        failures.add(`${p}:no_live_data_interval`);
    }
  }
  if (restarts) failures.add("service_restarted");
  return {
    completed: elapsed >= seconds,
    passed: elapsed >= seconds && !failures.size,
    elapsedSeconds: elapsed,
    restartCount: restarts,
    failures: [...failures],
  };
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, "").split("=");
      return [k, v.join("=")];
    }),
  );
  const duration = Number(args.seconds ?? 7200),
    interval = Number(args.interval ?? 60);
  if (!(duration > 0 && interval > 0))
    throw new Error("duration/interval must be positive");
  const root = resolve(import.meta.dirname, "..");
  const out = resolve(
    args.output ??
      `${root}/var/evidence/acceptance-${new Date().toISOString().replaceAll(":", "-")}`,
  );
  mkdirSync(out, { recursive: true });
  const token = readFileSync(`${root}/var/admin-token`, "utf8").trim();
  const db = new DatabaseSync(`${root}/var/studio.sqlite3`, { readOnly: true });
  db.exec("PRAGMA busy_timeout=5000");
  const started = Date.now(),
    samples: Sample[] = [];
  let lastAt = started;
  const platforms = (args.platforms ?? "tiktok,douyin").split(",");
  const json = (name: string, value: any) => {
    writeFileSync(`${out}/${name}.tmp`, JSON.stringify(value, null, 2));
    renameSync(`${out}/${name}.tmp`, `${out}/${name}`);
  };
  writeFileSync(`${out}/pid`, String(process.pid));
  console.log(
    JSON.stringify({
      pid: process.pid,
      startedAt: new Date(started).toISOString(),
      out,
      duration,
      interval,
    }),
  );
  while (true) {
    const at = Date.now();
    const s: Sample = {
      at,
      ok: true,
      uptime: 0,
      pid: 0,
      rssKb: 0,
      rooms: [],
      groups: [],
      queue: [],
      errors: [],
      dbBytes: 0,
    };
    try {
      const results = await Promise.all([
        fetch("http://127.0.0.1:8890/api/v1/health", {
          signal: AbortSignal.timeout(5000),
        }),
        fetch("http://127.0.0.1:8890/api/v1/state", {
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        }),
      ]);
      if (results.some((r) => !r.ok))
        throw new Error(`HTTP ${results.map((r) => r.status).join(",")}`);
      const health: any = await results[0].json(),
        state: any = await results[1].json();
      s.uptime = health.uptime;
      s.rooms = (state.rooms ?? [])
        .filter((r: any) => r.enabled)
        .map((r: any) => ({
          id: r.id,
          platform: r.platform,
          status: r.status,
          error: r.error,
          sessionId: r.sessionId,
        }));
      s.pid = Number(readFileSync(`${root}/var/instance.lock`, "utf8"));
      s.rssKb = Number(
        execFileSync("ps", ["-o", "rss=", "-p", String(s.pid)], {
          encoding: "utf8",
        }).trim(),
      );
      if (!s.pid || !s.rssKb || !Number.isFinite(s.uptime))
        throw new Error("process metric unavailable");
      s.groups = db
        .prepare(
          `SELECT json_extract(data,'$.platform') platform,json_extract(data,'$.roomId') roomId,json_extract(data,'$.type') type,json_extract(data,'$.giftId') giftId,json_extract(data,'$.giftName') giftName,COUNT(*) n,MIN(at) firstAt,MAX(at) lastAt,SUM(CASE WHEN json_extract(data,'$.identityReliable')=0 THEN 1 ELSE 0 END) identityUnverified FROM events WHERE at>? AND at<=? AND json_extract(data,'$.origin')='live' AND COALESCE(json_extract(data,'$.historical'),0)=0 GROUP BY platform,roomId,type,giftId,giftName`,
        )
        .all(lastAt, at);
      s.queue = db
        .prepare(
          `SELECT json_extract(data,'$.status') status,json_extract(data,'$.action') action,COUNT(*) n,MIN(at) oldestAt FROM jobs GROUP BY status,action`,
        )
        .all();
      s.dbBytes = statSync(`${root}/var/studio.sqlite3`).size;
    } catch (e: any) {
      s.ok = false;
      s.errors.push(e.message);
    }
    samples.push(s);
    lastAt = at;
    appendFileSync(`${out}/samples.jsonl`, JSON.stringify(s) + "\n");
    const report: any = {
      pid: process.pid,
      startedAt: new Date(started).toISOString(),
      lastAt: new Date(at).toISOString(),
      intervalSeconds: interval,
      expectedEndAt: new Date(started + duration * 1000).toISOString(),
      scope:
        "Read-only real live events; no simulated injection, room writes or print requests. sampled continuity, not proof of between-sample connection or gift correctness.",
      service: assess(samples, duration, interval, []),
      dualPlatform30min: assess(
        samples.filter((x) => x.at <= started + 1800000),
        1800,
        interval,
        platforms,
      ),
      liveDuringFullRun: assess(samples, duration, interval, platforms),
      samples: samples.length,
      rssKb: {
        start: samples[0].rssKb,
        current: s.rssKb,
        max: Math.max(...samples.map((x) => x.rssKb)),
      },
      queue: s.queue,
    };
    // Include the first sample at or beyond the 30-minute boundary exactly once.
    const boundary = samples.findIndex((x) => x.at - started >= 1800000);
    if (boundary >= 0)
      report.dualPlatform30min = assess(
        samples.slice(0, boundary + 1),
        1800,
        interval,
        platforms,
      );
    json("report.json", report);
    if (at - samples[0].at >= duration * 1000) {
      console.log(JSON.stringify(report));
      break;
    }
    await new Promise((r) =>
      setTimeout(
        r,
        Math.min(
          interval * 1000,
          Math.max(1, samples[0].at + duration * 1000 - Date.now()),
        ),
      ),
    );
  }
  db.close();
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
