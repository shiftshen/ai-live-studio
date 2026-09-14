export const campaignCopy = {
  zh: {
    title: "心愿邮局",
    subtitle: "你的名字，值得被温柔念出",
    welcome: "欢迎来到心愿邮局",
    idle: "在评论区说「你好」\n让我们认识你",
    note: "免费互动同样欢迎 · 仅提供本场数字互动",
    gifts: "礼物与回馈",
    unit: "份起",
    anyGift: "任意礼物",
    countNote: "同一次连送按最终数量，只触发最高档；份数不是价格。",
    paused: "互动准备中",
    ready: "等待新的互动",
    play: "开启直播语音",
    error: "互动连接暂不可用",
    tiers: ["昵称感谢", "专属祝福", "特别祝福"],
    free: "进场欢迎 · 关注感谢 · 评论「祝福」",
  },
  th: {
    title: "ไปรษณีย์แห่งความหวัง",
    subtitle: "ทุกชื่อมีความหมายสำหรับเรา",
    welcome: "ยินดีต้อนรับทุกคน",
    idle: "พิมพ์ “สวัสดี”\nมาทักทายกันนะคะ",
    note: "ร่วมพูดคุยฟรีได้เสมอ · กิจกรรมดิจิทัลในไลฟ์นี้เท่านั้น",
    gifts: "ของขวัญและคำขอบคุณ",
    unit: "ชิ้นขึ้นไป",
    anyGift: "ของขวัญใดก็ได้",
    countNote:
      "นับยอดสุดท้ายต่อชุด รับคำขอบคุณระดับสูงสุดครั้งเดียว จำนวนไม่ใช่ราคา",
    paused: "กำลังเตรียมกิจกรรม",
    ready: "รอข้อความใหม่",
    play: "เปิดเสียงไลฟ์",
    error: "การเชื่อมต่อขัดข้องชั่วคราว",
    tiers: ["ขอบคุณพร้อมเรียกชื่อ", "คำอวยพรเฉพาะคุณ", "คำอวยพรพิเศษ"],
    free: "ทักทาย · ขอบคุณที่ติดตาม · พิมพ์ “อวยพร”",
  },
} as const;
export function campaignPreset(language: "zh" | "th") {
  const th = language === "th",
    c = campaignCopy[language];
  return [
    {
      key: "join",
      name: th ? "ต้อนรับผู้ชม" : "进场欢迎",
      eventType: "join",
      minCount: 1,
      priority: 100,
      keywords: [],
      oncePerSession: true,
      cooldownSec: 60,
      body: th
        ? "ยินดีต้อนรับคุณ {{nickname}} สู่ไปรษณีย์แห่งความหวังค่ะ"
        : "欢迎{{nickname}}来到心愿邮局，很高兴遇见你。",
    },
    {
      key: "follow",
      name: th ? "ขอบคุณที่ติดตาม" : "关注感谢",
      eventType: "follow",
      minCount: 1,
      priority: 110,
      keywords: [],
      oncePerSession: true,
      cooldownSec: 60,
      body: th
        ? "ขอบคุณคุณ {{nickname}} ที่ติดตามค่ะ แวะมาพูดคุยกันได้เสมอนะคะ"
        : "谢谢{{nickname}}的关注，欢迎常来坐坐。",
    },
    {
      key: "hello",
      name: th ? "ทักทาย" : "评论问候",
      eventType: "comment",
      minCount: 1,
      priority: 200,
      keywords: th ? ["สวัสดี", "hello"] : ["你好", "hello"],
      oncePerSession: false,
      cooldownSec: 60,
      body: th
        ? "สวัสดีค่ะคุณ {{nickname}} วันนี้เป็นอย่างไรบ้างคะ"
        : "你好，{{nickname}}，愿今天有好事发生。",
    },
    {
      key: "wish",
      name: th ? "คำอวยพรฟรี" : "免费祝福",
      eventType: "comment",
      minCount: 1,
      priority: 210,
      keywords: th ? ["อวยพร", "วันเกิด"] : ["祝福", "生日快乐"],
      oncePerSession: false,
      cooldownSec: 60,
      body: th
        ? "คุณ {{nickname}} ขอให้วันนี้มีรอยยิ้ม สุขภาพแข็งแรง และพบเจอเรื่องดี ๆ นะคะ"
        : "{{nickname}}，愿你所遇皆温暖，所行皆坦途，每天都有值得期待的小幸福。",
    },
    ...[1, 10, 66].map((n, i) => ({
      key: "gift-" + n,
      name: c.tiers[i],
      eventType: "gift",
      minCount: n,
      priority: 400 + i * 100,
      keywords: [],
      oncePerSession: false,
      cooldownSec: 0,
      body: th
        ? [
            "ขอบคุณคุณ {{nickname}} สำหรับ {{giftName}} จำนวน {{count}} ชิ้นค่ะ ยินดีที่ได้พบกันนะคะ",
            "ขอบคุณคุณ {{nickname}} สำหรับ {{giftName}} จำนวน {{count}} ชิ้นค่ะ ขอให้ทุกวันมีรอยยิ้มและพบเจอสิ่งดี ๆ นะคะ",
            "ขอบคุณคุณ {{nickname}} สำหรับ {{giftName}} จำนวน {{count}} ชิ้นค่ะ ขอให้สุขภาพแข็งแรง ความตั้งใจค่อย ๆ สำเร็จ และมีคนใจดีอยู่ข้าง ๆ เสมอนะคะ",
          ][i]
        : [
            "谢谢{{nickname}}送来的{{count}}个{{giftName}}，这份心意收到啦。",
            "谢谢{{nickname}}送来的{{count}}个{{giftName}}。送你一份专属祝福：愿你眼里有光，心中有暖，今天比昨天更开心。",
            "谢谢{{nickname}}送来的{{count}}个{{giftName}}。这封特别祝福送给你：愿你的认真都有回响，忙碌都有收获，身边总有懂你的人。",
          ][i],
    })),
  ];
}
