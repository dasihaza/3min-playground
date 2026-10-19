// ==UserScript==
// @name         연수 자동 넘김 도우미
// @namespace    https://3min-playground.com/
// @version      1.1.0
// @description  연수 영상·음성이 끝나면 '다음' 버튼을 대신 눌러 줍니다. 확장 메뉴에서 사이트별로 켜고 끕니다.
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

/*
 * 동작 원리
 *  - 페이지(와 그 안의 iframe)의 <video>/<audio> 재생이 끝나는지 지켜봅니다.
 *  - '학습을 완료했습니다', '다음 버튼을 눌러 주세요' 같은 문구가 새로 뜨거나,
 *    잠겨 있던 '다음' 버튼이 풀리는 것도 완료 신호로 봅니다.
 *  - 완료 신호가 오면 몇 초 기다렸다가 '다음' 버튼을 찾아 눌러 줍니다.
 *  - 영상을 빨리 감거나 건너뛰지는 않습니다. 끝까지 들은 뒤에만 넘깁니다.
 *
 * 같은 파일을 두 가지로 씁니다.
 *  - 유저스크립트(Tampermonkey 등): 모든 iframe에서 함께 돌기 때문에
 *    다른 사이트에서 불러온 플레이어도 지켜볼 수 있습니다.
 *  - 북마클릿: 지금 보고 있는 창과 같은 사이트의 iframe만 지켜봅니다.
 */
