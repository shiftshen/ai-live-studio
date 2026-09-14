import {
  existsSync,
  renameSync,
  copyFileSync,
  unlinkSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve, join } from "node:path";
import { createApp } from "./app.ts";
const dir = resolve(process.env.STUDIO_DATA_DIR ?? "var");
mkdirSync(dir, { recursive: true, mode: 0o700 });
const lock = join(dir, "instance.lock");
if (existsSync(lock)) {
  let running = false;
  try {
    process.kill(Number(readFileSync(lock, "utf8")), 0);
    running = true;
  } catch {}
  if (running) throw Error("同一数据目录已有运行实例");
  unlinkSync(lock);
}
writeFileSync(lock, String(process.pid), { flag: "wx", mode: 0o600 });
const release = () => {
  if (existsSync(lock) && readFileSync(lock, "utf8") === String(process.pid))
    unlinkSync(lock);
};
process.on("exit", release);
const pending = join(dir, "restore-pending.sqlite3");
if (existsSync(pending)) {
  const db = join(dir, "studio.sqlite3");
  if (existsSync(db))
    copyFileSync(db, join(dir, `before-restore-${Date.now()}.sqlite3`));
  for (const suffix of ["-wal", "-shm"])
    if (existsSync(db + suffix)) unlinkSync(db + suffix);
  renameSync(pending, db);
}
const studio = await createApp({ dir });
try {
  await studio.app.listen({
    host: "127.0.0.1",
    port: Number(process.env.PORT ?? 8890),
  });
  console.log(
    "AI Live Studio ready on http://127.0.0.1:" +
      String(process.env.PORT ?? 8890),
  );
} catch (e: any) {
  console.error("启动失败：" + e.message);
  await studio.app.close();
  process.exit(1);
}
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void studio.app.close().then(() => process.exit(0));
  });
