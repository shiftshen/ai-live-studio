# Dycast 1.4.1 public-event field repair

Upstream: https://github.com/qinant/dycast-desktop

Pinned revision: `70050e27092fc726e3f7c84339b0edfd36d70130` (v1.4.1), MIT. Original LICENSE and NOTICE are included. No proprietary binary patching, private account data, messaging, or broadcasting is involved.

## Changes

- User identity: retain nonempty, nonzero public `secUid`; otherwise use public decimal `idStr` then `id`, excluding zero and malformed IDs. Keep int64 strings without Number conversion. Never generate IDs from nicknames. Missing identifiers remain undefined. The pinned protobuf User has `id` (field 1) and `secUid`, **no idStr**; the latter is forward-compatible only and does not add an unsupported protobuf field.
- Gift: propagate original message `groupId` into `gift.groupId`; preserve upstream `gift.type` and `repeatEnd`. A missing group remains missing. Never manufacture combo identity.
- Social: expose raw `action` string and normalized `socialAction` (`follow`, `share`, `unknown`). Action 1 is follow, 2 is share; unknown/missing actions are generic social interactions and do not update follower count. This mapping is supported by the public protocol sample reference at https://github.com/opedium/douyin-live-proto/blob/master/docs/complete_payload_reference.md . It is not a claim of an official guaranteed platform contract; keep raw action for future revisions.

## Rebuild on macOS

Requires Node/npm, Rust/cargo and Xcode Command Line Tools. The script checks out the pinned revision, applies the reviewable patch, installs the upstream npm lockfile, runs tests, builds a macOS app, copies it to a distinct destination, applies a local ad-hoc signature and verifies its code signature. Build cache lives on the project's disk. It does not start the app. An existing destination causes failure instead of overwrite.

```sh
/Volumes/M2USB/Projects/ai-live-studio/integrations/dycast/build.sh
```

Default result: `/Volumes/M2USB/Projects/ai-live-studio/var/vendor/Dycast AI Live Studio.app`.

`DYCAST_BUILD_DIR` optionally selects an existing checkout of the exact revision. `CARGO_TARGET_DIR` optionally selects the Cargo cache. `DYCAST_APP_DESTINATION` can select another non-existing output path. The local ad-hoc signature is not Apple notarization. `build-config.json` gives the app a separate identifier and product name and disables upstream updater endpoints so an upstream release cannot silently remove this local fix. Original running Dycast settings/app remain separate.

## Validation boundaries

`test-public-fields.mjs` has 15 behavioral cases, 3 wiring assertions and 6 assertions exercising actual upstream protobuf encoders/decoders (64-bit ID, gift group/type, social action). Fixtures are explicitly synthetic codec inputs, not captured users or production events. Type-check/build proves compilation; A read-only live session on 2026-09-14 subsequently observed reliable public numeric IDs for comment/join/like/follow through the patched app. Real gift/group-end coverage is still unverified. Existing captures made by the old app cannot recover dropped IDs or group IDs. If the upstream websocket omits all real identifiers, viewers remain anonymous. Identifier availability may vary across event types; switching between secUid and numeric IDs is not automatically linked by this patch.
