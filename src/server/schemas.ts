import { z } from "zod";
export const text = z.string().max(2000);
export const id = z.string().min(1).max(200);
export const roomSchema = z.object({
  name: z.string().min(1).max(80),
  platform: z.enum(["douyin", "tiktok"]),
  address: z.string().max(500).default(""),
  language: z.enum(["zh", "th", "en"]).default("zh"),
  voice: z.string().max(100).default("thai-zixia"),
  printerId: z.string().nullable().default(null),
  enabled: z.boolean().default(true),
  persona: text.default("你是友好的直播主持人。"),
  knowledge: z.string().max(10000).default(""),
});
export const ruleSchema = z.object({
  roomId: id,
  name: z.string().min(1).max(80),
  enabled: z.boolean(),
  priority: z.number().int().min(0).max(1000),
  eventType: z.enum(["join", "follow", "comment", "gift", "like"]),
  keywords: z.array(z.string().min(1).max(100)).max(30),
  giftIds: z.array(z.string().max(100)).max(100),
  minCount: z.number().int().min(1).max(100000000),
  cooldownSec: z.number().int().min(0).max(86400),
  oncePerSession: z.boolean(),
  continueMatching: z.boolean(),
  templateId: id,
  actions: z
    .array(z.enum(["print", "speech", "overlay"]))
    .min(1)
    .max(3),
  ai: z.boolean(),
  avatar: z.boolean(),
});
export const templateSchema = z.object({
  name: z.string().min(1).max(80),
  language: z.enum(["zh", "th", "en"]),
  body: z.string().min(1).max(400),
});
