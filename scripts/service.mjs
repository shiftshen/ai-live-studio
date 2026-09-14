import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  openSync,
  unlinkSync,
} from "node:fs";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const pidfile = resolve(root, "var/server.pid");
mkdirSync(resolve(root, "var"), { recursive: true, mode: 0o700 });
let pid = existsSync(pidfile) ? Number(readFileSync(pidfile, "utf8")) : 0;
let alive = false;
try {
  if (pid) {
    process.kill(pid, 0);
    alive = true;
  }
} catch {}
if (process.argv[2] === "stop") {
  if (alive) {
    process.kill(pid, "SIGTERM");
    const until = Date.now() + 45000;
    while (Date.now() < until) {
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (alive) {
      console.error("服务仍在完成当前任务，未强制终止；请稍后再次检查");
      process.exit(1);
    }
  }
  if (existsSync(pidfile)) unlinkSync(pidfile);
  console.log("服务已停止");
} else if (alive) {
  console.log("服务已在运行：http://127.0.0.1:8890");
} else {
  const log = openSync(resolve(root, "var/server.log"), "a", 0o600);
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "src/server/index.ts"],
    { cwd: root, detached: true, stdio: ["ignore", log, log] },
  );
  writeFileSync(pidfile, String(child.pid), { mode: 0o600 });
  child.unref();
  let ready = false;
  for (let n = 0; n < 50; n++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      process.kill(child.pid, 0);
    } catch {
      break;
    }
    if (
      existsSync(resolve(root, "var/instance.lock")) &&
      readFileSync(resolve(root, "var/instance.lock"), "utf8") ===
        String(child.pid)
    ) {
      try {
        const r = await fetch(
          "http://127.0.0.1:" + (process.env.PORT ?? 8890) + "/api/v1/health",
          { signal: AbortSignal.timeout(500) },
        );
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
    }
  }
  if (!ready) {
    console.error("启动尚未就绪，请检查 " + resolve(root, "var/server.log"));
    process.exitCode = 1;
  } else
    console.log("服务已就绪：http://127.0.0.1:" + (process.env.PORT ?? 8890));
}
