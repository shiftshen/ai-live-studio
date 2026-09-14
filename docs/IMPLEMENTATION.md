# AI Live Studio implementation contract

Target: real Douyin/TikTok event → durable rules → text/avatar print, speech, OBS overlay. New standalone repo. No DAMO business writes, no paid signing purchase, no posting/gifting to public rooms. Up to 10 authorized test pages. Do not claim physical paper based on provider acceptance.

Architecture: Vue3/TS frontend, Fastify/TS API, Node builtin SQLite durable events/outbox, isolated live adapters, Feie cloud, Ollama, existing OmniVoice. Bind 127.0.0.1:8890. Runtime var/ is ignored. Single instance. Each room/session has isolated identity, rules and access.

## Frontend API contract

All requests same origin. GET /api/v1/session → {authenticated:boolean}; POST /api/v1/login {token} sets HttpOnly cookie. Local bootstrap token at var/admin-token (never embed). GET /api/v1/state → Snapshot from src/shared/types.ts. Errors {error:string}; writes return {ok:true} or object. Use polling state every 3s or GET /api/v1/stream SSE.

- POST /api/v1/rooms full Room input (id optional); PATCH /api/v1/rooms/:id partial editable fields; POST /api/v1/rooms/:id/connect, /disconnect, /new-session.
- POST /api/v1/rules Rule (id optional), PATCH /api/v1/rules/:id partial, DELETE /api/v1/rules/:id.
- POST /api/v1/templates Template (id optional), PATCH /api/v1/templates/:id partial.
- POST /api/v1/simulate {roomId,type,nickname,text,giftId,giftName,count,userId?,repeatEnd?,streakId?} → {event,matches,jobs}. Always simulated. POST /api/v1/preview same input → {matches:[{ruleId,name,content,actions,reason}],reasons:string[]}; no writes/actions.
- POST /api/v1/replay {roomId,eventIds:string[]} forces replay.
- POST /api/v1/settings partial Settings. POST /api/v1/jobs/:id/cancel, /retry (safe only), /reprint (explicit separate physical job).
- POST /api/v1/printers/:id/check; POST /api/v1/printers {name,sn,user,ukey,apiBase?,paperWidth?,imageSupported?}; secrets write-only. PATCH printer /:id supports enabled,paperWidth,imageSupported,name.
- POST /api/v1/printers/:id/test {text,language} one physical page, max ten test pages per installation.
- POST /api/v1/blocked-users {roomId,userId}; DELETE same URL JSON body.
- GET /api/v1/export?kind=events|jobs|fans CSV; POST /api/v1/backup returns {name}; POST /api/v1/restore {name} offline-safe restores with restart response.
- GET /api/v1/diagnostics → {checks:[{name,status,detail}]}; POST /api/v1/speech/preview {roomId,text} → {url,status,error?}.
- POST /api/v1/access {role,roomIds} → {token} admin only, GET access returns redacted entries.
- /overlay/:roomId?token=... is standalone OBS surface. GET /api/v1/overlay/:roomId?token=... → {room:{name,language},jobs:Job[],settings:{speechVolume,speechRate}}. POST /api/v1/overlay/:roomId/ack?token=... {jobId} marks only pending overlay/speech jobs completed; speech ACK after actual playback ended. Authenticated /api/v1/media/:name supports admin cookie OR valid room overlay token with roomId query.

## Acceptance

Backend tests: dedupe, gift cumulative quantities/final/late, cooldown, historical/replay physical guard, transaction durability, timeout unknown/no blind retry, permissions, SSRF, template injection. Browser real desktop/mobile flows. 100 events/s 10min and 2h soak separate artifacts. Live event receipts, physical paper and actual OBS audio reported independently.
