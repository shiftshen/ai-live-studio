import { basename, join } from "node:path";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { Store } from "./store.ts";
import {
  Secrets,
  feieCall,
  feieContent,
  generateText,
  generateSpeech,
  avatarBytes,
} from "./providers.ts";
export class Worker {
  busy = false;
  active = new Map<string, Promise<void>>();
  preparing = new Map<string, Promise<any>>();
  timer: ReturnType<typeof setInterval> | null = null;
  constructor(
    public store: Store,
    public secrets: Secrets,
    public mediaDir: string,
  ) {}
  recover() {
    for (const job of this.store.query(
      "jobs",
      "json_extract(data,'$.status')='sending'",
      [],
      "at",
      1000000,
    )) {
      if (job.status === "sending")
        this.save(job, {
          status: job.action === "print" ? "unknown" : "pending",
          error:
            job.action === "print"
              ? "服务重启时发送结果未知，禁止自动重印"
              : null,
        });
    }
  }
  save(job: any, patch: any) {
    this.store.put("jobs", { ...job, ...patch, updatedAt: Date.now() });
  }
  start() {
    this.recover();
    this.timer = setInterval(
      () =>
        void this.tick().catch((e) =>
          this.store.audit("worker.error", e.message),
        ),
      500,
    );
  }
  async stop() {
    if (this.timer) clearInterval(this.timer);
    await Promise.allSettled([...this.active.values()]);
  }
  async tick() {
    if (this.store.setting("config").paused) return;
    const cfg = this.store.setting("config");
    this.store.db
      .prepare(
        `UPDATE jobs SET data=json_set(data,'$.status','expired','$.error','欢迎消息已过期') WHERE json_extract(data,'$.status') IN ('pending','ready') AND at<? AND json_extract(data,'$.eventId') IN (SELECT id FROM events WHERE json_extract(data,'$.type')='join')`,
      )
      .run(Date.now() - 120000);

    // Offline OBS must not play hours-old ordinary interactions on reconnect.
    // Gift feedback and physical print work retain their explicit recovery flow.
    this.store.db
      .prepare(
        `UPDATE jobs SET data=json_set(data,
      '$.status','expired','$.error','普通画面或语音已超过2分钟，保留记录不再播放',
      '$.updatedAt',?) WHERE json_extract(data,'$.status') IN ('pending','ready')
      AND json_extract(data,'$.action') IN ('speech','overlay') AND at<?
      AND json_extract(data,'$.eventId') IN (SELECT id FROM events
        WHERE json_extract(data,'$.type') IN ('follow','comment','like'))`,
      )
      .run(Date.now(), Date.now() - 120000);

    const candidates = this.store.db
      .prepare(
        `WITH eligible AS (
      SELECT data,at,ROW_NUMBER() OVER(PARTITION BY json_extract(data,'$.action'),COALESCE(json_extract(data,'$.printerId'),'') ORDER BY json_extract(data,'$.priority') DESC,at ASC) rn FROM jobs j
      WHERE ((json_extract(data,'$.status')='pending' AND (json_extract(data,'$.action')!='overlay' OR COALESCE(json_extract(data,'$.enriched'),0)=0)) OR (json_extract(data,'$.status')='accepted' AND COALESCE(json_extract(data,'$.lastPoll'),0)<?))
      AND (json_extract(data,'$.action')!='print' OR json_extract(data,'$.status')='accepted' OR (SELECT COUNT(*) FROM attempts a WHERE json_extract(a.data,'$.printerId')=COALESCE(json_extract(j.data,'$.printerId'),'') AND json_extract(a.data,'$.at')>?)<?)
    ) SELECT data FROM eligible WHERE rn=1`,
      )
      .all(Date.now() - 5000, Date.now() - 60000, cfg.printRate)
      .map((r: any) => JSON.parse(r.data));
    const started: Promise<void>[] = [];
    for (const job of candidates) {
      const lane =
        job.action === "print" ? "print:" + job.printerId : job.action;
      if (this.active.has(lane)) continue;
      if (job.action === "print" && job.status === "pending") {
        const n = this.store.db
          .prepare(
            "SELECT COUNT(*) n FROM attempts WHERE json_extract(data,'$.printerId')=? AND json_extract(data,'$.at')>?",
          )
          .get(job.printerId ?? "", Date.now() - 60000) as any;
        if (n.n >= cfg.printRate) continue;
      }
      const p = this.process(job)
        .catch((e) => this.store.audit("worker.error", e.message))
        .finally(() => {
          this.active.delete(lane);
          this.busy = this.active.size > 0;
        });
      this.active.set(lane, p);
      this.busy = true;
      started.push(p);
    }
    await Promise.allSettled(started);
  }
  async process(job: any) {
    if (job.action === "print" && job.status === "accepted") {
      const secret = this.secrets.get(job.printerId);
      if (!secret) return;
      try {
        const done = await feieCall(secret, "Open_queryOrderState", {
          orderid: job.providerId,
        });
        this.save(job, {
          status: done === true || done === "true" ? "completed" : "accepted",
          lastPoll: Date.now(),
          error: null,
        });
      } catch {
        this.save(job, {
          lastPoll: Date.now(),
          error: "查询打印回执失败，等待下次查询",
        });
      }
      return;
    }
    if (job.action === "print") {
      if (job.origin !== "live" && !job.explicitTest) {
        this.save(job, { status: "dry_run" });
        return;
      }
      const printer = this.store.get("printers", job.printerId);
      const secret = this.secrets.get(job.printerId);
      if (!printer?.enabled || !secret) {
        this.save(job, { status: "blocked", error: "打印机未启用或未配置" });
        return;
      }
      const since = Date.now() - 60000;
      const used = (
        this.store.db
          .prepare(
            "SELECT COUNT(*) n FROM attempts WHERE json_extract(data,'$.printerId')=? AND json_extract(data,'$.at')>?",
          )
          .get(job.printerId, since) as any
      ).n;
      if (used >= this.store.setting("config").printRate) return;
      if (job.needsAvatar && job.avatar && !printer.imageSupported) {
        job.imageWarning = "此设备不支持动态头像，本单仅打印文字";
        job.needsAvatar = false;
      }
    }
    if (
      job.ruleId !== "device-test" &&
      job.createdAt < Date.now() - 120000 &&
      this.store.get("events", job.eventId)?.type === "join"
    ) {
      this.save(job, { status: "expired", error: "欢迎消息已过期" });
      return;
    }
    this.save(job, { status: "sending" });
    const prepared = await this.prepare(job);
    let { content, avatar, aiError } = prepared;
    const latest = this.store.get("jobs", job.id);
    if (latest.status !== "sending") return;
    if (this.store.setting("config").paused) {
      this.save(job, { status: "pending", content, avatar, enriched: true });
      return;
    }
    if (job.action === "overlay") {
      this.save(job, {
        content,
        avatar,
        enriched: true,
        status: "pending",
        error: aiError,
      });
      return;
    }
    if (job.action === "speech") {
      try {
        const file = await generateSpeech(
          content,
          job.language,
          job.voice,
          this.mediaDir,
        );
        this.save(job, {
          content,
          avatar,
          enriched: true,
          status: "ready",
          mediaUrl: "/api/v1/media/" + basename(file),
          error: aiError,
        });
      } catch {
        const fallback = join(this.mediaDir, `fallback-${job.language}.wav`);
        if (existsSync(fallback))
          this.save(job, {
            content,
            avatar,
            enriched: true,
            status: "ready",
            mediaUrl: "/api/v1/media/" + basename(fallback),
            error: "语音生成超时，使用预生成感谢音频",
          });
        else
          this.save(job, {
            status: "failed",
            error: "语音生成失败，且尚无预生成音频",
          });
      }
      return;
    }
    if (job.action === "print") {
      const secret = this.secrets.get(job.printerId)!;
      if (
        this.store.setting("config").physicalTestMode !== false &&
        !job.testPageReserved
      ) {
        const allowed = this.store.tx(() => {
          const used = this.store.setting("testPages") ?? 0;
          if (used >= 10) return false;
          this.store.setting("testPages", used + 1);
          job.testPageReserved = true;
          this.save(job, { testPageReserved: true });
          return true;
        });
        if (!allowed) {
          this.save(job, {
            status: "blocked",
            error: "测试打印总额度10张已用完；任务已保留",
          });
          return;
        }
      }
      const attempt = {
        id: randomUUID(),
        jobId: job.id,
        printerId: job.printerId,
        at: Date.now(),
      };
      this.store.put("attempts", attempt);
      try {
        let params: any = {
          content: feieContent(content),
          times: "1",
          // Font selection is a device capability, independent of content language.
          // Legacy devices use the verified multilingual Thai font channel.
          ...(this.store.get("printers", job.printerId)?.renderLanguage ===
          "default"
            ? {}
            : { language: "Thai" }),
        };
        let bytes: Buffer | undefined;
        let api = "Open_printMsg";
        if (job.needsAvatar && job.avatar) {
          bytes = prepared.avatarBytes;
          if (!bytes)
            throw Object.assign(Error("头像无法处理"), { definite: true });
          if (bytes.length > 10000)
            throw Object.assign(Error("头像超过飞鹅10KB限制"), {
              definite: true,
            });
          api = "Open_printLabelMsg";
          params.content =
            '<SIZE>40,70</SIZE><IMG x="10" y="10"/><TEXT x="10" y="240" font="12" w="1" h="1" r="0">' +
            feieContent(content).replace(/<BR>/g, " ") +
            "</TEXT>";
        }
        const order = await feieCall(secret, api, params, bytes);
        this.save(job, {
          content,
          avatar,
          status: "accepted",
          providerId: String(order),
          error: job.imageWarning ?? aiError,
          lastPoll: Date.now(),
        });
      } catch (e: any) {
        this.save(job, {
          status: e.definite ? "failed" : "unknown",
          error: e.definite ? e.message : "飞鹅发送结果未知，不自动重投",
        });
      }
      return;
    }
  }

