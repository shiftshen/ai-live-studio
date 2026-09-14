import { randomUUID } from "node:crypto";
import { feieCall } from "../providers.ts";
import { id } from "../schemas.ts";
import { z } from "zod";
import type { RouteContext } from "./context.ts";
export function registerDevicesRoutes(ctx: RouteContext) {
  const { app, s, secrets, requireRoom, admin } = ctx;
  app.post("/api/v1/printers", (req: any) => {
    admin(req);
    const b = z
      .object({
        name: z.string().min(1).max(80),
        sn: z.string().regex(/^\d{8,15}$/),
        user: z.string().min(1).max(150),
        ukey: z.string().min(1).max(150),
        apiBase: z
          .enum([
            "https://api.jp.feieyun.com/Api/Open/",
            "https://api.feieyun.cn/Api/Open/",
          ])
          .default("https://api.jp.feieyun.com/Api/Open/"),
        paperWidth: z.union([z.literal(58), z.literal(80)]).default(58),
        imageSupported: z.boolean().default(false),
        renderLanguage: z.enum(["Thai", "default"]).default("Thai"),
      })
      .parse(req.body);
    const pid = randomUUID();
    secrets.set(pid, b);
    return s.put("printers", {
      id: pid,
      name: b.name,
      snLast4: b.sn.slice(-4),
      configured: true,
      status: "unverified",
      imageSupported: b.imageSupported,
      renderLanguage: b.renderLanguage,
      paperWidth: b.paperWidth,
      enabled: true,
      lastChecked: null,
      error: null,
    });
  });
  app.patch("/api/v1/printers/:id", (req: any) => {
    admin(req);
    const p = s.get("printers", req.params.id);
    if (!p) throw Error("打印机不存在");
    const data = z
      .object({
        name: z.string().min(1).max(80),
        enabled: z.boolean(),
        imageSupported: z.boolean(),
        renderLanguage: z.enum(["Thai", "default"]),
        paperWidth: z.union([z.literal(58), z.literal(80)]),
      })
      .partial()
      .parse(req.body);
    return s.put("printers", { ...p, ...data });
  });
  app.post("/api/v1/printers/:id/check", async (req: any) => {
    admin(req);
    const p = s.get("printers", req.params.id);
    const key = secrets.get(req.params.id);
    if (!p || !key) throw Error("缺少打印配置");
    try {
      const data = await feieCall(key, "Open_queryPrinterStatus");
      s.put("printers", {
        ...p,
        status: String(data),
        lastChecked: Date.now(),
        error: null,
      });
    } catch (e: any) {
      s.put("printers", {
        ...p,
        status: "error",
        lastChecked: Date.now(),
        error: e.message,
      });
    }
    return s.get("printers", p.id);
  });
  app.post("/api/v1/printers/:id/test", (req: any) => {
    admin(req);
    const p = s.get("printers", req.params.id);
    if (!p?.enabled || !secrets.get(p.id)) throw Error("打印机未就绪");
    const b = z
      .object({
        text: z.string().min(1).max(400),
        language: z.enum(["zh", "th", "en"]).default("zh"),
      })
      .parse(req.body);
    const n = s.setting("testPages") ?? 0;
    if (n >= 10) throw Error("本次实施10张测试额度已用完");
    const job = {
      id: randomUUID(),
      roomId: s.list("rooms")[0].id,
      sessionId: "device-test",
      eventId: "device-test",
      ruleId: "device-test",
      ruleVersion: 1,
      templateVersion: 1,
      action: "print",
      status: "pending",
      content: b.text,
      nickname: "设备测试",
      avatar: null,
      origin: "simulated",
      explicitTest: true,
      testPageReserved: true,
      priority: 100,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      error: null,
      providerId: null,
      parentId: null,
      printerId: p.id,
      language: b.language,
      ai: false,
      needsAvatar: false,
    };
    s.tx(() => {
      s.setting("testPages", n + 1);
      s.put("jobs", job);
      s.audit("printer.test", job.id, null, req.auth.id);
    });
    return job;
  });
  for (const method of ["post", "delete"] as const)
    app[method]("/api/v1/blocked-users", (req: any) => {
      const b = z.object({ roomId: id, userId: id }).parse(req.body);
      requireRoom(req, b.roomId);
      const key = b.roomId + ":" + b.userId;
      if (method === "post") s.put("blockedUsers", { id: key, ...b });
      else s.delete("blockedUsers", key);
      return { ok: true };
    });
}
