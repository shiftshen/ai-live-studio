export async function api<T = any>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch("/api/v1" + path, {
      method: method || (body === undefined ? "GET" : "POST"),
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: c.signal,
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `请求失败 (${r.status})`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}
export const stamp = (n: number) =>
  new Date(n).toLocaleString("zh-CN", { hour12: false });
export const labels: Record<string, string> = {
  accepted: "云端已受理",
  ready: "待播放",
  sending: "发送中",
  held: "已暂存",
  blocked: "已阻止",
  dry_run: "仅演练",
  enriched: "内容已就绪",
  unverified: "未验证",
  observed: "已收到事件",
  connecting: "连接中",
  waiting_events: "转发在线，等待事件",
  waiting_relay: "等待转发",
  join: "进入直播",
  follow: "关注",
  comment: "评论",
  gift: "礼物",
  like: "点赞",
  print: "打印",
  speech: "语音",
  overlay: "屏幕字幕",
  pending: "等待执行",
  completed: "已完成",
  failed: "失败",
  unknown: "结果未知",
  cancelled: "已取消",
  processing: "处理中",
  simulated: "模拟",
  live: "直播",
  replay: "重放",
  connected: "已连接",
  disconnected: "未连接",
};
export const label = (s: string) => labels[s] || s;
