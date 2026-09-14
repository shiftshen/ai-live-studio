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
      <h1>{{ th ? "活动规则" : "互动规则" }}</h1>
      <p>
        <UserPlus /><span
          ><b>{{ th ? "ติดตาม" : "关注 3 种奖励" }}</b
          ><small>{{
            th ? "พิมพ์โปรไฟล์ + ขอบคุณเสียง" : "关注后自动打印头像与语音"
          }}</small></span
        >
      </p>
      <p>
        <Heart /><span
          ><b>{{ th ? "กดไลก์ 10 / 50 / 100" : "点赞 10 / 50 / 100" }}</b
          ><small>{{
            th ? "ประกาศยอดไลก์แบบขั้น"
              : "实时累计播报，重点里程碑触发"
          }}</small></span
        >
      </p>
      <p>
        <Gift /><span
          ><b>{{ th ? "ของขวัญ 1 ชิ้น" : "礼物 × 1" }}</b
          ><small>{{
            th ? "พิมพ์รูป + ขอบคุณคำสั้นๆ" : "打印头像并播报感谢语"
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
  --panel: rgba(6, 10, 16, 0.78);
  --panel-soft: rgba(255, 255, 255, 0.09);
  --hot: #ff315f;
  --accent: #00e0a3;
  position: relative;
  width: 100%;
  height: 100dvh;
  min-height: 720px;
  overflow: hidden;
  background: transparent;
  color: #fff;
  font-family:
    "Inter",
    "PingFang SC",
    "Noto Sans Thai",
    "Segoe UI",
    sans-serif;
  text-shadow: 0 1px 3px #000;
  padding: 18px;
  box-sizing: border-box;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, var(--hot) 0%, #c40f4f 40%, var(--panel) 100%);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  padding: 11px 12px 10px;
  box-shadow: 0 14px 28px #0008;
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
  font-size: 22px;
  letter-spacing: 0.04em;
}
.brand small {
  font-size: 9px;
  letter-spacing: 2px;
  color: #c9d2d4;
  text-transform: uppercase;
}
.live-state {
  font-size: 11px;
  font-weight: 700;
  color: #6ef2b1;
}
.live-state.paused {
  color: #ffc75f;
}
.reward-rail {
  position: absolute;
  left: 16px;
  top: 72px;
  width: 280px;
  background: linear-gradient(
    180deg,
    rgba(14, 20, 28, 0.72),
    rgba(10, 15, 20, 0.58)
  );
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.24);
  padding: 11px 12px 8px;
  border-radius: 14px;
  box-shadow: 0 10px 22px #0008;
}
.reward-rail h1 {
  font-size: 20px;
  margin: 0 0 8px;
  letter-spacing: 0.06em;
}
.reward-rail p {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 9px 0 8px;
  border-top: 1px solid #ffffff2a;
}
.reward-rail svg {
  width: 22px;
  color: #ff7f98;
  flex: none;
}
.reward-rail span {
  display: grid;
  min-width: 0;
}
.reward-rail b {
  font-size: 13px;
  overflow-wrap: anywhere;
}
.reward-rail small {
  font-size: 9px;
  color: #d4dcde;
  margin-top: 2px;
}
.camera-guide {
  position: absolute;
  right: 16px;
  top: 79px;
  display: flex;
  gap: 7px;
  align-items: center;
  padding: 7px 9px;
  border: 1px dashed #ffffff9c;
  background: #0006;
  font-size: 10px;
  border-radius: 999px;
  box-shadow: 0 10px 18px #0007;
}
.camera-guide svg {
  width: 16px;
}
.feedback-card {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 102px;
  display: flex;
  align-items: center;
  gap: 11px;
  background: #fff;
  color: #16191b;
  text-shadow: none;
  border-left: 6px solid var(--hot);
  border-radius: 12px;
  padding: 12px 13px;
  box-shadow: 0 12px 30px #0008;
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
  font-size: 16px;
  overflow-wrap: anywhere;
}
.feedback-card p {
  font-size: 13px;
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
  left: 16px;
  right: 16px;
  bottom: 18px;
  height: 64px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--panel);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  backdrop-filter: blur(6px);
  overflow: hidden;
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
  background: linear-gradient(180deg, #ff315f16 0%, #ff315f00 100%);
}
.enable-audio {
  position: absolute;
  inset: auto 16px 88px auto;
  background: var(--hot);
  color: #fff;
  border: 0;
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  gap: 7px;
  align-items: center;
  box-shadow: 0 10px 26px #ff315f80;
  cursor: pointer;
  font-weight: 700;
}
.enable-audio:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}
.error {
  position: absolute;
  left: 16px;
  right: 18px;
  bottom: 164px;
  background: linear-gradient(90deg, #8a1227e8, #631019e8);
  border-radius: 10px;
  border: 1px solid #ff8fa1;
  padding: 10px;
  font-size: 11px;
}
@media (max-height: 760px) {
  .reward-rail {
    top: 72px;
    width: 260px;
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
  .live-totals {
    left: 12px;
    right: 12px;
    bottom: 12px;
    height: 100px;
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
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
