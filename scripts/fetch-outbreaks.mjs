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

/* 주소 다듬기 : 앞뒤 공백·줄바꿈 제거, 이미 붙어 있는 serviceKey 제거 */
function cleanUrl(u){
  /* 줄바꿈·일반공백·한글공백(ㅤ)·무형공백 등 모두 제거 */
  let v = String(u).replace(/[\s\u00A0\u1160\u3164\u200B-\u200D\uFEFF]/g, "");
  v = v.split("?")[0];        /* 물음표 뒤 옵션은 스크립트가 직접 붙입니다 */
  v = v.replace(/\/+$/, "");   /* 끝의 빗금 제거 */
  return v;
}

/* 한 번 호출해 보기 */
async function tryFetch(url, label){
  console.log("  [" + label + "] 시도 : " + url.replace(/serviceKey=[^&]*/, "serviceKey=***"));
  try{
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20000)
    });
    const text = await res.text();
    console.log("  [" + label + "] 응답 코드 " + res.status + " / 길이 " + text.length);
    return { ok: res.ok, text };
  }catch(e){
    const c = e.cause || {};
    console.log("  [" + label + "] 실패 : " + e.message
      + (c.code ? " (" + c.code + ")" : "")
      + (c.message && c.message !== e.message ? " - " + c.message : ""));
    return null;
  }
}

async function main(){
  if (!KEY || !URL_BASE) {
    console.log("KDCA_SERVICE_KEY 또는 KDCA_API_URL 이 없어 빈 목록으로 저장합니다.");
    save([], "인증키가 설정되지 않았습니다");
    return;
  }

  const base = cleanUrl(URL_BASE);

  /* 주소 점검 — 비밀키가 아니라면 그대로 보입니다 */
  let host = "";
  try { host = new URL(base).host; }
  catch(e){
    console.log("주소 모양이 올바르지 않습니다 :", base);
    console.log("→ https:// 로 시작하는 '요청주소'를 넣었는지 확인해 주세요.");
    save([], "요청주소를 확인해 주세요");
    return;
  }
  console.log("접속할 서버 :", host);

  const end = new Date(Date.now() + 9 * 3600 * 1000);
  const start = new Date(end.getTime() - 14 * 86400000);
  const ymd = d => d.toISOString().slice(0, 10).replace(/-/g, "");

  const qs = "serviceKey=" + encodeURIComponent(KEY)
    + "&pageNo=1&numOfRows=200&_type=json"
    + "&stdDay=" + ymd(end)
    + "&startCreateDt=" + ymd(start) + "&endCreateDt=" + ymd(end);

  const httpsUrl = base + (base.includes("?") ? "&" : "?") + qs;
  const httpUrl  = httpsUrl.replace(/^https:/, "http:");

  /* ① https → ② http → ③ 인증서 검사 완화 순으로 시도 */
  let got = await tryFetch(httpsUrl, "https");
  if (!got) got = await tryFetch(httpUrl, "http");
  if (!got) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    got = await tryFetch(httpsUrl, "https(인증서 검사 완화)");
  }

  if (!got) {
    console.log("");
    console.log("세 가지 방법 모두 연결하지 못했습니다.");
    console.log("확인해 주세요 :");
    console.log("  1) 요청주소가 공공데이터포털 상세화면의 '요청주소'와 같은지");
    console.log("  2) 주소 끝에 물음표(?) 뒤 내용이 붙어 있지 않은지");
    console.log("  3) 활용신청이 승인되었는지 (신청 직후엔 1시간쯤 걸립니다)");
    save([], "서버에 연결하지 못했습니다");
    return;
  }

  const text = got.text;

  if (/SERVICE_KEY_IS_NOT_REGISTERED|등록되지 않은|SERVICE ERROR|INVALID_REQUEST/i.test(text)) {
    console.log("인증키 문제로 보입니다. 응답 앞부분:");
    console.log(text.slice(0, 400));
    save([], "인증키를 확인해 주세요");
    return;
  }

  const pairs = extractPairs(text);
  console.log("찾은 항목 수 :", pairs.length);
  if (!pairs.length) {
    console.log("응답 앞부분 (이 내용을 알려주시면 맞춰 드릴 수 있어요) :");
    console.log(text.slice(0, 800));
    save([], "자료 모양이 달라 읽지 못했습니다");
    return;
  }

  const sum = {};
  for (const [n, c] of pairs) sum[n] = (sum[n] || 0) + c;
  console.log("질병별 합계 :", JSON.stringify(sum).slice(0, 400));

  const list = [];
  for (const name of Object.keys(sum)) {
    const lv = levelOf(sum[name]);
    if (lv === 0) continue;
    const info = pickInfo(name);
    if (list.some(x => x.name === info.key)) continue;
    list.push({ name: info.key, level: lv, emoji: info.emoji,
                desc: info.desc, prevent: info.prevent, count: sum[name] });
  }
  list.sort((a, b) => b.level - a.level || b.count - a.count);
  save(list.slice(0, 5), "질병관리청 자료 기준");
}

main();