  async prepare(job: any) {
    const key = job.explicitTest ? job.id : `${job.eventId}:${job.ruleId}`;
    const cached = this.store.get("feedback", key);
    if (cached)
      return {
        ...cached,
        avatarBytes:
          cached.avatarFile &&
          existsSync(join(this.mediaDir, cached.avatarFile))
            ? readFileSync(join(this.mediaDir, cached.avatarFile))
            : undefined,
      };
    if (this.preparing.has(key)) return this.preparing.get(key)!;
    const promise = (async () => {
      let content = job.content,
        aiError = null,
        avatar = job.avatar,
        avatarFile = null;
      let bytes: Buffer | undefined;
      if (job.ai && !job.enriched) {
        try {
          content = await generateText(job, this.store.setting("config"));
        } catch {
          aiError = "AI超时或不可用，已使用固定模板";
        }
      }
      if (avatar && !avatar.startsWith("/api/")) {
        try {
          bytes = await avatarBytes(avatar);
          avatarFile =
            createHash("sha256").update(avatar).digest("hex") + ".png";
          writeFileSync(join(this.mediaDir, avatarFile), bytes);
          avatar = "/api/v1/media/" + avatarFile;
        } catch {
          avatar = null;
        }
      }
      const data = {
        id: key,
        roomId: job.roomId,
        content,
        avatar,
        avatarFile,
        aiError,
      };
      this.store.put("feedback", data);
      return { ...data, avatarBytes: bytes };
    })().finally(() => this.preparing.delete(key));
    this.preparing.set(key, promise);
    return promise;
  }
}
