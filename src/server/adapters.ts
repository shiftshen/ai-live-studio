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
    if (!room || room.platform !== "douyin") throw Error("抖音房间不存在");
    if (!Array.isArray(message)) return;
    this.s.setting("relay-shape:" + id, {
      at: Date.now(),
      length: message.length,
      sample: message
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
    for (const d of message) {
      if (!d || typeof d !== "object") continue;
      if (
        d.method === "WebcastSocialMessage" &&
        !(d.socialAction === "follow" || String(d.action) === "1")
      )
        continue;
      const type = (
        {
          WebcastChatMessage: "comment",
          WebcastEmojiChatMessage: "comment",
          WebcastGiftMessage: "gift",
          WebcastLikeMessage: "like",
          WebcastMemberMessage: "join",
          WebcastSocialMessage: "follow",
        } as any
      )[d.method];
      if (!type || !d.id) continue;
      try {
        const gift = d.gift ?? {};
        this.engine.ingest({
          roomId: id,
          sessionId: room.sessionId,
          platform: "douyin",
          sourceId: String(d.id),
          userId: d.user?.id ? String(d.user.id) : `unidentified:${d.id}`,
          identityReliable: !!d.user?.id,
          nickname: d.user?.name ?? "观众",
          avatar: d.user?.avatar,
          type,
          origin: "live",
          text: d.content ?? "",
          giftId: gift.id ? String(gift.id) : undefined,
          giftName: gift.name,
          count: Math.max(
            1,
            Number(
              type === "like" ? (d.room?.likeCount ?? 1) : (gift.count ?? 1),
            ),
          ),
          streakId: gift.groupId ? String(gift.groupId) : undefined,
          streakable: type === "gift" && Number(gift.type) === 1,
          repeatEnd: Number(gift.repeatEnd) === 1,
          occurredAt: d.timestamp ?? Date.now(),
          historical: d.timestamp ? d.timestamp < Date.now() - 60000 : false,
        });
        this.update(id, {
          ...(!d.timestamp || d.timestamp >= Date.now() - 60000
            ? { status: "connected", error: null, lastEventAt: Date.now() }
            : {}),
          capabilities: {
            ...this.s.get("rooms", id).capabilities,
            [type]: "observed",
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
