import { registerDeliveryRoutes } from "./routes/delivery.ts";
import { registerOperationsRoutes } from "./routes/operations.ts";
import { registerDevicesRoutes } from "./routes/devices.ts";
import { registerManagementRoutes } from "./routes/management.ts";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import staticPlugin from "@fastify/static";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { Store } from "./store.ts";
import { Engine } from "./engine.ts";
import { Worker } from "./worker.ts";
import { Secrets } from "./providers.ts";
import { Adapters } from "./adapters.ts";
import { registerAuth } from "./auth.ts";
import { registerDataRoutes } from "./routes/data.ts";
export async function createApp(
  opts: { dir?: string; workers?: boolean; bootstrapToken?: string } = {},
) {
  const dir = resolve(opts.dir ?? "var");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const sub of ["media", "backups", "secrets"])
    mkdirSync(join(dir, sub), { recursive: true, mode: 0o700 });
  const s = new Store(join(dir, "studio.sqlite3"));
  if (s.setting("config").physicalTestMode === undefined)
    s.setting("config", { ...s.setting("config"), physicalTestMode: true });
  for (const printer of s.list("printers"))
    if (printer.renderLanguage === undefined)
      s.put("printers", { ...printer, renderLanguage: "Thai" });
  const engine = new Engine(s);
  const secrets = new Secrets(join(dir, "secrets"));
  const worker = new Worker(s, secrets, join(dir, "media"));
  const adapters = new Adapters(s, engine);
  const adminPath = join(dir, "admin-token");
  if (!existsSync(adminPath))
    writeFileSync(
      adminPath,
      opts.bootstrapToken ?? randomBytes(32).toString("hex"),
      { mode: 0o600 },
    );
  const adminToken = readFileSync(adminPath, "utf8").trim();
  const app = Fastify({ logger: false, bodyLimit: 256 * 1024 });
  await app.register(websocket, { options: { maxPayload: 256 * 1024 } });
  const { auth, roomAllowed, requireRoom, admin } = registerAuth(
    app,
    s,
    adminToken,
  );
  registerDataRoutes({ app, s, roomAllowed, requireRoom });
  app.get("/api/v1/stream", (req: any, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = () =>
      reply.raw.write(`data: ${JSON.stringify({ at: Date.now() })}\n\n`);
    send();
    const timer = setInterval(send, 3000);
    req.raw.on("close", () => clearInterval(timer));
    reply.hijack();
  });
  registerManagementRoutes({
    app,
    s,
    engine,
    worker,
    secrets,
    adapters,
    dir,
    auth,
    roomAllowed,
    requireRoom,
    admin,
  });
  registerDevicesRoutes({
    app,
    s,
    engine,
    worker,
    secrets,
    adapters,
    dir,
    auth,
    roomAllowed,
    requireRoom,
    admin,
  });
  registerOperationsRoutes({
    app,
    s,
    engine,
    worker,
    secrets,
    adapters,
    dir,
    auth,
    roomAllowed,
    requireRoom,
    admin,
  });
  registerDeliveryRoutes({
    app,
    s,
    engine,
    worker,
    secrets,
    adapters,
    dir,
    auth,
    roomAllowed,
    requireRoom,
    admin,
  });
  const dist = resolve("dist");
  if (existsSync(dist)) {
    await app.register(staticPlugin, { root: dist });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/")
        ? reply.code(404).send({ error: "接口不存在" })
        : reply.sendFile("index.html"),
    );
  }
  let maintenance: ReturnType<typeof setInterval> | undefined;
  if (opts.workers !== false) {
    worker.start();
    maintenance = setInterval(() => {
      engine.expireStreaks();
      const cfg = s.setting("config");
      const now = Date.now();
      for (const [table, days] of [
        ["events", cfg.eventRetentionDays],
        ["jobs", cfg.jobRetentionDays],
      ] as const) {
        s.db
          .prepare(
            `DELETE FROM ${table} WHERE at<? ${table === "events" ? "AND NOT EXISTS (SELECT 1 FROM jobs WHERE json_extract(jobs.data,'$.eventId')=events.id AND json_extract(jobs.data,'$.status') NOT IN ('completed','cancelled','dry_run','failed','expired'))" : ""} ${table === "jobs" ? "AND json_extract(data,'$.status') IN ('completed','cancelled','dry_run','failed','expired')" : ""}`,
          )
          .run(now - days * 86400000);
      }
      s.db
        .prepare(
          "DELETE FROM feedback WHERE at<? AND NOT EXISTS (SELECT 1 FROM jobs WHERE (jobs.id=feedback.id OR json_extract(jobs.data,'$.eventId')||':'||json_extract(jobs.data,'$.ruleId')=feedback.id) AND json_extract(jobs.data,'$.status') NOT IN ('completed','cancelled','dry_run','failed','expired'))",
        )
        .run(now - cfg.jobRetentionDays * 86400000);
      s.db
        .prepare("DELETE FROM audits WHERE at<?")
        .run(now - cfg.jobRetentionDays * 86400000);
      for (const f of readdirSync(join(dir, "media"))) {
        if (f.startsWith("fallback-")) continue;
        const file = join(dir, "media", f);
        if (now - statSync(file).mtimeMs > cfg.avatarRetentionHours * 3600000) {
          const inUse = s.db
            .prepare(
              "SELECT 1 FROM jobs WHERE json_extract(data,'$.status') IN ('pending','ready','sending','accepted','unknown','held','blocked') AND (json_extract(data,'$.mediaUrl')=? OR json_extract(data,'$.avatar')=?) LIMIT 1",
            )
            .get("/api/v1/media/" + f, "/api/v1/media/" + f);
          if (!inUse) unlinkSync(file);
        }
      }
    }, 60000);
  }
  app.addHook("onClose", async () => {
    await worker.stop();
    if (maintenance) clearInterval(maintenance);
    for (const id of [...adapters.connections.keys()])
      await adapters.disconnect(id);
    s.close();
  });
  return { app, store: s, engine, worker, secrets, adapters, adminToken, dir };
}
