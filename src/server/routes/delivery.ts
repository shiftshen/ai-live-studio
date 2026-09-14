import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { roomAddress } from "../adapters.ts";
import { id } from "../schemas.ts";
import { z } from "zod";
import type { RouteContext } from "./context.ts";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function registerDeliveryRoutes(ctx: RouteContext) {
  const { app, s, adapters, dir, auth, roomAllowed, requireRoom, admin } = ctx;
  const overlayRoom = (req: any) => {
    const room = s.get("rooms", req.params.id);
    if (
      !room ||
      !req.query.token ||
      hash(String(req.query.token)) !== hash(room.overlayToken)
    )
      throw Object.assign(Error("展示令牌无效"), { statusCode: 403 });
    return room;
  };
  app.get("/api/v1/overlay/:id", (req: any) => {
    const room = overlayRoom(req);
    const totals = s.db
      .prepare(
        `SELECT
          COUNT(DISTINCT CASE WHEN json_extract(data,'$.type')='join' THEN json_extract(data,'$.userId') END) viewers,
          COUNT(CASE WHEN json_extract(data,'$.type')='follow' THEN 1 END) follows,
          COALESCE(SUM(CASE WHEN json_extract(data,'$.type')='like' THEN json_extract(data,'$.count') ELSE 0 END),0) likes,
          COALESCE(SUM(CASE WHEN json_extract(data,'$.type')='gift' THEN json_extract(data,'$.count') ELSE 0 END),0) gifts
        FROM events WHERE json_extract(data,'$.roomId')=? AND json_extract(data,'$.sessionId')=? AND json_extract(data,'$.origin')='live' AND COALESCE(json_extract(data,'$.historical'),0)=0`,
      )
      .get(room.id, room.sessionId) as any;
    return {
      room: { name: room.name, language: room.language },
      totals: {
        viewers: Number(totals.viewers),
        follows: Number(totals.follows),
        likes: Number(totals.likes),
        gifts: Number(totals.gifts),
      },
      rewards: s
        .list("rules")
        .filter(
          (r) => r.roomId === room.id && r.enabled && r.eventType === "gift",
        )
        .sort((a, b) => a.minCount - b.minCount)
        .map((r) => ({
          id: r.id,
          name: r.name,
          minCount: r.minCount,
          giftIds: r.giftIds,
          actions: r.actions,
        })),
      jobs: s.query(
        "jobs",
        "json_extract(data,'$.roomId')=? AND json_extract(data,'$.sessionId')=? AND ((json_extract(data,'$.action')='overlay' AND json_extract(data,'$.enriched')=1 AND json_extract(data,'$.status')='pending') OR (json_extract(data,'$.action')='speech' AND json_extract(data,'$.status')='ready'))",
        [room.id, room.sessionId],
        "at ASC",
        30,
      ),
      settings: {
        speechVolume: s.setting("config").speechVolume,
        speechRate: s.setting("config").speechRate,
        paused: s.setting("config").paused,
      },
    };
  });
  app.post("/api/v1/overlay/:id/ack", (req: any) => {
    const room = overlayRoom(req);
    if (s.setting("config").paused) throw Error("动作已暂停");
    const { jobId } = z.object({ jobId: id }).parse(req.body);
    const job = s.get("jobs", jobId);
    if (
      !job ||
      job.roomId !== room.id ||
      job.sessionId !== room.sessionId ||
      !["overlay", "speech"].includes(job.action) ||
      !["pending", "ready"].includes(job.status)
    )
      throw Error("不能确认此任务");
    s.put("jobs", { ...job, status: "completed", updatedAt: Date.now() });
    return { ok: true };
  });
  app.get("/api/v1/media/:name", (req: any, reply) => {
    const name = z
      .string()
      .regex(/^(?:[a-f0-9]{64}|fallback-(?:zh|th|en))\.(wav|png)$/)
      .parse(req.params.name);
    const a = auth(req);
    const roomId = req.query.roomId;
    let rid: string | undefined;
    if (a?.role === "admin") rid = "*";
    else if (a) rid = s.setting("media:" + name);
    else if (roomId) {
      req.params.id = roomId;
      rid = overlayRoom(req).id;
    }
    const allowedRooms = a ? (a.roomIds ?? []) : rid ? [rid] : [];
    const related =
      rid === "*" ||
      (allowedRooms.length > 0 &&
        !!s.db
          .prepare(
            `SELECT 1 FROM jobs WHERE json_extract(data,'$.roomId') IN (${allowedRooms.map(() => "?").join(",")}) AND (json_extract(data,'$.mediaUrl')=? OR json_extract(data,'$.avatar')=?) LIMIT 1`,
          )
          .get(
            ...allowedRooms,
            "/api/v1/media/" + name,
            "/api/v1/media/" + name,
          ));
    if (rid !== "*" && !related && !(a && rid && roomAllowed(a, rid)))
      throw Object.assign(Error("无权访问媒体"), { statusCode: 403 });
    const path = join(dir, "media", name);
    if (!existsSync(path))
      return reply.code(404).send({ error: "媒体不存在或已过期" });
    return reply
      .type(name.endsWith("wav") ? "audio/wav" : "image/png")
      .send(readFileSync(path));
  });
  const relayPath = join(dir, "relay-token");
  if (!existsSync(relayPath))
    writeFileSync(relayPath, randomBytes(32).toString("hex"), { mode: 0o600 });
  const relayToken = readFileSync(relayPath, "utf8").trim();
  app.get(
    "/api/v1/relay/:id",
    {
      websocket: true,
      preValidation: async (req: any, reply) => {
        const room = s.get("rooms", req.params.id);
        if (
          !room ||
          room.platform !== "douyin" ||
          hash(String(req.query.token ?? "")) !== hash(relayToken)
        )
          return reply.code(403).send({ error: "转发令牌无效" });
      },
    },
    (socket, req: any) => {
      const room = s.get("rooms", req.params.id);
      if (
        !room ||
        room.platform !== "douyin" ||
        hash(String(req.query.token ?? "")) !== hash(relayToken)
      ) {
        socket.close(1008, "Unauthorized");
        return;
      }
      if (adapters.connections.has(room.id)) {
        socket.close(1008, "Already connected");
        return;
      }
      adapters.connections.set(room.id, socket);
      let established = false;
      socket.on("message", (raw) => {
        try {
          const payload = JSON.parse(raw.toString());
          if (!Array.isArray(payload)) {
            const number = roomAddress("douyin", room.address);
            if (String(payload.roomNum ?? payload.roomId) !== number)
              throw Error("转发房间编号不符");
            established = true;
            adapters.update(room.id, {
              status: "waiting_events",
              lastEventAt: null,
              error: "转发已连接，等待真实直播事件",
            });
            return;
          }
          if (!established) throw Error("请先发送直播间信息");
          adapters.relay(room.id, payload);
        } catch (e: any) {
          s.audit("relay.rejected", e.message, room.id);
        }
      });
      socket.on("close", () => {
        if (adapters.connections.get(room.id) === socket) {
          adapters.connections.delete(room.id);
          adapters.update(room.id, {
            status: "disconnected",
            error: "Dycast转发已断开",
          });
        }
      });
    },
  );
  app.get("/api/v1/relay-config/:id", (req: any) => {
    admin(req);
    requireRoom(req, req.params.id);
    return {
      url: `ws://127.0.0.1:8890/api/v1/relay/${req.params.id}?token=${relayToken}`,
    };
  });
}
