import { randomUUID } from "node:crypto";
import { Store } from "./store.ts";
import { Engine } from "./engine.ts";
// TikTokLiveConnection 2.4 uses v3 protobuf; legacy giftDetails is v2 only.
export function platformTime(value: unknown, now = Date.now()) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return now;
  return n >= 1e12 ? n : n * 1000;
}
export function tiktokGiftFields(d: any) {
  return {
    giftId: d.giftId ? String(d.giftId) : undefined,
    giftName:
      d.gift?.name ??
      d.giftDetails?.giftName ??
      d.extendedGiftInfo?.name ??
      "礼物",
    streakId: d.groupId ? String(d.groupId) : undefined,
    streakable: Number(d.gift?.type ?? d.giftDetails?.giftType) === 1,
    repeatEnd: d.repeatEnd === true || Number(d.repeatEnd) === 1,
  };
}
export function roomAddress(platform: string, address: string) {
  const s = address.trim();
  if (platform === "tiktok") {
    const m = s.match(
      /^(?:https:\/\/(?:www\.)?tiktok\.com\/)?@?([\w.]+)(?:\/live)?\/?$/,
    );
    if (!m) throw Error("请输入 TikTok 用户名或完整直播地址");
    return m[1];
  }
  const m = s.match(/^(?:https:\/\/live\.douyin\.com\/)?(\d+)\/?$/);
  if (!m) throw Error("请输入抖音直播间数字编号或完整地址");
  return m[1];
}
export class Adapters {
  connections = new Map<string, any>();
  retries = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(
    public s: Store,
    public engine: Engine,
  ) {}

  normalizeDycastId(d: any) {
    const raw =
      d.id ??
      d.msgId ??
      d.msg_id ??
      d.messageId ??
      d.eventId ??
      d.event_id ??
      null;
    if (typeof raw === "string" || typeof raw === "number") return String(raw);
    return null;
  }

