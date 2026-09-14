import { readFileSync } from "node:fs";
import { campaignPreset } from "../src/shared/campaign.ts";
const token = readFileSync("var/admin-token", "utf8").trim();
async function api(
  p: string,
  body?: unknown,
  method = body ? "POST" : "GET",
): Promise<any> {
  const r = await fetch("http://127.0.0.1:8890/api/v1" + p, {
    method,
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw Error(p + ":" + r.status);
  return r.json();
}
const state = await api("/state");
await api("/settings", { paused: true });
for (const p of state.printers)
  await api("/printers/" + p.id, { enabled: false }, "PATCH");
for (const room of state.rooms) {
  const language = room.platform === "douyin" ? "zh" : "th";
  await api("/rooms/" + room.id, { language, printerId: null }, "PATCH");
  for (const r of state.rules.filter(
    (r: any) => r.roomId === room.id && r.enabled,
  ))
    await api("/rules/" + r.id, { enabled: false }, "PATCH");
  for (const p of campaignPreset(language)) {
    const templateName = "心愿邮局/" + language + "/" + p.key;
    const old = state.templates.find((t: any) => t.name === templateName);
    const template = await api(
      "/templates" + (old ? "/" + old.id : ""),
      { name: templateName, language, body: p.body },
      old ? "PATCH" : "POST",
    );
    // Reuse newly created language templates if multiple rooms share a platform.
    if (!old) state.templates.push(template);
    const ruleName = p.name;
    const existing = state.rules.find(
      (r: any) => r.roomId === room.id && r.templateId === template.id,
    );
    await api(
      "/rules" + (existing ? "/" + existing.id : ""),
      {
        roomId: room.id,
        name: ruleName,
        enabled: true,
        priority: p.priority,
        eventType: p.eventType,
        keywords: p.keywords,
        giftIds: [],
        minCount: p.minCount,
        cooldownSec: p.cooldownSec,
        oncePerSession: p.oncePerSession,
        continueMatching: false,
        templateId: template.id,
        actions: [...p.actions],
        ai: false,
        avatar: true,
      },
      existing ? "PATCH" : "POST",
    );
  }
}
console.log(
  "Installed Chinese/Thai campaign. Dispatch paused; all printers disabled.",
);
