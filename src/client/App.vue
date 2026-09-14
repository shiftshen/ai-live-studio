<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import {
  Radio,
  LayoutDashboard,
  ListOrdered,
  Workflow,
  FileText,
  Printer,
  AudioLines,
  Users,
  ChartNoAxesCombined,
  ShieldCheck,
  FlaskConical,
  Plus,
  RefreshCw,
  Pause,
  Play,
  ChevronRight,
  LogIn,
  Check,
  ExternalLink,
  Menu,
} from "lucide-vue-next";
import Overlay from "./components/Overlay.vue";
import Editor from "./components/Editor.vue";
import type { Field } from "./components/Editor.vue";
import { api, stamp, label } from "./api";
import type {
  Snapshot,
  Job,
  Room,
  Rule,
  Template,
  Printer as PrinterType,
} from "../shared/types";
const overlay = location.pathname.startsWith("/overlay/");
const authenticated = ref(false),
  loading = ref(true),
  token = ref(""),
  error = ref(""),
  notice = ref(""),
  busy = ref(false),
  state = ref<Snapshot | null>(null),
  page = ref(location.hash.slice(1) || "overview"),
  roomFilter = ref(""),
  menu = ref(false);
let interval: ReturnType<typeof setInterval>;
const nav = [
  { id: "overview", name: "运行总览", icon: LayoutDashboard },
  { id: "rooms", name: "直播间", icon: Radio },
  { id: "rules", name: "互动规则", icon: Workflow },
  { id: "templates", name: "内容模板", icon: FileText },
  { id: "queue", name: "执行队列", icon: ListOrdered },
  { id: "printers", name: "打印设备", icon: Printer },
  { id: "ai", name: "AI 与语音", icon: AudioLines },
  { id: "fans", name: "粉丝与屏蔽", icon: Users },
  { id: "stats", name: "数据统计", icon: ChartNoAxesCombined },
  { id: "simulator", name: "事件实验室", icon: FlaskConical },
  { id: "system", name: "系统与访问", icon: ShieldCheck },
];
const title = computed(
  () => nav.find((n) => n.id === page.value)?.name || "运行总览",
);
const writable = computed(() => state.value?.role !== "viewer"),
  admin = computed(() => state.value?.role === "admin");
const rooms = computed(() => state.value?.rooms || []);
const jobs = computed(() =>
  (state.value?.jobs || []).filter(
    (j) =>
      (!roomFilter.value || j.roomId === roomFilter.value) &&
      (!jobStatus.value || j.status === jobStatus.value),
  ),
);
const events = computed(() =>
  (state.value?.events || []).filter(
    (e) => !roomFilter.value || e.roomId === roomFilter.value,
  ),
);
const jobStatus = ref("");
const selectedEvents = ref<string[]>([]);
watch(roomFilter, () => {
  selectedEvents.value = [];
});
function go(id: string) {
  page.value = id;
  location.hash = id;
  menu.value = false;
  error.value = "";
  notice.value = "";
}
const roomName = (id: string) =>
  rooms.value.find((r) => r.id === id)?.name || id;
