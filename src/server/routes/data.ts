import { z } from "zod";
import { Readable } from "node:stream";
import type { RouteContext } from "./context.ts";
export function registerDataRoutes({
  app,
  s,
  roomAllowed,
  requireRoom,
}: Pick<RouteContext, "app" | "s" | "roomAllowed" | "requireRoom">) {
  const scope = (a: any, roomId?: string) => {
    const rooms = s.list("rooms").filter((r) => roomAllowed(a, r.id));
    if (roomId) {
      requireRoom({ auth: a }, roomId);
    }
    const ids = roomId ? [roomId] : rooms.map((r) => r.id);
    return {
      rooms,
      ids,
      where: `json_extract(data,'$.roomId') IN (${ids.map(() => "?").join(",") || "NULL"})`,
    };
  };
  const rows = (
    table: string,
    where: string,
    ids: string[],
    limit?: number,
    offset = 0,
  ) => {
    s.check(table);
    const sql = `SELECT data FROM ${table} WHERE ${where} ORDER BY at DESC,id DESC${limit === undefined ? "" : " LIMIT ? OFFSET ?"}`;
    return s.db
      .prepare(sql)
      .all(...ids, ...(limit === undefined ? [] : [limit, offset]))
      .map((r: any) => JSON.parse(r.data));
  };
  const fanSql = (where: string) =>
    `WITH scoped AS (SELECT data,at,FIRST_VALUE(json_extract(data,'$.nickname')) OVER (PARTITION BY json_extract(data,'$.roomId'),json_extract(data,'$.platform'),json_extract(data,'$.userId') ORDER BY at DESC,id DESC) latestNickname FROM events WHERE ${where} AND COALESCE(json_extract(data,'$.identityReliable'),1)=1) SELECT json_extract(data,'$.roomId') roomId,json_extract(data,'$.platform') platform,json_extract(data,'$.userId') userId,MAX(latestNickname) nickname,COUNT(*) eventCount,SUM(CASE WHEN json_extract(data,'$.type')='gift' AND json_extract(data,'$.status') IN ('matched','unmatched') AND json_extract(data,'$.origin')='live' THEN COALESCE(json_extract(data,'$.count'),0) ELSE 0 END) giftCount,SUM(CASE WHEN json_extract(data,'$.type')='comment' THEN 1 ELSE 0 END) commentCount,SUM(CASE WHEN json_extract(data,'$.type')='follow' THEN 1 ELSE 0 END) followCount,MIN(at) firstSeenAt,MAX(at) lastSeenAt FROM scoped GROUP BY roomId,platform,userId`;
  const paging = z.object({
    roomId: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(100),
    offset: z.coerce.number().int().min(0).max(100000000).default(0),
  });
  app.get("/api/v1/state", (req: any) => {
    const { rooms, ids, where } = scope(req.auth);
    const stats = s.db
      .prepare(
        `SELECT COUNT(*) events,COALESCE(SUM(CASE WHEN json_extract(data,'$.type')='gift' AND json_extract(data,'$.status') IN ('matched','unmatched') AND json_extract(data,'$.origin')='live' THEN COALESCE(json_extract(data,'$.count'),0) ELSE 0 END),0) gifts FROM events WHERE ${where}`,
      )
      .get(...ids) as any;
    const statuses = s.db
      .prepare(
        `SELECT json_extract(data,'$.status') status,COUNT(*) n FROM jobs WHERE ${where} GROUP BY 1`,
      )
      .all(...ids) as any[];
    const count = (values: string[]) =>
      statuses
        .filter((x) => values.includes(x.status))
        .reduce((n, x) => n + x.n, 0);
    return {
      rooms:
        req.auth.role === "admin"
          ? rooms
          : rooms.map(({ overlayToken, ...r }) => r),
      rules: rows("rules", where, ids),
      templates: s.list("templates"),
      printers: s
        .list("printers")
        .filter(
          (p) =>
            req.auth.role === "admin" ||
            rooms.some((r) => r.printerId === p.id),
        ),
      events: rows("events", where, ids, 300),
      jobs: rows("jobs", where, ids, 500),
      audits:
        req.auth.role === "admin"
          ? s.audits()
          : s.db
              .prepare(
                `SELECT * FROM audits WHERE roomId IN (${ids.map(() => "?").join(",") || "NULL"}) ORDER BY id DESC LIMIT 150`,
              )
              .all(...ids),
      settings: s.setting("config"),
      testPagesUsed: s.setting("testPages") ?? 0,
      role: req.auth.role,
      blockedUsers: rows("blockedUsers", where, ids),
      stats: {
        events: stats.events,
        gifts: stats.gifts,
        jobs: statuses.reduce((n, x) => n + x.n, 0),
        pending: count(["pending", "ready", "sending", "accepted", "held"]),
        completed: count(["completed"]),
        failed: count(["failed", "unknown", "blocked"]),
        blocked: count(["blocked"]),
        unknown: count(["unknown"]),
        cancelled: count(["cancelled"]),
        dryRun: count(["dry_run"]),
      },
    };
  });
  for (const kind of ["events", "jobs", "fans"])
    app.get(`/api/v1/${kind}`, (req: any) => {
      const { roomId, limit, offset } = paging.parse(req.query);
      const { ids, where } = scope(req.auth, roomId);
      if (kind === "fans") {
        const sql = fanSql(where);
        const total = (
          s.db.prepare(`SELECT COUNT(*) n FROM (${sql})`).get(...ids) as any
        ).n;
        const items = s.db
          .prepare(
            `${sql} ORDER BY lastSeenAt DESC,roomId,platform,userId LIMIT ? OFFSET ?`,
          )
          .all(...ids, limit, offset);
        return { items, total, limit, offset };
      }
      return {
        items: rows(kind, where, ids, limit, offset),
        total: (
          s.db
            .prepare(`SELECT COUNT(*) n FROM ${kind} WHERE ${where}`)
            .get(...ids) as any
        ).n,
        limit,
        offset,
      };
    });
  app.get("/api/v1/export", (req: any, reply) => {
    const kind = z
      .enum(["events", "jobs", "fans"])
      .parse(req.query.kind ?? "events");
    const roomId = z.string().min(1).optional().parse(req.query.roomId);
    const { ids, where } = scope(req.auth, roomId);
    const statement = s.db.prepare(
      kind === "fans"
        ? fanSql(where) + " ORDER BY lastSeenAt DESC"
        : `SELECT data FROM ${kind} WHERE ${where} ORDER BY at DESC,id DESC`,
    );
    const fields =
      kind === "fans"
        ? [
            "roomId",
            "platform",
            "userId",
            "nickname",
            "eventCount",
            "giftCount",
            "commentCount",
            "followCount",
            "firstSeenAt",
            "lastSeenAt",
          ]
        : kind === "jobs"
          ? ["id", "roomId", "action", "status", "content", "createdAt"]
          : [
              "id",
              "roomId",
              "platform",
              "userId",
              "nickname",
              "type",
              "text",
              "count",
            ];
    const cell = (v: any) => {
      let value = String(v ?? "");
      if (/^[=+@\-\t\r]/.test(value)) value = "'" + value;
      return '"' + value.replace(/"/g, '""') + '"';
    };
    reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${kind}.csv"`);
    function* csv() {
      yield "\uFEFF" + fields.join(",");
      for (const entry of statement.iterate(...ids) as Iterable<any>) {
        const row = kind === "fans" ? entry : JSON.parse(entry.data);
        yield "\n" + fields.map((f) => cell(row[f])).join(",");
      }
    }
    return reply.send(Readable.from(csv()));
  });
}
