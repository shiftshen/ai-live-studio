<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import LiveStage from "./LiveStage.vue";
import { api } from "../api";
import type { Job } from "../../shared/types";

const roomId = decodeURIComponent(location.pathname.split("/")[2] || "");
const token = new URLSearchParams(location.search).get("token") || "";
const suffix = "?token=" + encodeURIComponent(token);
const roomIdSafe = () => encodeURIComponent(roomId);
const current = ref<Job | null>(null);
const error = ref("");
const needsPlay = ref(false);
const paused = ref(true);

let stopped = false;
let audio: HTMLAudioElement | null = null;
let waitingSpeech: HTMLAudioElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let monitor: ReturnType<typeof setInterval>;

const handled = new Set<string>();
const transparent = new URLSearchParams(location.search).get("transparent") === "1";
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
const totals = ref({ viewers: 0, follows: 0, likes: 0, gifts: 0 });

type Payload = {
  jobs: Job[];
  room: { language: string };
  rewards: typeof rewards.value;
  totals: typeof totals.value;
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
  const d = await api<Payload>(`/overlay/${roomIdSafe()}${suffix}`);
  language.value = d.room.language === "th" ? "th" : "zh";
  rewards.value = d.rewards || [];
  totals.value = d.totals || { viewers: 0, follows: 0, likes: 0, gifts: 0 };
  document.title =
    language.value === "th"
      ? "AI Live Studio · Thai Live"
      : "AI Live Studio · 抖音直播画面";
  const wasPaused = paused.value;
  paused.value = d.settings.paused;
  if (paused.value) {
    stopAudio();
  } else if (
    wasPaused &&
    audio &&
    !audio.ended &&
    !needsPlay.value &&
    !waitingSpeech
  ) {
    await playAudio(audio, true);
  }
  return d;
}

async function ack(j: Job) {
  let d = await read();
  while (d.settings.paused && !stopped) {
    await new Promise((r) => setTimeout(r, 1000));
    d = await read();
  }
  if (stopped) return;
  await api(`/overlay/${roomIdSafe()}/ack${suffix}`, {
    jobId: j.id,
  });
  handled.add(j.id);
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    audio = null;
  }
}

function clearWaitingSpeech() {
  if (waitingSpeech) {
    waitingSpeech.onended = null;
    waitingSpeech.onpause = null;
    waitingSpeech.onerror = null;
    waitingSpeech = null;
  }
}

function finishSpeech(result: boolean) {
  clearWaitingSpeech();
  waitingSpeech = null;
  needsPlay.value = !result;
  if (!result) {
    error.value = "语音播放被拦截，点击按钮后可继续播报";
  }
}

async function waitSpeechFinished(player: HTMLAudioElement) {
  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      player.pause();
      resolve(false);
    }, 18000);
    player.onended = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    player.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    player.onpause = () => {
      clearTimeout(timeout);
      resolve(player.currentTime > 0.25);
    };
  });
}

async function playAudio(player: HTMLAudioElement, isAuto = false) {
  if (paused.value) return false;
  try {
    await player.play();
    if (!isAuto) {
      return true;
    }
    return true;
  } catch {
    player.onended = null;
    player.onerror = null;
    player.onpause = null;
    waitingSpeech = player;
    needsPlay.value = true;
    return false;
  }
}

async function play() {
  if (paused.value) return;
  const player = waitingSpeech || audio;
  if (!player) return;
  const started = await playAudio(player);
  if (!started) return;
  const finished = await waitSpeechFinished(player);
  finishSpeech(finished);
  if (
    finished &&
    waitingSpeech === null &&
    current.value &&
    current.value.action === "speech" &&
    current.value.id
  ) {
    await ack(current.value);
    current.value = null;
    audio = null;
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
    if (waitingSpeech) {
      needsPlay.value = true;
      return;
    }
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
        stopAudio();
        audio = new Audio(scopedMedia(j.mediaUrl));
        audio.volume = Math.max(0, Math.min(1, d.settings.speechVolume));
        audio.playbackRate = d.settings.speechRate || 1;
        const started = await playAudio(audio);
        if (!started) {
          needsPlay.value = true;
          return;
        }
        const finished = await waitSpeechFinished(audio);
        finishSpeech(finished);
        if (!finished) {
          needsPlay.value = true;
          return;
        }
        current.value = null;
        await ack(j);
        audio = null;
      } else if (j.action === "overlay") {
        await display();
        await ack(j);
        current.value = null;
      }
    }
  } catch (e) {
    error.value = (e as Error).message;
    stopAudio();
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
      stopAudio();
    });
  }, 1000);
});

onUnmounted(() => {
  stopped = true;
  clearTimeout(timer);
  clearInterval(monitor);
  stopAudio();
  clearWaitingSpeech();
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
    :totals="totals"
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
