<script setup lang="ts">
import { computed } from "vue";
import { Gift, Heart, Mail, Sparkles, Volume2 } from "lucide-vue-next";
import type { Job } from "../../shared/types";
import { campaignCopy } from "../../shared/campaign";
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
}>();
defineEmits<{ play: [] }>();
const c = computed(() => campaignCopy[props.language]);
const visibleRewards = computed(() =>
  props.rewards
    .filter((r) => r.actions.includes("speech") && r.giftIds.length === 0)
    .slice(0, 3),
);
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
  <main
    class="live-stage"
    :lang="language"
    :class="{ thai: language === 'th' }"
  >
    <header class="stage-header">
      <span class="postmark"><Mail :size="20" /> WISH POST</span
      ><span class="stage-state">{{ paused ? c.paused : c.ready }}</span>
    </header>
    <section class="stage-intro">
      <p>AI LIVE STUDIO</p>
      <h1>{{ c.title }}</h1>
      <p>{{ c.subtitle }}</p>
    </section>
    <section class="wish-letter" aria-live="polite">
      <div class="letter-stamp"><Heart :size="24" /></div>
      <template v-if="current && !paused"
        ><img v-if="media" :src="media" class="letter-avatar" alt="" /><span
          class="letter-label"
          >{{
            language === "zh" ? "这一封，写给你" : "จดหมายฉบับนี้ถึงคุณ"
          }}</span
        >
        <h2>{{ current.nickname }}</h2>
        <p class="letter-message">{{ current.content }}</p>
        <span class="letter-sign"
          ><Volume2 :size="17" />{{
            language === "zh" ? "心意已送达" : "ส่งความรู้สึกดี ๆ ถึงคุณ"
          }}</span
        ></template
      >
      <template v-else
        ><Mail :size="52" class="idle-mail" /><span class="letter-label">{{
          c.welcome
        }}</span>
        <h2 class="idle-title">{{ c.idle }}</h2>
        <p class="letter-message small">{{ c.free }}</p></template
      >
    </section>
    <section class="reward-board">
      <h2><Sparkles :size="20" />{{ c.gifts }}</h2>
      <div class="reward-line" v-for="(r, i) in visibleRewards" :key="r.id">
        <span class="gift-symbol" :class="'gift-' + i"
          ><Gift :size="29"
        /></span>
        <div>
          <strong>{{ c.anyGift }} × {{ r.minCount }}</strong
          ><small>{{ r.name }}</small>
        </div>
        <span class="reward-arrow">↗</span>
      </div>
      <p class="reward-note">{{ c.countNote }}</p>
    </section>
    <footer>{{ c.note }}</footer>
    <button
      class="stage-play"
      v-if="needsPlay && !paused"
      @click="$emit('play')"
    >
      <Volume2 :size="20" />{{ c.play }}
    </button>
    <p class="stage-error" role="alert" v-if="error">{{ c.error }}</p>
  </main>
