import { randomBytes, randomUUID } from "node:crypto";
import { roomAddress } from "../adapters.ts";
import { id, roomSchema, ruleSchema, templateSchema } from "../schemas.ts";
import { z } from "zod";
import type { RouteContext } from "./context.ts";
export function registerManagementRoutes(ctx: RouteContext) {
  const { app, s, engine, adapters, requireRoom, admin } = ctx;
  app.post("/api/v1/rooms", (req: any) => {
    admin(req);
    const data = roomSchema.parse(req.body);
    if (data.address) roomAddress(data.platform, data.address);
    if (data.printerId && !s.get("printers", data.printerId))
      throw Error("打印机不存在");
    const room = {
      ...data,
      id: randomUUID(),
      sessionId: randomUUID(),
      status: "disconnected",
      error: null,
      overlayToken: randomBytes(24).toString("hex"),
      capabilities: {
        comment: "unverified",
        gift: "unverified",
        join: "unverified",
        follow: "unverified",
        like: "unverified",
      },
    };
    s.put("rooms", room);
    s.audit("room.create", room.name, room.id, req.auth.id);
    return room;
  });
  app.patch("/api/v1/rooms/:id", async (req: any) => {
    const rid = req.params.id;
    requireRoom(req, rid);
    const old = s.get("rooms", rid);
    const parsedPatch = roomSchema.partial().parse(req.body);
    // Zod defaults still apply inside optional fields: PATCH must retain omitted values.
    const patch = Object.fromEntries(
      Object.entries(parsedPatch).filter(([key]) =>
        Object.hasOwn(req.body, key),
      ),
    ) as typeof parsedPatch;
    if (patch.platform && patch.platform !== old.platform)
      throw Error("平台不可修改，请新建房间");
    if (patch.address) roomAddress(old.platform, patch.address);
    if (patch.printerId !== undefined && patch.printerId !== old.printerId)
      admin(req);
    if (patch.printerId && !s.get("printers", patch.printerId))
      throw Error("打印机不存在");
    const changedAddress =
      patch.address !== undefined && patch.address !== old.address;
    if (changedAddress) await adapters.disconnect(rid);
    const room = {
      ...s.get("rooms", rid),
      ...patch,
      ...(changedAddress
        ? {
            sessionId: randomUUID(),
            capabilities: {
              comment: "unverified",
              gift: "unverified",
              join: "unverified",
              follow: "unverified",
              like: "unverified",
            },
          }
        : {}),
    };
    s.put("rooms", room);
    s.audit("room.update", room.name, rid, req.auth.id);
    return room;
  });
  for (const action of ["connect", "disconnect", "new-session"])
    app.post(`/api/v1/rooms/:id/${action}`, async (req: any) => {
      requireRoom(req, req.params.id);
      const rid = req.params.id;
      if (action === "connect") {
        const room = s.get("rooms", rid);
        roomAddress(room.platform, room.address);
        void adapters.connect(rid).catch(() => {});
      } else if (action === "disconnect") await adapters.disconnect(rid);
      else {
        await adapters.disconnect(rid);
        const room = s.get("rooms", rid);
        s.put("rooms", { ...room, sessionId: randomUUID() });
      }
      s.audit("room." + action, "", rid, req.auth.id);
      return { ok: true };
    });
  app.post("/api/v1/rules", (req: any) => {
    const rule = ruleSchema.parse(req.body);
    requireRoom(req, rule.roomId);
    if (!s.get("templates", rule.templateId)) throw Error("模板不存在");
    return s.put("rules", { ...rule, id: randomUUID(), version: 1 });
  });
  app.patch("/api/v1/rules/:id", (req: any) => {
    const old = s.get("rules", req.params.id);
    if (!old) throw Error("规则不存在");
    requireRoom(req, old.roomId);
    const rule = ruleSchema.parse({ ...old, ...req.body, roomId: old.roomId });
    if (!s.get("templates", rule.templateId)) throw Error("模板不存在");
    s.audit("rule.update", rule.name, rule.roomId, req.auth.id);
    return s.put("rules", { ...rule, id: old.id, version: old.version + 1 });
  });
  app.delete("/api/v1/rules/:id", (req: any) => {
    const old = s.get("rules", req.params.id);
    if (!old) throw Error("规则不存在");
    requireRoom(req, old.roomId);
    s.delete("rules", old.id);
    s.audit("rule.delete", old.name, old.roomId, req.auth.id);
    return { ok: true };
  });
  app.post("/api/v1/templates", (req: any) => {
    admin(req);
    return s.put("templates", {
      ...templateSchema.parse(req.body),
      id: randomUUID(),
      version: 1,
    });
  });
  app.patch("/api/v1/templates/:id", (req: any) => {
    admin(req);
    const old = s.get("templates", req.params.id);
    if (!old) throw Error("模板不存在");
    const data = templateSchema.parse({ ...old, ...req.body });
    s.audit("template.update", data.name, null, req.auth.id);
    return s.put("templates", {
      ...data,
      id: old.id,
      version: old.version + 1,
    });
  });
  const sample = (req: any) => {
    requireRoom(req, req.body.roomId);
    const room = s.get("rooms", req.body.roomId);
    return {
      ...req.body,
      roomId: room.id,
      sessionId: room.sessionId,
      platform: room.platform,
      sourceId: randomUUID(),
      userId: req.body.userId || "simulated-user",
      origin: "simulated",
      occurredAt: Date.now(),
    };
  };
  app.post("/api/v1/preview", (req: any) => {
    const { matches, reasons } = engine.preview(sample(req));
    return {
      matches: matches.map(({ rule, template, cooldownKey, ...m }) => m),
      reasons,
    };
  });
  app.post("/api/v1/simulate", (req: any) => engine.ingest(sample(req)));
  app.post("/api/v1/replay", (req: any) => {
    const b = z
      .object({ roomId: id, eventIds: z.array(id).min(1).max(100) })
      .parse(req.body);
    requireRoom(req, b.roomId);
    const room = s.get("rooms", b.roomId);
    return {
      results: b.eventIds.map((i) => {
        const e = s.get("events", i);
        if (!e || e.roomId !== room.id) throw Error("事件不属于此房间");
        return engine.ingest({
          ...e,
          id: undefined,
          sessionId: room.sessionId,
          sourceId: randomUUID(),
          origin: "replay",
          historical: false,
        });
      }),
    };
  });
  app.post("/api/v1/settings", (req: any) => {
    admin(req);
    const p = z
      .object({
        paused: z.boolean(),
        physicalTestMode: z.boolean(),
        printRate: z.number().int().min(1).max(60),
        printQueueLimit: z.number().int().min(1).max(1000),
        eventRetentionDays: z.number().int().min(1).max(365),
        jobRetentionDays: z.number().int().min(1).max(3650),
        avatarRetentionHours: z.number().int().min(1).max(168),
        aiModel: z.string().min(1).max(120),
        aiUrl: z.enum(["http://127.0.0.1:11434", "http://localhost:11434"]),
        speechVolume: z.number().min(0).max(1),
        speechRate: z.number().min(0.5).max(2),
      })
      .partial()
      .parse(req.body);
    const cfg = { ...s.setting("config"), ...p };
    s.setting("config", cfg);
    s.audit("settings.update", Object.keys(p).join(","), null, req.auth.id);
    return { ok: true };
  });
  // Call within the same transaction that admits the pending task.
  const requirePrintQueueSlot = (job: any) => {
    const queued = s.db
      .prepare(
        "SELECT COUNT(*) n FROM jobs WHERE id!=? AND json_extract(data,'$.action')='print' AND COALESCE(json_extract(data,'$.printerId'),'')=? AND json_extract(data,'$.status') IN ('pending','sending','processing','accepted')",
      )
      .get(job.id, job.printerId ?? "") as { n: number };
    if (queued.n >= s.setting("config").printQueueLimit)
      throw Object.assign(Error("打印队列已满，请处理积压后再重试或补打"), {
        statusCode: 409,
      });
  };
  for (const action of ["cancel", "retry", "reprint"])
    app.post(`/api/v1/jobs/:id/${action}`, (req: any) => {
      const job = s.get("jobs", req.params.id);
      if (!job) throw Error("任务不存在");
      requireRoom(req, job.roomId);
      if (action === "cancel") {
        if (["sending", "accepted", "completed"].includes(job.status))
          throw Error("已发送任务不可取消");
        s.put("jobs", { ...job, status: "cancelled", updatedAt: Date.now() });
      } else if (action === "retry") {
        if (
          job.action === "print" &&
          ["unknown", "accepted", "completed", "sending", "dry_run"].includes(
            job.status,
          )
        )
          throw Error("此打印结果不能自动重试；明确需要时使用补打");
        if (!["failed", "blocked", "held"].includes(job.status))
          throw Error("任务不需要重试");
        s.tx(() => {
          if (job.action === "print") requirePrintQueueSlot(job);
          s.put("jobs", {
            ...job,
            status: "pending",
            error: null,
            updatedAt: Date.now(),
          });
        });
      } else {
        admin(req);
        if (job.action !== "print" || job.origin !== "live")
          throw Error("只允许补打真实直播打印任务");
        const { reason } = z
          .object({ reason: z.string().trim().min(3).max(300) })
          .parse(req.body);
        if (!["unknown", "failed", "completed"].includes(job.status))
          throw Object.assign(
            Error("原打印任务尚未结束，请等待结果或使用普通重试"),
            {
              statusCode: 409,
            },
          );
        s.tx(() => {
          requirePrintQueueSlot(job);
          s.put("jobs", {
            ...job,
            id: randomUUID(),
            reprintReason: reason,
            testPageReserved: false,
            status: "pending",
            parentId: job.id,
            providerId: null,
            error: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });
      }
      s.audit("job." + action, job.id, job.roomId, req.auth.id);
      return { ok: true };
    });
}
