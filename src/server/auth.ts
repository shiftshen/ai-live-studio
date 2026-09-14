import type { FastifyInstance } from "fastify";
import type { Store } from "./store.ts";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function registerAuth(
  app: FastifyInstance,
  s: Store,
  adminToken: string,
) {
  const failures = new Map<string, { count: number; at: number }>();
  const auth = (req: any) => {
    let token = req.headers.authorization?.replace(/^Bearer /, "");
    if (!token) {
      const cookie = req.headers.cookie
        ?.split(";")
        .map((x: string) => x.trim())
        .find((x: string) => x.startsWith("studio="));
      token = cookie?.slice(7);
      if (token) {
        const session = s.get("sessions", hash(token));
        if (session && session.expires > Date.now())
          token = session.accessToken;
        else token = null;
      }
    }
    if (!token) return null;
    if (hash(token) === hash(adminToken))
      return { id: "owner", role: "admin", roomIds: null };
    return s.get("access", hash(token)) ?? null;
  };
  const roomAllowed = (a: any, roomId: string) =>
    a?.role === "admin" || a?.roomIds?.includes(roomId);
  const requireRoom = (req: any, roomId: string) => {
    if (!roomAllowed(req.auth, roomId))
      throw Object.assign(Error("无权访问此房间"), { statusCode: 403 });
    if (!s.get("rooms", roomId))
      throw Object.assign(Error("房间不存在"), { statusCode: 404 });
  };
  const admin = (req: any) => {
    if (req.auth.role !== "admin")
      throw Object.assign(Error("需要管理员权限"), { statusCode: 403 });
  };
  app.addHook("onRequest", async (req: any, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "no-referrer");
    const url = req.url.split("?")[0];
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin);
      const nativeRelay =
        url.startsWith("/api/v1/relay/") &&
        [
          "tauri://localhost",
          "http://tauri.localhost",
          "https://live.douyin.com",
        ].includes(req.headers.origin);
      if (!nativeRelay && origin.host !== req.headers.host)
        return reply.code(403).send({ error: "拒绝跨站请求" });
    }
    if (!url.startsWith("/api/")) return;
    if (
      url === "/api/v1/login" ||
      url === "/api/v1/session" ||
      url === "/api/v1/health" ||
      url.startsWith("/api/v1/overlay/") ||
      url.startsWith("/api/v1/relay/") ||
      url.startsWith("/api/v1/media/")
    )
      return;
    req.auth = auth(req);
    if (!req.auth) return reply.code(401).send({ error: "请先登录" });
    if (req.method !== "GET" && req.auth.role === "viewer")
      return reply.code(403).send({ error: "只读账号不能修改" });
  });
  app.addHook("onResponse", async (req: any, reply) => {
    if (
      ["POST", "PATCH", "PUT", "DELETE"].includes(req.method) &&
      req.url.startsWith("/api/v1/") &&
      reply.statusCode < 400 &&
      !req.url.startsWith("/api/v1/preview")
    ) {
      s.audit(
        "api.mutation",
        req.method + " " + req.url.split("?")[0],
        req.body?.roomId ??
          (req.url.startsWith("/api/v1/rooms/") ||
          req.url.startsWith("/api/v1/overlay/")
            ? req.params?.id
            : null),
        req.auth?.id ?? "token-session",
      );
    }
  });
  app.setErrorHandler((error: any, req, reply) => {
    reply
      .code(error.statusCode ?? (error instanceof z.ZodError ? 400 : 400))
      .send({
        error:
          error instanceof z.ZodError
            ? error.issues
                .map((x: any) => `${x.path.join(".")}: ${x.message}`)
                .join("; ")
            : error.message,
      });
  });
  app.get("/api/v1/health", () => ({
    ok: true,
    version: "0.1.0",
    uptime: process.uptime(),
  }));
  app.get("/api/v1/session", (req: any) => ({ authenticated: !!auth(req) }));
  app.post("/api/v1/login", (req: any, reply) => {
    const ip = req.ip;
    const f = failures.get(ip);
    if (f && Date.now() - f.at < 60000 && f.count >= 10)
      return reply.code(429).send({ error: "登录尝试过多，请稍后重试" });
    const { token } = z.object({ token: z.string().max(300) }).parse(req.body);
    const a = auth({ headers: { authorization: "Bearer " + token } });
    if (!a) {
      failures.set(ip, {
        count: (f && Date.now() - f.at < 60000 ? f.count : 0) + 1,
        at: Date.now(),
      });
      return reply.code(401).send({ error: "访问令牌不正确" });
    }
    failures.delete(ip);
    req.auth = a;
    const cookie = randomBytes(32).toString("hex");
    s.put("sessions", {
      id: hash(cookie),
      accessToken: token,
      expires: Date.now() + 12 * 3600000,
    });
    reply.header(
      "set-cookie",
      `studio=${cookie}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200`,
    );
    return { ok: true };
  });
  app.post("/api/v1/logout", (req: any, reply) => {
    const cookie = req.headers.cookie
      ?.split(";")
      .map((v: string) => v.trim())
      .find((v: string) => v.startsWith("studio="))
      ?.slice(7);
    if (cookie) s.delete("sessions", hash(cookie));
    reply.header(
      "set-cookie",
      "studio=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    );
    return { ok: true };
  });
  return { auth, roomAllowed, requireRoom, admin };
}
