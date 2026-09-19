/* ===========================================================
   질병관리청 감염병 통계 → assets/outbreaks.json 만들기
   GitHub Actions 안에서 하루 한 번 자동으로 실행됩니다.
   (브라우저가 아니라 GitHub 서버에서 도니까 차단 문제가 없어요)

   필요한 값 (GitHub 저장소 Secrets 에 넣습니다)
     KDCA_SERVICE_KEY : 공공데이터포털에서 받은 일반 인증키(Decoding)
     KDCA_API_URL     : 활용신청한 오퍼레이션의 요청주소
                        (예: https://apis.data.go.kr/.../getInfectiousDisease )
   =========================================================== */

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.KDCA_SERVICE_KEY || "";
const URL_BASE = process.env.KDCA_API_URL || "";
const OUT = path.join(process.cwd(), "assets", "outbreaks.json");

/* 유행 정도 판단 기준 (주간 신고 건수)
   숫자는 학교에서 체감하는 수준에 맞춰 넉넉히 잡았어요. 필요하면 고치세요. */
const LEVEL_RULE = [
  { min: 3000, level: 3 },   /* 크게 유행 */
  { min: 800,  level: 2 },   /* 유행 */
  { min: 150,  level: 1 }    /* 주의 */
];

/* 아이들 눈높이 설명·예방법 (질병명으로 찾아 붙입니다) */
const INFO = {
  "인플루엔자": { emoji:"🤒",
    desc:"열이 갑자기 오르고 몸이 쑤시며 기침이 나요. 사람이 많은 곳에서 잘 퍼져요.",
    prevent:["비누로 30초 이상 손 씻기","기침할 땐 옷소매로 입 가리기","사람 많은 곳에서는 마스크 쓰기","물 자주 마시고 잠 푹 자기"] },
  "수족구병": { emoji:"🖐️",
    desc:"손·발·입 안에 작은 물집이 생기고 열이 나요. 침이나 손을 통해 옮아요.",
    prevent:["손을 자주 깨끗이 씻기","친구와 컵·수저 같이 쓰지 않기","장난감 자주 닦기","물집을 손으로 만지지 않기"] },
  "유행성각결막염": { emoji:"👁️",
    desc:"눈이 빨개지고 눈곱이 많이 껴요. 눈을 만진 손으로 물건을 만지면 옮아요.",
    prevent:["눈을 손으로 비비지 않기","수건 따로 쓰기","손 자주 씻기","눈이 빨개지면 바로 어른께 말하기"] },
  "유행성이하선염": { emoji:"😷",
    desc:"귀 아래 볼이 붓고 아파요. 볼거리라고도 불러요.",
    prevent:["예방접종 확인하기","손 자주 씻기","기침 예절 지키기","아프면 집에서 쉬기"] },
  "수두": { emoji:"💧",
    desc:"온몸에 가려운 물집이 생기고 열이 나요. 공기로도 옮을 수 있어요.",
    prevent:["예방접종 확인하기","물집을 긁지 않기","손·손톱 깨끗이 하기","아프면 집에서 쉬기"] },
  "노로바이러스": { emoji:"🤢",
    desc:"토하고 배가 아프며 설사를 해요. 음식이나 손을 통해 옮아요.",
    prevent:["음식은 익혀 먹기","물은 끓여 마시기","화장실 다녀와서 손 씻기","아프면 음식 만들지 않기"] },
  "코로나19": { emoji:"😷",
    desc:"열·기침·목아픔이 생겨요. 가까이서 이야기할 때 잘 퍼져요.",
    prevent:["사람 많은 곳에서 마스크 쓰기","손 자주 씻기","자주 환기하기","아프면 집에서 쉬기"] },
  "백일해": { emoji:"😮‍💨",
    desc:"기침이 오래 이어지고 숨쉬기 힘들어져요.",
    prevent:["예방접종 확인하기","기침할 땐 옷소매로 가리기","손 자주 씻기","기침이 2주 넘으면 병원 가기"] },
  "마이코플라스마": { emoji:"🫁",
    desc:"기침이 오래 가고 열이 나요. 학교나 학원에서 잘 퍼져요.",
    prevent:["손 자주 씻기","기침 예절 지키기","자주 환기하기","아프면 병원 진료받기"] }
};

function pickInfo(name){
  const keys = Object.keys(INFO);
  for (const k of keys) if (name.includes(k)) return { key:k, ...INFO[k] };
  return { key:name, emoji:"🦠",
    desc:"요즘 퍼지고 있는 감염병이에요. 사람이 많은 곳에서 조심해요.",
    prevent:["손을 자주 깨끗이 씻기","기침할 땐 옷소매로 입 가리기","사람 많은 곳에서는 마스크 쓰기","아프면 집에서 쉬기"] };
}

