import { randomBytes, createHash } from "node:crypto";
import { existsSync, copyFileSync } from "node:fs";
import { join, basename } from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { Store } from "../store.ts";
import { generateSpeech } from "../providers.ts";
import { id } from "../schemas.ts";
import { z } from "zod";
import type { RouteContext } from "./context.ts";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function registerOperationsRoutes(ctx: RouteContext) {
  const { app, s, worker, adapters, dir, requireRoom, admin } = ctx;
  app.post("/api/v1/backup", async (req: any) => {
    admin(req);
    const name = `studio-${Date.now()}.sqlite3`;
    await backup(s.db, join(dir, "backups", name));
    s.audit("backup.create", name, null, req.auth.id);
    return { name };
  });
  app.post("/api/v1/restore", async (req: any) => {
    admin(req);
    const { name } = z
      .object({ name: z.string().regex(/^studio-\d+\.sqlite3$/) })
      .parse(req.body);
    if (!s.setting("config").paused || worker.busy || adapters.connections.size)
      throw Error("恢复前请暂停动作并断开所有房间");
    const file = join(dir, "backups", name);
    if (!existsSync(file)) throw Error("备份不存在");
    const db = new DatabaseSync(file, { readOnly: true });
    try {
      if (
        (db.prepare("PRAGMA integrity_check").get() as any).integrity_check !==
        "ok"
      )
        throw Error("备份校验失败");
      db.prepare("SELECT version FROM migrations").get();
    } finally {
      db.close();
    }
    copyFileSync(file, join(dir, "restore-pending.sqlite3"));
    const restored = new Store(join(dir, "restore-pending.sqlite3"));
    restored.setting(
      "testPages",
      Math.max(s.setting("testPages") ?? 0, restored.setting("testPages") ?? 0),
    );
    restored.setting("config", { ...restored.setting("config"), paused: true });
    restored.db
      .prepare(
        `UPDATE jobs SET data=json_set(data,'$.status',CASE WHEN json_extract(data,'$.action')='print' THEN 'unknown' ELSE 'cancelled' END,'$.error','从备份恢复，旧任务不自动重发') WHERE COALESCE(json_extract(data,'$.status'),'') NOT IN ('completed','cancelled','dry_run','failed')`,
      )
      .run();
    // Restore business state without erasing audit evidence accumulated since the backup.
    const append = restored.db.prepare(
      `INSERT INTO audits(at,actor,action,detail,roomId) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM audits WHERE at=? AND actor IS ? AND action IS ? AND detail IS ? AND roomId IS ?)`,
    );
    restored.tx(() => {
      for (const audit of s.db
        .prepare("SELECT at,actor,action,detail,roomId FROM audits ORDER BY id")
        .all() as any[]) {
        const values = [
          audit.at,
          audit.actor,
          audit.action,
          audit.detail,
          audit.roomId,
        ];
        append.run(...values, ...values);
      }
    });
    restored.audit("backup.restore_requested", name, null, req.auth.id);
    restored.db.exec("DELETE FROM sessions");
    restored.close();
    s.audit("backup.restore_requested", name, null, req.auth.id);
    return { ok: true, restartRequired: true };
  });
  app.get("/api/v1/diagnostics", async (req: any) => {
    const checks: any[] = [
      { name: "数据库", status: "ok", detail: "SQLite WAL · 本地持久化" },
      {
        name: "实体头像打印",
        status: s.list("printers").some((p) => p.imageSupported)
          ? "configured"
          : "unverified",
        detail: "普通小票机未验证动态图片能力",
      },
      {
        name: "TikTok签名",
        status: process.env.EULER_API_KEY ? "configured" : "unverified",
        detail: process.env.EULER_API_KEY
          ? "签名密钥已配置"
          : "当前未配置专用签名密钥；不转发登录Cookie",
      },
      {
        name: "OmniVoice",
        status: existsSync(
          "/Users/shift/openclaw/scripts/omnivoice_local_tts.py",
        )
          ? "configured"
          : "missing",
        detail: "本地按需生成，15秒回退",
      },
    ];
    try {
      const r = await fetch("http://127.0.0.1:11434/api/tags", {
        signal: AbortSignal.timeout(1500),
      });
      checks.push({
        name: "Ollama",
        status: r.ok ? "ok" : "error",
        detail: r.ok ? "本地服务可访问" : "服务异常",
      });
    } catch {
      checks.push({
        name: "Ollama",
        status: "error",
        detail: "本地服务不可访问",
      });
    }
    return { checks };
  });
  app.post("/api/v1/speech/preview", async (req: any) => {
    const b = z
      .object({ roomId: id, text: z.string().min(1).max(80) })
      .parse(req.body);
    requireRoom(req, b.roomId);
    const room = s.get("rooms", b.roomId);
    try {
      const file = await generateSpeech(
        b.text,
        room.language,
        room.voice,
        join(dir, "media"),
      );
      s.setting("media:" + basename(file), b.roomId);
      return { url: "/api/v1/media/" + basename(file), status: "ready" };
    } catch {
      return {
        url: null,
        status: "failed",
        error: "本地语音15秒内未完成，请查看预生成音频与模型状态",
      };
    }
  });
  app.get("/api/v1/access", (req: any) => {
    admin(req);
    return s
      .list("access")
      .map(({ id, ...a }) => ({ ...a, id: id.slice(0, 8) }));
  });
  app.post("/api/v1/access", (req: any) => {
    admin(req);
    const data = z
      .object({
        role: z.enum(["operator", "viewer"]),
        roomIds: z.array(id).min(1),
      })
      .parse(req.body);
    if (data.roomIds.some((i) => !s.get("rooms", i))) throw Error("房间不存在");
    const token = randomBytes(32).toString("hex");
    s.put("access", { id: hash(token), ...data });
    return { token };
  });
}