async function refresh() {
  try {
    state.value = await api<Snapshot>("/state");
    if (!settingsDraft.value)
      settingsDraft.value = {
        ...state.value.settings,
        physicalTestMode: state.value.settings.physicalTestMode ?? true,
      };
    authenticated.value = true;
    if (page.value === "fans" && !fansLoading.value) void loadFans();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function run(fn: () => Promise<any>, message = "操作已完成") {
  busy.value = true;
  error.value = "";
  notice.value = "";
  try {
    const result = await fn();
    notice.value = message;
    await refresh();
    return result;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function login() {
  await run(async () => {
    await api("/login", { token: token.value });
    token.value = "";
    authenticated.value = true;
  }, "已安全登录");
}
onMounted(async () => {
  if (overlay) {
    loading.value = false;
    return;
  }
  try {
    const session = await api("/session");
    authenticated.value = session.authenticated;
    if (session.authenticated) await refresh();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
  interval = setInterval(() => {
    if (authenticated.value && !busy.value) refresh();
  }, 3000);
});
onUnmounted(() => clearInterval(interval));
const settingsDraft = ref<any>(null);
const editor = ref<{
    title: string;
    value: Record<string, any>;
    fields: Field[];
    path: string;
    method?: string;
  } | null>(null),
  editorError = ref("");
const langs = [
  { value: "zh", label: "中文" },
  { value: "th", label: "泰语" },
  { value: "en", label: "English" },
];
const roomOpts = computed(() =>
  rooms.value.map((r) => ({ value: r.id, label: r.name })),
);
const eventOpts = ["join", "follow", "comment", "gift", "like"].map((s) => ({
  value: s,
  label: label(s),
}));
function editRoom(r?: Room) {
  editorError.value = "";
  editor.value = {
    title: r ? "编辑直播间" : "新建直播间",
    path: r ? "/rooms/" + r.id : "/rooms",
    method: r ? "PATCH" : "POST",
    value: r
      ? { ...r }
      : {
          name: "",
          platform: "tiktok",
          address: "",
          language: "zh",
          voice: "",
          printerId: null,
          enabled: true,
          persona: "",
          knowledge: "",
        },
    fields: [
      { key: "name", label: "直播间名称", required: true },
      {
        key: "platform",
        label: "平台",
        options: r
          ? [
              {
                value: r.platform,
                label: r.platform === "douyin" ? "抖音" : "TikTok",
              },
            ]
          : [
              { value: "tiktok", label: "TikTok" },
              { value: "douyin", label: "抖音" },
            ],
      },
      { key: "address", label: "直播间地址或账号", required: true },
      { key: "language", label: "互动语言", options: langs },
      { key: "voice", label: "声音配置" },
      {
        key: "printerId",
        label: "打印设备",
        options: [
          { value: "", label: "不分配" },
          ...(state.value?.printers || []).map((p) => ({
            value: p.id,
            label: p.name,
          })),
        ],
      },
      { key: "persona", label: "AI 人设", type: "textarea" },
      { key: "knowledge", label: "直播知识库", type: "textarea" },
      { key: "enabled", label: "启用直播间", type: "checkbox" },
    ],
  };
}
function editRule(r?: Rule) {
  editorError.value = "";
  editor.value = {
    title: r ? "编辑规则" : "创建互动规则",
    path: r ? "/rules/" + r.id : "/rules",
    method: r ? "PATCH" : "POST",
    value: r
      ? { ...r, actions: [...r.actions] }
      : {
          roomId: rooms.value[0]?.id || "",
          name: "",
          enabled: true,
          priority: 10,
          eventType: "comment",
          keywords: [],
          giftIds: [],
          minCount: 1,
          cooldownSec: 30,
          oncePerSession: false,
          continueMatching: false,
          templateId: state.value?.templates[0]?.id || "",
          actions: ["overlay"],
          ai: false,
          avatar: false,
        },
    fields: [
      { key: "name", label: "规则名称", required: true },
      {
        key: "roomId",
        label: "所属直播间",
        options: r
          ? roomOpts.value.filter((o) => o.value === r.roomId)
          : roomOpts.value,
      },
      { key: "eventType", label: "触发事件", options: eventOpts },
      { key: "priority", label: "优先级", type: "number", min: 0 },
      { key: "keywords", label: "关键词（逗号分隔）", type: "list" },
      { key: "giftIds", label: "礼物 ID（逗号分隔）", type: "list" },
      { key: "minCount", label: "最低数量", type: "number", min: 1 },
      { key: "cooldownSec", label: "冷却时间（秒）", type: "number", min: 0 },
      {
        key: "templateId",
        label: "内容模板",
        options: (state.value?.templates || []).map((t) => ({
          value: t.id,
          label: t.name,
        })),
      },
      {
        key: "actions",
        label: "执行动作",
        type: "checklist",
        options: ["print", "speech", "overlay"].map((a) => ({
          value: a,
          label: label(a),
        })),
      },
      { key: "ai", label: "AI 生成内容", type: "checkbox" },
      { key: "avatar", label: "打印用户头像", type: "checkbox" },
      { key: "oncePerSession", label: "每场每用户仅一次", type: "checkbox" },
      { key: "continueMatching", label: "命中后继续匹配", type: "checkbox" },
      { key: "enabled", label: "启用规则", type: "checkbox" },
    ],
  };
}
function editTemplate(t?: Template) {
  editorError.value = "";
  editor.value = {
    title: t ? "编辑模板" : "新建内容模板",
    path: t ? "/templates/" + t.id : "/templates",
    method: t ? "PATCH" : "POST",
    value: t ? { ...t } : { name: "", language: "zh", body: "" },
    fields: [
      { key: "name", label: "模板名称", required: true },
      { key: "language", label: "语言", options: langs },
      {
        key: "body",
        label: "模板内容",
        type: "textarea",
        required: true,
        hint: "变量：{{nickname}}、{{text}}、{{giftName}}、{{count}}",
      },
    ],
  };
}
function editReprint(j: Job) {
  editorError.value = "";
  editor.value = {
    title: "补打及原因",
    path: "/jobs/" + j.id + "/reprint",
    method: "POST",
    value: { reason: "" },
    fields: [
      {
        key: "reason",
        label: "补打原因（至少3个字）",
        type: "textarea",
        required: true,
      },
    ],
  };
}
function editPrinter(p?: PrinterType) {
  editorError.value = "";
  editor.value = {
    title: p ? "编辑打印设备" : "添加飞鹅打印机",
    path: p ? "/printers/" + p.id : "/printers",
    method: p ? "PATCH" : "POST",
    value: p
      ? { ...p, renderLanguage: p.renderLanguage ?? "Thai" }
      : {
          name: "",
          sn: "",
          user: "",
          ukey: "",
          paperWidth: 58,
          renderLanguage: "Thai",
          imageSupported: false,
        },
    fields: [
      { key: "name", label: "设备名称", required: true },
      ...(!p
        ? [
            { key: "sn", label: "设备 SN", required: true },
            { key: "user", label: "飞鹅账号 USER", required: true },
            {
              key: "ukey",
              label: "API 密钥 UKEY",
              type: "password",
              required: true,
            },
          ]
        : [{ key: "enabled", label: "启用", type: "checkbox" }]),
      {
        key: "paperWidth",
        label: "纸宽（毫米）",
        type: "number",
        options: [
          { value: "58", label: "58 mm" },
          { value: "80", label: "80 mm" },
        ],
      },
      {
        key: "renderLanguage",
        label: "打印机字库通道",
        type: "select",
        options: [
          { value: "Thai", label: "多语言兼容字库（本机已验证）" },
          { value: "default", label: "设备默认字库" },
        ],
        hint: "设备字库与房间回复语言分开；本机使用兼容字库可打印中泰英。",
      },
      { key: "imageSupported", label: "设备支持图片打印", type: "checkbox" },
    ],
  };
}
async function saveEditor(value: Record<string, any>) {
  if (!editor.value) return;
  busy.value = true;
  editorError.value = "";
  try {
    if (editor.value.path.startsWith("/rooms") && !value.printerId)
      value.printerId = null;
    await api(editor.value.path, value, editor.value.method);
    editor.value = null;
    notice.value = "配置已保存";
    await refresh();
  } catch (e) {
    editorError.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
const sim = ref({
  roomId: "",
  type: "comment",
  nickname: "测试观众",
  userId: "test-viewer",
  text: "你好",
  giftId: "",
  giftName: "",
  count: 1,
  repeatEnd: true,
  streakId: "",
});
const preview = ref<any>(null);
async function simulate(write: boolean) {
  const result = await run(
    () => api(write ? "/simulate" : "/preview", sim.value),
    write ? "模拟事件已进入处理链" : "规则预览完成，未执行动作",
  );
  if (result) preview.value = result;
}
const speechText = ref("欢迎来到直播间"),
  speechRoom = ref(""),
  speechUrl = ref("");
async function speech() {
  const r = await run(
    () =>
      api("/speech/preview", {
        roomId: speechRoom.value,
        text: speechText.value,
      }),
    "语音预览已生成",
  );
  if (r) {
    speechUrl.value = r.url || "";
    if (r.error) error.value = r.error;
  }
}
const diagnostics = ref<any[]>([]),
  access = ref<any[]>([]),
  accessToken = ref(""),
  accessRole = ref("viewer"),
  accessRooms = ref<string[]>([]),
  backupName = ref(""),
  restoreName = ref("");
const blockRoom = ref(""),
  blockUser = ref("");
const relayUrls = ref<Record<string, string>>({});
async function relayConfig(r: Room) {
  const result = await run(
    () => api("/relay-config/" + r.id),
    "转发配置已获取",
  );
  if (result) {
    relayUrls.value[r.id] = result.url;
    try {
      await navigator.clipboard.writeText(result.url);
      notice.value = "Dycast 转发地址已复制";
    } catch {
      notice.value = "转发地址已显示，可手动复制";
    }
  }
}
const testText = ref("AI Live Studio 打印测试"),
  testLanguage = ref("zh");
interface Fan {
  roomId: string;
  platform: string;
  userId: string;
  nickname: string;
  eventCount: number;
  giftCount: number;
  commentCount: number;
  followCount: number;
  firstSeenAt: number;
  lastSeenAt: number;
}
const fans = ref<Fan[]>([]),
  fansTotal = ref(0),
  fansOffset = ref(0),
  fansLoading = ref(false),
  fansError = ref("");
const fansLimit = 50;
let fansRequest = 0;
async function loadFans() {
  if (page.value !== "fans" || !authenticated.value) return;
  const request = ++fansRequest;
  fansLoading.value = true;
  fansError.value = "";
  const params = new URLSearchParams({
    limit: String(fansLimit),
    offset: String(fansOffset.value),
  });
  if (roomFilter.value) params.set("roomId", roomFilter.value);
  try {
    const result = await api<{ items: Fan[]; total: number }>(
      "/fans?" + params,
    );
    if (request !== fansRequest) return;
    fans.value = result.items;
    fansTotal.value = result.total;
  } catch (e) {
    if (request === fansRequest) fansError.value = (e as Error).message;
  } finally {
    if (request === fansRequest) fansLoading.value = false;
  }
}
watch([page, roomFilter, authenticated], () => {
  fansOffset.value = 0;
  fans.value = [];
  fansTotal.value = 0;
  loadFans();
});
watch(fansOffset, loadFans);
async function loadSystem() {
  const d = await run(() => api("/diagnostics"), "诊断已更新");
  if (d) diagnostics.value = d.checks;
  if (admin.value) {
    const a = await run(() => api("/access"), "访问权限已读取");
    if (a) access.value = Array.isArray(a) ? a : a.entries || a.access || [];
  }
}
async function backup() {
  const r = await run(() => api("/backup", {}), "备份已创建");
  if (r) backupName.value = r.name;
}
async function createAccess() {
  const r = await run(
    () =>
      api("/access", { role: accessRole.value, roomIds: accessRooms.value }),
    "访问令牌已创建，请妥善保存",
  );
  if (r) accessToken.value = r.token;
}
async function copyOverlay(r: Room) {
  try {
    await navigator.clipboard.writeText(
      location.origin +
        "/overlay/" +
        encodeURIComponent(r.id) +
        "?token=" +
        encodeURIComponent(r.overlayToken || ""),
    );
    notice.value = "OBS 浏览器源地址已复制";
  } catch {
    error.value = "浏览器不允许复制，请打开 OBS 页面后复制地址";
  }
}
async function replay() {
  await run(
    () =>
      api("/replay", {
        roomId: roomFilter.value,
        eventIds: selectedEvents.value,
      }),
    "选中事件已重放",
  );
  selectedEvents.value = [];
}
</script>
<template>
  <Overlay v-if="overlay" />
  <div v-else-if="loading" class="loading-screen">
    <Radio :size="32" />
    <p>正在连接本地工作台…</p>
  </div>
  <div v-else-if="!authenticated" class="login-screen">
    <section class="login-card">
      <div class="brand-mark"><Radio /></div>
      <p class="eyebrow">AI LIVE STUDIO / LOCAL CONSOLE</p>
      <h1>你的直播互动控制室</h1>
      <p class="muted">使用本机管理员令牌进入工作台。</p>
      <form @submit.prevent="login">
        <label
          >访问令牌<input
            v-model="token"
            type="password"
            required
            autocomplete="current-password"
            placeholder="输入管理员令牌"
        /></label>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <button class="primary" :disabled="busy">
          <LogIn :size="16" />{{ busy ? "正在验证…" : "进入工作台" }}
        </button>
      </form>
      <small
        >管理员令牌文件<br /><code
          >/Volumes/M2USB/Projects/ai-live-studio/var/admin-token</code
        ></small
      >
    </section>
  </div>
  <div v-else class="app-shell">
    <aside :class="['sidebar', { open: menu }]">
      <a class="brand" href="#overview" @click.prevent="go('overview')"
        ><div class="brand-mark"><Radio :size="22" /></div>
        <div>AI Live Studio<small>直播互动工作台</small></div></a
      >
      <p class="nav-label">工作空间</p>
      <nav aria-label="主导航">
        <button
          v-for="n in nav"
          :key="n.id"
          :class="{ active: page === n.id }"
          :aria-current="page === n.id ? 'page' : undefined"
          @click="go(n.id)"
        >
          <component :is="n.icon" :size="18" /><span>{{ n.name }}</span
          ><ChevronRight v-if="page === n.id" :size="14" />
        </button>
      </nav>
      <div class="sidebar-bottom">
        <span class="status-dot" />本地独立运行<small
          >{{
            state?.role === "admin"
              ? "管理员"
              : state?.role === "operator"
                ? "操作员"
                : "只读访问"
          }}
          · 127.0.0.1</small
        >
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="breadcrumb">
          <button
            class="mobile-toggle"
            aria-label="打开导航"
            @click="menu = !menu"
          >
            <Menu :size="20" /></button
          ><span>工作空间</span><ChevronRight :size="13" /><strong>{{
            title
          }}</strong>
        </div>
        <div class="toolbar">
          <span
            :class="['badge', state?.settings.paused ? 'warning' : 'success']"
            >{{ state?.settings.paused ? "执行已暂停" : "执行中" }}</span
          ><button :disabled="busy" aria-label="刷新数据" @click="refresh">
            <RefreshCw :size="16" /></button
          ><button
            v-if="admin && state"
            :disabled="busy"
            @click="
              run(
                () => api('/settings', { paused: !state!.settings.paused }),
                state.settings.paused ? '执行已恢复' : '执行已暂停',
              )
            "
          >
            <component
              :is="state.settings.paused ? Play : Pause"
              :size="15"
            /><span>{{ state.settings.paused ? "恢复" : "暂停执行" }}</span>
          </button>
        </div>
      </header>
      <main>
        <div class="page-heading">
          <div>
            <p class="eyebrow">LIVE OPERATIONS</p>
            <h1>{{ title }}</h1>
            <p class="muted">
              {{
                page === "overview"
                  ? "关注实时互动，让每一次回应都有迹可循。"
                  : page === "simulator"
                    ? "预览规则或注入带有模拟标识的测试事件。"
                    : "配置与运行记录来自当前本地服务。"
              }}
            </p>
          </div>
          <select
            v-if="['overview', 'queue', 'fans', 'stats'].includes(page)"
            v-model="roomFilter"
            aria-label="筛选直播间"
          >
            <option value="">全部直播间</option>
            <option v-for="r in rooms" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>
        <div v-if="error" class="banner error" role="alert">{{ error }}</div>
        <div v-if="notice" class="banner success" role="status">
          <Check :size="16" />{{ notice }}
        </div>
        <div v-if="!state" class="empty">
          <h2>暂时无法读取工作台</h2>
          <button @click="refresh">重新连接</button>
        </div>
        <template v-if="state">
          <section
            v-if="page === 'overview' || page === 'stats'"
            class="metrics"
          >
            <div
              v-for="m in [
                { name: '收到事件', value: state.stats.events },
                { name: '待执行任务', value: state.stats.pending },
                { name: '已完成任务', value: state.stats.completed },
                { name: '失败任务', value: state.stats.failed },
              ]"
              :key="m.name"
            >
              <span>{{ m.name }}</span
              ><strong>{{ m.value.toLocaleString() }}</strong
              ><small>当前服务实际记录</small>
            </div>
          </section>
          <template v-if="page === 'overview'"
            ><div class="section-heading">
              <h2>
                直播间运行状态 <span class="count">{{ rooms.length }}</span>
              </h2>
              <button @click="go('rooms')">
                管理直播间 <ChevronRight :size="14" />
              </button>
            </div>
            <div v-if="!rooms.length" class="empty">
              <Radio :size="32" />
              <h2>连接你的第一个直播间</h2>
              <p>先配置直播间，再创建模板与互动规则。</p>
              <button v-if="admin" class="primary" @click="editRoom()">
                <Plus :size="16" />新建直播间
              </button>
            </div>
            <div v-else class="room-grid">
              <article v-for="r in rooms" :key="r.id" class="room-card">
                <div class="row-between">
                  <span class="platform">{{
                    r.platform === "douyin" ? "抖音" : "TikTok"
                  }}</span
                  ><span class="badge">{{ label(r.status) }}</span>
                </div>
                <h3>{{ r.name }}</h3>
                <p class="muted truncate">{{ r.address }}</p>
                <p v-if="r.error" class="error">{{ r.error }}</p>
                <div class="room-meta">
                  <span>{{
                    langs.find((l) => l.value === r.language)?.label
                  }}</span
                  ><span
                    >{{
                      state.rules.filter((x) => x.roomId === r.id && x.enabled)
                        .length
                    }}
                    条生效规则</span
                  >
                </div>
              </article>
            </div>
            <div class="section-heading">
              <h2>最近事件</h2>
              <span class="muted">每 3 秒刷新</span>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>直播间 / 用户</th>
                    <th>事件</th>
                    <th>内容</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="e in events.slice(0, 15)" :key="e.id">
                    <td>{{ stamp(e.receivedAt) }}</td>
                    <td>
                      <strong>{{ e.nickname }}</strong
                      ><small>{{ roomName(e.roomId) }}</small>
                    </td>
                    <td>
                      {{ label(e.type)
                      }}<small
                        v-if="e.identityReliable === false"
                        class="warning"
                        >用户标识缺失，仅记录</small
                      >
                    </td>
                    <td>
                      {{ e.text || (e.type === "gift" ? e.giftName : "") || "—"
                      }}<span v-if="e.type === 'gift'"> × {{ e.count }}</span>
                    </td>
                    <td>
                      <span class="badge">{{ label(e.origin) }}</span>
                    </td>
                  </tr>
                  <tr v-if="!events.length">
                    <td colspan="5" class="empty-cell">
                      尚未收到事件。连接直播间或前往事件实验室测试。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div></template
          >
          <template v-if="page === 'rooms'"
            ><div class="section-heading">
              <h2>
                直播间 <span class="count">{{ rooms.length }}</span>
              </h2>
              <button v-if="admin" class="primary" @click="editRoom()">
                <Plus :size="16" />新建直播间
              </button>
            </div>
            <div v-if="!rooms.length" class="empty">
              尚未配置直播间，点击右上角开始。
            </div>
            <article v-for="r in rooms" :key="r.id" class="room-detail">
              <div>
                <div class="inline">
                  <span class="platform">{{ r.platform }}</span
                  ><span class="badge">{{ label(r.status) }}</span>
                </div>
                <h2>{{ r.name }}</h2>
                <p class="muted break">{{ r.address }}</p>
                <p v-if="r.error" class="error">{{ r.error }}</p>
                <div v-if="relayUrls[r.id]" class="relay-config">
                  <label
                    >Dycast WebSocket 转发地址<input
                      :value="relayUrls[r.id]"
                      readonly
                      @focus="($event.target as HTMLInputElement).select()"
                  /></label>
                </div>
                <div class="capabilities">
                  <span v-for="(v, k) in r.capabilities" :key="k"
                    >{{ label(String(k)) }}: {{ label(v) }}</span
                  >
                </div>
              </div>
              <div class="actions">
                <button v-if="writable" @click="editRoom(r)">编辑配置</button
                ><button
                  v-if="writable"
                  :disabled="busy || !r.enabled"
                  class="primary"
                  @click="
                    run(
                      () => api('/rooms/' + r.id + '/connect', {}),
                      '已请求连接直播间',
                    )
                  "
                >
                  连接</button
                ><button
                  v-if="writable"
                  :disabled="busy"
                  @click="
                    run(
                      () => api('/rooms/' + r.id + '/disconnect', {}),
                      '直播间已断开',
                    )
                  "
                >
                  断开</button
                ><button
                  v-if="writable"
                  :disabled="busy"
                  @click="
                    run(
                      () => api('/rooms/' + r.id + '/new-session', {}),
                      '新场次已创建',
                    )
                  "
                >
                  开启新场次</button
                ><button
                  v-if="admin && r.platform === 'douyin'"
                  :disabled="busy"
                  @click="relayConfig(r)"
                >
                  复制 Dycast 转发地址</button
                ><button v-if="r.overlayToken" @click="copyOverlay(r)">
                  复制 OBS 地址</button
                ><a
                  v-if="r.overlayToken"
                  class="button"
                  :href="
                    '/overlay/' +
                    encodeURIComponent(r.id) +
                    '?token=' +
                    encodeURIComponent(r.overlayToken)
                  "
                  target="_blank"
                  rel="noopener"
                  >预览 OBS <ExternalLink :size="14"
                /></a>
              </div></article
          ></template>
          <template v-if="page === 'rules'"
            ><div class="section-heading">
              <h2>按优先级匹配的互动规则</h2>
              <button
                v-if="writable"
                class="primary"
                :disabled="!rooms.length || !state.templates.length"
                @click="editRule()"
              >
                <Plus :size="16" />新建规则
              </button>
            </div>
            <p v-if="!rooms.length || !state.templates.length" class="hint">
              创建规则前，请先添加直播间和内容模板。
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>规则 / 直播间</th>
                    <th>触发条件</th>
                    <th>动作</th>
                    <th>冷却</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="r in [...state.rules].sort(
                      (a, b) => b.priority - a.priority,
                    )"
                    :key="r.id"
                  >
                    <td>
                      <strong>{{ r.name }}</strong
                      ><small
                        >{{ roomName(r.roomId) }} · 优先级 {{ r.priority }} ·
                        v{{ r.version }}</small
                      >
                    </td>
                    <td>
                      {{ label(r.eventType)
                      }}<small
                        >{{
                          r.keywords.join("、") ||
                          r.giftIds.join("、") ||
                          "不限关键词"
                        }}
                        · ≥ {{ r.minCount }}</small
                      >
                    </td>
                    <td>
                      {{ r.actions.map(label).join(" / ")
                      }}<small
                        >{{ r.ai ? "AI 生成" : "固定模板"
                        }}{{ r.avatar ? " · 头像" : "" }}</small
                      >
                    </td>
                    <td>{{ r.cooldownSec }} 秒</td>
                    <td>
                      <span :class="['badge', r.enabled ? 'success' : '']">{{
                        r.enabled ? "已启用" : "已停用"
                      }}</span>
                    </td>
                    <td>
                      <div v-if="writable" class="actions">
                        <button @click="editRule(r)">编辑</button
                        ><button
                          :disabled="busy"
                          @click="
                            run(() =>
                              api(
                                '/rules/' + r.id,
                                { enabled: !r.enabled },
                                'PATCH',
                              ),
                            )
                          "
                        >
                          {{ r.enabled ? "停用" : "启用" }}</button
                        ><button
                          class="danger"
                          :disabled="busy"
                          @click="
                            run(
                              () => api('/rules/' + r.id, {}, 'DELETE'),
                              '规则已删除',
                            )
                          "
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!state.rules.length">
                    <td colspan="6" class="empty-cell">
                      暂无规则。建立触发条件、内容和执行动作之间的联系。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div></template
          >
          <template v-if="page === 'templates'"
            ><div class="section-heading">
              <h2>可复用的互动内容</h2>
              <button v-if="admin" class="primary" @click="editTemplate()">
                <Plus :size="16" />新建模板
              </button>
            </div>
            <div class="template-grid">
              <article
                v-for="t in state.templates"
                :key="t.id"
                class="template-card"
              >
                <div class="row-between">
                  <h2>{{ t.name }}</h2>
                  <span class="badge">{{ t.language }} · v{{ t.version }}</span>
                </div>
                <p class="template-body">{{ t.body }}</p>
                <button v-if="admin" @click="editTemplate(t)">编辑模板</button>
              </article>
            </div>
            <div v-if="!state.templates.length" class="empty">
              还没有内容模板。可使用用户昵称、评论、礼物名称等变量。
            </div></template
          >
          <template v-if="page === 'queue'"
            ><div class="section-heading">
              <h2>
                执行记录 <span class="count">{{ jobs.length }}</span>
              </h2>
              <select v-model="jobStatus" aria-label="任务状态">
                <option value="">全部状态</option>
                <option
                  v-for="s in [
                    'pending',
                    'ready',
                    'sending',
                    'accepted',
                    'held',
                    'completed',
                    'failed',
                    'unknown',
                    'blocked',
                    'dry_run',
                    'cancelled',
                  ]"
                  :key="s"
                  :value="s"
                >
                  {{ label(s) }}
                </option>
              </select>
            </div>
            <p class="hint">
              “重新打印”会创建新的物理打印任务；未知结果请先核实设备，避免重复出纸。
            </p>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>任务 / 用户</th>
                    <th>内容</th>
                    <th>状态</th>
                    <th>来源 / 时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="j in jobs" :key="j.id">
                    <td>
                      <strong>{{ label(j.action) }} · {{ j.nickname }}</strong
                      ><small>{{ roomName(j.roomId) }}</small>
                    </td>
                    <td class="content-cell">
                      {{ j.content
                      }}<small v-if="j.error" class="error">{{
                        j.error
                      }}</small>
                    </td>
                    <td>
                      <span
                        :class="[
                          'badge',
                          j.status === 'completed'
                            ? 'success'
                            : j.status === 'failed' || j.status === 'unknown'
                              ? 'warning'
                              : '',
                        ]"
                        >{{ label(j.status) }}</span
                      >
                    </td>
                    <td>
                      {{ label(j.origin)
                      }}<small>{{ stamp(j.createdAt) }}</small>
                    </td>
                    <td>
                      <div v-if="writable" class="actions">
                        <button
                          v-if="
                            [
                              'pending',
                              'ready',
                              'held',
                              'failed',
                              'blocked',
                              'unknown',
                            ].includes(j.status)
                          "
                          :disabled="busy"
                          @click="
                            run(
                              () => api('/jobs/' + j.id + '/cancel', {}),
                              '任务已取消',
                            )
                          "
                        >
                          取消</button
                        ><button
                          v-if="
                            ['failed', 'blocked', 'held'].includes(j.status)
                          "
                          :disabled="busy"
                          @click="
                            run(
                              () => api('/jobs/' + j.id + '/retry', {}),
                              '已请求安全重试',
                            )
                          "
                        >
                          重试</button
                        ><button
                          v-if="
                            admin &&
                            j.origin === 'live' &&
                            j.action === 'print' &&
                            [
                              'completed',
                              'failed',
                              'unknown',
                              'accepted',
                            ].includes(j.status)
                          "
                          :disabled="busy"
                          @click="editReprint(j)"
                        >
                          重新打印
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="!jobs.length">
                    <td colspan="5" class="empty-cell">
                      当前筛选下没有执行任务。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div></template
          >
          <template v-if="page === 'printers'"
            ><div class="section-heading">
              <h2>飞鹅云打印设备</h2>
              <button v-if="admin" class="primary" @click="editPrinter()">
                <Plus :size="16" />添加设备
              </button>
            </div>
            <p class="hint">
              云端受理不等于实际出纸。设备凭据仅写入，界面不回显。
            </p>
            <div class="template-grid">
              <article
                v-for="p in state.printers"
                :key="p.id"
                class="template-card"
              >
                <div class="row-between">
                  <Printer :size="24" /><span class="badge">{{
                    label(p.status)
                  }}</span>
                </div>
                <h2>{{ p.name }}</h2>
                <p class="muted">
                  SN ····{{ p.snLast4 }} / {{ p.paperWidth }}mm /
                  {{ p.imageSupported ? "支持图片" : "文字打印" }}
                </p>
                <small>{{
                  p.lastChecked
                    ? "检查于 " + stamp(p.lastChecked)
                    : "尚未检查设备状态"
                }}</small>
                <p v-if="p.error" class="error">{{ p.error }}</p>
                <div class="actions">
                  <button
                    :disabled="busy || !admin"
                    @click="
                      run(
                        () => api('/printers/' + p.id + '/check', {}),
                        '设备状态已检查',
                      )
                    "
                  >
                    检查状态</button
                  ><button v-if="admin" @click="editPrinter(p)">配置</button
                  ><button
                    v-if="admin"
                    :disabled="busy || !rooms.length"
                    @click="
                      run(
                        () =>
                          api('/printers/' + p.id + '/test', {
                            text: testText,
                            language: testLanguage,
                          }),
                        '测试页已提交，请检查实际出纸',
                      )
                    "
                  >
                    打印测试页
                  </button>
                </div>
              </article>
            </div>
            <div v-if="!state.printers.length" class="empty">
              尚未配置打印设备。
            </div>
            <section class="form-section">
              <h2>测试页内容</h2>
              <div class="form-grid">
                <label>文本<input v-model="testText" maxlength="300" /></label
                ><label
                  >语言<select v-model="testLanguage">
                    <option v-for="l in langs" :key="l.value" :value="l.value">
                      {{ l.label }}
                    </option>
                  </select></label
                >
              </div>
              <small
                >每套安装最多 10 张授权测试页。每次点击都会请求打印一张。</small
              >
            </section></template
          >
          <template v-if="page === 'ai'"
            ><section class="form-section">
              <h2>本地 AI 引擎</h2>
              <form
                @submit.prevent="
                  run(
                    () =>
                      api('/settings', {
                        aiModel: settingsDraft.aiModel,
                        aiUrl: settingsDraft.aiUrl,
                        speechVolume: settingsDraft.speechVolume,
                        speechRate: settingsDraft.speechRate,
                      }),
                    'AI 与声音设置已保存',
                  )
                "
              >
                <fieldset :disabled="!admin || busy">
                  <div class="form-grid">
                    <label
                      >Ollama 地址<input
                        v-model="settingsDraft.aiUrl"
                        type="url"
                        required /></label
                    ><label
                      >模型名称<input
                        v-model="settingsDraft.aiModel"
                        required /></label
                    ><label
                      >播放音量（0–1）<input
                        v-model.number="settingsDraft.speechVolume"
                        type="number"
                        min="0"
                        max="1"
                        step="0.05" /></label
                    ><label
                      >语速<input
                        v-model.number="settingsDraft.speechRate"
                        type="number"
                        min="0.5"
                        max="2"
                        step="0.1"
                    /></label>
                  </div>
                  <button class="primary">保存设置</button>
                </fieldset>
              </form>
            </section>
            <section class="form-section">
              <h2>试听语音</h2>
              <p class="muted">使用直播间语言与声音配置生成本地预览。</p>
              <form @submit.prevent="speech">
                <div class="form-grid">
                  <label
                    >直播间<select v-model="speechRoom" required>
                      <option value="" disabled>选择直播间</option>
                      <option v-for="r in rooms" :key="r.id" :value="r.id">
                        {{ r.name }}
                      </option>
                    </select></label
                  ><label class="wide"
                    >朗读内容<textarea
                      v-model="speechText"
                      rows="3"
                      required
                      maxlength="80"
                    />
                  </label>
                </div>
                <button
                  class="primary"
                  :disabled="busy || !writable || !speechRoom"
                >
                  生成试听
                </button>
              </form>
              <audio v-if="speechUrl" :src="speechUrl" controls /></section
          ></template>
          <template v-if="page === 'fans'"
            ><div class="section-heading">
              <h2>
                互动观众
                <span class="count">{{ fansTotal.toLocaleString() }}</span>
              </h2>
              <a class="button" href="/api/v1/export?kind=fans" download
                >导出 CSV</a
              >
            </div>
            <p class="muted">
              按已保存的全部事件分页汇总，共
              {{ fansTotal.toLocaleString() }}
              位互动观众；不代表平台完整粉丝列表。
            </p>
            <p v-if="fansError" class="error" role="alert">
              {{ fansError }} <button @click="loadFans">重新加载</button>
            </p>
            <div class="table-wrap" :aria-busy="fansLoading">
              <table>
                <thead>
                  <tr>
                    <th>用户</th>
                    <th>直播间</th>
                    <th>互动次数</th>
                    <th>礼物数量</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in fans" :key="f.roomId + f.platform + f.userId">
                    <td>
                      <strong>{{ f.nickname }}</strong
                      ><small>{{ f.userId }}</small>
                    </td>
                    <td>{{ roomName(f.roomId) }}</td>
                    <td>{{ f.eventCount }}</td>
                    <td>{{ f.giftCount }}</td>
                    <td>
                      <button
                        v-if="writable"
                        :disabled="busy"
                        @click="
                          run(
                            () =>
                              api('/blocked-users', {
                                roomId: f.roomId,
                                userId: f.userId,
                              }),
                            '用户已屏蔽',
                          )
                        "
                      >
                        屏蔽
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!fans.length">
                    <td colspan="5" class="empty-cell">
                      {{
                        fansLoading
                          ? "正在加载互动观众…"
                          : fansError
                            ? "加载失败，请重试。"
                            : "暂无互动观众记录。"
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="fans-pagination" aria-label="互动观众分页">
              <span class="muted"
                >共 {{ fansTotal.toLocaleString() }} 位 ·
                {{ fansTotal ? fansOffset + 1 : 0 }}–{{
                  Math.min(fansOffset + fans.length, fansTotal)
                }}</span
              >
              <div class="actions">
                <button
                  :disabled="fansLoading || fansOffset === 0"
                  @click="fansOffset = Math.max(0, fansOffset - fansLimit)"
                >
                  上一页</button
                ><button
                  :disabled="fansLoading || fansOffset + fansLimit >= fansTotal"
                  @click="fansOffset += fansLimit"
                >
                  下一页
                </button>
              </div>
            </div>
            <section class="form-section">
              <h2>屏蔽名单</h2>
              <form
                v-if="writable"
                class="inline-form"
                @submit.prevent="
                  run(
                    () =>
                      api('/blocked-users', {
                        roomId: blockRoom,
                        userId: blockUser,
                      }),
                    '用户已屏蔽',
                  )
                "
              >
                <label
                  >直播间<select v-model="blockRoom" required>
                    <option value="" disabled>请选择</option>
                    <option v-for="r in rooms" :key="r.id" :value="r.id">
                      {{ r.name }}
                    </option>
                  </select></label
                ><label>用户 ID<input v-model="blockUser" required /></label
                ><button :disabled="busy" class="primary">加入屏蔽</button>
              </form>
              <div
                v-for="b in state.blockedUsers"
                :key="b.roomId + b.userId"
                class="list-row"
              >
                <span>{{ roomName(b.roomId) }} · {{ b.userId }}</span
                ><button
                  v-if="writable"
                  :disabled="busy"
                  @click="
                    run(() => api('/blocked-users', b, 'DELETE'), '已解除屏蔽')
                  "
                >
                  解除屏蔽
                </button>
              </div>
              <p v-if="!state.blockedUsers.length" class="muted">
                屏蔽名单为空。
              </p>
            </section></template
          >
          <template v-if="page === 'stats'"
            ><section class="form-section">
              <h2>事件分布</h2>
              <div v-for="e in eventOpts" :key="e.value" class="stat-row">
                <span>{{ e.label }}</span>
                <div class="bar-track">
                  <div
                    :style="{
                      width: events.length
                        ? (events.filter((x) => x.type === e.value).length /
                            events.length) *
                            100 +
                          '%'
                        : '0%',
                    }"
                  />
                </div>
                <strong>{{
                  events.filter((x) => x.type === e.value).length
                }}</strong>
              </div>
              <p class="muted">
                上方总量来自服务统计；事件分布按当前已加载记录与直播间筛选计算。
              </p>
            </section>
            <div class="actions">
              <a class="button" href="/api/v1/export?kind=events" download
                >导出事件 CSV</a
              ><a class="button" href="/api/v1/export?kind=jobs" download
                >导出任务 CSV</a
              >
            </div></template
          >
          <template v-if="page === 'simulator'"
            ><section class="form-section">
              <h2>事件输入</h2>
              <form @submit.prevent="simulate(false)">
                <fieldset :disabled="busy || !writable">
                  <div class="form-grid">
                    <label
                      >直播间<select v-model="sim.roomId" required>
                        <option value="" disabled>选择直播间</option>
                        <option v-for="r in rooms" :key="r.id" :value="r.id">
                          {{ r.name }}
                        </option>
                      </select></label
                    ><label
                      >事件类型<select v-model="sim.type">
                        <option
                          v-for="e in eventOpts"
                          :key="e.value"
                          :value="e.value"
                        >
                          {{ e.label }}
                        </option>
                      </select></label
                    ><label
                      >观众昵称<input v-model="sim.nickname" required /></label
                    ><label
                      >用户 ID<input v-model="sim.userId" required /></label
                    ><label class="wide"
                      >评论内容<textarea v-model="sim.text" rows="2" /></label
                    ><template v-if="sim.type === 'gift'"
                      ><label
                        >礼物 ID<input v-model="sim.giftId" required /></label
                      ><label>礼物名称<input v-model="sim.giftName" /></label
                      ><label
                        >累计数量<input
                          v-model.number="sim.count"
                          type="number"
                          min="1"
                          required /></label
                      ><label>连击 ID<input v-model="sim.streakId" /></label
                      ><label class="check-label"
                        ><input
                          v-model="sim.repeatEnd"
                          type="checkbox"
                        />连击结束</label
                      ></template
                    >
                  </div>
                  <div class="actions">
                    <button class="primary">仅预览规则</button
                    ><button
                      type="button"
                      :disabled="!sim.roomId"
                      @click="simulate(true)"
                    >
                      注入模拟事件
                    </button>
                  </div>
                </fieldset>
              </form>
              <p class="hint">
                预览不会产生任务；模拟事件会执行允许的测试动作，并保留 simulated
                来源。
              </p>
            </section>
            <section v-if="preview" class="form-section">
              <h2>处理结果</h2>
              <p v-if="!preview.matches?.length" class="hint">
                {{
                  preview.reasons?.join("；") || "本次未匹配规则，事件已记录。"
                }}
              </p>
              <article
                v-for="match in preview.matches"
                :key="match.ruleId"
                class="preview-ticket"
              >
                <h3>{{ match.name }}</h3>
                <p>{{ match.content }}</p>
                <small
                  >{{ match.actions.map(label).join(" · ") }} ·
                  {{ match.reason }}</small
                >
              </article>
              <p v-if="preview.jobs?.length" class="hint">
                已生成
                {{ preview.jobs.length }} 个测试动作。实体打印仅预览，不出纸。
              </p>
            </section>
            <section class="form-section">
              <h2>历史事件重放</h2>
              <label
                >直播间<select v-model="roomFilter">
                  <option value="">选择一个直播间</option>
                  <option v-for="r in rooms" :key="r.id" :value="r.id">
                    {{ r.name }}
                  </option>
                </select></label
              >
              <div v-if="roomFilter" class="replay-list">
                <label
                  v-for="e in events.slice(0, 30)"
                  :key="e.id"
                  class="check-label"
                  ><input
                    v-model="selectedEvents"
                    type="checkbox"
                    :value="e.id"
                  />{{ e.nickname }} · {{ label(e.type) }} ·
                  {{ e.text || (e.type === "gift" ? e.giftName : "") || "—"
                  }}<small v-if="e.identityReliable === false" class="warning"
                    >用户标识缺失，仅记录</small
                  ></label
                >
              </div>
              <button
                :disabled="
                  busy || !writable || !roomFilter || !selectedEvents.length
                "
                @click="replay"
              >
                重放 {{ selectedEvents.length }} 条事件
              </button>
            </section></template
          >
          <template v-if="page === 'system'"
            ><section class="form-section">
              <div class="section-heading">
                <h2>服务诊断</h2>
                <button :disabled="busy" @click="loadSystem">
                  <RefreshCw :size="15" />运行诊断
                </button>
              </div>
              <div v-for="(d, i) in diagnostics" :key="i" class="list-row">
                <strong>{{ d.name }}</strong
                ><span class="badge">{{ label(d.status) }}</span
                ><span class="muted break">{{ d.detail }}</span>
              </div>
              <p v-if="!diagnostics.length" class="muted">
                点击运行诊断，检查存储与服务依赖。
              </p>
            </section>
            <section class="form-section">
              <h2>执行与数据保留</h2>
              <form
                @submit.prevent="
                  run(
                    () =>
                      api('/settings', {
                        physicalTestMode: settingsDraft.physicalTestMode,
                        printRate: settingsDraft.printRate,
                        printQueueLimit: settingsDraft.printQueueLimit,
                        eventRetentionDays: settingsDraft.eventRetentionDays,
                        jobRetentionDays: settingsDraft.jobRetentionDays,
                        avatarRetentionHours:
                          settingsDraft.avatarRetentionHours,
                      }),
                    '运行设置已保存',
                  )
                "
              >
                <fieldset :disabled="!admin || busy">
                  <div class="form-grid">
                    <label
                      >每分钟打印上限<input
                        v-model.number="settingsDraft.printRate"
                        type="number"
                        min="1"
                        required /></label
                    ><label
                      >打印队列上限<input
                        v-model.number="settingsDraft.printQueueLimit"
                        type="number"
                        min="1"
                        required /></label
                    ><label
                      >事件保留（天）<input
                        v-model.number="settingsDraft.eventRetentionDays"
                        type="number"
                        min="1"
                        required /></label
                    ><label
                      >任务保留（天）<input
                        v-model.number="settingsDraft.jobRetentionDays"
                        type="number"
                        min="1"
                        required /></label
                    ><label
                      >头像保留（小时）<input
                        v-model.number="settingsDraft.avatarRetentionHours"
                        type="number"
                        min="1"
                        required
                    /></label>
                  </div>
                  <label class="check"
                    ><input
                      type="checkbox"
                      v-model="settingsDraft.physicalTestMode"
                    />测试保护：所有实体输出合计最多10张（已用
                    {{ state.testPagesUsed ?? 0 }} 张）</label
                  >
                  <p class="muted">
                    关闭后进入日常运行，仍按设备速率限制打印；测试额度不会清零。
                  </p>
                  <button class="primary">保存运行设置</button>
                </fieldset>
              </form>
            </section>
            <section v-if="admin" class="form-section">
              <h2>本地备份与恢复</h2>
              <div class="actions">
                <button :disabled="busy" @click="backup">创建数据库备份</button
                ><span v-if="backupName">{{ backupName }}</span>
              </div>
              <form
                class="inline-form"
                @submit.prevent="
                  run(
                    () => api('/restore', { name: restoreName }),
                    '恢复请求已提交，请按服务返回状态重启',
                  )
                "
              >
                <label
                  >备份文件名<input
                    v-model="restoreName"
                    required
                    placeholder="输入已有备份名称" /></label
                ><button class="danger" :disabled="busy">恢复此备份</button>
              </form>
              <small
                >恢复会替换当前数据库。先断开直播并停止任务执行；服务端会检查运行状态。</small
              >
            </section>
            <section v-if="admin" class="form-section">
              <h2>创建访问令牌</h2>
              <form @submit.prevent="createAccess">
                <div class="form-grid">
                  <label
                    >角色<select v-model="accessRole">
                      <option value="viewer">只读查看</option>
                      <option value="operator">操作员</option>
                    </select></label
                  >
                  <div>
                    <span>直播间范围</span
                    ><label v-for="r in rooms" :key="r.id" class="check-label"
                      ><input
                        v-model="accessRooms"
                        type="checkbox"
                        :value="r.id"
                      />{{ r.name }}</label
                    >
                  </div>
                </div>
                <button :disabled="busy || !accessRooms.length" class="primary">
                  生成访问令牌
                </button>
              </form>
              <div v-if="accessToken" class="token-result">
                <p>仅此处展示，请妥善保存</p>
                <code>{{ accessToken }}</code>
              </div>
              <pre v-if="access.length">{{
                JSON.stringify(access, null, 2)
              }}</pre>
            </section>
            <section class="form-section">
              <h2>操作审计</h2>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>角色</th>
                      <th>动作</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="a in state.audits.slice(0, 50)" :key="a.id">
                      <td>{{ stamp(a.at) }}</td>
                      <td>{{ a.actor }}</td>
                      <td>{{ a.action }}</td>
                      <td class="content-cell">{{ a.detail }}</td>
                    </tr>
                    <tr v-if="!state.audits.length">
                      <td colspan="4" class="empty-cell">暂无审计记录。</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section></template
          >
        </template>
      </main>
      <footer class="workspace-footer">
        AI Live Studio <span>本地处理 · 数据可追溯 · 物理出纸独立验收</span>
      </footer>
    </div>
    <Editor
      v-if="editor"
      :title="editor.title"
      :value="editor.value"
      :fields="editor.fields"
      :busy="busy"
      :error="editorError"
      @save="saveEditor"
      @close="editor = null"
    />
  </div>
</template>