function levelOf(count){
  for (const r of LEVEL_RULE) if (count >= r.min) return r.level;
  return 0;
}

/* 응답에서 (질병명, 건수) 짝을 최대한 찾아냅니다 — JSON·XML 둘 다 대응 */
function extractPairs(text){
  const pairs = [];

  /* JSON 시도 */
  try {
    const j = JSON.parse(text);
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === "object") {
        const keys = Object.keys(node);
        let name = null, cnt = null;
        for (const k of keys) {
          const lk = k.toLowerCase();
          const v = node[k];
          if (name === null && typeof v === "string" &&
              /(nm|name|kor|dis|term)/.test(lk) && v.trim()) name = v.trim();
          if (cnt === null && /(cnt|count|num|case|occrrnc|tot)/.test(lk)) {
            const n = parseInt(String(v).replace(/[^\d]/g, ""), 10);
            if (!isNaN(n)) cnt = n;
          }
        }
        if (name && cnt !== null) pairs.push([name, cnt]);
        keys.forEach(k => walk(node[k]));
      }
    };
    walk(j);
    if (pairs.length) return pairs;
  } catch (e) { /* JSON 이 아니면 XML 로 */ }

  /* XML 시도 : <item> 안에서 이름/숫자 태그 찾기 */
  const items = text.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const it of items) {
    let name = null, cnt = null;
    const tags = it.match(/<([^\/>\s]+)>([^<]*)<\/\1>/g) || [];
    for (const t of tags) {
      const m = t.match(/<([^\/>\s]+)>([^<]*)<\/\1>/);
      if (!m) continue;
      const tag = m[1].toLowerCase(), val = m[2].trim();
      if (name === null && /(nm|name|kor|dis|term)/.test(tag) && val && !/^\d+$/.test(val)) name = val;
      if (cnt === null && /(cnt|count|num|case|occrrnc|tot)/.test(tag)) {
        const n = parseInt(val.replace(/[^\d]/g, ""), 10);
        if (!isNaN(n)) cnt = n;
      }
    }
    if (name && cnt !== null) pairs.push([name, cnt]);
  }
  return pairs;
}

function today(){
  const d = new Date(Date.now() + 9 * 3600 * 1000); /* 한국 시각 */
  return d.toISOString().slice(0, 10);
}

function save(list, note){
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    updated: today(),
    note: note || "",
    list
  }, null, 2), "utf8");
  console.log("저장 완료 :", OUT, "/ 유행 중", list.length, "건");
}

async function main(){
  if (!KEY || !URL_BASE) {
    console.log("KDCA_SERVICE_KEY 또는 KDCA_API_URL 이 없어 빈 목록으로 저장합니다.");
    save([], "인증키가 설정되지 않았습니다");
    return;
  }

  /* 최근 2주 */
  const end = new Date(Date.now() + 9 * 3600 * 1000);
  const start = new Date(end.getTime() - 14 * 86400000);
  const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, "");

  const url = URL_BASE
    + (URL_BASE.includes("?") ? "&" : "?")
    + "serviceKey=" + encodeURIComponent(KEY)
    + "&pageNo=1&numOfRows=200&_type=json"
    + "&stdDay=" + ymd(end)
    + "&startCreateDt=" + ymd(start) + "&endCreateDt=" + ymd(end);

  console.log("요청 :", url.replace(encodeURIComponent(KEY), "***"));

  let text = "";
  try {
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    text = await res.text();
    console.log("응답 길이 :", text.length);
  } catch (e) {
    console.log("요청 실패 :", e.message);
    save([], "자료를 받지 못했습니다");
    return;
  }

  if (/SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ERROR|등록되지 않은/i.test(text)) {
    console.log("인증키 오류로 보입니다. 앞부분:", text.slice(0, 300));
    save([], "인증키를 확인해 주세요");
    return;
  }

  const pairs = extractPairs(text);
  console.log("찾은 항목 수 :", pairs.length);
  if (!pairs.length) {
    console.log("응답 앞부분 :", text.slice(0, 500));
    save([], "자료 모양이 달라 읽지 못했습니다");
    return;
  }

  /* 질병별 합계 → 유행 등급 매기기 */
  const sum = {};
  for (const [n, c] of pairs) sum[n] = (sum[n] || 0) + c;

  const list = [];
  for (const name of Object.keys(sum)) {
    const lv = levelOf(sum[name]);
    if (lv === 0) continue;
    const info = pickInfo(name);
    if (list.some(x => x.name === info.key)) continue;   /* 중복 제거 */
    list.push({
      name: info.key, level: lv, emoji: info.emoji,
      desc: info.desc, prevent: info.prevent,
      count: sum[name]
    });
  }
  list.sort((a, b) => b.level - a.level || b.count - a.count);
  save(list.slice(0, 5), "질병관리청 자료 기준");
}

main();
