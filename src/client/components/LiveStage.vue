<script setup lang="ts">
import { computed } from "vue";
import {
  Camera,
  Gift,
  Heart,
  Printer,
  UserPlus,
  Users,
  Volume2,
} from "lucide-vue-next";
import type { Job } from "../../shared/types";
const props = defineProps<{
  language: "zh" | "th";
  current: Job | null;
  paused: boolean;
  needsPlay: boolean;
  error: string;
  rewards: Array<{
    id: string;
    name: string;
    minCount: number;
    giftIds: string[];
    actions: string[];
  }>;
  totals: { viewers: number; follows: number; likes: number; gifts: number };
}>();
defineEmits<{ play: [] }>();
const th = computed(() => props.language === "th");
const media = computed(() => {
  if (!props.current?.avatar) return "";
  const u = new URL(props.current.avatar, location.origin);
  if (u.origin !== location.origin) return "";
  const q = new URLSearchParams(location.search);
  u.searchParams.set("token", q.get("token") || "");
  u.searchParams.set("roomId", location.pathname.split("/")[2]);
  return u.href;
});
</script>
<template>
  <main class="live-hud" :lang="language">
    <header>
      <div class="brand">
        <Printer /><span
          ><b>{{ th ? "เครื่องพิมพ์ตอบกลับ" : "关注就打印" }}</b
          ><small>AI LIVE PRINTER</small></span
        >
      </div>
      <span class="live-state" :class="{ paused }"
        >●
        {{
          paused
            ? th
              ? "หยุดชั่วคราว"
              : "互动暂停"
            : th
              ? "กำลังทำงาน"
              : "实时运行"
        }}</span
      >
    </header>
    <aside class="reward-rail">
      <h1>{{ th ? "ร่วมสนุก" : "互动奖励" }}</h1>
      <p>
        <UserPlus /><span
          ><b>{{ th ? "ติดตาม" : "关注" }}</b
          ><small>{{
            th ? "พิมพ์รูปโปรไฟล์" : "打印头像＋语音感谢"
          }}</small></span
        >
      </p>
      <p>
        <Heart /><span
          ><b>{{ th ? "กดไลก์" : "点赞" }} 10 / 50 / 100</b
          ><small>{{
            th ? "ประกาศยอดไลก์" : "实时累计＋里程碑播报"
          }}</small></span
        >
      </p>
      <p>
        <Gift /><span
          ><b>{{ th ? "ของขวัญ 1 ชิ้น" : "小心心／任意礼物" }}</b
          ><small>{{
            th ? "พิมพ์รูปพร้อมขอบคุณ" : "打印头像＋礼物感谢"
          }}</small></span
        >
      </p>
      <p>
        <Gift /><span
          ><b>{{ th ? "ของขวัญ 10 ชิ้น" : "礼物 × 10" }}</b
          ><small>{{ th ? "คำอวยพรพิเศษ" : "头像＋专属祝福" }}</small></span
        >
      </p>
      <p>
        <Gift /><span
          ><b>{{ th ? "ของขวัญ 66 ชิ้น" : "礼物 × 66" }}</b
          ><small>{{
            th ? "รูปใหญ่และคำอวยพร" : "大图＋特别祝福"
          }}</small></span
        >
      </p>
    </aside>
    <section class="camera-guide">
      <Camera /><span>{{
        th ? "กล้องถ่ายเครื่องพิมพ์จริง" : "实拍打印区"
      }}</span>
    </section>
    <section v-if="current && !paused" class="feedback-card" aria-live="polite">
      <img v-if="media" :src="media" alt="" />
      <div>
        <strong>{{ current.nickname }}</strong>
        <p>{{ current.content }}</p>
      </div>
      <Volume2 />
    </section>
    <section class="live-totals" aria-label="本场实时数据">
      <span
        ><Users /><b>{{ totals.viewers }}</b
        ><small>{{ th ? "เข้าห้อง" : "进场" }}</small></span
      ><span
        ><UserPlus /><b>{{ totals.follows }}</b
        ><small>{{ th ? "ติดตาม" : "关注" }}</small></span
      ><span class="likes"
        ><Heart /><b>{{ totals.likes }}</b
        ><small>{{ th ? "ไลก์" : "点赞" }}</small></span
      ><span
        ><Gift /><b>{{ totals.gifts }}</b
        ><small>{{ th ? "ของขวัญ" : "礼物" }}</small></span
      >
    </section>
    <button
      v-if="needsPlay && !paused"
      class="enable-audio"
      @click="$emit('play')"
    >
      <Volume2 />{{ th ? "เปิดเสียง" : "开启语音" }}
    </button>
    <p v-if="error" class="error">
      {{ th ? "การเชื่อมต่อขัดข้อง" : "互动连接异常" }}：{{ error }}
    </p>
  </main>
