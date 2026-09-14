<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import LiveStage from "./LiveStage.vue";
import { api } from "../api";
import type { Job } from "../../shared/types";
const roomId = decodeURIComponent(location.pathname.split("/")[2] || "");
const token = new URLSearchParams(location.search).get("token") || "";
const suffix = "?token=" + encodeURIComponent(token);
const current = ref<Job | null>(null),
  error = ref(""),
  needsPlay = ref(false),
  paused = ref(true);
let stopped = false,
  audio: HTMLAudioElement | null = null,
  timer: ReturnType<typeof setTimeout> | undefined,
  monitor: ReturnType<typeof setInterval>;
const handled = new Set<string>();
const transparent =
  new URLSearchParams(location.search).get("transparent") === "1";
const language = ref<"zh" | "th">("zh");
const rewards = ref<
  Array<{
    id: string;
    name: string;
    minCount: number;
    giftIds: string[];
    actions: string[];
  }>
>([]);
type Payload = {
  jobs: Job[];
  room: { language: string };
  rewards: typeof rewards.value;
  settings: { speechVolume: number; speechRate: number; paused: boolean };
};
function scopedMedia(path: string) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) return "";
  url.searchParams.set("token", token);
  url.searchParams.set("roomId", roomId);
  return url.href;
}
async function read() {
  const d = await api<Payload>(
    `/overlay/${encodeURIComponent(roomId)}${suffix}`,
  );
  language.value = d.room.language === "th" ? "th" : "zh";
  rewards.value = d.rewards || [];
  document.title =
    language.value === "th"
      ? "AI Live Studio · Thai Live"
      : "AI Live Studio · 抖音直播画面";
  const wasPaused = paused.value;
  paused.value = d.settings.paused;
  if (paused.value) audio?.pause();
  else if (wasPaused && audio && !audio.ended && !needsPlay.value) await play();
  return d;
}
async function ack(j: Job) {
  let d = await read();
  while (d.settings.paused && !stopped) {
    await new Promise((r) => setTimeout(r, 1000));
    d = await read();
  }
  if (stopped) return;
  await api(`/overlay/${encodeURIComponent(roomId)}/ack${suffix}`, {
    jobId: j.id,
  });
  handled.add(j.id);
}
async function play() {
  if (paused.value) return;
  try {
    await audio?.play();
    needsPlay.value = false;
  } catch {
    needsPlay.value = true;
  }
}
async function display() {
  let elapsed = 0;
  while (elapsed < 6000 && !stopped) {
    await new Promise((r) => setTimeout(r, 250));
    if (!paused.value) elapsed += 250;
  }
}
async function poll() {
  try {
    const d = await read();
    error.value = "";
    if (d.settings.paused) return;
    for (const j of d.jobs) {
      if (stopped || paused.value) break;
      if (
        handled.has(j.id) ||
        !(
          (j.action === "speech" && j.status === "ready") ||
          (j.action === "overlay" && j.status === "pending")
        )
      )
        continue;
      current.value = j;
      if (j.action === "speech" && j.mediaUrl) {
        audio = new Audio(scopedMedia(j.mediaUrl));
        audio.volume = Math.max(0, Math.min(1, d.settings.speechVolume));
        audio.playbackRate = d.settings.speechRate || 1;
        await new Promise<void>((resolve, reject) => {
          audio!.onended = () => resolve();
          audio!.onerror = () => reject(new Error("语音播放失败，未确认完成"));
          play();
        });
        audio = null;
        await ack(j);
      } else if (j.action === "overlay") {
        await display();
        await ack(j);
      }
      current.value = null;
    }
  } catch (e) {
    error.value = (e as Error).message;
    audio?.pause();
    audio = null;
    current.value = null;
  } finally {
    if (!stopped) timer = setTimeout(poll, 1500);
  }
}
onMounted(() => {
  poll();
  monitor = setInterval(() => {
    read().catch((e) => {
      error.value = (e as Error).message;
      paused.value = true;
      audio?.pause();
    });
  }, 1000);
});
onUnmounted(() => {
  stopped = true;
  clearTimeout(timer);
  clearInterval(monitor);
  audio?.pause();
});
</script>
<template>
  <LiveStage
    v-if="!transparent"
    :language="language"
    :current="current"
    :paused="paused"
    :needs-play="needsPlay"
    :error="error"
    :rewards="rewards"
    @play="play"
  />
  <div v-else class="obs-surface">
    <div v-if="current && !paused" class="obs-caption">
      <img
        v-if="current.avatar && scopedMedia(current.avatar)"
        class="obs-avatar"
        :src="scopedMedia(current.avatar)"
        alt="观众头像"
      /><strong>{{ current.nickname }}</strong>
      <p>{{ current.content }}</p>
    </div>
    <button v-if="needsPlay && !paused" class="obs-play" @click="play">
      点击启用语音播放
    </button>
    <p v-if="error" class="obs-error">{{ error }}</p>
  </div>
</template>
