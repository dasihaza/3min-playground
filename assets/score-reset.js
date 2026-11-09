/* ===== 웹게임 전체 순위 초기화 =====
   메인 화면 맨 아래 전구를 누르면 모든 웹게임의 순위표를 지우고,
   초기화 표시(farm_rankings/score_reset)를 새로 남겨요.
   이 파일을 불러오는 페이지는 열릴 때 그 표시를 확인해서,
   이 기기에 남은 예전 점수(최고 기록·단계별 점수·별)도 지워요. */
(function(){
  var API_KEY = "AIzaSyAqXsG8npxettrCRH3MbZwFZGLg5aehxdw";
  var BASE = "projects/min-playground/databases/(default)/documents/";
  var DOCS_URL = "https://firestore.googleapis.com/v1/" + BASE;
  var MARK = "farm_rankings/score_reset";
  var SEEN_KEY = "sambun-score-reset";
  var ADMIN_PW = "3min";

  /* 지울 순위표 : [문서 경로, 순위 목록 칸 이름] */
  var BOARDS = [
    ["farm_rankings/top5", "top5"],                 // 농사의 왕
    ["farm_rankings/getbeol_top5", "top5"],         // 갯벌을 지키자! (보통)
    ["farm_rankings/getbeol_easy_top5", "top5"],    // 갯벌을 지키자! (쉬움)
    ["farm_rankings/baramgil_top", "top"],          // 바람길
    ["farm_rankings/balloon_prince_top", "top"],    // 딱 맞게 부풀려라
    ["farm_rankings/gas_hero_top", "top"],          // 기체 히어로 출동!
    ["farm_rankings/sound_post_top", "top"],        // 또롱이의 소리 우체국
    ["flag_rankings/diff_8", "top3"],               // 세계 국기 짝 맞추기
    ["flag_rankings/diff_15", "top3"],
    ["flag_rankings/diff_25", "top3"]
  ];

  /* 이 기기에 남은 점수 : 최고 기록은 지우고, 진행 기록은 열린 단계만 남겨요 */
  var BEST_KEYS = ["farmking-best", "getbeol-best", "getbeol-best-easy"];
  var PROGRESS_KEYS = ["bubble-prince-v1", "gas-hero-v1", "sound-post-progress", "baramgil"];

  function clearLocal(){
    var changed = false;
    BEST_KEYS.forEach(function(k){
      if(localStorage.getItem(k) !== null){ localStorage.removeItem(k); changed = true; }
    });
    PROGRESS_KEYS.forEach(function(k){
      var p = null;
      try{ p = JSON.parse(localStorage.getItem(k) || "null"); }catch(e){}
      if(!p || typeof p !== "object") return;
      var had = false;
      if(Array.isArray(p.scores) && p.scores.some(function(s){ return s > 0; })){ had = true; p.scores = p.scores.map(function(){ return 0; }); }
      if(Array.isArray(p.stars) && p.stars.some(function(s){ return s > 0; })){ had = true; p.stars = []; }
      if(had){ localStorage.setItem(k, JSON.stringify(p)); changed = true; }
    });
    return changed;
  }

  function readMark(){
    return fetch(DOCS_URL + MARK + "?key=" + API_KEY).then(function(r){
      if(r.status === 404) return "";
      if(!r.ok) throw new Error("HTTP " + r.status);
      return r.json().then(function(d){ return (d.fields && d.fields.id && d.fields.id.stringValue) || ""; });
    });
  }

  /* 페이지가 열릴 때 : 초기화 표시가 바뀌었으면 이 기기 점수도 지워요 */
  function syncLocal(reloadIfChanged){
    readMark().then(function(id){
      if(!id) return;
      var seen = null;
      try{ seen = localStorage.getItem(SEEN_KEY); }catch(e){ return; }
      if(seen === id) return;
      var changed = false;
      try{ changed = clearLocal(); localStorage.setItem(SEEN_KEY, id); }catch(e){ return; }
      // 게임은 시작할 때 점수를 이미 읽어 두었으니, 지운 게 있으면 새로 불러와요
      if(changed && reloadIfChanged) location.reload();
    }).catch(function(){});
  }

  /* 관리자 전구 : 모든 순위표와 초기화 표시를 한 번에 써요 (하나라도 실패하면 아무것도 안 바뀌어요) */
  function resetAll(){
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var writes = BOARDS.map(function(b){
      var fields = {}; fields[b[1]] = { arrayValue: {} };
      return { update: { name: BASE + b[0], fields: fields } };
    });
    writes.push({ update: { name: BASE + MARK, fields: {
      id: { stringValue: id },
      at: { timestampValue: new Date().toISOString() }
    } } });
    return fetch(DOCS_URL.slice(0, -1) + ":commit?key=" + API_KEY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writes: writes })
    }).then(function(r){
      if(!r.ok) return r.text().then(function(t){ throw new Error("HTTP " + r.status + " " + t.slice(0, 200)); });
      try{ clearLocal(); localStorage.setItem(SEEN_KEY, id); }catch(e){}
    });
  }

  function adminResetAll(){
    var bulb = document.getElementById("resetBulb");
    var pw = prompt("관리자 비밀번호를 입력하세요.");
    if(pw === null) return;
    if(pw !== ADMIN_PW){ alert("비밀번호가 달라요."); return; }
    if(!confirm("모든 웹게임의 순위를 지울까요?\n학생들 기기에 저장된 최고 기록과 점수도 다음에 접속할 때 함께 지워져요.\n지우면 되돌릴 수 없어요.")) return;
    if(bulb) bulb.classList.add("on");
    resetAll().then(function(){
      alert("✅ 모든 웹게임 순위를 초기화했어요.");
    }).catch(function(e){
      alert("초기화하지 못했어요.\n" + (e && e.message ? e.message : ""));
    }).then(function(){ if(bulb) bulb.classList.remove("on"); });
  }

  var bulb = document.getElementById("resetBulb");
  if(bulb){
    bulb.onclick = adminResetAll;
    syncLocal(false);
  } else {
    syncLocal(true);
  }
})();
