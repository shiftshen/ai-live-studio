import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
const tables = [
  "rooms",
  "rules",
  "templates",
  "printers",
  "events",
  "jobs",
  "streaks",
  "cooldowns",
  "blockedUsers",
  "access",
  "attempts",
  "sessions",
  "dedupe",
  "feedback",
] as const;
export class Store {
  db: DatabaseSync;
  constructor(public path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO migrations VALUES(1); CREATE TABLE IF NOT EXISTS settings(id TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audits(id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, actor TEXT, action TEXT, detail TEXT, roomId TEXT);",
    );
    for (const t of tables)
      this.db.exec(
        `CREATE TABLE IF NOT EXISTS ${t}(id TEXT PRIMARY KEY, data TEXT NOT NULL, at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS ${t}_at ON ${t}(at);`,
      );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS jobs_status ON jobs(json_extract(data,'$.status')); CREATE INDEX IF NOT EXISTS jobs_room ON jobs(json_extract(data,'$.roomId')); CREATE INDEX IF NOT EXISTS events_room ON events(json_extract(data,'$.roomId'));",
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS events_type ON events(json_extract(data,'$.type')); CREATE INDEX IF NOT EXISTS jobs_event ON jobs(json_extract(data,'$.eventId')); CREATE INDEX IF NOT EXISTS attempts_device_time ON attempts(json_extract(data,'$.printerId'),json_extract(data,'$.at'));",
    );
    this.seed();
  }
  query(
    t: string,
    where: string,
    params: any[] = [],
    order = "at DESC",
    limit = 1000,
  ): any[] {
    this.check(t);
    return this.db
      .prepare(`SELECT data FROM ${t} WHERE ${where} ORDER BY ${order} LIMIT ?`)
      .all(...params, limit)
      .map((x: any) => JSON.parse(x.data));
  }
  check(t: string) {
    if (!tables.includes(t as any)) throw Error("Invalid table");
  }
  list(t: string, limit = 10000): any[] {
    this.check(t);
    return this.db
      .prepare(`SELECT data FROM ${t} ORDER BY at DESC LIMIT ?`)
      .all(limit)
      .map((x: any) => JSON.parse(x.data));
  }
  get(t: string, id: string): any {
    this.check(t);
    const row = this.db
      .prepare(`SELECT data FROM ${t} WHERE id=?`)
      .get(id) as any;
    return row ? JSON.parse(row.data) : undefined;
  }
  put(t: string, obj: any) {
    this.check(t);
    this.db
      .prepare(
        `INSERT INTO ${t}(id,data,at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,at=excluded.at`,
      )
      .run(
        obj.id,
        JSON.stringify(obj),
        obj.createdAt ?? obj.receivedAt ?? Date.now(),
      );
    return obj;
  }
  delete(t: string, id: string) {
    this.check(t);
    this.db.prepare(`DELETE FROM ${t} WHERE id=?`).run(id);
  }
  tx<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  setting(key: string, value?: any): any {
    if (value !== undefined)
      this.db
        .prepare(
          "INSERT INTO settings VALUES(?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        )
        .run(key, JSON.stringify(value));
    const row = this.db
      .prepare("SELECT value FROM settings WHERE id=?")
      .get(key) as any;
    return row ? JSON.parse(row.value) : undefined;
  }
  audit(
    action: string,
    detail: string,
    roomId: string | null = null,
    actor = "system",
  ) {
    this.db
      .prepare(
        "INSERT INTO audits(at,actor,action,detail,roomId) VALUES(?,?,?,?,?)",
      )
      .run(Date.now(), actor, action, detail, roomId);
  }
  audits() {
    return this.db
      .prepare("SELECT * FROM audits ORDER BY id DESC LIMIT 150")
      .all();
  }
  count(t: string) {
    this.check(t);
    return Number(
      (this.db.prepare(`SELECT COUNT(*) n FROM ${t}`).get() as any).n,
    );
  }
  close() {
    this.db.close();
  }
  seed() {
    if (!this.setting("initialized")) {
      this.setting("config", {
        paused: false,
        printRate: 10,
        physicalTestMode: true,
        printQueueLimit: 100,
        eventRetentionDays: 7,
        jobRetentionDays: 90,
        avatarRetentionHours: 24,
        aiModel: "qwen3.8:27b",
        aiUrl: "http://127.0.0.1:11434",
        speechVolume: 0.8,
        speechRate: 1,
      });
      for (const lang of ["zh", "th", "en"]) {
        const body: any = {
          zh: {
            welcome: "欢迎 {{nickname}} 来到直播间！",
            greeting: "{{nickname}}，你好！很高兴见到你。",
            gift: "感谢 {{nickname}} 送来 {{count}} 个 {{giftName}}！",
            blessing: "祝 {{nickname}} 每一天都开心，愿美好与你相伴。",
            follow: "感谢 {{nickname}} 的关注，欢迎常来！",
            like: "谢谢大家！点赞已达到 {{count}}！",
          },
          th: {
            welcome: "ยินดีต้อนรับ {{nickname}}!",
            greeting: "สวัสดี {{nickname}} ยินดีที่ได้พบคุณ",
            gift: "ขอบคุณ {{nickname}} สำหรับ {{giftName}} {{count}} ชิ้น!",
            blessing: "ขอให้ {{nickname}} มีความสุขในทุกวัน",
            follow: "ขอบคุณ {{nickname}} ที่ติดตาม!",
            like: "ขอบคุณสำหรับ {{count}} ไลก์!",
          },
          en: {
            welcome: "Welcome, {{nickname}}!",
            greeting: "Hello {{nickname}}, lovely to see you!",
            gift: "Thank you {{nickname}} for {{count}} {{giftName}}!",
            blessing: "Wishing {{nickname}} a wonderful day!",
            follow: "Thank you for following, {{nickname}}!",
            like: "Thank you for {{count}} likes!",
          },
        };
        for (const [k, v] of Object.entries(body[lang]))
          this.put("templates", {
            id: `${k}-${lang}`,
            name: `${k} · ${lang}`,
            language: lang,
            body: v,
            version: 1,
          });
      }
      for (const platform of ["tiktok", "douyin"]) {
        const id = randomUUID();
        this.put("rooms", {
          id,
          name: platform === "tiktok" ? "TikTok 直播间" : "抖音直播间",
          platform,
          address: "",
          language: "zh",
          voice: "thai-zixia",
          printerId: null,
          enabled: true,
          status: "disconnected",
          error: null,
          sessionId: randomUUID(),
          persona: "你是一位友好、简洁的直播主持人。只回应本次互动。",
          knowledge: "",
          overlayToken: randomBytes(24).toString("hex"),
          capabilities: {
            comment: "unverified",
            gift: "unverified",
            join: "unverified",
            follow: "unverified",
            like: "unverified",
          },
        });
        const defaultRules: any[] = [
          {
            name: "礼物感谢",
            eventType: "gift",
            template: "gift",
            priority: 100,
          },
          {
            name: "生日与祝福",
            eventType: "comment",
            template: "blessing",
            priority: 90,
            keywords: ["生日快乐", "祝福"],
            ai: true,
            avatar: true,
          },
          {
            name: "多语言问候",
            eventType: "comment",
            template: "greeting",
            priority: 80,
            keywords: ["你好", "hello", "สวัสดี"],
          },
          {
            name: "首次关注",
            eventType: "follow",
            template: "follow",
            priority: 60,
            once: true,
          },
          {
            name: "首次进场",
            eventType: "join",
            template: "welcome",
            priority: 50,
            once: true,
          },
          ...[10, 50, 100].map((minCount) => ({
            name:
              minCount === 10
                ? "点赞里程碑（10）"
                : minCount === 50
                  ? "点赞里程碑（50）"
                  : "点赞里程碑（100）",
            eventType: "like",
            template: "like",
            minCount,
            priority: minCount === 100 ? 100 : minCount === 50 ? 90 : 80,
            actions: minCount === 100 ? ["print", "speech", "overlay"] : ["speech", "overlay"],
            cooldownSec: 0,
          })),
        ];
        for (const spec of defaultRules)
          this.put("rules", {
            id: randomUUID(),
            roomId: id,
            name: spec.name,
            enabled: true,
            priority: spec.priority,
            eventType: spec.eventType,
            keywords: spec.keywords ?? [],
            giftIds: [],
            minCount: spec.minCount ?? 1,
            cooldownSec: spec.cooldownSec ?? (spec.eventType === "gift" ? 0 : 60),
            oncePerSession: spec.once ?? false,
            continueMatching: false,
            templateId: `${spec.template}-zh`,
            actions:
              spec.eventType === "join"
                ? spec.actions ?? ["overlay", "speech"]
                : spec.eventType === "like"
                  ? spec.actions ?? ["overlay"]
                  : spec.eventType === "follow"
                    ? ["overlay", "speech"]
                    : ["print", "speech", "overlay"],
            ai: spec.ai ?? false,
            avatar: spec.avatar ?? spec.eventType === "gift",
            version: 1,
          });
      }
      this.setting("initialized", true);
    }
    const schema = this.setting("schemaVersion") ?? 1;
    if (schema < 2) {
      this.upgradeLikeRules();
      this.setting("schemaVersion", 2);
    }
    if (schema < 3) {
      this.upgradeJoinSpeech();
      this.setting("schemaVersion", 3);
    }
  }
  upgradeJoinSpeech() {
    for (const rule of this.list("rules")) {
      if (rule.eventType !== "join") continue;
      const actions = Array.isArray(rule.actions) ? rule.actions : [];
      if (actions.includes("overlay") && !actions.includes("speech")) {
        this.put("rules", {
          ...rule,
          actions: Array.from(new Set([...actions, "speech"])),
        });
      }
    }
  }
  upgradeLikeRules() {
    const required = [10, 50, 100];
    const byRoomId = new Map<string, any[]>();
    for (const rule of this.list("rules")) {
      if (rule.eventType !== "like") continue;
      const roomRules = byRoomId.get(rule.roomId) ?? [];
      roomRules.push(rule);
      byRoomId.set(rule.roomId, roomRules);
    }
    for (const room of this.list("rooms")) {
      const existing = byRoomId.get(room.id) ?? [];
      const present = new Set(existing.map((r) => Number(r.minCount)));
      for (const minCount of required) {
        if (!present.has(minCount)) {
          const actions =
            minCount === 100 ? ["print", "speech", "overlay"] : ["speech", "overlay"];
          this.put("rules", {
            id: randomUUID(),
            roomId: room.id,
            name:
              minCount === 10
                ? "点赞里程碑（10）"
                : minCount === 50
                  ? "点赞里程碑（50）"
                  : "点赞里程碑（100）",
            enabled: true,
            priority: minCount === 100 ? 100 : minCount === 50 ? 90 : 80,
            eventType: "like",
            keywords: [],
            giftIds: [],
            minCount,
            cooldownSec: 0,
            oncePerSession: false,
            continueMatching: false,
            templateId: `like-${room.language ?? "zh"}`,
            actions,
            ai: false,
            avatar: false,
            version: 1,
          });
        }
      }
    }
  }
}
