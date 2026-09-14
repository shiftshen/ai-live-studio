import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiBase = "http://127.0.0.1:8890/api/v1";
const appPaths = {
  stage: resolve(root, "var/vendor/AI Live Stage.app"),
  collector: resolve(root, "var/vendor/Dycast AI Live Studio.app"),
  companion: "/Applications/Douyin Webcast Mate.app",
};

export function requestInit(method, token, body) {
  return {
    method,
    headers: {
      authorization: "Bearer " + token,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
export function printerOnline(status) {
  const s = String(status ?? "").toLowerCase();
  return (
    s.includes("online working condition is normal") ||
    s === "online" ||
    s.includes("在线")
  );
}

async function api(path, method = "GET", body) {
  const token = readFileSync(resolve(root, "var/admin-token"), "utf8").trim();
  const response = await fetch(apiBase + path, {
    ...requestInit(method, token, body),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

export async function readiness(deps = {}) {
  const health =
    deps.health ??
    (async () =>
      (await fetch(apiBase + "/health", { signal: AbortSignal.timeout(1500) }))
        .ok);
  const appExists = deps.appExists ?? existsSync;
  const state = deps.state ?? (async () => api("/state"));
  let snapshot = { printers: [], rooms: [] };
  try {
    snapshot = await state();
  } catch {}
  const printer =
    deps.printer ?? (async () => snapshot.printers.find((p) => p.configured));
  const room =
    deps.room ??
    (async () => snapshot.rooms.find((r) => r.platform === "douyin"));
  const p = await printer(),
    r = await room();
  return {
    service: await health().catch(() => false),
    collector:
      appExists(appPaths.collector) &&
      (!r || ["connected", "connecting", "waiting_relay"].includes(r.status)),
    printer: !!p?.configured && !!p?.enabled && printerOnline(p.status),
    camera: appExists(appPaths.companion),
  };
}

async function start() {
  execFileSync(
    process.execPath,
    [resolve(root, "scripts/service.mjs"), "start"],
    { cwd: root, stdio: "inherit" },
  );
  let state = await api("/state");
  const printer = state.printers.find((p) => p.configured);
  const room = state.rooms.find((r) => r.platform === "douyin");
  if (!printer || !room) throw new Error("缺少抖音房间或打印机配置");
  const checked = await api(`/printers/${printer.id}/check`, "POST");
  if (!printerOnline(checked.status))
    throw new Error("打印机不在线，已停止恢复直播动作");
  await api(`/printers/${printer.id}`, "PATCH", { enabled: true });
  await api(`/rooms/${room.id}`, "PATCH", {
    printerId: printer.id,
    enabled: true,
  });
  await api("/settings", "POST", { paused: false, physicalTestMode: false });
  await api(`/rooms/${room.id}/connect`, "POST");
  for (const p of [appPaths.stage, appPaths.collector, appPaths.companion])
    if (existsSync(p)) execFileSync("open", [p]);
  console.log(JSON.stringify(await readiness(), null, 2));
  console.log(
    "本地工具已启动。四项均为 true 后，在直播伴侣检查摄像头画面并点击开始直播。",
  );
}

async function diagnose() {
  const state = await api("/state");
  const printer = state.printers.find((p) => p.configured);
  if (printer) await api(`/printers/${printer.id}/check`, "POST");
  console.log(JSON.stringify(await readiness(), null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const action = process.argv[2] ?? "start";
  if (action === "start") await start();
  else if (action === "diagnose") await diagnose();
  else if (action === "stop")
    execFileSync(
      process.execPath,
      [resolve(root, "scripts/service.mjs"), "stop"],
      { cwd: root, stdio: "inherit" },
    );
  else throw new Error("用法: live-control.mjs start|diagnose|stop");
}
