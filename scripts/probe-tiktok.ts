import { TikTokLiveConnection } from "tiktok-live-connector";
import { writeFileSync, mkdirSync } from "node:fs";
const c: any = new TikTokLiveConnection(process.argv[2] ?? "boomjobjab", {
  processInitialData: false,
  authenticateWs: false,
  fetchRoomInfoOnConnect: true,
  webClientOptions: { timeout: { request: 10000 } } as any,
});
const report: any = {
  startedAt: new Date().toISOString(),
  username: process.argv[2] ?? "boomjobjab",
  events: {},
  status: "connecting",
};
c.on("error", () => {});
for (const event of ["chat", "gift", "member", "like", "follow"])
  c.on(event, (data: any) => {
    report.events[event] = (report.events[event] ?? 0) + 1;
    report.lastShape = Object.keys(data).filter(
      (k) => !/cookie|token/i.test(k),
    );
  });
const timer = setTimeout(() => void c.disconnect(), 40000);
try {
  await c.connect();
  report.status = "connected";
  await new Promise((r) => setTimeout(r, 15000));
} catch (e: any) {
  report.status = "failed";
  report.error = String(e.message)
    .replace(/https?:\/\/\S+/g, "[service]")
    .slice(0, 500);
} finally {
  clearTimeout(timer);
  await c.disconnect();
  report.endedAt = new Date().toISOString();
  mkdirSync("var/evidence", { recursive: true });
  writeFileSync(
    "var/evidence/tiktok-probe.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  process.exit(0);
}
