/* 복불복 오락실 · 방송 모드 (SOOP 별풍선 수동 입력판)
   게임 페이지는 window.PL_GAME 을 정의한다:
   { id, screen:Element, tiers:[{id,n,label,target?}], participants():[name], run(id,{donor,target,mult}) -> true|'later'|string(err),
     join?(names)->n, predict?:true }
   게임이 결과를 알릴 때: window.PL_LIVE && PL_LIVE.result(name)
*/
(function () {
  const G = window.PL_GAME; if (!G) return;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const K = k => 'pl.' + G.id + '.' + k;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const tierCfg = load(K('tiers'), {});
  const tiers = () => G.tiers.map(t => Object.assign({}, t, {n: +tierCfg[t.id] || t.n})).sort((a, b) => a.n - b.n);
  let S = Object.assign({on: false, goal: 300, goalText: '노래 한 곡 부르기', total: 0, battle: false, ta: '매운맛', tb: '순한맛', a: 0, b: 0, feverSec: 30, board: true, log: []}, load(K('s'), {}));
  let HALL = load('pl.hall', {donors: {}, prophets: {}, joins: {}});
  let preds = {}; // name -> choice
  let queue = [], feverUntil = 0, ctx = null;
  const save = () => { store(K('s'), S); store('pl.hall', HALL); };

  /* ---------- 스타일 ---------- */
  const fl = document.createElement('link'); fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Noto+Sans+KR:wght@500;700;900&display=swap';
  document.head.appendChild(fl);
  const css = document.createElement('style');
  css.textContent = `
.pl-ov{position:absolute;inset:0;pointer-events:none;z-index:30;font-family:'Noto Sans KR',sans-serif;color:#fff}
.pl-ov[hidden],.pl-dock [hidden]{display:none!important}
.pl-top{position:absolute;left:10px;right:10px;top:10px;display:flex;flex-direction:column;gap:6px}
.pl-bar{position:relative;height:26px;border-radius:999px;background:rgba(10,6,22,.72);border:2px solid rgba(255,255,255,.18);overflow:hidden;backdrop-filter:blur(4px)}
.pl-bar i{position:absolute;inset:0 auto 0 0;background:linear-gradient(90deg,#ff5fa2,#ffd400);transition:width .6s cubic-bezier(.2,1.4,.4,1)}
.pl-bar b{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-size:12.5px;font-weight:900;text-shadow:0 1px 2px #000;white-space:nowrap;gap:8px}
.pl-bar b span:first-child{overflow:hidden;text-overflow:ellipsis}
.pl-bar.done i{background:linear-gradient(90deg,#3dffc5,#5df2ff);animation:plglow 1s infinite alternate}
@keyframes plglow{to{filter:brightness(1.4)}}
.pl-tug{display:flex;height:30px;border-radius:999px;overflow:hidden;border:2px solid rgba(255,255,255,.2);background:#111;font-weight:900;font-size:13px;text-shadow:0 1px 2px #000}
.pl-tug div{display:flex;align-items:center;padding:0 12px;white-space:nowrap;transition:flex-grow .6s cubic-bezier(.2,1.4,.4,1);min-width:0;overflow:hidden}
.pl-tug .a{background:linear-gradient(90deg,#ff3b30,#ff7a1a);justify-content:flex-start}
.pl-tug .b{background:linear-gradient(90deg,#3a8bff,#5df2ff);justify-content:flex-end}
.pl-menu{position:absolute;right:10px;top:var(--pl-mtop,48px);width:min(42%,184px);padding:9px 10px 8px;border-radius:14px;background:rgba(10,6,22,.78);border:2px solid #ffd400;box-shadow:0 0 0 3px rgba(255,212,0,.15);backdrop-filter:blur(4px)}
.pl-menu h4{margin:0 0 6px;font:400 15px 'Black Han Sans',sans-serif;color:#ffd400;letter-spacing:.3px;display:flex;align-items:center;gap:6px}
.pl-menu h4:before{content:'';width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6a8,#ffb300 60%,#c77700);box-shadow:0 0 6px #ffd400}
.pl-menu ul{list-style:none;margin:0;padding:0;display:grid;gap:3px}
.pl-menu li{display:flex;gap:7px;align-items:baseline;font-size:12px;font-weight:700;line-height:1.3}
.pl-menu li em{font-style:normal;font-weight:900;color:#ffd400;min-width:34px;text-align:right;font-variant-numeric:tabular-nums}
.pl-menu .fv{margin-top:6px;font-size:11px;color:#ff9ad5;font-weight:900}
.pl-fever{position:absolute;left:50%;top:var(--pl-ftop,48px);transform:translateX(-50%);padding:5px 16px;border-radius:999px;font:400 18px 'Black Han Sans',sans-serif;background:linear-gradient(90deg,#ff2d95,#ff7a1a,#ffd400,#ff2d95);background-size:300% 100%;animation:plfv 1.2s linear infinite,plpulse .5s ease-in-out infinite alternate;box-shadow:0 0 18px #ff2d95;white-space:nowrap;text-shadow:0 2px 0 #7a0037}
@keyframes plfv{to{background-position:300% 0}}@keyframes plpulse{to{transform:translateX(-50%) scale(1.08)}}
.pl-alert{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%) scale(.6);opacity:0;min-width:64%;max-width:92%;padding:14px 18px 15px;border-radius:20px;text-align:center;background:linear-gradient(180deg,rgba(32,16,60,.94),rgba(12,6,26,.94));border:3px solid #ffd400;box-shadow:0 0 0 4px rgba(255,212,0,.2),0 0 40px rgba(255,180,0,.5)}
.pl-alert.show{animation:plal 3.4s cubic-bezier(.2,1.5,.4,1) forwards}
.pl-alert .who{font-size:15px;font-weight:900;color:#fff}
.pl-alert .who b{color:#ffd400}
.pl-alert .cnt{font:400 clamp(30px,8vw,52px)/1 'Black Han Sans',sans-serif;color:#ffd400;margin:6px 0;text-shadow:0 3px 0 #8a4b00,0 0 20px rgba(255,212,0,.6)}
.pl-alert .eff{display:inline-block;margin-top:2px;padding:5px 14px;border-radius:999px;background:#ff2d95;font:400 18px 'Black Han Sans',sans-serif}
.pl-alert .eff.wait{background:#5a4b8a}
.pl-alert .x2{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:8px;background:#ffd400;color:#2a0a3a;font-size:13px;font-weight:900;vertical-align:middle}
@keyframes plal{0%{opacity:0;transform:translate(-50%,-50%) scale(.5) rotate(-4deg)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.06) rotate(1deg)}20%{transform:translate(-50%,-50%) scale(1) rotate(0)}85%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-62%) scale(.96)}}
.pl-coins{position:absolute;inset:0;overflow:hidden}
.pl-coin{position:absolute;top:-30px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6a8,#ffc400 55%,#b86e00);box-shadow:0 0 8px rgba(255,212,0,.8);animation:plcoin linear forwards}
@keyframes plcoin{to{transform:translateY(120vh) rotate(720deg)}}
.pl-pred{position:absolute;left:10px;bottom:10px;width:min(56%,250px);padding:9px 11px;border-radius:14px;background:rgba(10,6,22,.8);border:2px solid #5df2ff;backdrop-filter:blur(4px)}
.pl-pred h4{margin:0 0 6px;font:400 15px 'Black Han Sans',sans-serif;color:#5df2ff}
.pl-pred .r{display:grid;grid-template-columns:64px 1fr 40px;gap:6px;align-items:center;font-size:12px;font-weight:900;margin:3px 0}
.pl-pred .r span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pl-pred .r i{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,#5df2ff,#b388ff);transition:width .5s}
.pl-pred .r em{font-style:normal;text-align:right;color:#cfe}
.pl-pred .hit{margin-top:6px;font-size:12px;font-weight:700;color:#ffd400;line-height:1.4}
.pl-rank{position:absolute;left:10px;bottom:10px;max-width:60%;padding:6px 11px;border-radius:999px;background:rgba(10,6,22,.72);font-size:12px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border:1px solid rgba(255,255,255,.18)}
.pl-rank b{color:#ffd400}

.pl-toggle{position:fixed;left:12px;bottom:12px;z-index:10000;display:flex;align-items:center;gap:8px;padding:9px 15px;border-radius:999px;border:0;cursor:pointer;font:900 13px 'Noto Sans KR',sans-serif;color:#fff;background:#2a1d48;box-shadow:0 4px 0 #120a22,0 0 0 2px rgba(255,255,255,.12)}
.pl-toggle:before{content:'';width:9px;height:9px;border-radius:50%;background:#777}
.pl-toggle.on{background:#e3123b}.pl-toggle.on:before{background:#fff;animation:plblink 1s infinite}
@keyframes plblink{50%{opacity:.25}}
body.pl-docked{padding-right:340px!important;box-sizing:border-box}
body.pl-docked a[href="./"]{right:352px!important}
body.pl-docked.pl-mini{padding-right:0!important}body.pl-docked.pl-mini a[href="./"]{right:12px!important}
.pl-dock{position:fixed;right:0;top:0;bottom:0;z-index:10000;width:340px;max-width:100vw;display:flex;flex-direction:column;background:#160f2a;border-left:2px solid #3b2d63;box-shadow:-10px 0 40px rgba(0,0,0,.45);font-family:'Noto Sans KR',sans-serif;color:#fff;overflow:hidden}
.pl-dock header{display:flex;align-items:center;gap:8px;padding:12px 14px;background:#21173d;user-select:none}
body.pl-mini .pl-dock{top:auto;bottom:60px;right:12px;width:auto;border:2px solid #3b2d63;border-radius:14px}
.pl-dock header b{font:400 17px 'Black Han Sans',sans-serif;color:#ffd400;flex:1}
.pl-dock header button{border:0;background:none;color:#b9b0d6;font-size:18px;cursor:pointer;padding:0 4px}
.pl-tabs{display:flex;gap:4px;padding:8px 10px 0}
.pl-tabs button{flex:1;padding:7px 0;border:0;border-radius:10px 10px 0 0;background:#21173d;color:#b9b0d6;font:900 12.5px 'Noto Sans KR',sans-serif;cursor:pointer}
.pl-tabs button[aria-selected=true]{background:#2c2050;color:#fff}
.pl-body{padding:12px;background:#2c2050;overflow:auto;display:grid;gap:10px;align-content:start;flex:1}
.pl-body label{display:block;font-size:12px;font-weight:900;color:#b9b0d6;margin-bottom:4px}
.pl-body input,.pl-body select,.pl-body textarea{width:100%;box-sizing:border-box;padding:9px 10px;border-radius:10px;border:2px solid #44356f;background:#120b22;color:#fff;font:700 14px 'Noto Sans KR',sans-serif;outline:none}
.pl-body input:focus,.pl-body textarea:focus,.pl-body select:focus{border-color:#ffd400}
.pl-body textarea{min-height:90px;resize:vertical;font-size:12.5px}
.pl-row{display:flex;gap:8px}.pl-row>*{flex:1;min-width:0}
.pl-btn{padding:10px 12px;border:0;border-radius:12px;font:900 14px 'Noto Sans KR',sans-serif;cursor:pointer;background:#ffd400;color:#1a1410;box-shadow:0 3px 0 #a88a00}
.pl-btn.g{background:#3b2d63;color:#fff;box-shadow:0 3px 0 #1d1435}
.pl-btn.p{background:#ff2d95;color:#fff;box-shadow:0 3px 0 #8a0048}
.pl-btn:active{transform:translateY(2px);box-shadow:none}
.pl-quick{display:flex;flex-wrap:wrap;gap:5px}
.pl-quick button{flex:1 0 auto;padding:6px 8px;border-radius:9px;border:2px solid #44356f;background:#1b1233;color:#ffd400;font:900 12px 'Noto Sans KR',sans-serif;cursor:pointer}
.pl-team{display:flex;gap:6px}.pl-team button{flex:1;padding:8px;border-radius:10px;border:2px solid #44356f;background:#1b1233;color:#fff;font:900 13px 'Noto Sans KR',sans-serif;cursor:pointer}
.pl-team button[aria-pressed=true].a{background:#ff3b30;border-color:#ff3b30}.pl-team button[aria-pressed=true].b{background:#3a8bff;border-color:#3a8bff}
.pl-note{font-size:11.5px;color:#9c92c2;line-height:1.5;margin:0}
.pl-log{list-style:none;margin:0;padding:0;font-size:12px;display:grid;gap:3px;max-height:120px;overflow:auto}
.pl-log li{display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-radius:8px;background:#1b1233}
.pl-log li em{font-style:normal;color:#ffd400;font-weight:900;white-space:nowrap}
.pl-lb{display:grid;gap:4px;font-size:13px}
.pl-lb div{display:flex;justify-content:space-between;padding:6px 10px;border-radius:9px;background:#1b1233;font-weight:700}
.pl-lb div b{color:#ffd400}
.pl-sw{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:900}
.pl-sw input{width:auto}
.pl-tiers{display:grid;gap:5px}
.pl-tiers div{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:center;font-size:12.5px;font-weight:700}
.pl-tiers input{padding:6px 8px}
.pl-h{font:400 15px 'Black Han Sans',sans-serif;color:#fff;margin:2px 0 -2px}
`;
  document.head.appendChild(css);

  /* ---------- 화면 오버레이 (방송에 잡히는 부분) ---------- */
  const scr = G.screen;
  if (getComputedStyle(scr).position === 'static') scr.style.position = 'relative';
  const ov = document.createElement('div'); ov.className = 'pl-ov'; ov.hidden = true;
  ov.innerHTML = `<div class="pl-coins"></div><div class="pl-top"><div class="pl-bar" id="plGoal"><i></i><b><span></span><span></span></b></div><div class="pl-tug" id="plTug"><div class="a"></div><div class="b"></div></div></div>
<div class="pl-menu" id="plMenu"></div><div class="pl-fever" id="plFever" hidden></div><div class="pl-pred" id="plPred" hidden></div><div class="pl-rank" id="plRank" hidden></div><div class="pl-alert" id="plAlert"></div>`;
  scr.appendChild(ov);

  /* ---------- 스트리머 조작판 ---------- */
  const tg = document.createElement('button'); tg.className = 'pl-toggle'; tg.type = 'button'; tg.textContent = '방송 모드';
  document.body.appendChild(tg);
  const otherLink = [...document.querySelectorAll('a[href="./"]')].pop(); // 게임 목록 링크는 그대로 오른쪽 아래
  const dock = document.createElement('div'); dock.className = 'pl-dock'; dock.hidden = true;
  const TABS = [['don', '별풍선'], ['chat', G.predict ? '채팅 예측' : '채팅 참가'], ['goal', '목표·배틀'], ['rank', '랭킹'], ['set', '설정']];
  dock.innerHTML = `<header><b>방송 모드 조작판</b><button type="button" data-k="min" title="접기 (F4)">–</button></header>
<div class="pl-tabs">${TABS.map(([k, n], i) => `<button type="button" data-tab="${k}" aria-selected="${i === 0}">${n}</button>`).join('')}</div>
<div class="pl-body" data-p="don">
 <div class="pl-row"><div style="flex:1.4"><label for="plNick">후원자 닉네임</label><input id="plNick" autocomplete="off" placeholder="예: 썩은물"></div>
 <div><label for="plCnt">별풍선 개수</label><input id="plCnt" type="number" min="1" inputmode="numeric" placeholder="10"></div></div>
 <div class="pl-quick" id="plQuick"></div>
 <div id="plTgtWrap"><label for="plTgt">지목할 대상</label><select id="plTgt"></select></div>
 <div id="plTeamWrap"><label>어느 팀에 넣을까</label><div class="pl-team"><button type="button" class="a" data-t="a" aria-pressed="true"></button><button type="button" class="b" data-t="b" aria-pressed="false"></button></div></div>
 <button class="pl-btn" id="plGo" type="button">후원 띄우기 (Enter)</button>
 <div class="pl-row"><button class="pl-btn p" id="plFv" type="button">피버타임 시작 (F2)</button></div>
 <ul class="pl-log" id="plLog"></ul>
 <p class="pl-note">SOOP 후원 알림을 보고 닉네임과 개수를 넣으면, 금액에 맞는 효과가 게임에 바로 들어가요. 피버타임 동안은 모든 후원이 2배로 계산돼요.</p>
</div>
<div class="pl-body" data-p="chat" hidden>
 <label for="plPaste">${G.predict ? '채팅 붙여넣기 — "!예측 이름" 또는 "!번호"' : '채팅 붙여넣기 — "!참가" 친 사람만 뽑아요'}</label>
 <textarea id="plPaste" placeholder="${G.predict ? '썩은물 : !예측 조경훈\n하이요맨 : !3\n…' : '썩은물 : !참가\n하이요맨 : !참가\n…'}"></textarea>
 <div class="pl-row"><button class="pl-btn" id="plParse" type="button">${G.predict ? '예측 집계' : '참가자로 넣기'}</button><button class="pl-btn g" id="plClearP" type="button">${G.predict ? '예측 초기화' : '비우기'}</button></div>
 <p class="pl-note" id="plChatNote">${G.predict ? '방송 채팅을 드래그해서 복사한 뒤 붙여넣으면 닉네임별로 예측을 모아요. 같은 사람이 여러 번 치면 마지막 것만 세요. 결과가 나오면 적중자를 화면에 띄우고 예언자 랭킹에 올려요.' : '방송 채팅을 드래그해서 복사한 뒤 붙여넣으세요. "!참가"가 들어간 줄의 닉네임만 중복 없이 참가자 목록에 들어가요.'}</p>
</div>
<div class="pl-body" data-p="goal" hidden>
 <p class="pl-h">목표 게이지</p>
 <div class="pl-row"><div><label for="plGoalN">목표 개수</label><input id="plGoalN" type="number" min="1"></div><div style="flex:1.6"><label for="plGoalT">달성하면</label><input id="plGoalT"></div></div>
 <div class="pl-row"><button class="pl-btn g" id="plGoalReset" type="button">게이지 0으로</button></div>
 <p class="pl-h">팀 배틀</p>
 <label class="pl-sw"><input type="checkbox" id="plBattle"> 팀 배틀 켜기</label>
 <div class="pl-row"><div><label for="plTA">빨강 팀</label><input id="plTA"></div><div><label for="plTB">파랑 팀</label><input id="plTB"></div></div>
 <div class="pl-row"><button class="pl-btn" id="plBattleEnd" type="button">배틀 결과 발표</button><button class="pl-btn g" id="plBattleReset" type="button">배틀 초기화</button></div>
 <p class="pl-note">예: "다음 판 벌칙 — 매운맛 vs 순한맛". 후원할 때 팀을 고르면 그쪽 게이지가 올라가요.</p>
</div>
<div class="pl-body" data-p="rank" hidden>
 <p class="pl-h">큰손 명예의 전당</p><div class="pl-lb" id="plLbD"></div>
 <p class="pl-h">${G.predict ? '예언자 랭킹' : '참가왕'}</p><div class="pl-lb" id="plLbP"></div>
 <div class="pl-row"><button class="pl-btn g" id="plShowRank" type="button">화면에 TOP3 띄우기</button><button class="pl-btn g" id="plHallReset" type="button">랭킹 초기화</button></div>
</div>
<div class="pl-body" data-p="set" hidden>
 <p class="pl-h">별풍선 메뉴판 (개수 바꾸기)</p>
 <div class="pl-tiers" id="plTiers"></div>
 <label class="pl-sw"><input type="checkbox" id="plBoard"> 화면에 메뉴판 보이기</label>
 <div class="pl-row"><div><label for="plFvSec">피버타임 길이(초)</label><input id="plFvSec" type="number" min="5" max="300"></div></div>
 <p class="pl-note">단축키 · Enter 후원 띄우기 · F2 피버타임 · F4 조작판 접기/펼치기<br>방송 화면에는 게임 판만 잡히도록 창 캡처 영역을 잘라 쓰세요. 이 조작판은 판 밖에 두면 시청자에게 안 보여요.</p>
</div>`;
  document.body.appendChild(dock);

  let mini = false;
  function setMini(v) { mini = v; document.body.classList.toggle('pl-mini', mini); $('[data-k=min]', dock).textContent = mini ? '+' : '–'; dock.querySelectorAll('.pl-tabs,.pl-body').forEach(el => el.style.display = mini ? 'none' : ''); if (!mini) showTab(curTab); setTimeout(() => dispatchEvent(new Event('resize')), 30); }
  $('[data-k=min]', dock).onclick = () => setMini(!mini);
  let curTab = 'don';
  function showTab(k) { curTab = k; dock.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k)); dock.querySelectorAll('[data-p]').forEach(p => p.hidden = p.dataset.p !== k); if (k === 'rank') renderLB(); }
  dock.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => showTab(b.dataset.tab));

  /* ---------- 소리 ---------- */
  function chime(big) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = big ? [784, 988, 1175, 1568, 1976] : [988, 1319, 1568];
      notes.forEach((f, i) => { const t = ctx.currentTime + i * .08, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = f; g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.0005, t + .35); o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + .4); });
    } catch (e) {}
  }

  /* ---------- 렌더 ---------- */
  const fever = () => performance.now() < feverUntil;
  function renderMenu() {
    const m = $('#plMenu', ov); m.hidden = !S.board;
    m.innerHTML = `<h4>별풍선 메뉴판</h4><ul>${tiers().map(t => `<li><em>${t.n}개</em><span>${esc(t.label)}${t.target ? ' <small style="color:#9ad">지목</small>' : ''}</span></li>`).join('')}</ul><div class="fv">${fever() ? '지금 피버타임! 전부 2배' : '피버타임엔 효과 2배'}</div>`;
    $('#plQuick', dock).innerHTML = tiers().map(t => `<button type="button" data-n="${t.n}">${t.n} · ${esc(t.label)}</button>`).join('');
    $('#plQuick', dock).querySelectorAll('button').forEach(b => b.onclick = () => { $('#plCnt', dock).value = b.dataset.n; syncTgt(); $('#plNick', dock).focus(); });
    $('#plTiers', dock).innerHTML = G.tiers.map(t => `<div><input type="number" min="1" data-id="${t.id}" value="${+tierCfg[t.id] || t.n}"><span>${esc(t.label)}</span></div>`).join('');
    $('#plTiers', dock).querySelectorAll('input').forEach(i => i.onchange = () => { tierCfg[i.dataset.id] = Math.max(1, +i.value || 1); store(K('tiers'), tierCfg); renderMenu(); });
  }
  function renderBars() {
    const g = $('#plGoal', ov), p = Math.min(1, S.total / Math.max(1, S.goal));
    g.querySelector('i').style.width = (p * 100) + '%';
    g.classList.toggle('done', p >= 1);
    const sp = g.querySelectorAll('span'); sp[0].textContent = (p >= 1 ? '목표 달성! ' : '목표: ') + S.goalText; sp[1].textContent = `${S.total.toLocaleString('ko-KR')} / ${S.goal.toLocaleString('ko-KR')}개`;
    const t = $('#plTug', ov); t.hidden = !S.battle;
    const tot = S.a + S.b, ra = tot ? S.a / tot : .5;
    t.children[0].style.flexGrow = Math.max(.12, ra); t.children[1].style.flexGrow = Math.max(.12, 1 - ra);
    t.children[0].textContent = `${S.ta} ${S.a}`; t.children[1].textContent = `${S.b} ${S.tb}`;
    const tops = (S.battle ? 84 : 48);
    ov.style.setProperty('--pl-mtop', tops + 'px'); ov.style.setProperty('--pl-ftop', tops + 'px');
    $('#plTeamWrap', dock).hidden = !S.battle;
    const tb = $('#plTeamWrap', dock).querySelectorAll('button'); tb[0].textContent = S.ta; tb[1].textContent = S.tb;
  }
  function renderLog() {
    $('#plLog', dock).innerHTML = S.log.slice(0, 8).map(l => `<li><span>${esc(l.d)}</span><em>${l.n}개${l.x ? ' ×2' : ''}</em></li>`).join('') || '<li><span>아직 후원 없음</span></li>';
  }
  function topList(obj, n) { return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n); }
  function renderLB() {
    const d = topList(HALL.donors, 10), p = topList(G.predict ? HALL.prophets : HALL.joins, 10);
    $('#plLbD', dock).innerHTML = d.map(([k, v], i) => `<div><span>${i + 1}. ${esc(k)}</span><b>${v.toLocaleString('ko-KR')}개</b></div>`).join('') || '<div><span>아직 없음</span></div>';
    $('#plLbP', dock).innerHTML = p.map(([k, v], i) => `<div><span>${i + 1}. ${esc(k)}</span><b>${v}${G.predict ? '회 적중' : '회'}</b></div>`).join('') || '<div><span>아직 없음</span></div>';
  }
  function syncTgt() {
    const n = +$('#plCnt', dock).value || 0, t = pickTier(n * (fever() ? 2 : 1));
    const w = $('#plTgtWrap', dock), sel = $('#plTgt', dock);
    w.hidden = !(t && t.target);
    if (t && t.target) { const cur = sel.value; sel.innerHTML = G.participants().map(x => `<option>${esc(x)}</option>`).join(''); if ([...sel.options].some(o => o.value === cur)) sel.value = cur; }
  }
  function pickTier(n) { let r = null; for (const t of tiers()) if (n >= t.n) r = t; return r; }

  let alertT = 0;
  function showAlert(d, n, x2, t, tgt, wait) {
    const a = $('#plAlert', ov);
    a.innerHTML = `<div class="who"><b>${esc(d)}</b>님</div><div class="cnt">별풍선 ${n.toLocaleString('ko-KR')}개${x2 ? '<span class="x2">피버 ×2</span>' : ''}</div>${t ? `<div class="eff${wait ? ' wait' : ''}">${esc(t.label)}${tgt ? ' → ' + esc(tgt) : ''}${wait ? ' · 시작하면 발동' : ''}</div>` : '<div class="eff wait">응원 감사합니다!</div>'}`;
    a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
    clearTimeout(alertT); alertT = setTimeout(() => a.classList.remove('show'), 3500);
    const box = $('.pl-coins', ov), k = Math.min(40, 6 + Math.round(Math.sqrt(n) * 2));
    for (let i = 0; i < k; i++) { const c = document.createElement('i'); c.className = 'pl-coin'; c.style.left = Math.random() * 100 + '%'; c.style.animationDuration = (1.4 + Math.random() * 1.4) + 's'; c.style.animationDelay = (Math.random() * .6) + 's'; box.appendChild(c); setTimeout(() => c.remove(), 3600); }
  }

  /* ---------- 후원 처리 ---------- */
  let team = 'a';
  $('#plTeamWrap', dock).querySelectorAll('button').forEach(b => b.onclick = () => { team = b.dataset.t; $('#plTeamWrap', dock).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  function donate() {
    const d = $('#plNick', dock).value.trim() || '익명', n = Math.floor(+$('#plCnt', dock).value || 0);
    if (n < 1) { $('#plCnt', dock).focus(); return; }
    const x2 = fever(), eff = n * (x2 ? 2 : 1), t = pickTier(eff), tgt = t && t.target ? $('#plTgt', dock).value : '';
    let wait = false;
    if (t) {
      const r = G.run(t.id, {donor: d, target: tgt, mult: x2 ? 2 : 1});
      if (r === 'later') { wait = true; queue.push({id: t.id, donor: d, target: tgt, mult: x2 ? 2 : 1}); }
    }
    S.total += eff; if (S.battle) S[team] += eff;
    HALL.donors[d] = (HALL.donors[d] || 0) + n;
    S.log.unshift({d, n, x: x2}); S.log = S.log.slice(0, 50);
    const reached = S.total >= S.goal && S.total - eff < S.goal;
    showAlert(d, n, x2, t, tgt, wait); chime(n >= 50);
    if (reached) setTimeout(() => { bigBanner('목표 달성!', S.goalText); chime(true); }, 2400);
    save(); renderBars(); renderLog(); renderRankStrip();
    $('#plNick', dock).value = ''; $('#plCnt', dock).value = ''; syncTgt(); $('#plNick', dock).focus();
  }
  function bigBanner(top, sub) {
    const a = $('#plAlert', ov);
    a.innerHTML = `<div class="who">${esc(top)}</div><div class="cnt" style="font-size:clamp(24px,6vw,40px)">${esc(sub)}</div>`;
    a.classList.remove('show'); void a.offsetWidth; a.classList.add('show');
    const box = $('.pl-coins', ov); for (let i = 0; i < 40; i++) { const c = document.createElement('i'); c.className = 'pl-coin'; c.style.left = Math.random() * 100 + '%'; c.style.animationDuration = (1.4 + Math.random() * 1.6) + 's'; c.style.animationDelay = (Math.random() * .8) + 's'; box.appendChild(c); setTimeout(() => c.remove(), 3800); }
  }
  setInterval(() => {
    if (queue.length) { const q = queue[0]; const r = G.run(q.id, q); if (r !== 'later') queue.shift(); }
    const f = $('#plFever', ov), on = fever();
    f.hidden = !on || !S.on;
    if (on) f.textContent = `피버타임 ×2 · ${Math.ceil((feverUntil - performance.now()) / 1000)}초`;
    if (on !== renderMenu._fv) { renderMenu._fv = on; renderMenu(); }
    const res = !!(G.resultShowing && G.resultShowing()); $('#plMenu', ov).style.opacity = res ? 0 : 1; $('#plMenu', ov).style.transition = 'opacity .3s';
  }, 250);
  function startFever() { feverUntil = performance.now() + S.feverSec * 1000; chime(true); bigBanner('피버타임 시작!', `${S.feverSec}초 동안 후원 2배`); renderMenu(); }

  /* ---------- 채팅 파서 ---------- */
  function parseLines(txt) {
    const out = [];
    for (let line of txt.split(/\n/)) {
      line = line.replace(/^\s*\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/, '').trim(); if (!line) continue;
      let nick = '', msg = line;
      const m = line.match(/^(.{1,30}?)\s*[:：]\s*(.*)$/);
      if (m) { nick = m[1]; msg = m[2]; }
      else { const k = line.indexOf('!'); if (k > 0) { nick = line.slice(0, k); msg = line.slice(k); } }
      nick = nick.replace(/\([^)]*\)\s*$/, '').replace(/^[\s@]+|\s+$/g, '').replace(/^(매니저|팬|열혈|구독|BJ|스트리머)\s+/, '');
      if (nick) out.push({nick, msg: msg.trim()});
    }
    return out;
  }
  $('#plParse', dock).onclick = () => {
    const rows = parseLines($('#plPaste', dock).value), note = $('#plChatNote', dock);
    if (G.predict) {
      const ps = G.participants(); let n = 0;
      for (const r of rows) {
        const mm = r.msg.match(/^!\s*(?:예측|ㅇㅊ)?\s*(.+)$/); if (!mm) continue;
        let v = mm[1].trim(); const num = parseInt(v, 10);
        let pick = (!isNaN(num) && String(num) === v && ps[num - 1]) ? ps[num - 1] : ps.find(p => p === v) || ps.find(p => v && (p.includes(v) || v.includes(p)));
        if (pick) { preds[r.nick] = pick; n++; }
      }
      note.textContent = `예측 ${n}건 반영 · 총 ${Object.keys(preds).length}명`;
      renderPred(); $('#plPaste', dock).value = '';
    } else {
      const names = [...new Set(rows.filter(r => /!\s*참가/.test(r.msg)).map(r => r.nick))];
      if (!names.length) { note.textContent = '"!참가"가 들어간 줄을 못 찾았어요. 닉네임 : 메시지 형식으로 붙여넣어 주세요.'; return; }
      const k = G.join ? G.join(names) : 0;
      names.forEach(x => HALL.joins[x] = (HALL.joins[x] || 0) + 1); save();
      note.textContent = `${names.length}명 확인 · ${k}명 새로 참가 (${names.slice(0, 6).join(', ')}${names.length > 6 ? ' …' : ''})`;
      bigBanner('채팅 참가 완료', `${names.length}명 입장!`); $('#plPaste', dock).value = '';
    }
  };
  $('#plClearP', dock).onclick = () => { $('#plPaste', dock).value = ''; if (G.predict) { preds = {}; renderPred(); $('#plChatNote', dock).textContent = '예측을 비웠어요.'; } };
  let predResult = null;
  function renderPred() {
    const box = $('#plPred', ov); if (!G.predict) return;
    const ps = G.participants(), tot = Object.keys(preds).length;
    box.hidden = !S.on || (!tot && !predResult);
    if (box.hidden) return;
    const cnt = {}; Object.values(preds).forEach(v => cnt[v] = (cnt[v] || 0) + 1);
    box.innerHTML = `<h4>시청자 예측 · ${tot}명</h4>` + ps.map(p => { const c = cnt[p] || 0, pc = tot ? Math.round(c / tot * 100) : 0; return `<div class="r"><span>${esc(p)}</span><i style="width:${pc}%"></i><em>${pc}%</em></div>`; }).join('') +
      (predResult ? `<div class="hit">${predResult}</div>` : '');
  }
  function renderRankStrip() {
    const el = $('#plRank', ov); const top = topList(sessionDonors(), 3);
    el.hidden = !S.on || !showRank || !top.length || (G.predict && !$('#plPred', ov).hidden);
    el.innerHTML = '오늘의 큰손 ' + top.map(([k, v], i) => `<b>${i + 1}</b> ${esc(k)} ${v}`).join(' · ');
  }
  let showRank = true;
  function sessionDonors() { const o = {}; S.log.forEach(l => o[l.d] = (o[l.d] || 0) + l.n); return o; }

  /* ---------- 공개 API ---------- */
  window.PL_LIVE = {
    result(name) {
      if (!G.predict || !Object.keys(preds).length) return;
      const hit = Object.entries(preds).filter(([, v]) => v === name).map(([k]) => k);
      hit.forEach(k => HALL.prophets[k] = (HALL.prophets[k] || 0) + 1); save();
      predResult = hit.length ? `적중 ${hit.length}명! ${hit.slice(0, 8).map(esc).join(', ')}${hit.length > 8 ? ' 외' : ''}` : '적중자 없음… 다들 반성해';
      renderPred();
      if (S.on) setTimeout(() => { bigBanner(hit.length ? `예언자 ${hit.length}명 탄생` : '적중자 0명', hit.length ? hit.slice(0, 3).join(', ') + (hit.length > 3 ? ' 외' : '') : '아무도 못 맞혔다'); chime(true); }, 2600);
    },
    resetRound() { predResult = null; preds = {}; renderPred(); },
    active: () => S.on,
  };

  /* ---------- 입력 연결 ---------- */
  $('#plGo', dock).onclick = donate;
  $('#plFv', dock).onclick = startFever;
  $('#plCnt', dock).addEventListener('input', syncTgt);
  [$('#plNick', dock), $('#plCnt', dock)].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (i.id === 'plNick' && !$('#plCnt', dock).value) $('#plCnt', dock).focus(); else donate(); } }));
  const bindVal = (id, key, num, after) => { const el = $(id, dock); el.value = S[key]; el.addEventListener('input', () => { S[key] = num ? Math.max(1, +el.value || 1) : el.value; save(); renderBars(); after && after(); }); };
  bindVal('#plGoalN', 'goal', true); bindVal('#plGoalT', 'goalText'); bindVal('#plTA', 'ta'); bindVal('#plTB', 'tb'); bindVal('#plFvSec', 'feverSec', true);
  $('#plBattle', dock).checked = S.battle; $('#plBattle', dock).onchange = e => { S.battle = e.target.checked; save(); renderBars(); };
  $('#plBoard', dock).checked = S.board; $('#plBoard', dock).onchange = e => { S.board = e.target.checked; save(); renderMenu(); };
  $('#plGoalReset', dock).onclick = () => { S.total = 0; save(); renderBars(); };
  $('#plBattleReset', dock).onclick = () => { S.a = S.b = 0; save(); renderBars(); };
  $('#plBattleEnd', dock).onclick = () => { if (S.a === S.b) bigBanner('배틀 결과', `무승부! ${S.a} : ${S.b}`); else bigBanner('배틀 결과', `${S.a > S.b ? S.ta : S.tb} 승리! ${Math.max(S.a, S.b)} : ${Math.min(S.a, S.b)}`); chime(true); };
  $('#plShowRank', dock).onclick = () => { showRank = !showRank; $('#plShowRank', dock).textContent = showRank ? '화면 TOP3 숨기기' : '화면에 TOP3 띄우기'; renderRankStrip(); };
  $('#plHallReset', dock).onclick = () => { if (!confirmReset()) return; HALL = {donors: {}, prophets: {}, joins: {}}; S.log = []; save(); renderLB(); renderLog(); renderRankStrip(); };
  let resetArm = 0; function confirmReset() { const b = $('#plHallReset', dock); if (Date.now() - resetArm < 2500) { b.textContent = '랭킹 초기화'; return true; } resetArm = Date.now(); b.textContent = '한 번 더 누르면 초기화'; setTimeout(() => b.textContent = '랭킹 초기화', 2500); return false; }

  function setOn(on) {
    S.on = on; save(); tg.classList.toggle('on', on); tg.textContent = on ? '방송 모드 ON' : '방송 모드';
    ov.hidden = !on; dock.hidden = !on; document.body.classList.toggle('pl-docked', on); setTimeout(() => dispatchEvent(new Event('resize')), 30); renderMenu(); renderBars(); renderLog(); renderPred(); renderRankStrip(); $('#plShowRank', dock).textContent = showRank ? '화면 TOP3 숨기기' : '화면에 TOP3 띄우기';
    if (on) setTimeout(() => $('#plNick', dock).focus(), 50);
  }
  tg.onclick = () => setOn(!S.on);
  addEventListener('keydown', e => {
    if (!S.on) return;
    if (e.key === 'F2') { e.preventDefault(); startFever(); }
    else if (e.key === 'F4') { e.preventDefault(); setMini(!mini); }
  });
  if (otherLink) otherLink.style.zIndex = 9999;
  setOn(!!S.on); syncTgt();
})();
