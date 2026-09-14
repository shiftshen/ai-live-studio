# Camera Print Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a one-click Douyin/TikTok live workflow whose main scene is a real camera view of the printer, with simple rewards, live like totals, localized speech, and bounded duplicate-safe physical printing.

**Architecture:** Keep platform collection, durable rules and the Feie worker unchanged. Add an aggregate live-status contract to the room overlay, replace the ornamental full-screen scene with a transparent camera-first HUD, install a smaller event/reward matrix, and add a native launcher that starts and diagnoses every local component before the operator presses the official platform start button.

**Tech Stack:** Vue 3, TypeScript, Fastify, SQLite, Swift/WebKit, Dycast, OmniVoice, Feie API.

---

### Task 1: Like totals and simple rewards

**Files:**

- Modify: `src/shared/campaign.ts`
- Modify: `src/server/routes/delivery.ts`
- Test: `tests/campaign.test.ts`
- Test: `tests/overlay.test.ts`

- [ ] Write failing tests asserting follow prints/speaks/displays, like milestones 10/50/100 use cumulative totals, and the overlay returns live totals.
- [ ] Run `npm test -- tests/campaign.test.ts tests/overlay.test.ts`; expect the new assertions to fail.
- [ ] Add the Chinese and Thai templates/rules and compute per-session likes, follows, viewers and gifts from durable live events.
- [ ] Run the focused tests; expect all new assertions to pass.

### Task 2: Camera-first live HUD

**Files:**

- Modify: `src/client/components/Overlay.vue`
- Modify: `src/client/components/LiveStage.vue`
- Modify: `src/client/style.css`
- Test: `tests/campaign.test.ts`

- [ ] Add failing content-contract assertions for the five visible reward rows and cumulative like counter.
- [ ] Run the focused test and confirm the expected missing labels.
- [ ] Replace the full background with a narrow dynamic HUD: compact title, reward rail, live counters, and temporary interaction card. Put it beside the phone camera source because Douyin Live Companion renders transparent WebKit capture as white on this host.
- [ ] Build and inspect at 432×768 and 1080×1920; verify long Chinese/Thai names do not overlap.

### Task 3: One-click launcher and readiness

**Files:**

- Create: `scripts/live-control.mjs`
- Create: `scripts/build-live-launcher.sh`
- Create: `src/native/LiveLauncher.swift`
- Modify: `package.json`
- Test: `tests/live-control.test.ts`

- [ ] Write failing tests for idempotent start, four readiness checks, and safe stop that leaves the official live ending action to the operator.
- [ ] Run the focused test and confirm the launcher module is missing.
- [ ] Implement service start, overlay app launch, Dycast launch, printer status check and structured readiness output; implement the native launcher with Start, Diagnose and Stop Local Tools actions.
- [ ] Run tests, build the app and verify repeated starts do not create duplicate services.

### Task 4: Physical configuration and tutorial

**Files:**

- Modify: `scripts/install-campaign.ts`
- Create: `docs/USER-GUIDE.md`
- Modify: `README.md`

- [ ] Add a failing campaign assertion that every live print action remains dry-run for simulated/replayed events and that duplicate source events never create a second print.
- [ ] Run the focused test and confirm the new installed action contract fails.
- [ ] Install the approved rules, bind the existing verified Feie printer, disable the ten-page test cap for operating mode, retain rate/queue/dedupe protection, and check online status before resuming.
- [ ] Write the exact startup, camera layout, preflight, start-live, stop-live and fault-recovery steps with screenshots/paths where available.

### Task 5: Real verification and delivery

**Files:**

- Modify: `docs/ACCEPTANCE.md`
- Modify: `docs/OWN-LIVE-RESULT.md`

- [ ] Run `npm run check`, `npm test`, `npm run build`, native launcher build and credential scan.
- [ ] Verify the camera plus HUD in the official companion preview, then connect the real room and check a real comment/like/follow/gift when observed.
- [ ] Record provider job IDs separately from physical paper observation; do not call provider acceptance paper success.
- [ ] Commit explicit project files, push `main`, and wait for both GitHub jobs to pass.
