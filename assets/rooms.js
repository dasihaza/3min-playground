/* =========================================================
   3분 놀이터 — 장소(메뉴)와 프로그램 목록
   ---------------------------------------------------------
   ▶ 새 웹프로그램을 올리면 해당 장소의 programs 배열에
     한 줄만 추가하세요. 메인화면 '엿보기'와 각 실 페이지에
     자동으로 나타납니다.
   ▶ href 값은 실제 파일 경로로 바꿔 주세요. (지금은 예시)
   ▶ isNew: true 를 붙이면 'NEW' 배지가 붙어요.
   ========================================================= */
const ROOMS = {
  playground: {
    name: '놀이터', menu: '놀이 퀴즈', emoji: '🛝', floor: '운동장', en: 'PLAYGROUND',
    page: 'playground.html', accent: '#ff7a59',
    desc: '웹게임, 타자 게임, 상식 퀴즈까지! 3분이면 끝나는 놀이',
    programs: [
      { emoji: '🦀', title: '갯벌을 지키자!', desc: '갯벌 생물 이름을 타자로 쳐서 갯벌을 넓히고 개발 악당을 물리쳐요', tag: '타자 게임', href: 'content/getbeol-guard.html' },
      { emoji: '🐍', title: '먹이사슬 대작전', desc: '메뚜기·개구리·뱀·사람 중 하나가 되어 3분간 살아남아요 (최대 4명)', tag: '웹게임', href: 'content/food-chain.html' },
      { emoji: '🦸', title: '기후 히어로: 지구를 구해 줘!', desc: '감축·적응·지구공학 히어로가 되어 기후 변화의 원인과 대응을 배워요', tag: '웹게임 RPG', href: 'content/climate-hero.html' },
      { emoji: '📮', title: '또롱이의 소리 우체국', desc: '소리가 고체·액체·기체 중 무엇을 지나는지 맞히며 소리 길을 잇고 방을 탈출해요', tag: '웹게임', href: 'content/sound-post.html' },
      { emoji: '🏠', title: '우리 집 겨울나기', desc: '냄비, 욕조, 거실 난방 미션으로 열의 이동을 익히고 한파 대왕을 물리쳐요', tag: '웹게임', href: 'content/winter-home.html' },
      { emoji: '🫧', title: '기체 히어로 출동!', desc: '7가지 기체 중 알맞은 기체를 골라 시민을 도와요', tag: '웹게임', href: 'content/gas-hero.html' },
      { emoji: '🎈', title: '딱 맞게 부풀려라', desc: '온도와 압력으로 열기구·타이어·탁구공 크기를 조절해 왕자를 도와요', tag: '웹게임', href: 'content/balloon-prince.html' },
      { emoji: '🎬', title: '꼬마 폴리 아티스트', desc: '생활 물건으로 효과음을 만들어 소리 없는 장면에 녹음해요', tag: '웹게임', href: 'content/foley-artist.html' },
      { emoji: '🌬️', title: '바람길', desc: '고기압과 저기압의 바람을 타고 기상 풍선을 관측소까지 보내요', tag: '웹게임', href: 'content/baramgil.html' },
      { emoji: '🌾', title: '농사의 왕', desc: '씨앗을 심고 벌레를 잡고 물을 주며 농사를 지어요', tag: '웹게임', href: 'content/farm-king.html' },
      { emoji: '🚩', title: '세계 국기 짝 맞추기', desc: '국기 카드 50장에서 같은 국기를 찾아 짝을 맞춰요', tag: '기억력 게임', href: 'content/flag-memory.html' },
      { emoji: '👾', title: '몬조운', desc: '몬스터를 조합해 오늘의 운세를 보고 더 강하게 키워요', tag: '웹게임 3분+', href: 'content/core-mixmaster.html' },
      { emoji: '🧠', title: '초등 상식 퀴즈 (만물박사)', desc: '만물박사 선발대회 대비 예상문제, 매일 새 문제가 나와요', tag: '매일 50문제', href: 'content/manmul-quiz.html' }
    ]
  },
  lab: {
    name: '연구실', menu: '수업 도구', emoji: '🔬', floor: '3층', en: 'LAB',
    page: 'lab.html', accent: '#3fb6d9',
    desc: '타이머, 자리 뽑기, 소리 분석기 등 수업이 즐거워지는 교실 도구',
    programs: [
      { emoji: '🔊', title: '소리 분석기', desc: '소리의 크기와 높낮이를 눈으로 보여 줘요', tag: '수업용', href: 'content/noise-meter.html' },
      { emoji: '🙋', title: '애들아 모여라', desc: '방 번호로 학생들의 글·그림·풀이를 한 화면에서 실시간으로 확인해요', tag: '실시간', href: 'content/classroom.html', isNew: true },
      { emoji: '⏱️', title: '똑딱똑딱 교실 타이머', desc: '알림 방식을 골라 켜는 교실 타이머', tag: '수업용', href: 'content/timer.html' },
      { emoji: '🪑', title: '두근두근 자리바꾸기', desc: '명단으로 분단·모둠 자리를 남녀 고르게 뽑아요', tag: '1분', href: 'content/seat-shuffle.html' },
      { emoji: '🪜', title: '두근두근 사다리타기', desc: '사람 수와 당첨 개수만 정하면 바로 시작해요', tag: '1분', href: 'content/ladder.html' },
      { emoji: '👕', title: '오늘 뭐 입지?', desc: '지역 날씨와 미세먼지로 옷차림과 마스크를 안내해요', tag: '1분', href: 'content/today-weather.html' },
      { emoji: '✏️', title: '슥삭슥삭 필기도구', desc: '캡처 화면이나 화이트보드에 밑줄·별표·글자를 써요', tag: '수업용', href: 'content/writing-tool.html' },
      { emoji: '🎵', title: '도레미 리코더 도우미', desc: '계이름으로 운지법 그림을 보고 악보를 인쇄해요', tag: '음악 시간', href: 'content/recorder-helper.html' },
      { emoji: '🌅', title: '2학기 아침활동지', desc: '학년별 90일치 아침활동지 (수학·영어·한자·속담)', tag: '3~6학년', href: 'content/morning-hub.html' }
    ]
  },
  office: {
    name: '교무실', menu: '업무 꾸러미', emoji: '🗂️', floor: '1층', en: 'TEACHERS\' OFFICE',
    page: 'office.html', accent: '#e0a33a',
    desc: '알림장, 품의서 자동 작성 등 선생님의 업무 시간을 줄여 주는 도구',
    programs: [
      { emoji: '📒', title: '알림장 자동완성기', desc: '항목을 체크하면 가정통신문·행사·준비물 등 알림장이 완성돼요', tag: '1분', href: 'content/notice-helper.html' },
      { emoji: '🧾', title: '품의 자동완성기', desc: '장바구니 내용을 붙여넣으면 품목내역 표를 만들고 엑셀로 내려받아요', tag: '1분', href: 'content/purchase-helper.html' }
    ]
  },
  meeting: {
    name: '회의실', menu: '이야기방', emoji: '💬', floor: '2층', en: 'MEETING ROOM',
    page: 'meeting.html', accent: '#6c7ce0',
    desc: '교육자로서의 생각과 관점을 나누는 이야기 공간',
    programs: [
      { emoji: '🤖', title: '정보교육과 AI', desc: '최신 정보교육과 AI 소식에 대하여 교육자로서 느끼는 점, 관점 등을 나누는 공간', tag: '자유 주제', href: 'content/board.html' }
    ]
  },
  council: {
    name: '학생자치실', menu: '나 알아보기', emoji: '🎗️', floor: '3층', en: 'STUDENT COUNCIL',
    page: 'council.html', accent: '#e8668f',
    desc: 'MBTI, 진로, 연애 스타일, 밸런스 게임으로 알아보는 진짜 나',
    programs: [
      { emoji: '🏫', title: 'MBTI 학교ver (앞)', desc: '학교 상황 20가지로 알아보는 내 상징', tag: '테스트', href: 'content/mbti-front.html' },
      { emoji: '🌿', title: 'MBTI 학교ver (뒤)', desc: '학교 상황 20가지로 알아보는 내 안의 자연', tag: '테스트', href: 'content/mbti-back.html' },
      { emoji: '🧭', title: '나의 커리어 나침반', desc: '학교생활 질문 10가지로 어울리는 직업을 찾아요', tag: '테스트', href: 'content/career-test.html' },
      { emoji: '💌', title: '나의 연애 스타일 테스트', desc: '썸·다툼·화해의 순간으로 알아보는 연애 스타일', tag: '테스트', href: 'content/love-style-test.html' },
      { emoji: '⚖️', title: '인생 최고의 딜레마 8선', desc: '고민되는 밸런스 게임 8가지', tag: '밸런스 게임', href: 'content/balance-game.html' }
    ]
  }
};
const ROOM_ORDER = ['playground', 'lab', 'office', 'meeting', 'council'];

