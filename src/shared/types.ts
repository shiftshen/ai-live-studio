export type Platform = "tiktok" | "douyin";
export type Language = "zh" | "th" | "en";
export type EventType = "join" | "follow" | "comment" | "gift" | "like";
export type Action = "print" | "speech" | "overlay";
export interface Room {
  id: string;
  name: string;
  platform: Platform;
  address: string;
  language: Language;
  voice: string;
  printerId: string | null;
  enabled: boolean;
  status: string;
  error: string | null;
  sessionId: string;
  persona: string;
  knowledge: string;
  overlayToken?: string;
  capabilities: Record<string, string>;
}
export interface LiveEvent {
  id: string;
  platform: Platform;
  roomId: string;
  sessionId: string;
  sourceId: string;
  userId: string;
  nickname: string;
  avatar?: string;
  type: EventType;
  origin: "live" | "replay" | "simulated";
  text: string;
  giftId?: string;
  giftName?: string;
  count: number;
  streakId?: string;
  streakable?: boolean;
  repeatEnd?: boolean;
  historical?: boolean;
  identityReliable?: boolean;
  occurredAt: number;
  receivedAt: number;
  status?: string;
}
export interface Rule {
  id: string;
  roomId: string;
  name: string;
  enabled: boolean;
  priority: number;
  eventType: EventType;
  keywords: string[];
  giftIds: string[];
  minCount: number;
  cooldownSec: number;
  oncePerSession: boolean;
  continueMatching: boolean;
  templateId: string;
  actions: Action[];
  ai: boolean;
  avatar: boolean;
  version: number;
}
export interface Template {
  id: string;
  name: string;
  language: Language;
  body: string;
  version: number;
}
export interface Printer {
  id: string;
  name: string;
  snLast4: string;
  configured: boolean;
  status: string;
  imageSupported: boolean;
  renderLanguage: "Thai" | "default";
  paperWidth: number;
  enabled: boolean;
  lastChecked: number | null;
  error: string | null;
}
export interface Job {
  id: string;
  roomId: string;
  sessionId: string;
  eventId: string;
  ruleId: string;
  ruleVersion: number;
  templateVersion: number;
  action: Action;
  status: string;
  content: string;
  nickname: string;
  avatar: string | null;
  origin: string;
  priority: number;
  createdAt: number;
  updatedAt: number;
  error: string | null;
  providerId: string | null;
  parentId: string | null;
  printerId: string | null;
  mediaUrl?: string | null;
}
export interface Audit {
  id: number;
  at: number;
  actor: string;
  action: string;
  detail: string;
  roomId: string | null;
}
export interface Settings {
  paused: boolean;
  physicalTestMode?: boolean;
  printRate: number;
  printQueueLimit: number;
  eventRetentionDays: number;
  jobRetentionDays: number;
  avatarRetentionHours: number;
  aiModel: string;
  aiUrl: string;
  speechVolume: number;
  speechRate: number;
}
export interface Snapshot {
  rooms: Room[];
  rules: Rule[];
  templates: Template[];
  printers: Printer[];
  events: LiveEvent[];
  jobs: Job[];
  audits: Audit[];
  settings: Settings;
  stats: {
    events: number;
    jobs: number;
    pending: number;
    completed: number;
    failed: number;
    gifts: number;
  };
  testPagesUsed?: number;
  role: "admin" | "operator" | "viewer";
  blockedUsers: { roomId: string; userId: string }[];
}