(function () {
  'use strict';

  var IS_TOP = window.self === window.top;
  var HAS_GM = typeof GM_getValue === 'function';

  // 북마클릿을 한 번 더 누르면 창을 열고 닫습니다.
  if (IS_TOP && window.__autoNext) { window.__autoNext.togglePanel(); return; }

  var store = {
    get: function (k, d) {
      try {
        if (HAS_GM) { var v = GM_getValue(k); return v === undefined ? d : v; }
        var s = localStorage.getItem('autoNext:' + k);
        return s === null ? d : JSON.parse(s);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try {
        if (HAS_GM) GM_setValue(k, v);
        else localStorage.setItem('autoNext:' + k, JSON.stringify(v));
      } catch (e) {}
    }
  };

  var DEFAULTS = { delay: 3, idleWait: 0, textCue: true, autoplay: true };
  var cfg = Object.assign({}, DEFAULTS, store.get('cfg', {}));
  var SEL_KEY = 'sel:' + location.host;
  var fid = Math.random().toString(36).slice(2); // 이 창(프레임)의 이름표

  /* ---------- 찾을 문서 ---------- */

  function sameOriginDocs(win, out) {
    try { if (!win.document) return out; out.push(win.document); } catch (e) { return out; }
    for (var i = 0; i < win.frames.length; i++) sameOriginDocs(win.frames[i], out);
    return out;
  }
  // 유저스크립트는 iframe마다 따로 돌기 때문에 자기 문서만 봅니다.
  function localDocs() { return HAS_GM ? [document] : sameOriginDocs(window, []); }

  function eachFrame(win, fn) {
    for (var i = 0; i < win.frames.length; i++) { fn(win.frames[i]); eachFrame(win.frames[i], fn); }
  }
  function broadcast(msg) {
    msg.__an = 1;
    eachFrame(window, function (f) { try { f.postMessage(msg, '*'); } catch (e) {} });
  }
  function toTop(msg) {
    msg.__an = 1; msg.fid = fid;
    try { window.top.postMessage(msg, '*'); } catch (e) {}
  }
  function crossOriginFrameCount() {
    var n = 0;
    eachFrame(window, function (f) { try { void f.document.body; } catch (e) { n++; } });
    return n;
  }

  /* ---------- '다음' 버튼 찾기 ---------- */

  var CAND = 'a,button,input[type=button],input[type=submit],input[type=image],[role=button],[onclick],img,[id*=next i],[class*=next i]';
  var CLICKABLE = 'a,button,input,[role=button],[onclick]';
  var NEG_LABEL = /이전|prev|뒤로|처음|목록|닫기|종료|나가기|back|before|close|home/i;
  var NEG_SIG = /prev|before|(^|[^a-z])back([^a-z]|$)|close/i;
  var EXACT = /^(다음|다음\s*(페이지|장|화면|차시|강의?|단계|학습)|다음으로|다음\s*[>▶►〉»]+|next|next\s*page|>|>>|▶|►|〉|»|→)$/i;

  function className(el) {
    return typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
  }
  function labelOf(el) {
    var t = el.tagName === 'INPUT' ? (el.value || el.alt || '') : (el.innerText || '');
    t = t || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '';
    if (!t && el.querySelector) { var img = el.querySelector('img[alt]'); if (img) t = img.alt; }
    return t.replace(/\s+/g, ' ').trim();
  }
  function sigOf(el) {
    return [el.id, className(el), el.getAttribute('src') || '', el.getAttribute('onclick') || '',
      el.getAttribute('href') || ''].join(' ');
  }
  function scoreOf(el) {
    var label = labelOf(el), sig = sigOf(el);
    if (label.length > 25 || NEG_LABEL.test(label) || NEG_SIG.test(sig)) return 0;
    var s = 0;
    if (EXACT.test(label)) s += 10;
    else if (/다음|\bnext\b/i.test(label)) s += 6;
    if (/next|nxt/i.test(sig)) s += 5;
    return s;
  }
  function isDisabled(el) {
    return !!el.disabled || el.getAttribute('aria-disabled') === 'true' ||
      /(^|[\s_-])(disabled?|dim|off|inactive)([\s_-]|$)/i.test(className(el)) ||
      /(_off|_dis|disabled?)\.(png|gif|jpe?g|svg)/i.test(el.getAttribute('src') || '');
  }
  function visible(el) {
    if (!el.getClientRects().length) return false;
    var s = el.ownerDocument.defaultView.getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }
  function findNext() {
    var best = null, sel = store.get(SEL_KEY, '');
    localDocs().forEach(function (doc) {
      if (sel) {
        var c = null;
        try { c = doc.querySelector(sel); } catch (e) {}
        if (c && visible(c) && (!best || best.score < 100)) best = { el: c, score: 100, disabled: isDisabled(c) };
      }
      var list = doc.querySelectorAll(CAND);
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (!visible(el)) continue;
        var sc = scoreOf(el);
        if (sc < 5 || (best && sc <= best.score)) continue;
        var target = el.closest(CLICKABLE) || el;
        best = { el: target, score: sc, disabled: isDisabled(el) || isDisabled(target) };
      }
    });
    return best;
  }

  function press(el) {
    try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    var w = el.ownerDocument.defaultView;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup'].forEach(function (t) {
      try {
        var E = t.indexOf('pointer') === 0 && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
        el.dispatchEvent(new E(t, { bubbles: true, cancelable: true }));
      } catch (e) {}
    });
    if (typeof el.click === 'function') el.click();
    else el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  /* ---------- 완료 신호 감시 (모든 프레임 공통) ---------- */

  var tracked = new WeakSet(), media = [];
  var signal = function () {}; // 맨 위 창에서는 바로 판단, iframe에서는 맨 위 창에 알림

  function watchMedia(m) {
    tracked.add(m);
    var st = { el: m, played: false, done: false };
    media.push(st);
    m.addEventListener('playing', function () {
      st.played = true;
      if (m.currentTime < m.duration - 2) st.done = false;
    });
    m.addEventListener('loadstart', function () { st.played = false; st.done = false; });
    m.addEventListener('ended', function () { finished(st); });
    m.addEventListener('timeupdate', function () {
      if (!m.paused) st.played = true;
      if (isFinite(m.duration) && m.duration > 3 && m.currentTime >= m.duration - 0.3) finished(st);
    });
  }
  function realMedia(st) {
    return st.el.isConnected && !st.el.loop && !(isFinite(st.el.duration) && st.el.duration <= 3);
  }
  function isPlaying(st) { return realMedia(st) && !st.el.paused && !st.el.ended; }
  function finished(st) {
    if (st.done || !st.played || !realMedia(st)) return;
    st.done = true;
    if (media.some(function (o) { return o !== st && isPlaying(o); })) return; // 다른 소리가 아직 나는 중
    signal('media');
  }
  function anyMediaPlaying() {
    return Array.prototype.some.call(document.querySelectorAll('video,audio'), function (m) { return !m.paused && !m.ended; });
  }
  function scanMedia() {
    media = media.filter(function (st) { return st.el.isConnected; });
    localDocs().forEach(function (doc) {
      var list = doc.querySelectorAll('video,audio');
      for (var i = 0; i < list.length; i++) if (!tracked.has(list[i])) watchMedia(list[i]);
    });
  }
  function mediaState() {
    var main = null;
    media.forEach(function (st) {
      if (!realMedia(st)) return;
      if (!main || isPlaying(st) || (!isPlaying(main) && (st.el.duration || 0) > (main.el.duration || 0))) main = st;
    });
    if (!main) return { has: false, playing: false };
    return { has: true, playing: isPlaying(main), cur: main.el.currentTime, dur: main.el.duration };
  }

  // 화면에 '학습 완료'류 문구가 새로 생기면 신호
  var CUE = /학습을?\s*(모두\s*)?(완료|마쳤|마치셨)|수강을?\s*완료|다음\s*(버튼|페이지|화면|차시)[으로을를]*\s*(클릭|눌러|선택|이동)/g;
  var cueBase = null;
  function checkCue() {
    var n = 0;
    localDocs().forEach(function (d) {
      var m = d.body ? (d.body.innerText || '').match(CUE) : null;
      n += m ? m.length : 0;
    });
    if (cueBase === null || n < cueBase) { cueBase = n; return; }
    if (n > cueBase) { cueBase = n; signal('cue'); }
  }

  // 잠겨 있던 '다음' 버튼이 풀리면 신호
  var btnLocked = 0;
  function checkBtn() {
    var b = findNext();
    if (!b) { btnLocked = 0; return; }
    if (b.disabled) { btnLocked++; return; }
    if (btnLocked >= 2) signal('btn');
    btnLocked = 0;
  }

  function resetWatch() {
    cueBase = null; btnLocked = 0;
    media.forEach(function (st) { st.done = true; });
  }

  function tryAutoplay() {
    media.forEach(function (st) {
      var m = st.el;
      if (!realMedia(st) || !m.paused || m.ended || m.currentTime > 1) return;
      var p;
      try { p = m.play(); } catch (e) {}
      if (p && p.catch) p.catch(function () { (IS_TOP ? onBlocked : function () { toTop({ type: 'blocked' }); })(); });
    });
  }

  /* ---------- 다음 버튼 직접 지정 ---------- */

  function selectorFor(el) {
    var parts = [], doc = el.ownerDocument;
    while (el && el.nodeType === 1 && el !== doc.body && el !== doc.documentElement) {
      if (el.id && !/\d{4,}/.test(el.id)) { parts.unshift('#' + CSS.escape(el.id)); return parts.join(' > '); }
      var part = el.tagName.toLowerCase(), p = el.parentElement;
      if (p) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === el.tagName; });
        if (same.length > 1) part += ':nth-of-type(' + (same.indexOf(el) + 1) + ')';
      }
      parts.unshift(part);
      el = p;
    }
    return 'body > ' + parts.join(' > ');
  }

  var picking = null;
  function startPick() {
    if (picking) return;
    var docs = localDocs(), hover = null, prevOutline = '';
    function unmark() { if (hover) { hover.style.outline = prevOutline; hover = null; } }
    function over(e) {
      if (e.target === panelHost) return;
      var t = e.target.closest ? e.target.closest(CLICKABLE) || e.target : e.target;
      if (t === hover) return;
      unmark(); hover = t; prevOutline = t.style.outline; t.style.outline = '3px solid #FF7BA4';
    }
    function click(e) {
      if (e.target === panelHost) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var t = e.target.closest ? e.target.closest(CLICKABLE) || e.target : e.target;
      unmark();
      store.set(SEL_KEY, selectorFor(t));
      stopPick();
      if (IS_TOP) onPicked(); else toTop({ type: 'picked' });
    }
    function key(e) { if (e.key === 'Escape') { stopPick(); if (IS_TOP) setNote('지정을 취소했어요.'); } }
    docs.forEach(function (d) {
      d.addEventListener('mouseover', over, true);
      d.addEventListener('click', click, true);
      d.addEventListener('keydown', key, true);
    });
    picking = function () {
      unmark();
      docs.forEach(function (d) {
        d.removeEventListener('mouseover', over, true);
        d.removeEventListener('click', click, true);
        d.removeEventListener('keydown', key, true);
      });
    };
  }
  function stopPick() { if (picking) { picking(); picking = null; } }

  /* ---------- iframe 쪽: 맨 위 창의 지시를 따름 ---------- */

  if (!IS_TOP) {
    var childTimer = null, lastHello = 0, ticks = 0;
    signal = function (kind) { toTop({ type: 'signal', kind: kind }); };
    // 아직 꺼진 사이트라도 영상이 재생되면 맨 위 창에 알려서 '켤까요?'를 물어보게 함
    document.addEventListener('play', function () { toTop({ type: 'seen' }); }, true);
    if (anyMediaPlaying()) toTop({ type: 'seen' });
    var childTick = function () {
      if (Date.now() - lastHello > 10000) { clearInterval(childTimer); childTimer = null; return; }
      scanMedia();
      var s = mediaState();
      toTop({ type: 'state', has: s.has, playing: s.playing, cur: s.cur, dur: s.dur });
      if (++ticks % 2 === 0) { if (cfg.textCue) checkCue(); checkBtn(); }
    };
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.__an !== 1 || d.role !== 'top') return;
      if (d.type === 'hello') {
        lastHello = Date.now(); cfg = d.cfg;
        if (!childTimer) { childTimer = setInterval(childTick, 1000); childTick(); }
      } else if (d.type === 'find') {
        var b = findNext();
        if (b) toTop({ type: 'found', req: d.req, score: b.score, disabled: b.disabled });
      } else if (d.type === 'click' && d.target === fid) {
        var nb = findNext();
        if (nb) press(nb.el);
      } else if (d.type === 'reset') resetWatch();
      else if (d.type === 'autoplay') tryAutoplay();
      else if (d.type === 'pick') startPick();
      else if (d.type === 'unpick') stopPick();
      else if (d.type === 'clearsel') store.set(SEL_KEY, '');
    });
    return;
  }

  /* ---------- 맨 위 창: 판단하고 창을 보여 줌 ---------- */

  var running = true, active = false, mainTimer = null, ticksTop = 0;
  var remote = {}; // fid -> { state, t }
  var pending = null, pendingAt = 0, cooldownUntil = 0, pageStart = Date.now(), lastMediaSeen = 0;
  var note = '', noteUntil = 0, finds = {};
  var KIND = { media: '영상 끝', cue: '완료 문구', btn: '다음 버튼 풀림', idle: '대기 시간', manual: '직접' };

  function sendTop(msg) { msg.role = 'top'; broadcast(msg); }

  function somethingPlaying() {
    if (mediaState().playing) return true;
    var now = Date.now();
    return Object.keys(remote).some(function (k) { return now - remote[k].t < 3000 && remote[k].state.playing; });
  }

  signal = function (kind) {
    if (!running || pending || Date.now() < cooldownUntil) return;
    if (kind === 'cue' && !cfg.textCue) return;
    if (kind !== 'media' && kind !== 'manual' && somethingPlaying()) return;
    var secs = kind === 'manual' ? 0 : Math.max(1, +cfg.delay || 0);
    pendingAt = Date.now() + secs * 1000;
    pending = { kind: kind, timer: setTimeout(function () { pending = null; goNext(kind, 0); }, secs * 1000) };
    render();
  };
  function cancelPending() {
    if (pending) { clearTimeout(pending.timer); pending = null; setNote('이번 넘김은 취소했어요.'); }
  }

  function goNext(kind, tries) {
    if (kind !== 'manual' && somethingPlaying()) { setNote('아직 재생 중인 소리가 있어 기다려요.'); return; }
    var req = Math.random().toString(36).slice(2);
    finds[req] = [];
    var local = findNext();
    sendTop({ type: 'find', req: req });
    setTimeout(function () {
      var cands = finds[req]; delete finds[req];
      if (local) cands.unshift({ local: true, score: local.score, disabled: local.disabled });
      var open = cands.filter(function (c) { return !c.disabled; });
      var best = open.sort(function (a, b) { return b.score - a.score; })[0]; // 정렬은 안정적이라 동점이면 이 창이 먼저
      if (!best) {
        if (cands.length && tries < 5) { setNote('다음 버튼이 아직 잠겨 있어 기다려요…'); setTimeout(function () { goNext(kind, tries + 1); }, 2000); return; }
        cooldownUntil = Date.now() + 15000;
        setNote(cands.length ? '다음 버튼이 계속 잠겨 있어요.' : '다음 버튼을 못 찾았어요. ‘다음 버튼 지정’으로 알려 주세요.');
        return;
      }
      if (best.local) press(local.el); else sendTop({ type: 'click', target: best.fid });
      afterClick(kind);
    }, 500);
  }

  function afterClick(kind) {
    cooldownUntil = Date.now() + 5000;
    pageStart = Date.now(); lastMediaSeen = 0;
    resetWatch(); sendTop({ type: 'reset' });
    try { sessionStorage.setItem('autoNext:clicked', String(Date.now())); } catch (e) {}
    setNote('다음으로 넘겼어요 (' + KIND[kind] + ').');
    if (cfg.autoplay) scheduleAutoplay();
  }
  function scheduleAutoplay() {
    [2500, 5000].forEach(function (ms) {
      setTimeout(function () { scanMedia(); tryAutoplay(); sendTop({ type: 'autoplay' }); }, ms);
    });
  }
  function onBlocked() { setNote('브라우저가 자동 재생을 막았어요. 재생 버튼을 눌러 주세요.', 15000); }
  function onPicked() { stopPick(); sendTop({ type: 'unpick' }); setPickUi(false); setNote('다음 버튼을 기억했어요. 이 사이트에서는 이 버튼을 누를게요.'); }

  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.__an !== 1 || d.role === 'top' || !d.fid) return;
    if (d.type === 'seen') { offer(); return; }
    if (!active) return;
    if (d.type === 'state') remote[d.fid] = { state: d, t: Date.now() };
    else if (d.type === 'signal') signal(d.kind);
    else if (d.type === 'found' && finds[d.req]) finds[d.req].push({ fid: d.fid, score: d.score, disabled: d.disabled });
    else if (d.type === 'blocked') onBlocked();
    else if (d.type === 'picked') onPicked();
  });

  function tick() {
    var now = Date.now();
    Object.keys(remote).forEach(function (k) { if (now - remote[k].t > 5000) delete remote[k]; });
    if (ticksTop % 2 === 0) sendTop({ type: 'hello', cfg: cfg });
    scanMedia();
    if (++ticksTop % 2 === 0) { if (cfg.textCue) checkCue(); checkBtn(); }
    var any = mediaState().has || Object.keys(remote).some(function (k) { return remote[k].state.has; });
    if (any) lastMediaSeen = now;
    var idle = +cfg.idleWait || 0;
    if (idle > 0 && !lastMediaSeen && now - pageStart > idle * 1000) signal('idle');
    render();
  }

  /* ---------- 떠 있는 작은 창 ---------- */

  var panelHost = null, ui = {};
  function fmt(t) {
    if (!isFinite(t)) return '--:--';
    t = Math.max(0, Math.floor(t));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }
  function setNote(t, ms) { note = t; noteUntil = Date.now() + (ms || 8000); render(); }

  function buildPanel() {
    panelHost = document.createElement('div');
    panelHost.setAttribute('data-auto-next', '');
    var root = panelHost.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      ':host{all:initial}:host([hidden]){display:none}' +
      '.box{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:280px;max-width:calc(100vw - 32px);' +
      'background:#fff;color:#26304F;border:2px solid #D6E4F5;border-radius:16px;box-shadow:0 10px 30px rgba(38,48,79,.18);' +
      'font:13px/1.5 "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif;}' +
      '.head{display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:move;user-select:none}' +
      '.dot{width:10px;height:10px;border-radius:50%;background:#3FBF95;flex:none}.off .dot{background:#C3CAD9}' +
      '.title{font-weight:700;flex:1}' +
      'button{font:inherit;cursor:pointer;border:none;border-radius:10px;padding:7px 10px;background:#EEF6FF;color:#26304F}' +
      'button:hover{background:#E2F0FD}button.main{background:#3FBF95;color:#fff;font-weight:700}' +
      '.off button.main{background:#9AA3B8}.icon{padding:3px 8px;background:none;font-size:16px;line-height:1}' +
      '.body{padding:0 12px 12px}.mini .body{display:none}' +
      '.status{background:#F5F9FF;border-radius:10px;padding:8px 10px;min-height:20px}' +
      '.bar{height:6px;background:#E2E8F2;border-radius:3px;margin-top:6px;overflow:hidden}.bar i{display:block;height:100%;background:#4DA3EE;width:0}' +
      '.note{color:#5E6788;font-size:12px;margin-top:6px;min-height:0}' +
      '.row{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.row[hidden]{display:none}.row button{flex:1}' +
      'details{margin-top:8px}summary{cursor:pointer;color:#5E6788;font-size:12px}' +
      'label{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12px}' +
      'input[type=number]{width:52px;font:inherit;padding:3px 5px;border:1px solid #D6E4F5;border-radius:6px}' +
      '.picking{background:#FFE6EE !important}' +
      '</style>' +
      '<div class="box">' +
      '<div class="head"><span class="dot"></span><span class="title">연수 자동 넘김</span>' +
      '<button class="main" data-k="toggle">켜짐</button><button class="icon" data-k="mini" title="접기">–</button></div>' +
      '<div class="body">' +
      '<div class="status"><span data-k="status"></span><div class="bar"><i data-k="bar"></i></div></div>' +
      '<div class="note" data-k="note"></div>' +
      '<div class="row"><button data-k="now">지금 다음으로</button><button data-k="pick">다음 버튼 지정</button></div>' +
      '<div class="row" data-k="cancelrow" hidden><button data-k="cancel">이번 넘김 취소</button></div>' +
      '<details><summary>설정</summary>' +
      '<label>끝나고 <input type="number" min="1" max="60" data-k="delay"> 초 뒤에 넘기기</label>' +
      '<label>영상이 없는 페이지는 <input type="number" min="0" max="3600" data-k="idleWait"> 초 뒤 넘기기 (0 = 안 함)</label>' +
      '<label><input type="checkbox" data-k="textCue"> ‘학습 완료’ 문구가 뜨면 넘기기</label>' +
      '<label><input type="checkbox" data-k="autoplay"> 넘긴 뒤 영상 자동 재생 시도</label>' +
      '<div class="row"><button data-k="clearsel">지정한 다음 버튼 지우기</button></div>' +
      '</details></div></div>';
    root.querySelectorAll('[data-k]').forEach(function (el) { ui[el.getAttribute('data-k')] = el; });
    ui.box = root.querySelector('.box');

    ui.delay.value = cfg.delay; ui.idleWait.value = cfg.idleWait;
    ui.textCue.checked = cfg.textCue; ui.autoplay.checked = cfg.autoplay;
    ['delay', 'idleWait'].forEach(function (k) {
      ui[k].addEventListener('change', function () { cfg[k] = Math.max(+ui[k].min, Math.min(+ui[k].max, +ui[k].value || 0)); ui[k].value = cfg[k]; saveCfg(); });
    });
    ['textCue', 'autoplay'].forEach(function (k) {
      ui[k].addEventListener('change', function () { cfg[k] = ui[k].checked; saveCfg(); });
    });
    ui.toggle.addEventListener('click', function () {
      running = !running; if (!running) cancelPending();
      store.set('running', running); render();
    });
    ui.mini.addEventListener('click', function () { ui.box.classList.toggle('mini'); });
    ui.now.addEventListener('click', function () { cancelPending(); cooldownUntil = 0; goNext('manual', 0); });
    ui.cancel.addEventListener('click', cancelPending);
    ui.pick.addEventListener('click', function () {
      if (picking) { stopPick(); sendTop({ type: 'unpick' }); setPickUi(false); setNote('지정을 취소했어요.'); return; }
      startPick(); sendTop({ type: 'pick' }); setPickUi(true);
      setNote('이제 연수 화면의 ‘다음’ 버튼을 눌러 주세요. (취소: Esc 또는 이 버튼)', 60000);
    });
    ui.clearsel.addEventListener('click', function () {
      store.set(SEL_KEY, ''); sendTop({ type: 'clearsel' }); setNote('지정한 버튼을 지우고 자동으로 찾을게요.');
    });

    // 머리 부분을 끌어서 옮기기
    var drag = null;
    root.querySelector('.head').addEventListener('pointerdown', function (e) {
      if (e.target.tagName === 'BUTTON') return;
      var r = ui.box.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      e.target.setPointerCapture(e.pointerId);
    });
    root.querySelector('.head').addEventListener('pointermove', function (e) {
      if (!drag) return;
      ui.box.style.left = Math.max(0, Math.min(innerWidth - 60, e.clientX - drag.dx)) + 'px';
      ui.box.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - drag.dy)) + 'px';
      ui.box.style.right = 'auto'; ui.box.style.bottom = 'auto';
    });
    root.querySelector('.head').addEventListener('pointerup', function () { drag = null; });

    (document.body || document.documentElement).appendChild(panelHost);
  }
  function saveCfg() { store.set('cfg', cfg); sendTop({ type: 'hello', cfg: cfg }); }
  function setPickUi(on) { if (ui.pick) { ui.pick.textContent = on ? '지정 취소' : '다음 버튼 지정'; ui.pick.classList.toggle('picking', on); } }

  function render() {
    if (!panelHost) return;
    if (!panelHost.isConnected) (document.body || document.documentElement).appendChild(panelHost);
    var now = Date.now();
    ui.box.classList.toggle('off', !running);
    ui.toggle.textContent = running ? '켜짐' : '꺼짐';
    ui.cancelrow.hidden = !pending;

    var st = mediaState();
    if (!st.has || !st.playing) {
      Object.keys(remote).forEach(function (k) {
        var r = remote[k].state;
        if (r.has && (r.playing || !st.has)) st = r;
      });
    }
    var text, pct = 0;
    if (!running) text = '꺼져 있어요. 켜면 다시 지켜볼게요.';
    else if (pending) text = '완료 감지(' + KIND[pending.kind] + ') · ' + Math.max(0, Math.ceil((pendingAt - now) / 1000)) + '초 뒤 다음으로';
    else if (st.has && st.playing) text = '듣는 중 ' + fmt(st.cur) + ' / ' + fmt(st.dur);
    else if (st.has) text = '일시 정지 ' + fmt(st.cur) + ' / ' + fmt(st.dur);
    else if (now - pageStart > 8000 && !HAS_GM && crossOriginFrameCount()) text = '영상을 못 찾았어요. 다른 사이트의 플레이어라면 유저스크립트 방식을 써 주세요.';
    else text = '영상이 끝나길 기다리는 중…';
    if (st.has && st.dur > 0 && isFinite(st.dur)) pct = Math.min(100, st.cur / st.dur * 100);
    ui.status.textContent = text;
    ui.bar.style.width = pct + '%';
    ui.note.textContent = now < noteUntil ? note : '';
  }

  /* ---------- 켜고 끄기 ---------- */

  function start() {
    if (active) return;
    active = true;
    running = store.get('running', true);
    buildPanel();
    tick();
    mainTimer = setInterval(tick, 1000);
    try {
      var t = +sessionStorage.getItem('autoNext:clicked');
      if (cfg.autoplay && Date.now() - t < 15000) scheduleAutoplay(); // 페이지가 새로 열린 직후
    } catch (e) {}
  }
  function stop() {
    if (!active) return;
    active = false;
    cancelPending(); stopPick();
    clearInterval(mainTimer);
    if (panelHost) panelHost.remove();
    panelHost = null; ui = {};
  }

  window.__autoNext = { togglePanel: function () { if (panelHost) panelHost.hidden = !panelHost.hidden; } };

  if (!HAS_GM) { start(); return; }

  // 유저스크립트: 켠 사이트에서만 동작. 꺼진 사이트에서 영상이 재생되면 켤지 한 번 물어봄
  function setHost(key, on) {
    var list = store.get(key, []), i = list.indexOf(location.host);
    if (on && i < 0) list.push(location.host);
    if (!on && i >= 0) list.splice(i, 1);
    store.set(key, list);
  }
  function enableHere() { setHost('hosts', true); setHost('never', false); removeOffer(); start(); }

  var offerHost = null;
  function removeOffer() { if (offerHost) { offerHost.remove(); offerHost = null; } }
  function offer() {
    if (active || offerHost || store.get('never', []).indexOf(location.host) >= 0) return;
    offerHost = document.createElement('div');
    offerHost.setAttribute('data-auto-next', '');
    var root = offerHost.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>:host{all:initial}' +
      '.pill{position:fixed;right:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:8px;flex-wrap:wrap;' +
      'max-width:calc(100vw - 32px);padding:10px 12px;background:#fff;color:#26304F;border:2px solid #D6E4F5;border-radius:16px;' +
      'box-shadow:0 10px 30px rgba(38,48,79,.18);font:13px/1.5 "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif}' +
      'button{font:inherit;cursor:pointer;border:none;border-radius:10px;padding:6px 10px;background:#EEF6FF;color:#26304F}' +
      'button.yes{background:#3FBF95;color:#fff;font-weight:700}</style>' +
      '<div class="pill"><span>연수 자동 넘김을 이 사이트에서 켤까요?</span>' +
      '<button class="yes">켜기</button><button class="no">이 사이트는 안 함</button></div>';
    root.querySelector('.yes').addEventListener('click', enableHere);
    root.querySelector('.no').addEventListener('click', function () { setHost('never', true); removeOffer(); });
    (document.body || document.documentElement).appendChild(offerHost);
  }

  if (store.get('hosts', []).indexOf(location.host) >= 0) start();
  else {
    document.addEventListener('play', offer, true);
    if (anyMediaPlaying()) offer();
  }
  GM_registerMenuCommand('이 사이트에서 켜기 / 끄기 (' + location.host + ')', function () {
    if (active) { setHost('hosts', false); stop(); } else enableHere();
  });
})();