/* 실제 사이트(3min-playground.com)가 아닌 곳에서 미리 볼 때는
   프로그램 링크를 실제 사이트 주소로 열어 줍니다. */
const SITE = 'https://3min-playground.com/';
const IS_PREVIEW = !/3min-playground\.com$/.test(location.hostname);

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fixPreviewLinks(root) {
  if (!IS_PREVIEW) return;
  root.querySelectorAll('a.prog-link, a.site-link').forEach(a => {
    a.href = SITE + a.getAttribute('href');
    a.target = '_blank';
    a.rel = 'noopener';
  });
}

/* 각 실 페이지: 프로그램 카드 그리기 */
function mountPrograms(key, cardFn) {
  const room = ROOMS[key];
  const box = document.getElementById('programs');
  box.innerHTML = room.programs.map((p, i) => cardFn(p, i, room)).join('');
  fixPreviewLinks(box);
  const cnt = document.querySelector('[data-count]');
  if (cnt) cnt.textContent = room.programs.length;
}

/* 각 실 페이지 하단: 다른 장소로 가는 복도 표지판 */
function mountRoomNav(current) {
  const nav = document.getElementById('roomNav');
  if (!nav) return;
  nav.innerHTML = `<h2 class="room-nav-title">다른 장소로 가 볼까요?</h2><ul>` +
    ROOM_ORDER.map(k => {
      const r = ROOMS[k];
      const here = k === current;
      return `<li><a class="door${here ? ' here' : ''}" href="${here ? '#' : r.page}" style="--accent:${r.accent}" ${here ? 'aria-current="page"' : ''}>
        <span class="door-emoji">${r.emoji}</span>
        <span class="door-name">${r.name}</span>
        <span class="door-menu">${here ? '지금 여기' : r.menu}</span></a></li>`;
    }).join('') +
    `<li><a class="door home-door" href="index.html"><span class="door-emoji">🏫</span><span class="door-name">학교 지도</span><span class="door-menu">처음으로</span></a></li></ul>`;
}

/* 하단 개인정보처리방침 링크도 미리보기에서는 실제 사이트로 */
document.addEventListener('DOMContentLoaded', () => fixPreviewLinks(document.querySelector('.site-foot') || document.body));