</template>
<style scoped>
.live-hud {
  --panel: rgba(8, 12, 15, 0.82);
  --hot: #ff315f;
  position: relative;
  width: 100%;
  height: 100dvh;
  min-height: 720px;
  overflow: hidden;
  background: transparent;
  color: #fff;
  font-family: "PingFang SC", "Noto Sans Thai", sans-serif;
  text-shadow: 0 1px 3px #000;
  padding: 18px;
  box-sizing: border-box;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--panel);
  border-left: 5px solid var(--hot);
  padding: 10px 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 9px;
}
.brand svg {
  width: 25px;
}
.brand span {
  display: grid;
}
.brand b {
  font-size: 19px;
}
.brand small {
  font-size: 8px;
  letter-spacing: 2px;
  color: #c9d2d4;
}
.live-state {
  font-size: 11px;
  color: #6ef2b1;
}
.live-state.paused {
  color: #ffc75f;
}
.reward-rail {
  position: absolute;
  left: 18px;
  top: 92px;
  width: 235px;
  background: var(--panel);
  padding: 13px 14px 8px;
  border-radius: 2px;
}
.reward-rail h1 {
  font-size: 24px;
  margin: 0 0 8px;
}
.reward-rail p {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 9px 0;
  border-top: 1px solid #ffffff35;
}
.reward-rail svg {
  width: 25px;
  color: #ff7896;
  flex: none;
}
.reward-rail span {
  display: grid;
  min-width: 0;
}
.reward-rail b {
  font-size: 14px;
  overflow-wrap: anywhere;
}
.reward-rail small {
  font-size: 10px;
  color: #d4dcde;
  margin-top: 2px;
}
.camera-guide {
  position: absolute;
  right: 20px;
  top: 96px;
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 7px 9px;
  border: 1px dashed #ffffff9c;
  background: #0006;
  font-size: 10px;
}
.camera-guide svg {
  width: 16px;
}
.feedback-card {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 95px;
  display: flex;
  align-items: center;
  gap: 11px;
  background: #fff;
  color: #16191b;
  text-shadow: none;
  border-left: 6px solid var(--hot);
  padding: 11px 13px;
  box-shadow: 0 6px 25px #0008;
}
.feedback-card img {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
}
.feedback-card div {
  min-width: 0;
  flex: 1;
}
.feedback-card strong {
  font-size: 17px;
  overflow-wrap: anywhere;
}
.feedback-card p {
  font-size: 12px;
  line-height: 1.35;
  margin: 3px 0 0;
  overflow-wrap: anywhere;
  max-height: 3.9em;
  overflow: hidden;
}
.feedback-card > svg {
  color: var(--hot);
  flex: none;
}
.live-totals {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 18px;
  height: 63px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--panel);
}
.live-totals span {
  display: grid;
  grid-template-columns: 18px auto;
  grid-template-rows: 1fr 1fr;
  align-items: center;
  justify-content: center;
  column-gap: 5px;
  border-left: 1px solid #ffffff29;
  padding: 7px;
}
.live-totals span:first-child {
  border: 0;
}
.live-totals svg {
  width: 17px;
  grid-row: 1/3;
}
.live-totals b {
  font:
    700 19px ui-monospace,
    monospace;
}
.live-totals small {
  font-size: 9px;
  color: #d4dcde;
}
.live-totals .likes {
  background: #ff315f26;
}
.enable-audio {
  position: absolute;
  inset: auto 18px 94px auto;
  background: var(--hot);
  color: #fff;
  border: 0;
  padding: 10px 13px;
  display: flex;
  gap: 7px;
  align-items: center;
  font-weight: 700;
}
.enable-audio:focus-visible {
  outline: 3px solid #fff;
}
.error {
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: 164px;
  background: #8a1227e8;
  padding: 10px;
  font-size: 11px;
}
@media (max-height: 760px) {
  .reward-rail {
    top: 78px;
  }
  .reward-rail p {
    padding: 7px 0;
  }
  .feedback-card {
    bottom: 87px;
  }
  .live-totals {
    bottom: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}
.live-hud {
  background: transparent;
  padding: 12px;
}
.reward-rail {
  left: 12px;
  right: 12px;
  top: 82px;
  width: auto;
}
.camera-guide {
  display: none;
}
.feedback-card {
  left: 12px;
  right: 12px;
  bottom: 124px;
}
.live-totals {
  left: 12px;
  right: 12px;
  bottom: 12px;
  height: 100px;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}
.live-totals span:nth-child(3) {
  border-left: 0;
  border-top: 1px solid #ffffff29;
}
.live-totals span:nth-child(4) {
  border-top: 1px solid #ffffff29;
}
.brand b {
  font-size: 16px;
}
.live-state {
  font-size: 9px;
}
</style>
