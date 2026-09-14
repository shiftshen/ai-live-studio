import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { Store } from "./store.ts";
export const eventSchema = z.object({
  roomId: z.string().min(1),
  sessionId: z.string().min(1),
  platform: z.enum(["douyin", "tiktok"]),
  sourceId: z.string().min(1).max(300),
  userId: z.string().min(1).max(300),
  nickname: z.string().max(100).default("观众"),
  avatar: z.string().max(3000).optional(),
  type: z.enum(["join", "follow", "comment", "gift", "like"]),
  origin: z.enum(["live", "replay", "simulated"]),
  text: z.string().max(2000).default(""),
  giftId: z.string().max(200).optional(),
  giftName: z.string().max(100).optional(),
  count: z.number().int().min(1).max(100000000).default(1),
  streakId: z.string().max(300).optional(),
  streakable: z.boolean().optional(),
  repeatEnd: z.boolean().optional(),
  historical: z.boolean().optional(),
  identityReliable: z.boolean().default(true),
  occurredAt: z.number().finite(),
});
export function render(body: string, event: any) {
  return body
    .replace(/\{\{\s*(nickname|giftName|count|text|time)\s*\}\}/g, (_, key) =>
      String(
        key === "time"
          ? new Date(event.occurredAt).toISOString()
          : (event[key] ?? ""),
      ),
    )
    .slice(0, 400);
}
export class Engine {
  constructor(public store: Store) {}
  preview(raw: any) {
    const room = this.store.get("rooms", raw.roomId);
    if (!room) throw Error("房间不存在");
    const event = eventSchema.parse({
      sessionId: room.sessionId,
      platform: room.platform,
      sourceId: randomUUID(),
      userId: "preview",
      origin: "simulated",
      occurredAt: Date.now(),
      ...raw,
    });
    const matches: any[] = [];
    const reasons: string[] = [];
    if (!event.identityReliable)
      return {
        matches,
        reasons: ["平台未提供可靠用户标识，仅记录事件，不执行回馈"],
      };
    if (this.store.get("blockedUsers", `${room.id}:${event.userId}`))
      return { matches, reasons: ["用户已屏蔽"] };
    for (const rule of this.store
      .list("rules")
      .filter((r) => r.roomId === room.id && r.enabled)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))) {
      if (rule.eventType !== event.type) continue;
      if (
        rule.keywords.length &&
        !rule.keywords.some((k: string) =>
          event.text
            .toLowerCase()
            .normalize("NFKC")
            .includes(k.toLowerCase().normalize("NFKC")),
        )
      )
        continue;
      if (rule.giftIds.length && !rule.giftIds.includes(event.giftId)) continue;
      if (event.count < rule.minCount) continue;
      const ck = `${room.id}:${room.sessionId}:${rule.id}:${event.type === "like" ? "all" : event.userId}`;
      const prior = this.store.get("cooldowns", ck);
      if (
        prior &&
        (rule.oncePerSession ||
          Date.now() - prior.at < rule.cooldownSec * 1000 ||
          (event.type === "like" &&
            Math.floor(event.count / rule.minCount) <= prior.milestone))
      ) {
        reasons.push(`${rule.name}：冷却或本场已触发`);
        continue;
      }
      let template = this.store.get("templates", rule.templateId);
      if (!template) {
        reasons.push(`${rule.name}：模板不存在`);
        continue;
      }
      let lang = room.language;
      if (event.type === "comment") {
        if (event.text.includes("สวัสดี")) lang = "th";
        else if (/hello/i.test(event.text)) lang = "en";
      }
      const sibling = this.store.get(
        "templates",
        template.id.replace(/-(zh|en|th)$/, "-" + lang),
      );
      if (sibling) template = sibling;
      matches.push({
        ruleId: rule.id,
        name: rule.name,
        content: render(template.body, event),
        actions: rule.actions,
        reason: "条件匹配",
        rule,
        template,
        cooldownKey: ck,
        language: lang,
      });
      if (!rule.continueMatching) break;
    }
    if (!matches.length && !reasons.length)
      reasons.push("没有匹配规则，仅记录事件");
    return { matches, reasons };
  }
  ingest(raw: any) {
    const parsed = eventSchema.parse(raw);
    const room = this.store.get("rooms", parsed.roomId);
    if (
      !room ||
      room.platform !== parsed.platform ||
      room.sessionId !== parsed.sessionId
    )
      throw Error("房间、平台或场次不一致");
    const id = createHash("sha256")
      .update(
        [
          parsed.origin,
          parsed.platform,
          parsed.roomId,
          parsed.sessionId,
          parsed.sourceId,
        ].join("|"),
      )
      .digest("hex");
    return this.store.tx(() => {
      if (this.store.get("dedupe", id) || this.store.get("events", id))
        return {
          event: this.store.get("events", id),
          matches: [],
          jobs: [],
          duplicate: true,
        };
      this.store.put("dedupe", {
        id,
        roomId: room.id,
        sessionId: room.sessionId,
      });
      const event: any = {
        ...parsed,
        id,
        receivedAt: Date.now(),
        status: "received",
      };
      let skip = !!event.historical || !room.enabled;
      if (event.type === "gift" && event.streakable) {
        if (!event.streakId) {
          event.status = "needs_review";
          skip = true;
        } else {
          const sk = [
            event.origin,
            room.id,
            room.sessionId,
            event.userId,
            event.giftId,
            event.streakId,
          ].join(":");
          const old = this.store.get("streaks", sk);
          const streak = {
            ...old,
            id: sk,
            roomId: room.id,
            sessionId: room.sessionId,
            count: Math.max(event.count, old?.count ?? 0),
            at: Date.now(),
            status:
              old?.status === "settled"
                ? "settled"
                : event.repeatEnd
                  ? "settled"
                  : "pending",
            eventId: id,
          };
          if (old?.status === "settled" || !event.repeatEnd) skip = true;
          event.count = streak.count;
          event.status =
            old?.status === "settled"
              ? "duplicate_streak"
              : event.repeatEnd
                ? "received"
                : "streak_pending";
          this.store.put("streaks", streak);
        }
      }
      if (event.historical) event.status = "historical";
      if (!event.identityReliable) event.status = "identity_unverified";
      this.store.put("events", event);
      const result = skip ? { matches: [], reasons: [] } : this.preview(event);
      const jobs: any[] = [];
      for (const match of result.matches) {
        const { rule, template } = match;
        this.store.put("cooldowns", {
          id: match.cooldownKey,
          at: Date.now(),
          roomId: room.id,
          milestone: Math.floor(event.count / rule.minCount),
        });
        for (const action of rule.actions) {
          const jid = createHash("sha256")
            .update(`${id}:${rule.id}:${action}`)
            .digest("hex");
          if (this.store.get("jobs", jid)) continue;
          let status = "pending";
          if (action === "print") {
            if (event.origin !== "live") status = "dry_run";
            else if (!room.printerId) status = "blocked";
            else {
              const pending = this.store.db
                .prepare(
                  "SELECT COUNT(*) n FROM jobs WHERE json_extract(data,'$.action')='print' AND json_extract(data,'$.printerId')=? AND json_extract(data,'$.status') IN ('pending','sending','processing','accepted')",
                )
                .get(room.printerId) as any;
              if (pending.n >= this.store.setting("config").printQueueLimit)
                status = "held";
            }
          }
          const job = {
            id: jid,
            roomId: room.id,
            sessionId: room.sessionId,
            eventId: id,
            ruleId: rule.id,
            ruleVersion: rule.version,
            templateVersion: template.version,
            action,
            status,
            content: match.content,
            nickname: event.nickname,
            avatar: rule.avatar ? (event.avatar ?? null) : null,
            origin: event.origin,
            priority: rule.priority,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            error:
              status === "blocked"
                ? "未绑定打印机"
                : status === "held"
                  ? "打印积压，等待恢复"
                  : null,
            providerId: null,
            parentId: null,
            printerId: room.printerId,
            language: match.language,
            ai: rule.ai,
            voice: room.voice,
            persona: room.persona,
            knowledge: room.knowledge,
            needsAvatar: rule.avatar,
            mediaUrl: null,
          };
          this.store.put("jobs", job);
          jobs.push(job);
        }
      }
      event.status = result.matches.length
        ? "matched"
        : event.status === "received"
          ? "unmatched"
          : event.status;
      this.store.put("events", event);
      return {
        event,
        matches: result.matches.map(
          ({ rule, template, cooldownKey, ...m }) => m,
        ),
        jobs,
      };
    });
  }
  expireStreaks(now = Date.now()) {
    for (const st of this.store.query(
      "streaks",
      "json_extract(data,'$.status')='pending' AND json_extract(data,'$.at')<=?",
      [now - 10000],
      "at ASC",
      1000,
    ))
      if (st.status === "pending" && now - st.at >= 10000) {
        st.status = "needs_review";
        this.store.put("streaks", st);
        const event = this.store.get("events", st.eventId);
        if (event)
          this.store.put("events", { ...event, status: "needs_review" });
        this.store.audit(
          "gift.needs_review",
          "礼物连送缺少结束事件",
          st.roomId,
        );
      }
  }
}