</template>
<style scoped>
.live-stage {
  font-family: "PingFang SC", "Thonburi", sans-serif;
  color: #fffaf2;
  width: 100%;
  height: 100dvh;
  min-height: 720px;
  max-width: 1080px;
  margin: auto;
  position: relative;
  overflow: hidden;
  background: #103f43 url("/live-assets/wish-post.png") center/cover;
  padding: 6% 7% 10%;
  display: flex;
  flex-direction: column;
  gap: 2.4%;
  box-sizing: border-box;
}
.stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  gap: 12px;
}
.postmark {
  display: flex;
  gap: 7px;
  align-items: center;
  letter-spacing: 2px;
}
.stage-state {
  color: #bde6df;
  font-size: 11px;
}
.stage-intro {
  text-align: center;
  margin: 2% 0;
}
.stage-intro > p:first-child {
  font-size: 10px;
  letter-spacing: 4px;
  color: #bde6df;
}
.stage-intro h1 {
  font-size: 44px;
  margin: 9px 0;
  font-weight: 800;
}
.stage-intro > p:last-child {
  font-size: 13px;
  letter-spacing: 2px;
}
.wish-letter {
  position: relative;
  background: #fffaf2;
  color: #193f42;
  padding: 26px 24px 22px;
  min-height: 240px;
  border-radius: 4px;
  box-shadow: 0 10px 24px #061f2733;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-top: 5px solid #ef6553;
  text-align: center;
}
.letter-stamp {
  position: absolute;
  right: 14px;
  top: 13px;
  transform: rotate(12deg);
  color: #ef6553;
  border: 1px dashed #ef6553;
  padding: 6px;
}
.letter-label {
  font-size: 11px;
  color: #587372;
  margin: 8px 0;
  letter-spacing: 1px;
}
.wish-letter h2 {
  font-size: 27px;
  line-height: 1.35;
  margin: 8px 0 14px;
  max-width: 100%;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
.letter-message {
  font-size: 17px;
  line-height: 1.65;
  margin: 0;
  overflow-wrap: anywhere;
  max-height: 220px;
  overflow: hidden;
}
.letter-message.small {
  font-size: 12px;
  color: #587372;
}
.letter-sign {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 18px;
  font-size: 10px;
  color: #af5144;
}
.letter-avatar {
  width: 62px;
  height: 62px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid #e9d9c7;
}
.idle-mail {
  color: #ef6553;
  margin-bottom: 9px;
}
.reward-board {
  padding: 10px 14px;
  background: rgba(8, 43, 47, 0.88);
  border-radius: 6px;
  box-shadow: 0 4px 18px #061f2722;
}
.reward-board > h2 {
  font-size: 16px;
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0 12px;
}
.reward-line {
  display: flex;
  align-items: center;
  gap: 13px;
  border-top: 1px solid #fff3;
  padding: 10px 0;
}
.gift-symbol {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  background: #e86956;
  color: #fffaf2;
  border-radius: 10px;
}
.gift-1 {
  background: #bde6df;
  color: #103f43;
}
.gift-2 {
  background: #eab75f;
  color: #103f43;
}
.reward-line strong {
  display: block;
  font-size: 14px;
}
.reward-line small {
  display: block;
  font-size: 12px;
  color: #bde6df;
  margin-top: 4px;
}
.reward-arrow {
  margin-left: auto;
  color: #bde6df;
  font-size: 24px;
}
.reward-note {
  font-size: 10px;
  line-height: 1.55;
  color: #c8ded9;
  margin: 10px 0;
}
.live-stage footer {
  font-size: 10px;
  text-align: center;
  line-height: 1.5;
  color: #dcece5;
  margin-top: auto;
}
.stage-play {
  position: absolute;
  bottom: 24px;
  left: 10%;
  width: 80%;
  padding: 14px;
  background: #ef6553;
  color: white;
  border: 2px solid white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 16px;
  cursor: pointer;
}
.stage-play:focus-visible {
  outline: 4px solid #eab75f;
  outline-offset: 3px;
}
.stage-error {
  position: absolute;
  bottom: 5px;
  left: 0;
  width: 100%;
  text-align: center;
  font-size: 11px;
  background: #963c32;
  padding: 8px;
}
.thai .stage-intro h1 {
  font-size: 31px;
}
.thai .stage-intro > p:last-child {
  letter-spacing: 0;
}
.thai .wish-letter h2 {
  font-size: 24px;
}
.thai .letter-message {
  font-size: 16px;
}
@media (min-height: 1100px) {
  .stage-intro h1 {
    font-size: 64px;
  }
  .stage-intro > p:last-child {
    font-size: 21px;
  }
  .stage-header {
    font-size: 16px;
  }
  .stage-state {
    font-size: 16px;
  }
  .wish-letter {
    min-height: 400px;
    padding: 42px;
  }
  .wish-letter h2 {
    font-size: 45px;
  }
  .letter-message {
    font-size: 28px;
    max-height: 330px;
  }
  .letter-label {
    font-size: 18px;
  }
  .letter-avatar {
    width: 100px;
    height: 100px;
  }
  .reward-line {
    padding: 20px 0;
  }
  .reward-line strong {
    font-size: 23px;
  }
  .reward-line small {
    font-size: 21px;
  }
  .gift-symbol {
    width: 70px;
    height: 70px;
  }
  .reward-board > h2 {
    font-size: 25px;
  }
  .reward-note,
  .live-stage footer {
    font-size: 16px;
  }
  .thai .stage-intro h1 {
    font-size: 48px;
  }
  .thai .wish-letter h2 {
    font-size: 38px;
  }
  .thai .letter-message {
    font-size: 27px;
  }
}
@media (max-height: 790px) {
  .live-stage {
    gap: 10px;
    padding-top: 24px;
    padding-bottom: 35px;
  }
  .stage-intro {
    margin: 0;
  }
  .stage-intro h1 {
    font-size: 34px;
  }
  .wish-letter {
    min-height: 200px;
    padding: 16px;
  }
  .reward-line {
    padding: 6px 0;
  }
  .gift-symbol {
    width: 36px;
    height: 36px;
  }
  .reward-note {
    margin: 6px 0;
  }
}
</style>