  normalizeDycastNumber(value: unknown, fallback = 1) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return n;
  }

  private extractRelayMethod(message: any) {
    const raw =
      message.method ??
      message.event ??
      message.eventType ??
      message.type ??
      message.action ??
      message.message_type ??
      message.msgType ??
      message.event_type ??
      null;
    if (typeof raw === "string") return raw.trim();
    return "";
  }

  private extractDycastLikeCount(d: any, fallback = 1) {
    const fromText = (typeof d.content === "string"
      ? d.content.match(/[(（]?\s*([0-9]+)\s*[）)]?$/)?.[1]
      : null) ??
      (typeof d.description === "string"
        ? d.description.match(/[(（]?\s*([0-9]+)\s*[）)]?$/)?.[1]
        : null);
    if (fromText) return this.normalizeDycastNumber(Number(fromText), fallback);

    return this.normalizeDycastNumber(
      d.room?.likeCount ??
        d.likeCount ??
        d.totalLikeCount ??
        d.count ??
        d.like_count ??
        d.params?.likeCount ??
        d.data?.likeCount ??
        fallback,
      fallback,
    );
  }

  private normalizeDycastMessagePayload(message: any) {
    if (Array.isArray(message)) return message.filter((d) => d && typeof d === "object");

    if (!message || typeof message !== "object") return [];

    const method = this.extractRelayMethod(message);
    if (method) return [message];

    return [];
  }

  normalizeDycastTime(value: unknown, now = Date.now()) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return now;
    return n >= 1e12 ? n : n * 1000;
  }

  update(id: string, patch: any) {
    const room = this.s.get("rooms", id);
    if (room) this.s.put("rooms", { ...room, ...patch });
  }
  async disconnect(id: string) {
    const timer = this.retries.get(id);
    if (timer) clearTimeout(timer);
    this.retries.delete(id);
    const c = this.connections.get(id);
    this.connections.delete(id);
    if (c) {
      c.removeAllListeners?.();
      await c.disconnect?.();
      c.close?.();
    }
    this.update(id, { status: "disconnected", error: null });
  }
  async connect(id: string, attempt = 0) {
    const room = this.s.get("rooms", id);
    if (!room) throw Error("房间不存在");
    const address = roomAddress(room.platform, room.address);
    await this.disconnect(id);
    if (room.platform === "douyin") {
      this.update(id, {
        status: "waiting_relay",
        error: "等待 Dycast 连接已认证的转发入口",
      });
      return;
    }
    this.update(id, { status: "connecting", error: null });
    try {
      const lib = await import("tiktok-live-connector");
      const connection: any = new lib.TikTokLiveConnection(address, {
        processInitialData: false,
        authenticateWs: false,
        fetchRoomInfoOnConnect: true,
        enableExtendedGiftInfo: false,
        ...(process.env.EULER_API_KEY
          ? { signApiKey: process.env.EULER_API_KEY }
          : {}),
      });
      this.connections.set(id, connection);
      for (const [name, type] of Object.entries({
        chat: "comment",
        gift: "gift",
        member: "join",
        follow: "follow",
        like: "like",
      })) {
        connection.on(name as any, (d: any) => {
          if (this.connections.get(id) !== connection) return;
          try {
            const current = this.s.get("rooms", id);
            const source = d.common?.msgId ?? d.msgId;
            const uid = d.user?.userId ?? d.user?.id ?? d.user?.uniqueId;
            if (!source || !uid) return;
            const n = Number(
              d.repeatCount ?? d.totalLikeCount ?? d.likeCount ?? 1,
            );
            const event = {
              roomId: id,
              sessionId: current.sessionId,
              platform: "tiktok",
              sourceId: String(source),
              userId: String(uid),
              nickname: d.user?.nickname ?? d.user?.uniqueId ?? "观众",
              avatar: d.user?.avatarThumb?.urlList?.[0],
              type,
              origin: "live",
              text: d.content ?? d.comment ?? "",
              ...(type === "gift" ? tiktokGiftFields(d) : {}),
              count: Math.max(1, n),
              occurredAt: platformTime(d.common?.createTime),
            };
            this.engine.ingest(event);
            this.update(id, {
              capabilities: { ...current.capabilities, [type]: "observed" },
            });
          } catch (e: any) {
            this.s.audit("adapter.event_rejected", e.message, id);
          }
        });
      }
      connection.on("error" as any, () => {});
      connection.on("disconnected" as any, () => {
        if (this.connections.get(id) !== connection) return;
        this.update(id, { status: "reconnecting", error: "直播连接断开" });
        if (attempt < 3)
          this.retries.set(
            id,
            setTimeout(
              () => void this.connect(id, attempt + 1).catch(() => {}),
              Math.min(30000, 2000 * 2 ** attempt),
            ),
          );
        else
          this.update(id, {
            status: "error",
            error: "重连三次失败，请检查网络与签名服务",
          });
      });
      await connection.connect();
      if (this.connections.get(id) === connection)
        this.update(id, { status: "connected", error: null });
    } catch (e: any) {
      await this.disconnect(id);
      this.update(id, {
        status: "error",
        error: `TikTok连接失败：${String(e.message)
          .replace(/https?:\/\/\S+/g, "[服务地址]")
          .slice(0, 220)}；可能需要签名服务凭据`,
      });
      this.s.audit(
        "adapter.connect_failed",
        "TikTok连接失败，查看房间诊断",
        id,
      );
    }
  }
  refreshRelayHealth(now = Date.now()) {
    for (const room of this.s.list("rooms")) {
      if (
        room.platform === "douyin" &&
        room.status === "connected" &&
        now - (room.lastEventAt ?? 0) > 60000
      ) {
        this.update(room.id, {
          status: "waiting_events",
          error: "转发在线但60秒未收到新事件，请检查主播是否下播",
        });
      }
    }
  }

  relay(id: string, message: any) {
    const room = this.s.get("rooms", id);
    if (!room) throw Error("抖音房间不存在");
    if (room.platform !== "douyin") throw Error("抖音房间不存在");
    const normalized = this.normalizeDycastMessagePayload(message);
    if (!normalized.length) return;
    this.s.setting("relay-shape:" + id, {
      at: Date.now(),
      length: normalized.length,
      sample: normalized
        .filter((d) => d && typeof d === "object")
        .slice(0, 3)
        .map((d) => ({
          keys: Object.keys(d),
          method: d.method,
          idPresent: !!d.id,
          userKeys: Object.keys(d.user ?? {}),
          userIdPresent: !!d.user?.id,
        })),
    });
    for (const d of normalized) {
      if (!d || typeof d !== "object") continue;
      if (
        String(d.method) === "WebcastSocialMessage" &&
        !(d.socialAction === "follow" || String(d.action) === "1")
      )
        continue;
      const typeMap =
        {
          WebcastChatMessage: "comment",
          WebcastEmojiChatMessage: "comment",
          WebcastGiftMessage: "gift",
          WebcastGift: "gift",
          WebcastLikeMessage: "like",
          WebcastLike: "like",
          WebcastMemberMessage: "join",
          WebcastMember: "join",
          WebcastRoomUserSeqMessage: "join",
          WebcastSocialMessage: "follow",
          follow: "follow",
          member: "join",
          like: "like",
          comment: "comment",
          chat: "comment",
          gift: "gift",
        } as any;
      const mappedType =
        typeMap[d.method] ??
        typeMap[d.event] ??
        typeMap[d.eventType] ??
        typeMap[d.event_type] ??
        typeMap[d.type] ??
        typeMap[d.action] ??
        typeMap[d.msgType] ??
        undefined;
      if (!mappedType) continue;
      const gift = d.gift ?? d?.data?.gift ?? {};
      const sourceId = this.normalizeDycastId(d) || randomUUID();
      const occurredAt = this.normalizeDycastTime(
        d.timestamp ?? d.eventTime ?? d.createTime,
      );
      const method = String(d.method || d.event || d.eventType || "").toLowerCase();
      const socialFollow =
        d.socialAction === "follow" ||
        String(d.action) === "1" ||
        method.includes("follow") ||
        String(d.eventType).includes("follow") ||
        String(d.type) === "social" ||
        d.msgType === "WebcastSocialMessage";
      if (mappedType === "follow" && !socialFollow && !d.text && !d.comment && !d.content)
        continue;
      const count =
        mappedType === "like"
          ? this.extractDycastLikeCount(d, 1)
          : mappedType === "gift"
            ? this.normalizeDycastNumber(gift.count, 1)
            : this.normalizeDycastNumber(d.count, 1);
      const identityReliable = !!d.user?.id;
      const eventUserId =
        d.user?.id ? String(d.user.id) : `unidentified:${sourceId}`;
      try {
        this.engine.ingest({
          roomId: id,
          sessionId: room.sessionId,
          platform: "douyin",
          sourceId,
          userId: eventUserId,
          identityReliable,
          nickname: d.user?.name ?? "观众",
          avatar: d.user?.avatar,
          type: mappedType,
          origin: "live",
          text: d.content ?? "",
          giftId: gift.id ? String(gift.id) : undefined,
          giftName: gift.name,
          count: Math.max(1, count),
          streakId: gift.groupId ? String(gift.groupId) : undefined,
          streakable: mappedType === "gift" && Number(gift.type) === 1,
          repeatEnd: Number(gift.repeatEnd) === 1,
          occurredAt,
          historical: occurredAt < Date.now() - 60000,
        });
        this.update(id, {
          ...(!d.timestamp || d.timestamp >= Date.now() - 60000
            ? { status: "connected", error: null, lastEventAt: Date.now() }
            : {}),
          capabilities: {
            ...this.s.get("rooms", id).capabilities,
            [mappedType]: "observed",
            identity: d.user?.id ? "observed" : "unverified",
          },
        });
      } catch (e: any) {
        this.s.audit(
          "adapter.event_rejected",
          String(e.message).slice(0, 500),
          id,
        );
      }
    }
  }
}
