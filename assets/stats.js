/* ===== 3분 놀이터 :: 밸런스게임 공용 통계 모듈 =====
   방문자 전체가 고른 결과를 실시간으로 집계해서 원그래프로 보여주는 기능이에요.
   키 발급이 필요 없는 무료 카운터 API(countapi.mileshilliard.com)를 사용해요.

   [새 밸런스게임에 재사용하는 법]
   1. 이 파일을 <script src="../assets/stats.js"></script>로 불러오세요.
   2. 결과 화면에 <svg id="pie-chart" width="180" height="180" viewBox="0 0 180 180"></svg>
      와 <div id="pie-legend"></div> 를 추가하세요.
   3. 결과 계산 직후 아래처럼 호출하세요:
      await renderPlaygroundStats({
        gameKey: "게임을-구분하는-고유-영문키",   // 예: "dilemma8"
        types: [
          { key:"left",  label:"왼쪽 유형",  color:"#E8483C" },
          { key:"right", label:"오른쪽 유형", color:"#F5A623" },
          { key:"balanced", label:"균형 유형", color:"#1F6F63" }
        ],
        myType: "left" // 이번 방문자가 받은 결과의 key
      });
*/

const COUNTAPI_BASE = "https://countapi.mileshilliard.com/api/v1";

async function playgroundHitAndFetch(gameKey, types, myTypeKey){
  const counts = {};
  try{
    await fetch(COUNTAPI_BASE + "/hit/3minplay_" + gameKey + "_" + myTypeKey);
  }catch(e){ /* 집계 실패해도 결과 화면은 계속 보여줘요 */ }

  await Promise.all(types.map(async (t)=>{
    try{
      const res = await fetch(COUNTAPI_BASE + "/get/3minplay_" + gameKey + "_" + t.key);
      if(res.ok){
        const data = await res.json();
        counts[t.key] = parseInt(data.value) || (t.key===myTypeKey ? 1 : 0);
      } else {
        counts[t.key] = (t.key===myTypeKey) ? 1 : 0;
      }
    }catch(e){
      counts[t.key] = (t.key===myTypeKey) ? 1 : 0;
    }
  }));
  return counts;
}

function drawPieChart(svgEl, types, counts, myTypeKey){
  const total = types.reduce((s,t)=> s + (counts[t.key]||0), 0) || 1;
  const cx=90, cy=90, r=80;
  let startAngle = -90;
  let svgContent = "";

  types.forEach(t=>{
    const value = counts[t.key] || 0;
    const pct = value/total;
    const angle = Math.max(pct*360, total>0 && value>0 ? 0.5 : 0);
    const endAngle = startAngle + angle;
    const largeArc = angle > 180 ? 1 : 0;
    const s = startAngle*Math.PI/180, e = endAngle*Math.PI/180;
    const x1 = cx + r*Math.cos(s), y1 = cy + r*Math.sin(s);
    const x2 = cx + r*Math.cos(e), y2 = cy + r*Math.sin(e);
    const isMine = t.key === myTypeKey;
    svgContent += '<path d="M'+cx+','+cy+' L'+x1+','+y1+' A'+r+','+r+' 0 '+largeArc+' 1 '+x2+','+y2+' Z" fill="'+t.color+'" stroke="#fff" stroke-width="'+(isMine?3:1.5)+'" opacity="'+(isMine?1:0.82)+'"/>';
    startAngle = endAngle;
  });

  svgEl.innerHTML = svgContent;
}

function renderLegend(legendEl, types, counts, myTypeKey){
  const total = types.reduce((s,t)=> s + (counts[t.key]||0), 0) || 1;
  legendEl.innerHTML = "";
  types.forEach(t=>{
    const value = counts[t.key] || 0;
    const pct = Math.round((value/total)*100);
    const isMine = t.key === myTypeKey;
    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; gap:8px; font-size:13px; padding:6px 0;" + (isMine ? " font-weight:700;" : "");
    row.innerHTML =
      '<span style="width:11px; height:11px; border-radius:3px; background:'+t.color+'; flex:0 0 auto;' + (isMine ? ' box-shadow:0 0 0 2px rgba(0,0,0,0.15);' : '') + '"></span>' +
      '<span style="flex:1;">'+t.label + (isMine ? ' (내 결과)' : '') + '</span>' +
      '<span>'+pct+'%</span>';
    legendEl.appendChild(row);
  });
}

async function renderPlaygroundStats(opts){
  const pieEl = document.getElementById("pie-chart");
  const legendEl = document.getElementById("pie-legend");
  const noteEl = document.getElementById("pie-note");
  if(!pieEl || !legendEl) return;

  try{
    const counts = await playgroundHitAndFetch(opts.gameKey, opts.types, opts.myType);
    drawPieChart(pieEl, opts.types, counts, opts.myType);
    renderLegend(legendEl, opts.types, counts, opts.myType);
    const total = opts.types.reduce((s,t)=> s + (counts[t.key]||0), 0);
    if(noteEl) noteEl.textContent = "지금까지 " + total.toLocaleString() + "명이 참여했어요";
  }catch(e){
    if(noteEl) noteEl.textContent = "통계를 불러오지 못했어요. 잠시 후 새로고침해보세요.";
  }
}
