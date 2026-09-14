import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const token = readFileSync("var/admin-token", "utf8").trim();
const start = Date.now(),
  minutes = Number(process.argv[2] ?? 120);
const samples: any[] = [];
mkdirSync("var/evidence", { recursive: true });
for (let n = 0; n <= minutes; n++) {
  let sample: any = { at: new Date().toISOString() };
  try {
    const r = await fetch("http://127.0.0.1:8890/api/v1/state", {
      headers: { authorization: "Bearer " + token },
      signal: AbortSignal.timeout(5000),
    });
    const d: any = await r.json();
    sample = {
      ...sample,
      ok: r.ok,
      stats: d.stats,
      rooms: d.rooms?.map((x: any) => ({
        platform: x.platform,
        status: x.status,
        capabilities: x.capabilities,
      })),
    };
  } catch (e: any) {
    sample = { ...sample, ok: false, error: e.message };
  }
  try {
    const health: any = await (
      await fetch("http://127.0.0.1:8890/api/v1/health", {
        signal: AbortSignal.timeout(5000),
      })
    ).json();
    sample.uptime = health.uptime;
    sample.restarted =
      samples.length > 0 && health.uptime < samples[samples.length - 1].uptime;
  } catch {
    sample.ok = false;
  }
  samples.push(sample);
  writeFileSync(
    "var/evidence/soak.json",
    JSON.stringify(
      {
        startedAt: new Date(start).toISOString(),
        elapsedSeconds: (Date.now() - start) / 1000,
        completed: n === minutes,
        passed: n === minutes && samples.every((x) => x.ok && !x.restarted),
        scope: "本机服务端点与进程连续性；不替代两平台真实礼物或实体结果",
        restartCount: samples.filter((x) => x.restarted).length,
        healthy: samples.filter((x) => x.ok).length,
        samples,
      },
      null,
      2,
    ),
  );
  if (n < minutes) await new Promise((r) => setTimeout(r, 60000));
}
console.log("soak complete");
