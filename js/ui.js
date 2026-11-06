'use strict';
/* =========================================================================
   REPAIR MASTER — UI 공통 · 수리점 화면 · 접수대 · 견적 · 미니게임
   ========================================================================= */
const UI = {};

UI.show = function (name) {
  ['shop', 'bench', 'computer', 'book'].forEach(n => $('#' + n).classList.toggle('hidden', n !== name));
  UI.screen = name; document.body.dataset.screen = name;
  if (name === 'shop') UI.renderScene();
  UI.hud();
};
UI.statusName = st => ({ diagnosing: '진단 중', repairing: '수리 중', ready: '반환 대기', rejected: '수리 거절', closed: '완료' }[st] || st);
UI.stars = r => { let s = ''; for (let i = 1; i <= 5; i++) s += r >= i - 0.25 ? '★' : r >= i - 0.75 ? '⯪' : '☆'; return s; };

/* ---------- HUD ---------- */
UI.hud = function () {
  if (!S) return;
  $('#hudDay').textContent = fmtDay();
  $('#hudTime').textContent = fmtClock();
  $('#hudTime').classList.toggle('late', minOfDay() >= CLOSE);
  $('#hudMoney').textContent = WON(S.money); $('#hudMoney').classList.toggle('neg', S.money < 0);
  $('#hudRep').innerHTML = `<span class="stars">${UI.stars(S.rep)}</span> ${S.rep.toFixed(1)}`;
  $('#hudLv').innerHTML = `Lv${playerLv()} ${rankName()} <i class="xpbar"><b style="width:${(lvProgress() * 100).toFixed(0)}%"></b></i>`;
  const q = S.queue.length, pk = S.packages.length, rd = S.tickets.filter(t => t.status === 'ready').length;
  $('#hudAlerts').innerHTML = (q ? `<span class="al" data-go="counter">🔔 손님 ${q}</span>` : '') + (pk ? `<span class="al" data-go="packages">📦 택배 ${pk}</span>` : '') + (rd ? `<span class="al" data-go="counter">✅ 반환 대기 ${rd}</span>` : '') + (UI.lowStock().length ? `<span class="al warn" data-go="inv">⚠ 재고 부족 ${UI.lowStock().length}</span>` : '');
};
UI.lowStock = function () {
  const out = [];
  if ((S.consum.adhesive || 0) < 2) out.push('adhesive');
  Object.entries(S.minStock).forEach(([sku, min]) => { if (sku !== 'adhesive' && min > 0 && S.inv.filter(p => p.sku === sku).length < min) out.push(sku); });
  return out;
};

/* ---------- 토스트 · 모달 · 툴팁 ---------- */
UI.toast = function (icon, text, long) {
  text = fixJosa(text);
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `<i>${icon}</i><span>${esc(text)}</span>`;
  $('#toasts').appendChild(el); setTimeout(() => el.classList.add('out'), long ? 5200 : 3200); setTimeout(() => el.remove(), long ? 5800 : 3800);
  while ($('#toasts').children.length > 5) $('#toasts').firstChild.remove();
};
UI.modal = function (title, html, onMount, opts = {}) {
  const root = $('#modalRoot');
  const wrap = document.createElement('div'); wrap.className = 'modal-wrap' + (opts.cls ? ' ' + opts.cls : '');
  wrap.innerHTML = `<div class="modal ${opts.size || ''}"><div class="modal-h"><h2>${title}</h2>${opts.noClose ? '' : '<button class="x" aria-label="닫기">✕</button>'}</div><div class="modal-b">${html}</div></div>`;
  root.appendChild(wrap);
  const x = $('.x', wrap); if (x) x.onclick = () => { UI.closeModal(wrap); opts.onClose && opts.onClose(); };
  if (onMount) onMount($('.modal-b', wrap), wrap);
  return wrap;
};
UI.closeModal = function (w) { const root = $('#modalRoot'); const el = w || root.lastElementChild; if (el) el.remove(); UI.hud(); if (UI.screen === 'shop') UI.renderScene(); };
UI.choice = function (title, text, opts) {
  text = fixJosa(text);
  UI.modal(title, `<p>${esc(text)}</p><div class="row end">${opts.map((o, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-i="${i}">${esc(o[0])}</button>`).join('')}</div>`, (b, w) => {
    $$('button[data-i]', b).forEach(btn => btn.onclick = () => { UI.closeModal(w); opts[+btn.dataset.i][1](); });
  }, { size: 'sm', noClose: true });
};
UI.alert = (title, text) => UI.choice(title, text, [['확인', () => { }]]);
UI.hoverTip = function (e) {
  const tip = $('#tooltip'); const t = e.target.closest('[data-kind]'); const dev = WB.dev;
  if (!t || !dev || e.pointerType === 'touch') { tip.style.display = 'none'; return; }
  const k = t.dataset.kind, id = t.dataset.id; let txt = '';
  if (k === 'slot') { const sd = mSlot(dev, id); const lv = (S.book[sd.type] || {}).lv || 0; txt = lv >= 2 ? (sd.label || PART_TYPES[sd.type].name) : '알 수 없는 부품 — 클릭해서 식별'; }
  else if (k === 'conn') txt = skillLv('knowledge') >= 1 || S.tut.active ? mConn(dev, id).label + (dev.conns[id].on ? ' (연결됨)' : ' (분리됨)') : '커넥터';
  else if (k === 'screw') txt = '나사';
  else if (k === 'chip') { const c = id.split('|')[1]; txt = (S.book[c] || {}).lv >= 2 ? PART_TYPES[c].name : '칩 (확대경으로 관찰)'; }
  else if (k === 'lci') txt = S.flags.lciSeen ? '침수 감지 라벨(LCI)' : '작은 라벨';
  else if (k === 'port') txt = '충전 포트 입구';
  else if (k === 'seg') txt = '접착면 — 픽으로 드래그해 절단';
  else if (k === 'clip') txt = '플라스틱 클립 — 픽으로 클릭';
  else if (k === 'backfixed') txt = '후면 글라스 (분해 불가)';
  else if (k === 'frontfixed') txt = '앞면 쉘 (분해 불필요 — 뒷면을 여세요)';
  tip.textContent = txt; tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 12) + 'px';
};
UI.hideTip = () => { $('#tooltip').style.display = 'none'; };

/* ---------- 아이콘 · 아바타 ---------- */
UI.toolIcon = function (k) {
  const P = {
    hand: '<path d="M9 21c-2-2-4-5-4-8V8a1.5 1.5 0 013 0v4V4a1.5 1.5 0 013 0v7V3a1.5 1.5 0 013 0v8V5a1.5 1.5 0 013 0v9c0 4-3 7-6 7z" fill="#f3c9a0" stroke="#7a5236"/>',
    driver: '<rect x="10" y="2" width="4" height="10" rx="2" fill="#e04848"/><rect x="11.2" y="12" width="1.6" height="9" fill="#ccd"/><path d="M11 21h2l-1 2z" fill="#889"/>',
    spudger: '<path d="M4 20 L17 4 Q19 3 20 5 L8 21 Z" fill="#2c2c2c" stroke="#666"/>',
    pick: '<path d="M4 6 Q12 2 20 6 L12 20 Z" fill="#3fa9e0" stroke="#1d6d99"/><circle cx="18" cy="18" r="4" fill="#5c5c5c" stroke="#222"/>',
    heater: '<rect x="3" y="6" width="18" height="12" rx="3" fill="#e07a3a" stroke="#8a3b10"/><path d="M8 4c-1 1 1 2 0 3M12 4c-1 1 1 2 0 3M16 4c-1 1 1 2 0 3" stroke="#ff4b2b" fill="none"/>',
    tweezers: '<path d="M7 2 L11 20 M17 2 L13 20" stroke="#bfc6cf" stroke-width="2.2" stroke-linecap="round"/>',
    magnifier: '<circle cx="10" cy="10" r="6" fill="#bfe3ff" stroke="#556" stroke-width="2"/><path d="M14.5 14.5 L21 21" stroke="#556" stroke-width="3" stroke-linecap="round"/>',
    brush: '<rect x="10.5" y="2" width="3" height="12" fill="#8a5a2b"/><path d="M8 14h8l-1 8H9z" fill="#333"/>'
  };
  return `<svg viewBox="0 0 24 24" width="26" height="26">${P[k] || ''}</svg>`;
};
UI.avatar = function (a, size = 64) {
  a = a || {}; const hair = a.hair || '#333';
  const hairs = [`<path d="M14 30 Q14 10 32 10 Q50 10 50 30 Q46 18 32 18 Q18 18 14 30Z" fill="${hair}"/>`, `<path d="M12 34 Q10 8 32 8 Q54 8 52 34 L50 26 Q44 16 32 16 Q20 16 14 26Z" fill="${hair}"/><path d="M12 30 Q10 46 16 52 L18 34Z" fill="${hair}"/><path d="M52 30 Q54 46 48 52 L46 34Z" fill="${hair}"/>`,
    `<path d="M16 26 Q18 12 32 12 Q46 12 48 26 Q40 20 32 21 Q22 21 16 26Z" fill="${hair}"/>`, `<ellipse cx="32" cy="16" rx="18" ry="9" fill="${hair}"/><circle cx="32" cy="7" r="6" fill="${hair}"/>`];
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="avatar"><circle cx="32" cy="32" r="32" fill="#2b3440"/><path d="M10 64 Q12 46 32 46 Q52 46 54 64Z" fill="${a.shirt || '#456'}"/><rect x="28" y="38" width="8" height="9" fill="${a.skin || '#f0c8a0'}"/><ellipse cx="32" cy="29" rx="15" ry="17" fill="${a.skin || '#f0c8a0'}"/>${hairs[a.style || 0]}<circle cx="26" cy="31" r="1.8" fill="#222"/><circle cx="38" cy="31" r="1.8" fill="#222"/><path d="M28 38 Q32 41 36 38" stroke="#8a4a3a" stroke-width="1.5" fill="none"/>${a.glasses ? '<circle cx="26" cy="31" r="5" fill="none" stroke="#222" stroke-width="1.3"/><circle cx="38" cy="31" r="5" fill="none" stroke="#222" stroke-width="1.3"/><path d="M31 31h2" stroke="#222"/>' : ''}</svg>`;
};
const SENIOR_AV = { skin: '#e9be96', hair: '#2a2420', style: 2, shirt: '#2f6a8f', glasses: true };
UI.senior = function (text, title) {
  UI.modal(title || '박준호 선임', `<div class="senior-say">${UI.avatar(SENIOR_AV, 72)}<div class="bubble">${text}</div></div><div class="row end"><button class="btn primary" data-ok>알겠어요</button></div>`, (b, w) => { $('[data-ok]', b).onclick = () => UI.closeModal(w); }, { size: 'sm' });
};

/* ---------- 수리점 메인 화면 ---------- */
function personSVG(x, y, s, a, opts = {}) {
  a = a || {};
  return `<g transform="translate(${x} ${y}) scale(${s})" ${opts.attrs || ''}>
    <ellipse cx="0" cy="250" rx="60" ry="10" fill="#000" opacity=".18"/>
    <path d="M-48 250 L-40 120 Q-38 92 0 90 Q38 92 40 120 L48 250Z" fill="${a.shirt || '#456'}"/>
    <path d="M-40 120 L-58 200 L-46 204 L-30 140Z" fill="${a.shirt || '#456'}" opacity=".85"/><path d="M40 120 L58 200 L46 204 L30 140Z" fill="${a.shirt || '#456'}" opacity=".85"/>
    <rect x="-9" y="66" width="18" height="26" fill="${a.skin || '#f0c8a0'}"/>
    <ellipse cx="0" cy="48" rx="30" ry="34" fill="${a.skin || '#f0c8a0'}"/>
    ${[`<path d="M-30 44 Q-30 10 0 10 Q30 10 30 44 Q24 24 0 24 Q-24 24 -30 44Z" fill="${a.hair}"/>`, `<path d="M-33 56 Q-36 6 0 6 Q36 6 33 56 L28 34 Q16 20 0 20 Q-16 20 -28 34Z" fill="${a.hair}"/>`, `<path d="M-28 36 Q-24 12 0 12 Q24 12 28 36 Q14 26 0 26 Q-14 26 -28 36Z" fill="${a.hair}"/>`, `<ellipse cx="0" cy="20" rx="32" ry="16" fill="${a.hair}"/><circle cx="0" cy="2" r="10" fill="${a.hair}"/>`][a.style || 0]}
    <circle cx="-11" cy="50" r="3" fill="#222"/><circle cx="11" cy="50" r="3" fill="#222"/><path d="M-8 64 Q0 70 8 64" stroke="#8a4a3a" stroke-width="2.4" fill="none"/>
    ${a.glasses ? '<circle cx="-11" cy="50" r="9" fill="none" stroke="#222" stroke-width="2"/><circle cx="11" cy="50" r="9" fill="none" stroke="#222" stroke-width="2"/>' : ''}
    ${opts.apron ? '<path d="M-28 118 L28 118 L34 250 L-34 250Z" fill="#20303a" opacity=".9"/><text x="0" y="170" font-size="14" fill="#9fd" text-anchor="middle">RM</text>' : ''}
  </g>`;
}
UI.renderScene = function () {
  if (!S) return;
  const m = minOfDay(); const hh = (m / 60) % 12, mm = m % 60;
  const night = m >= CLOSE;
  const q = S.queue.slice(0, 3); const pk = S.packages.length; const active = S.tickets.length; const benchTk = benchTicket();
  let s = `<defs>
    <linearGradient id="sWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4048"/><stop offset="1" stop-color="#4c535c"/></linearGradient>
    <linearGradient id="sWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a35"/><stop offset="1" stop-color="#5e3a20"/></linearGradient>
    <linearGradient id="sFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d5038"/><stop offset="1" stop-color="#3b2a1e"/></linearGradient>
    <linearGradient id="sSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#0b1230' : '#8ec5ef'}"/><stop offset="1" stop-color="${night ? '#2a2a55' : '#dcefff'}"/></linearGradient>
    <linearGradient id="sMat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a8f86"/><stop offset="1" stop-color="#1c6b64"/></linearGradient>
    <linearGradient id="sScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3d7dd8"/><stop offset="1" stop-color="#1c3f7a"/></linearGradient>
    <radialGradient id="sLamp" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".55"/><stop offset="1" stop-color="#ffe7a8" stop-opacity="0"/></radialGradient>
    <filter id="sGlow"><feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#ffd86b" flood-opacity=".9"/></filter>
    <filter id="sSh"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".4"/></filter>
  </defs>`;
  // 벽·바닥
  s += `<rect width="1600" height="580" fill="url(#sWall)"/><rect y="420" width="1600" height="160" fill="#2f3339"/>${Array.from({ length: 33 }, (_, i) => `<rect x="${i * 50}" y="420" width="2" height="160" fill="#262a2f"/>`).join('')}`;
  s += `<rect y="570" width="1600" height="330" fill="url(#sFloor)"/>${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${600 + i * 36}" x2="1600" y2="${600 + i * 36}" stroke="#2c1f15" stroke-width="2" opacity=".6"/>`).join('')}${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 90 + (i % 2) * 40}" y1="${600 + (i % 9) * 36}" x2="${i * 90 + (i % 2) * 40}" y2="${636 + (i % 9) * 36}" stroke="#2c1f15" stroke-width="2" opacity=".5"/>`).join('')}`;
  // 천장 조명
  [430, 900, 1300].forEach(x => s += `<line x1="${x}" y1="0" x2="${x}" y2="60" stroke="#222" stroke-width="3"/><path d="M${x - 40} 60 h80 l-14 26 h-52z" fill="#1d2126"/><ellipse cx="${x}" cy="88" rx="22" ry="6" fill="#fff4c9"/><path d="M${x - 30} 88 L${x - 260} 600 L${x + 260} 600 L${x + 30} 88Z" fill="url(#sLamp)" opacity="${night ? .9 : .55}"/>`);
  // 출입문
  s += `<g class="hot" data-act="door" data-label="출입문 — 영업 종료"><rect x="50" y="160" width="210" height="430" fill="#1a1d21" filter="url(#sSh)"/><rect x="62" y="172" width="186" height="410" fill="url(#sSky)" opacity=".85"/><rect x="62" y="172" width="186" height="410" fill="none" stroke="#9aa3ad" stroke-width="8"/><rect x="225" y="360" width="10" height="60" rx="4" fill="#cbd2d9"/>
    <rect x="95" y="230" width="120" height="44" rx="8" fill="${night ? '#552222' : '#173b2a'}" stroke="#fff" stroke-width="2"/><text x="155" y="260" font-size="24" fill="${night ? '#ff8a8a' : '#7dffb0'}" text-anchor="middle" font-weight="800">${night ? 'CLOSED' : 'OPEN'}</text>
    <circle cx="248" cy="186" r="9" fill="#e6c15a"/></g>`;
  // 쇼윈도
  s += `<g><rect x="280" y="150" width="270" height="250" fill="#1a1d21"/><rect x="290" y="160" width="250" height="230" fill="url(#sSky)"/><path d="M290 390 V300 h40 v-40 h50 v60 h30 v-80 h60 v100 h40 v-30 h30 V390Z" fill="${night ? '#111526' : '#9fb3c8'}" opacity=".9"/>${night ? Array.from({ length: 12 }, (_, i) => `<rect x="${300 + (i * 37) % 230}" y="${310 + (i * 23) % 70}" width="6" height="8" fill="#ffd86b"/>`).join('') : ''}
    <text x="415" y="200" font-size="26" fill="#ffd86b" text-anchor="middle" font-weight="900" opacity=".9" letter-spacing="2">REPAIR MASTER</text><text x="415" y="226" font-size="15" fill="#fff" text-anchor="middle" opacity=".85">전자기기 사설 수리점</text></g>`;
  // 벽시계 (게임 시간)
  const ha = (hh + mm / 60) * 30, ma = mm * 6;
  s += `<g transform="translate(640 110)"><circle r="40" fill="#f7f3ea" stroke="#3a3a3a" stroke-width="5"/>${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="-33" x2="0" y2="-28" stroke="#333" stroke-width="3" transform="rotate(${i * 30})"/>`).join('')}<line x1="0" y1="0" x2="0" y2="-20" stroke="#222" stroke-width="5" stroke-linecap="round" transform="rotate(${ha})"/><line x1="0" y1="0" x2="0" y2="-30" stroke="#222" stroke-width="3" stroke-linecap="round" transform="rotate(${ma})"/><circle r="4" fill="#c33"/></g>`;
  // 수리 대기 선반
  s += `<g class="hot" data-act="crm" data-label="수리 대기 선반 — 진행 중인 의뢰 ${active}/${shelfCap()}"><rect x="720" y="128" width="380" height="12" fill="url(#sWood)" filter="url(#sSh)"/><rect x="720" y="76" width="380" height="54" fill="none"/>${S.tickets.slice(0, 7).map((t, i) => `<g transform="translate(${740 + i * 50} 82)"><rect width="30" height="46" rx="6" fill="#0d0f12" stroke="#666"/><rect x="3" y="3" width="24" height="40" rx="4" fill="${t.status === 'ready' ? '#2fbf71' : t.status === 'rejected' ? '#c44' : '#28466e'}"/><rect x="-4" y="-12" width="38" height="11" fill="#f4e7b8"/><text x="15" y="-3" font-size="9" fill="#333" text-anchor="middle">${t.id.slice(2)}</text></g>`).join('')}<text x="1090" y="122" font-size="13" fill="#cfd6de" text-anchor="end">대기 선반 ${active}/${shelfCap()}</text></g>`;
  // 공구 보드
  s += `<g><rect x="720" y="160" width="380" height="230" rx="6" fill="#a68356" filter="url(#sSh)"/>${Array.from({ length: 60 }, (_, i) => `<circle cx="${735 + (i % 15) * 25}" cy="${175 + Math.floor(i / 15) * 55}" r="2.4" fill="#6d5430"/>`).join('')}
    <g transform="translate(760 200)"><rect x="0" y="0" width="10" height="70" rx="4" fill="#d44"/><rect x="3.5" y="70" width="3" height="40" fill="#ccc"/></g><g transform="translate(800 200)"><rect width="10" height="60" rx="4" fill="#3a7bd5"/><rect x="3.5" y="60" width="3" height="44" fill="#ccc"/></g>
    <path d="M860 200 L866 300 M880 200 L874 300" stroke="#cfd6de" stroke-width="5" stroke-linecap="round"/><path d="M920 210 L990 280" stroke="#222" stroke-width="10" stroke-linecap="round"/>
    <g transform="translate(1010 200)"><rect width="60" height="40" rx="6" fill="#e07a3a"/><text x="30" y="26" font-size="12" fill="#fff" text-anchor="middle">HEAT</text></g>
    <g transform="translate(1030 270)"><circle r="22" fill="#bfe3ff" stroke="#556" stroke-width="5"/><path d="M15 15 L38 38" stroke="#556" stroke-width="8" stroke-linecap="round"/></g></g>`;
  // 작업대
  s += `<g class="hot" data-act="bench" data-label="${benchTk ? '작업대 — ' + benchTk.id + ' 작업 계속' : '작업대 — 수리할 기기 올리기'}">
    <path d="M690 470 H1100 L1120 520 H670Z" fill="#7a4f2c"/><rect x="670" y="520" width="450" height="26" fill="url(#sWood)"/><rect x="690" y="546" width="20" height="200" fill="#4a2f1a"/><rect x="1080" y="546" width="20" height="200" fill="#4a2f1a"/><rect x="720" y="560" width="200" height="120" fill="#5e3a20" stroke="#3a2412"/><line x1="720" y1="620" x2="920" y2="620" stroke="#3a2412" stroke-width="3"/><circle cx="820" cy="590" r="4" fill="#d6b45a"/><circle cx="820" cy="650" r="4" fill="#d6b45a"/>
    <path d="M730 476 H1060 L1072 512 H718Z" fill="url(#sMat)"/>${Array.from({ length: 8 }, (_, i) => `<line x1="${740 + i * 42}" y1="478" x2="${734 + i * 44}" y2="510" stroke="#5fc9be" stroke-width="1" opacity=".4"/>`).join('')}
    <path d="M1040 470 L1010 330 L930 300" stroke="#333" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="910" cy="300" rx="44" ry="16" fill="#cfd6de" stroke="#555" stroke-width="3"/><ellipse cx="910" cy="304" rx="34" ry="10" fill="#bfe3ff" opacity=".7"/><path d="M880 312 L840 470 L990 470 L940 312Z" fill="#fff7d0" opacity=".16"/>
    ${benchTk ? `<g transform="translate(860 478) rotate(-80) scale(.06)"><rect x="0" y="0" width="360" height="760" rx="50" fill="#0d0f12" stroke="#888" stroke-width="20"/></g><g transform="translate(910 480)"><rect width="24" height="10" rx="2" fill="#666"/></g>` : ''}
    <g transform="translate(760 484)"><rect width="34" height="20" rx="3" fill="#333"/>${[0, 1, 2, 3].map(i => `<circle cx="${6 + i * 7}" cy="10" r="2" fill="#ccc"/>`).join('')}</g></g>`;
  // 교과서
  s += `<g class="hot" data-act="book" data-label="수리 교과서 — 발견 ${discoveredCount()}/${BOOK_ORDER.length}"><g transform="translate(990 444) rotate(-6)"><rect width="86" height="30" rx="3" fill="#6b1f24" filter="url(#sSh)"/><rect y="22" width="86" height="8" fill="#efe6cf"/><rect x="0" y="0" width="10" height="30" fill="#4a1418"/><text x="48" y="17" font-size="10" fill="#f0d27a" text-anchor="middle" font-weight="700">수리 백과</text></g></g>`;
  // 박 선임
  s += `<g class="hot" data-act="senior" data-label="박준호 선임 — 조언 듣기">${personSVG(1150, 360, 1.05, SENIOR_AV, { apron: true })}</g>`;
  // 컴퓨터 책상
  s += `<g class="hot" data-act="computer" data-label="업무용 컴퓨터 — 부품몰·재고·회계"><rect x="1200" y="500" width="240" height="24" fill="url(#sWood)" filter="url(#sSh)"/><rect x="1215" y="524" width="16" height="220" fill="#4a2f1a"/><rect x="1410" y="524" width="16" height="220" fill="#4a2f1a"/>
    <rect x="1240" y="330" width="170" height="118" rx="8" fill="#111" filter="url(#sSh)"/><rect x="1248" y="338" width="154" height="100" rx="4" fill="url(#sScreen)"/><rect x="1256" y="346" width="40" height="30" rx="3" fill="#fff" opacity=".25"/><rect x="1302" y="346" width="40" height="30" rx="3" fill="#fff" opacity=".2"/><rect x="1256" y="382" width="90" height="6" fill="#fff" opacity=".35"/><rect x="1256" y="394" width="70" height="6" fill="#fff" opacity=".25"/>
    <rect x="1315" y="448" width="20" height="30" fill="#222"/><rect x="1290" y="476" width="70" height="8" rx="3" fill="#222"/><rect x="1250" y="486" width="130" height="12" rx="3" fill="#2a2a2a"/><ellipse cx="1405" cy="492" rx="10" ry="6" fill="#2a2a2a"/>
    ${S.orders.some(o => !o.delivered) ? '<circle cx="1400" cy="340" r="10" fill="#3a8fe0"/><text x="1400" y="344" font-size="11" fill="#fff" text-anchor="middle">🚚</text>' : ''}</g>`;
  // 부품 보관함
  const low = UI.lowStock().length;
  s += `<g class="hot" data-act="inv" data-label="부품 보관함 — 재고 ${S.inv.length}개"><rect x="1460" y="210" width="130" height="530" rx="6" fill="#4b5563" filter="url(#sSh)"/>${Array.from({ length: 24 }, (_, i) => { const cx = 1470 + (i % 3) * 40, cy = 222 + Math.floor(i / 3) * 64; return `<rect x="${cx}" y="${cy}" width="34" height="56" rx="3" fill="#6b7685" stroke="#374151"/><rect x="${cx + 5}" y="${cy + 8}" width="24" height="10" fill="#f5f0dc"/><rect x="${cx + 12}" y="${cy + 38}" width="10" height="4" rx="2" fill="#222"/>`; }).join('')}
    ${low ? `<circle cx="1585" cy="214" r="15" fill="#e0703a"/><text x="1585" y="220" font-size="16" fill="#fff" text-anchor="middle" font-weight="800">!</text>` : ''}</g>`;
  // 접수대
  s += `<g class="hot" data-act="counter" data-label="${q.length ? '고객 접수대 — ' + q[0].name + ' 님 대기 중' : '고객 접수대'}">
    ${q.map((c, i) => personSVG(470 - i * 120, 300 + i * 18, 0.95 - i * 0.08, c.avatar, { attrs: `opacity="${1 - i * 0.15}"` })).reverse().join('')}
    ${q.length ? `<g transform="translate(500 250)"><rect x="0" y="0" width="190" height="56" rx="14" fill="#fff" filter="url(#sSh)"/><path d="M20 56 L10 74 L40 56Z" fill="#fff"/><text x="95" y="24" font-size="15" fill="#222" text-anchor="middle" font-weight="700">${esc(q[0].name)} 님</text><text x="95" y="44" font-size="13" fill="#555" text-anchor="middle">${q[0].warranty ? '재방문 (보증)' : '수리 문의'}</text></g>` : ''}
    <path d="M300 470 H660 L670 500 H290Z" fill="#c9b08a"/><rect x="290" y="500" width="380" height="200" fill="url(#sWood)" filter="url(#sSh)"/><rect x="290" y="500" width="380" height="14" fill="#a07850"/><text x="480" y="600" font-size="22" fill="#f3e2c0" text-anchor="middle" font-weight="800" opacity=".85">접 수</text>
    <rect x="560" y="430" width="70" height="44" rx="4" fill="#222"/><rect x="566" y="436" width="58" height="32" fill="#3a5a40"/><circle cx="340" cy="466" r="10" fill="#d6b45a"/></g>`;
  // 택배
  s += `<g class="hot" data-act="packages" data-label="택배 보관 공간 — ${pk ? pk + '개 도착' : '비어 있음'}"><rect x="40" y="690" width="260" height="160" fill="transparent"/><ellipse cx="170" cy="830" rx="130" ry="18" fill="#000" opacity=".2"/>
    ${Array.from({ length: Math.min(pk, 5) }, (_, i) => `<g transform="translate(${70 + (i % 3) * 70} ${760 - Math.floor(i / 3) * 56})"><rect width="64" height="54" fill="#c8955a" stroke="#8a5f30" stroke-width="2"/><rect x="26" width="12" height="54" fill="#e3c08a"/><rect x="6" y="8" width="18" height="12" fill="#fff"/></g>`).join('')}
    ${pk ? '' : '<text x="170" y="800" font-size="15" fill="#bba" text-anchor="middle" opacity=".5">택배 보관</text>'}</g>`;
  if (night) s += `<rect width="1600" height="900" fill="#0a1030" opacity=".28" pointer-events="none"/>`;
  $('#scene').innerHTML = s;
};
UI.sceneAct = function (act) {
  Bus.emit('act', { type: 'scene', act });
  if (act === 'counter') return UI.openCounter();
  if (act === 'bench') return UI.pickBenchTicket();
  if (act === 'computer') return Computer.open();
  if (act === 'book') return UI.openBook();
  if (act === 'inv') return Computer.open('inv');
  if (act === 'packages') return UI.openPackages();
  if (act === 'senior') return UI.seniorTalk();
  if (act === 'crm') return Computer.open('crm');
  if (act === 'door') return UI.endDayFlow();
};
UI.pickBenchTicket = function (force) {
  const list = S.tickets;
  if (!list.length) return UI.senior('지금 작업대에 올릴 기기가 없어요. 접수대에서 손님을 먼저 받아봐요.');
  if (!force && S.bench && benchTicket()) return openBench();
  if (list.length === 1) { if (force) return UI.toast('🔧', '수리 중인 기기가 이것 하나뿐입니다.'); return openBench(list[0].id); }
  UI.modal(force ? '🔄 작업할 기기 바꾸기' : '작업대에 올릴 기기 선택', `${force ? '<p class="hint">지금 기기는 분해된 상태 그대로 선반에 보관됩니다. 나중에 다시 올리면 이어서 작업할 수 있어요.</p>' : ''}<div class="pick-list">${list.map(t => `<button class="pick-item fit${t.id === S.bench ? ' cur' : ''}" data-id="${t.id}">${UI.avatar(t.cust.avatar, 40)}<span><b>${t.id} · ${esc(t.cust.name)}</b> — ${MODELS[t.modelId].name}<br><small>${UI.statusName(t.status)} · 기한 ${fmtDT(t.deadlineT)}${t.id === S.bench ? ' · <b>지금 작업대 위</b>' : ''}</small></span></button>`).join('')}</div>`, b => {
    $('.pick-item', b).forEach(x => x.onclick = () => { UI.closeModal(); if (force && x.dataset.id === S.bench) return; save(); openBench(x.dataset.id); });
  });
};

/* ---------- 접수대 ---------- */
UI.openCounter = function () {
  const ready = S.tickets.filter(t => t.status === 'ready' || t.status === 'rejected' || t.status === 'repairing');
  const c = S.queue[0];
  let html = `<div class="counter-tabs"><button class="on" data-t="q">대기 손님 (${S.queue.length})</button><button data-t="r">기기 반환 (${ready.length})</button></div><div id="counterBody"></div>`;
  UI.modal('고객 접수대', html, (b) => {
    const renderQ = () => {
      const c = S.queue[0]; const body = $('#counterBody', b);
      if (!c) { body.innerHTML = `<div class="empty">기다리는 손님이 없습니다.<br><small>${S.arrivals.length ? '오늘 더 올 손님이 있을 수 있어요. 상단의 ⏱ 버튼으로 시간을 보낼 수 있습니다.' : '오늘은 더 이상 예정된 손님이 없습니다.'}</small></div>`; return; }
      const log = Object.entries(c.asked).map(([q, a]) => `<div class="qa"><div class="me">${esc(QUESTIONS.find(x => x.id === q).q)}</div><div class="them">${esc(a)}</div></div>`).join('');
      const cands = skillLv('diag') >= 3 ? candidatesFor(c) : [];
      body.innerHTML = `<div class="talk">${UI.avatar(c.avatar, 96)}<div class="talk-b"><b>${esc(c.name)}</b> <span class="muted">${c.persona.label}${c.warranty ? ' · 보증 재방문' : ''}</span>
        <div class="bubble big">“${esc(c.complaint)}”</div>${log}
        ${cands.length ? `<div class="cands"><b>🧠 추론: 가능한 원인 후보</b><br>${cands.map(x => `<span class="tag">${esc(x)}</span>`).join(' ')}</div>` : ''}</div></div>
        <h4>추가 질문 <small class="muted">(질문당 2분)</small></h4><div class="qs">${QUESTIONS.filter(q => !c.asked[q.id]).map(q => `<button class="btn sm" data-q="${q.id}">${esc(q.q)}</button>`).join('')}</div>
        <div class="row end"><button class="btn" data-a="decline">죄송하지만 지금은 받기 어려워요</button><button class="btn primary" data-a="intake">📋 기기 확인 · 접수서 작성</button></div>`;
      $$('[data-q]', body).forEach(btn => btn.onclick = () => { const q = QUESTIONS.find(x => x.id === btn.dataset.q); c.asked[q.id] = q.a(c); advance(2); addXP('consult', 2); Bus.emit('act', { type: 'ask', q: q.id }); renderQ(); });
      $('[data-a="decline"]', body).onclick = () => { if (c.tutorial) return UI.senior('첫 손님인데 돌려보내면 안 되죠! 제가 도와줄게요.'); S.queue.shift(); S.rep = clamp(S.rep - 0.03, 0, 5); advance(2); UI.toast('🚪', c.name + ' 님이 돌아갔습니다.'); renderQ(); UI.hud(); };
      $('[data-a="intake"]', body).onclick = () => { if (S.tickets.length >= shelfCap()) return UI.alert('선반이 가득 참', '수리 대기 선반이 가득 찼습니다 (' + shelfCap() + '건). 진행 중인 수리를 먼저 마무리하세요.'); UI.closeModal(); UI.intakeForm(c); };
    };
    const renderR = () => {
      const body = $('#counterBody', b);
      const list = S.tickets.filter(t => t.status === 'ready' || t.status === 'rejected' || t.status === 'repairing');
      body.innerHTML = list.length ? `<div class="pick-list">${list.map(t => `<div class="pick-item ${t.status === 'ready' ? 'fit' : ''}">${UI.avatar(t.cust.avatar, 40)}<span><b>${t.id} · ${esc(t.cust.name)}</b> — ${MODELS[t.modelId].name}<br><small>${UI.statusName(t.status)}${t.qcPass ? ' · 최종 점검 통과' : ' · 최종 점검 미통과'} · 견적 ${t.quote ? WON(t.quote.total) : '-'}</small></span><button class="btn primary sm" data-ret="${t.id}">반환하기</button></div>`).join('')}</div>` : '<div class="empty">반환할 기기가 없습니다.</div>';
      $$('[data-ret]', body).forEach(btn => btn.onclick = () => { const tk = S.tickets.find(t => t.id === btn.dataset.ret); UI.closeModal(); UI.returnFlow(tk); });
    };
    $$('.counter-tabs button', b).forEach(t => t.onclick = () => { $$('.counter-tabs button', b).forEach(x => x.classList.toggle('on', x === t)); t.dataset.t === 'q' ? renderQ() : renderR(); });
    if (!c && ready.length) { $$('.counter-tabs button', b)[1].click(); } else renderQ();
  }, { size: 'lg' });
};
UI.devPreview = function (dev, side, vb) { const v = dev.view; dev.view = side; const h = renderDevice(dev, { showUnknown: false }); dev.view = v; return `<svg viewBox="${vb || MODELS[dev.modelId].prevVB || '-20 -20 400 800'}" class="dev-prev">${h}</svg>`; };
UI.intakeForm = function (c) {
  const dev = c.device;
  UI.modal('📋 수리 접수서 — ' + esc(c.name) + ' 님', `<div class="intake"><div class="prev-col">
    <div class="prevs"><figure>${UI.devPreview(dev, 'front')}<figcaption>앞면</figcaption></figure><figure>${UI.devPreview(dev, 'back')}<figcaption>뒷면</figcaption></figure></div>
    <figure class="label-zoom">${UI.devPreview(dev, 'back', MODELS[dev.modelId].labelVB || '30 650 300 80')}<figcaption>🔍 뒷면 라벨 확대 — 모델 코드 확인</figcaption></figure></div>
    <div class="form">
      <label>기기 모델 <small class="muted">— 뒷면 라벨의 Model 코드를 확인하세요</small><select id="fModel"><option value="">선택…</option>${MODEL_IDS.map(id => `<option value="${id}">${MODELS[id].name} (${MODELS[id].code}) — ${MODELS[id].tier}</option>`).join('')}</select></label>
      <fieldset><legend>외관 상태 점검</legend>${devCat(c.modelId) === 'pad' ? `
        <label class="chk"><input type="checkbox" data-e="dent"> 쉘 찍힘·긁힘</label><label class="chk"><input type="checkbox" data-e="lifted"> 쉘 틈 벌어짐</label>` : `
        <label class="chk"><input type="checkbox" data-e="screenCrack"> 화면 유리 파손</label><label class="chk"><input type="checkbox" data-e="backCrack"> 후면 파손</label>
        <label class="chk"><input type="checkbox" data-e="lensCrack"> 카메라 렌즈 파손</label><label class="chk"><input type="checkbox" data-e="dent"> 프레임 찍힘</label><label class="chk"><input type="checkbox" data-e="lifted"> 화면·후면 들뜸</label>`}</fieldset>
      <label>고객 증상<textarea id="fSym" rows="3">${esc(c.complaint)}</textarea></label>
      <label>접수 메모 (선택)<input id="fMemo" placeholder="예) 낙하 이력 있음, 예산 약 20만 원"></label>
      <p class="small">수리 희망 기한: <b>${c.asked.deadline ? c.deadlineDays + '일 이내 (' + fmtDT((dayIdx() + c.deadlineDays) * DAY + CLOSE) + ')' : '아직 묻지 않음 — 기본 ' + c.deadlineDays + '일로 기록'}</b></p>
      <div class="row end"><button class="btn primary" id="fOk">접수 완료 · 선반에 보관</button></div>
    </div></div>`, (b) => {
    $('#fOk', b).onclick = () => {
      const mid = $('#fModel', b).value;
      if (!mid) return UI.alert('모델 미선택', '기기 모델을 선택하세요. 뒷면 아래쪽 작은 글씨의 Model 코드를 보면 알 수 있어요.');
      if (mid !== c.modelId) { addXP('consult', -0); return UI.alert('모델 확인', '접수서의 모델과 기기 뒷면의 Model 코드가 다른 것 같습니다. 다시 확인해 보세요. (잘못된 모델로 접수하면 엉뚱한 부품을 주문하게 됩니다)'); }
      const ext = {}; $$('[data-e]', b).forEach(i => ext[i.dataset.e] = i.checked);
      const tk = createTicket(c, { model: mid, ext, symptom: $('#fSym', b).value.trim(), memo: $('#fMemo', b).value.trim() });
      UI.closeModal();
      UI.toast('📋', '접수 완료: ' + tk.id + ' (' + MODELS[mid].name + '). 외관 점검 정확도 ' + tk.intakeScore);
      Bus.emit('act', { type: 'intake', id: tk.id });
      UI.renderScene();
    };
  }, { size: 'lg' });
};
UI.returnFlow = function (tk) {
  const go = () => {
    const ev = evaluateReturn(tk);
    if (ev.I.open.length) return UI.alert('반환 불가', '화면이 열린 상태입니다. 작업대에서 닫은 뒤 반환하세요.');
    if (ev.problems.length && tk.status !== 'rejected') {
      UI.modal('고객이 기기를 확인합니다…', `<div class="talk">${UI.avatar(tk.cust.avatar, 80)}<div class="talk-b"><div class="bubble big">“어? 아직 문제가 있는데요?”</div><ul class="fb">${ev.problems.map(p => `<li>${p.missing ? '부품 누락: ' + esc(p.label) : FUNC_NAMES[p.k] + ' — ' + p.st + (p.complaint ? ' (원래 증상)' : ' (새로 생긴 문제)')}</li>`).join('')}</ul></div></div>
        <div class="row end"><button class="btn" id="rFail">이대로 반환 (수리 실패 처리)</button><button class="btn primary" id="rRedo">죄송합니다, 다시 수리하겠습니다</button></div>`, (b, w) => {
        $('#rRedo', b).onclick = () => { tk.satAdj -= 1; tk.status = 'repairing'; tk.qcPass = false; S.rep = clamp(S.rep - 0.05, 0, 5); UI.closeModal(w); UI.toast('🔧', '재수리를 약속했습니다. (고객 만족도 감소)'); };
        $('#rFail', b).onclick = () => { UI.closeModal(w); UI.showResult(closeTicket(tk, true), tk); };
      }, { size: 'md' });
      return;
    }
    UI.showResult(closeTicket(tk, false), tk);
  };
  if (!tk.qcPass && tk.status !== 'rejected') UI.choice('최종 점검 미통과', '이 기기는 최종 기능 점검을 통과하지 않았습니다. 그래도 고객에게 반환할까요?', [['작업대에서 점검하기', () => openBench(tk.id)], ['그대로 반환', go]]);
  else go();
};
UI.showResult = function (r, tk) {
  const rec = r.rec;
  // 교과서: 실제 고친 고장 부품 경험 해금
  if (r.success && rec.result === '수리 완료') tk.faults.forEach(f => { const fd = FAULTS[f.id]; const sid = faultSlot(tk.modelId, f.id); if (sid) discover(mSlot(tk.device, sid).type, 4); if (fd.pmic) discover('pmic', 4); if (fd.conn) discover(MODELS[tk.modelId].slots.find(s => s.id === 'display').type, 4); });
  UI.modal(r.success ? '🎉 수리 완료!' : (rec.result.includes('거절') ? '기기 반환' : '😞 수리 실패'), `<div class="result">
    <div class="talk">${UI.avatar(tk.cust.avatar, 80)}<div class="talk-b"><div class="bubble big">${r.success ? (r.sat >= 4.5 ? '“와, 새 거 같아요! 정말 감사합니다!”' : r.sat >= 3 ? '“고쳐주셔서 감사해요.”' : '“고치긴 했는데… 좀 아쉽네요.”') : rec.result.includes('거절') ? '“네, 돌려받을게요.”' : '“돈은 못 드리겠네요. 다른 데 가볼게요.”'}</div>
    <div class="sat">고객 만족도 <span class="stars">${UI.stars(r.sat)}</span></div></div></div>
    <table class="kv"><tr><td>받은 수리비</td><td><b class="${r.paid ? 'ok' : ''}">${WON(r.paid)}</b></td></tr><tr><td>사용 부품 원가</td><td>${WON(rec.partsCost)}</td></tr><tr><td>작업 시간</td><td>${rec.workMin}분</td></tr><tr><td>실제 고장 원인</td><td>${esc(rec.truth)}</td></tr><tr><td>교체한 부품</td><td>${esc(rec.replaced)}</td></tr>${rec.warrantyUntil ? `<tr><td>보증 기간</td><td>${fmtDT(rec.warrantyUntil)}까지</td></tr>` : ''}</table>
    <h4>피드백</h4><ul class="fb">${rec.feedback.map(f => `<li>${esc(f)}</li>`).join('') || '<li>깔끔한 작업이었습니다.</li>'}</ul>
    <div class="row end"><button class="btn primary" data-ok>확인</button></div></div>`, (b, w) => { $('[data-ok]', b).onclick = () => { UI.closeModal(w); Bus.emit('act', { type: 'closed', id: tk.id, success: r.success }); }; }, { size: 'md' });
};

/* ---------- 견적 ---------- */
UI.openQuote = function (tk, isAdd) {
  const m = MODELS[tk.modelId];
  const rows = m.slots.filter(sd => !['shield', 'heatsink'].includes(sd.type)).map(sd => {
    const known = (S.book[sd.type] || {}).lv >= 2;
    return { key: sd.id, label: (known ? (sd.label || PART_TYPES[sd.type].name) : '(미확인 부품) ' + PART_TYPES[sd.type].name) + ' 교체', part: refPrice(skuOf(m.id, sd.id)), labor: LABOR[sd.type] };
  });
  rows.push({ key: 'svc_sw', label: '소프트웨어 복구', part: 0, labor: LABOR.software }, { key: 'svc_clean', label: '충전 포트 청소', part: 0, labor: LABOR.cleaning }, { key: 'svc_reseat', label: '커넥터 점검·재장착', part: 0, labor: LABOR.reseat });
  UI.modal((isAdd ? '➕ 추가 견적' : '📝 견적 작성') + ' — ' + tk.id, `<p class="hint">진단 결과를 바탕으로 필요한 항목만 고르세요. 가격이 너무 높으면 고객이 거절하고, 너무 낮으면 이익이 줄어듭니다. 부품가 기본값은 현재 <b>부품나라(일반)</b> 시세입니다.</p>
    ${isAdd ? `<p>현재 승인된 견적: <b>${WON(tk.quote.total)}</b></p>` : ''}
    <table class="qtable"><thead><tr><th></th><th>항목</th><th>부품가</th><th>공임</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td><input type="checkbox" data-i="${i}"></td><td>${esc(r.label)}</td><td><input type="number" step="1000" min="0" value="${r.part}" data-p="${i}" ${r.part ? '' : 'disabled'}></td><td><input type="number" step="1000" min="0" value="${r.labor}" data-l="${i}"></td></tr>`).join('')}</tbody></table>
    <div class="qsum">견적 합계: <b id="qTotal">₩0</b></div>
    <div class="row end"><button class="btn primary" id="qSend">📞 고객에게 견적 안내</button></div>`, (b, w) => {
    const calc = () => { let t = 0; rows.forEach((r, i) => { if ($(`[data-i="${i}"]`, b).checked) t += (+$(`[data-p="${i}"]`, b).value || 0) + (+$(`[data-l="${i}"]`, b).value || 0); }); $('#qTotal', b).textContent = WON(t + (isAdd ? tk.quote.total : 0)) + (isAdd ? ' (추가 ' + WON(t) + ')' : ''); return t; };
    b.addEventListener('input', calc); calc();
    $('#qSend', b).onclick = () => {
      const lines = []; rows.forEach((r, i) => { if ($(`[data-i="${i}"]`, b).checked) lines.push({ key: r.key, label: r.label, price: (+$(`[data-p="${i}"]`, b).value || 0) + (+$(`[data-l="${i}"]`, b).value || 0) }); });
      if (!lines.length) return UI.alert('견적 항목 없음', '최소 한 개의 항목을 선택하세요.');
      const add = lines.reduce((s, l) => s + l.price, 0); const total = add + (isAdd ? tk.quote.total : 0);
      UI.closeModal(w); advance(3);
      const d = customerDecide(tk, total, isAdd);
      const done = (dec, finalTotal, finalLines) => { applyQuote(tk, finalLines, finalTotal, isAdd, dec); addXP('consult', 3); if (UI.screen === 'bench') WB.render(); UI.hud(); Bus.emit('act', { type: 'quote', res: dec.res }); };
      UI.modal('📞 ' + esc(tk.cust.name) + ' 님과 통화', `<div class="talk">${UI.avatar(tk.cust.avatar, 80)}<div class="talk-b"><p class="muted">견적 ${WON(total)}을 안내했습니다.</p><div class="bubble big">“${esc(d.text)}”</div></div></div><div class="row end" id="qBtns"></div>`, (b2, w2) => {
        const btns = $('#qBtns', b2);
        if (d.res === 'counter') {
          btns.innerHTML = `<button class="btn" id="qNo">그 가격은 어렵습니다</button><button class="btn primary" id="qYes">${WON(d.offer)}에 진행할게요</button>`;
          $('#qYes', b2).onclick = () => { const k = (d.offer - (isAdd ? tk.quote.total : 0)) / add; lines.forEach(l => l.price = Math.round(l.price * k / 100) * 100); UI.closeModal(w2); done({ res: 'accept', sat: -0.2 }, d.offer, lines); UI.toast('🤝', '가격을 조정해 수리 동의를 받았습니다.'); };
          $('#qNo', b2).onclick = () => { UI.closeModal(w2); done({ res: 'reject' }, total, lines); UI.toast('❌', isAdd ? '추가 수리는 거절되었습니다.' : '고객이 수리를 거절했습니다. 기기를 원래대로 조립해 반환하세요.', true); };
        } else {
          btns.innerHTML = `<button class="btn primary" id="qOk">확인</button>`;
          $('#qOk', b2).onclick = () => { UI.closeModal(w2); done(d, total, lines); if (d.res === 'reject') UI.toast('❌', isAdd ? '추가 수리는 거절되었습니다.' : '고객이 수리를 거절했습니다. 기기를 원래대로 조립해 반환하세요.', true); else UI.toast('✅', '수리 동의를 받았습니다! 수리를 진행하세요.'); };
        }
      }, { size: 'md', noClose: true });
    };
  }, { size: 'lg' });
};

/* ---------- 선임 ---------- */
const SENIOR_HINTS = {
  disp_lines: '줄이 생기고 터치 일부가 안 되면 패널이 깨진 경우가 대부분이야. 그래도 교체 전에 커넥터 재장착은 한번 해봐.',
  disp_dead: '부팅 진동은 오는데 화면만 까맣다면 패널 아니면 커넥터야. 열어서 커넥터부터 다시 꽂아보고, 그래도 안 되면 패널.',
  disp_loose: '화면 검사에서 깜빡임이 있었지? 눌렀을 때 변한다면 패널보다 커넥터 접촉을 먼저 의심해봐. 확대경으로 커넥터를 봐도 좋고.',
  touch_dead: '화면은 멀쩡한데 터치만 안 된다면 터치 센서야. 그 전에 소프트웨어 검사로 드라이버 문제가 아닌지 확인해봐.',
  lcd_backlight: 'LCD는 빛을 뒤에서 비춰야 보여. 화면 검사에서 "희미하게 보인다"는 결과가 나왔다면 뭘 의미할까?',
  batt_worn: '오래 쓴 폰이 빨리 닳으면 배터리 건강도부터 재봐. 80% 아래면 교체 대상이야.',
  batt_dead: '배터리만으로 안 켜지는데 충전기를 꽂으면 켜진다? 배터리 상태 검사를 꼭 해봐. 버튼 고장도 비슷하게 보일 수 있어.',
  batt_swollen: '뒷면이 들떠 있으면 위험 신호야. 열어서 배터리 모양을 확대경으로 봐.',
  port_lint: '충전이 됐다 안 됐다 하면 포트 안을 먼저 들여다봐. 의외로 청소만으로 끝나는 경우가 많아.',
  port_corroded: '포트를 확대경으로 봐. 물 먹은 흔적이 있는지, 침수 라벨 색도 확인해봐.',
  port_broken: '충전 완전 무반응이면 포트 단자부터. 그 전에 다른 하단 기능이 살아 있는지 같이 봐야 범위를 좁힐 수 있어.',
  mic_dead: '"상대가 내 목소리를 못 듣는다"면 마이크야. 그런데 이 모델의 하단 마이크가 어디 붙어 있는지 교과서에서 확인해봐.',
  board_pmic: '충전기를 꽂아도 전류가 안 흐르면 큰 문제일 수 있어. 하지만 메인보드는 비싸니까, 배터리·버튼·포트를 먼저 배제해.',
  board_baseband: '무선 연결 검사에서 IMEI가 읽히는지 봐. 그게 안테나랑 모뎀을 가르는 기준이야.',
  cam_rear_dead: '카메라가 검은 화면이면 모듈 아니면 커넥터. 소프트웨어 검사 장치 목록에서 인식이 되는지 봐.',
  cam_rear_blur: '초점이 안 잡히고 떨린다면 손떨림 보정 쪽이야. 렌즈 커버도 확대경으로 봐.',
  cam_front_dead: '전면만 안 된다면 전면 카메라 모듈. 브라켓 밑에 숨어 있어.',
  spk_dead: '소리가 아예 안 나면 스피커 자체나 접점 경로야. 물 먹은 이력도 물어봤지?',
  spk_blown: '찢어지는 소리는 진동판 손상이 대부분이야.',
  ear_dead: '"스피커폰은 되는데 귀에 대면 안 들린다"면 어떤 스피커일까?',
  vib_dead: '진동만 안 되면 진동 모터. 연결이 어디로 가는지 확인해.',
  btn_power: '전원이 안 켜진다고 무조건 배터리가 아니야. 충전기로는 켜지는지, 배터리 건강도는 괜찮은지 같이 봐.',
  btn_volume: '하드웨어 자가진단으로 버튼 입력을 확인해봐.',
  ant_weak: '신호가 약하면 IMEI가 정상인지부터. 정상이면 안테나 쪽이야.',
  coil_dead: '유선은 되는데 무선만 안 된다면 범위가 확 좁아지지.',
  flex_torn: '충전·마이크·스피커가 한꺼번에 죽었다면 하나하나 바꾸기 전에, 그걸 다 잇는 길을 생각해봐.',
  sw_bootloop: '로고까지 뜬다는 건 전원은 살아 있다는 거야. 소프트웨어 검사를 해봐.',
  sw_touch: '고스트 터치가 불규칙하면 소프트웨어 검사부터. 화면 교체는 비싸잖아.',
  sw_drain: '배터리 건강도가 정상인데 빨리 닳는다면? 소프트웨어 검사 로그를 봐.'
};
UI.askSenior = function (tk) {
  if (tk.tutorial && S.tut.active) return UI.senior(TUT.currentText ? TUT.currentText() : '지금 단계 안내를 따라와요!');
  const left = tk.faults.filter(f => faultStillPresent(tk.device, f.id) && f.noticed);
  const f = left[0] || tk.faults.find(f => faultStillPresent(tk.device, f.id));
  const doIt = () => {
    tk.hints++;
    if (!f) { const r = qcReport(tk.device); return UI.senior(r.pass ? '원래 고장은 해결된 것 같아. 최종 기능 점검을 하고 반환해.' : '고장은 해결된 것 같은데 조립 상태를 다시 봐. 나사, 커넥터, 빠진 부품 없는지! 최종 기능 점검을 돌려봐.'); }
    UI.senior(SENIOR_HINTS[f.id] || '증상과 검사 결과를 하나씩 맞춰 봐. 불가능한 원인부터 지워나가는 거야.');
  };
  UI.choice('박 선임에게 묻기', '선임의 힌트를 들으면 이번 수리의 경험치가 30% 줄어듭니다. (사용 ' + tk.hints + '회)', [['힌트 듣기', doIt], ['스스로 해볼게요', () => { }]]);
};
UI.seniorTalk = function () {
  const tips = [];
  if (S.queue.length) tips.push('손님이 기다리고 있어요. 너무 오래 기다리게 하면 그냥 가버려요.');
  if (S.packages.length) tips.push('택배가 도착했어요. 문 옆 택배 공간을 눌러 열어보고 재고에 넣어요.');
  const rd = S.tickets.filter(t => t.status === 'ready'); if (rd.length) tips.push('점검을 통과한 기기가 있어요. 접수대의 "기기 반환" 탭에서 돌려드려요.');
  const late = S.tickets.filter(t => t.deadlineT < S.t + DAY && t.status !== 'ready'); if (late.length) tips.push('기한이 임박한 수리가 ' + late.length + '건 있어요. 부품이 없으면 프리미엄 업체 특급 배송도 방법이에요.');
  if (S.tickets.some(t => t.status === 'diagnosing')) tips.push('진단이 끝나면 견적부터 받아요. 동의 없이 고치면 돈을 못 받아요.');
  if (!tips.length) tips.push(R.pick(['정상 부품을 바꾸는 건 돈 낭비예요. 검사로 원인을 좁힌 뒤에 교체해요.', '싼 업체 부품은 가끔 불량이 섞여 있어요. 급하지 않으면 일반 업체가 무난해요.', '배터리 커넥터는 항상 제일 먼저 분리하고, 제일 마지막에 연결해요.', '같은 증상도 원인은 여러 가지예요. 교과서의 "관련 고장 증상"을 참고해요.', '진단 능력이 오르면 검사 결과를 해석하는 힌트가 보이기 시작할 거예요.']));
  UI.modal('박준호 선임', `<div class="senior-say">${UI.avatar(SENIOR_AV, 72)}<div class="bubble">${tips.map(t => `<p>${esc(t)}</p>`).join('')}</div></div><div class="row end"><button class="btn" id="sGuide">📘 튜토리얼 가이드 다시 보기</button><button class="btn primary" data-ok>고마워요</button></div>`, (b, w) => { $('[data-ok]', b).onclick = () => UI.closeModal(w); $('#sGuide', b).onclick = () => { UI.closeModal(w); TUT.guide(); }; }, { size: 'md' });
};

/* ---------- 택배 ---------- */
UI.openPackages = function () {
  if (!S.packages.length) return UI.alert('택배 보관 공간', '도착한 택배가 없습니다. 주문한 부품은 컴퓨터의 부품몰 "주문·배송" 탭에서 배송 상태를 확인할 수 있습니다.');
  const id = S.packages[0]; const o = S.orders.find(x => x.id === id);
  UI.modal('📦 택배 상자 — ' + VENDORS[o.vendor].name, `<div class="unbox"><div class="box-anim"><div class="flap l"></div><div class="flap r"></div><div class="boxbody">${VENDORS[o.vendor].name}<br><small>${o.id}</small></div></div>
    <p>주문 ${o.id} · ${o.items.map(i => esc(skuName(i.sku)) + ' ×' + i.qty).join(', ')}</p><div class="row end"><button class="btn primary" id="uOpen">상자 열기</button></div></div>`, (b, w) => {
    $('#uOpen', b).onclick = () => {
      $('.box-anim', b).classList.add('open');
      setTimeout(() => {
        const res = unbox(id);
        $('.unbox', b).innerHTML += `<h4>내용물 — 재고에 추가되었습니다</h4><ul class="fb">${res.map(r => r.adhesive ? `<li>접착 테이프 시트 ×${r.adhesive}</li>` : `<li>${partThumb(r.p, 30)} ${esc(skuName(r.p.sku))} <span class="tag">${r.p.grade}</span> ${r.note ? `<b class="bad">${esc(r.note)}</b>` : ''}</li>`).join('')}</ul><div class="row end"><button class="btn primary" data-ok>확인</button></div>`;
        $('#uOpen', b) && $('#uOpen', b).remove();
        $('[data-ok]', b).onclick = () => { UI.closeModal(w); if (S.packages.length) UI.openPackages(); };
        Bus.emit('act', { type: 'unbox' });
      }, 600);
    };
  }, { size: 'md' });
};

/* ---------- 하루 종료 ---------- */
UI.endDayFlow = function () {
  const open = S.tickets.filter(t => t.status !== 'ready').length;
  UI.choice('영업 종료', '오늘 영업을 마치고 다음 날 아침 9시로 넘어갈까요?' + (S.queue.length ? ' 기다리는 손님 ' + S.queue.length + '명은 돌아갑니다.' : '') + (open ? ' (진행 중인 수리 ' + open + '건은 내일 이어서 할 수 있습니다)' : ''), [['영업 종료', () => {
    if (UI.screen !== 'shop') UI.show('shop');
    const sum = endDay();
    UI.modal('🌙 ' + sum.day + '일차 영업 마감', `<table class="kv"><tr><td>오늘 매출</td><td><b class="ok">${WON(sum.rev)}</b></td></tr><tr><td>오늘 지출</td><td>${WON(sum.exp)}</td></tr><tr><td>완료한 수리</td><td>${sum.repairs}건</td></tr><tr><td>매장 자금</td><td>${WON(sum.money)}</td></tr><tr><td>평판</td><td><span class="stars">${UI.stars(sum.rep)}</span> ${sum.rep.toFixed(2)}</td></tr></table><ul class="fb">${sum.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul><p class="muted">☀ ${fmtDay()} 아침입니다.</p><div class="row end"><button class="btn primary" data-ok>새 하루 시작</button></div>`, (b, w) => { $('[data-ok]', b).onclick = () => UI.closeModal(w); }, { size: 'md', noClose: true });
    UI.renderScene();
  }], ['조금 더 일하기', () => { }]]);
};

/* ---------- 미니게임: 가열 (교육용 가상 작업) ---------- */
UI.heatGame = function (cb) {
  const pro = !!S.tools.heater_pro; const lv = skillLv('assembly'); const lo = 68 - lv * 2, hi = 92 + lv * 2;
  let temp = 26, prog = 0, hold = false, auto = false, over = false, ticks = 0, timer;
  UI.modal('🔥 접착제 가열 (가상 작업)', `<p class="hint">버튼을 <b>누르고 있으면</b> 온도가 오릅니다. 온도를 <b class="ok">초록 구간(${lo}~${hi}°)</b>에 유지하면 접착제가 부드러워집니다. 110° 이상은 과열 — 부품이 손상될 수 있습니다. <br><small>※ 실제 가열 작업은 화상·화재 위험이 있어 게임 속 가상 조작으로만 표현합니다.</small></p>
    <div class="heat"><div class="thermo"><div class="zone" style="bottom:${lo / 130 * 100}%;height:${(hi - lo) / 130 * 100}%"></div><div class="danger" style="bottom:${110 / 130 * 100}%"></div><div class="fill" id="hFill"></div></div>
    <div class="heat-r"><div class="temp" id="hTemp">26°</div><div class="prog"><b id="hProg"></b></div><p class="small">접착 연화 진행도</p>
    <button class="btn primary big" id="hBtn">🔥 누르고 있기</button>${pro ? '<label class="chk"><input type="checkbox" id="hAuto"> 정밀 스테이션 자동 온도 유지 (85°)</label>' : ''}</div></div>
    <div class="row end"><button class="btn" id="hCancel">그만두기</button></div>`, (b, w) => {
    const btn = $('#hBtn', b);
    const on = e => { e.preventDefault(); hold = true; btn.classList.add('on'); }; const off = () => { hold = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on); window.addEventListener('pointerup', off); btn.addEventListener('pointerleave', off);
    if (pro) $('#hAuto', b).onchange = e => auto = e.target.checked;
    timer = setInterval(() => {
      ticks++;
      if (auto) temp += (85 - temp) * 0.12 + (Math.random() - .5);
      else if (hold) temp += (pro ? 1.6 : 2.4) + Math.random() * (pro ? 0.6 : 2.0);
      else temp -= 1.1 + (temp - 26) * 0.012;
      temp = clamp(temp, 22, 130);
      if (temp >= lo && temp <= hi) prog += pro ? 2.2 : 1.5;
      if (temp > 110 && !over) { over = true; $('.thermo', b).classList.add('hot'); UI.toast('🔥', '과열! 온도를 낮추세요.'); }
      $('#hFill', b).style.height = (temp / 130 * 100) + '%'; $('#hTemp', b).textContent = Math.round(temp) + '°';
      $('#hTemp', b).className = 'temp ' + (temp > 110 ? 'bad' : temp >= lo && temp <= hi ? 'ok' : '');
      $('#hProg', b).style.width = Math.min(100, prog) + '%';
      if (prog >= 100) { clearInterval(timer); window.removeEventListener('pointerup', off); UI.closeModal(w); cb({ ok: true, overheat: over, min: pro ? 2.5 : 4 + ticks / 120 }); }
    }, 50);
    $('#hCancel', b).onclick = () => { clearInterval(timer); window.removeEventListener('pointerup', off); UI.closeModal(w); cb({ ok: false }); };
  }, { size: 'md', noClose: true });
};
/* ---------- 미니게임: 배터리 풀탭 ---------- */
UI.pullTab = function (cb) {
  const lv = skillLv('assembly'); let prog = 0, ten = 0, hold = false, tabs = 3, timer;
  UI.modal('🔋 배터리 풀탭 당기기 (가상 작업)', `<p class="hint">버튼을 누르고 있으면 접착 테이프를 천천히 당깁니다. <b>장력</b>이 빨간 선을 넘으면 테이프가 끊어집니다. 잠깐씩 손을 떼서 장력을 낮추세요.<br><small>※ 손상된 배터리는 현실에서 화재 위험이 있습니다. 이 미니게임은 교육용 추상화입니다.</small></p>
    <div class="tab-game"><div class="meter"><span>당긴 길이</span><div class="prog"><b id="tProg"></b></div></div><div class="meter"><span>장력</span><div class="prog ten"><b id="tTen"></b><i class="lim"></i></div></div><p>남은 풀탭: <b id="tTabs">3</b>개</p>
    <button class="btn primary big" id="tBtn">✋ 누르고 천천히 당기기</button><div id="tAlt"></div></div>
    <div class="row end"><button class="btn" id="tCancel">그만두기</button></div>`, (b, w) => {
    const btn = $('#tBtn', b);
    const on = e => { e.preventDefault(); hold = true; btn.classList.add('on'); }; const off = () => { hold = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on); window.addEventListener('pointerup', off); btn.addEventListener('pointerleave', off);
    const finish = (ok, extra) => { clearInterval(timer); window.removeEventListener('pointerup', off); UI.closeModal(w); if (ok) advance(workTime(3 + (extra || 0), 'assembly')); cb(ok); };
    timer = setInterval(() => {
      if (hold && tabs > 0) { prog += 0.9; ten += 2.4 - lv * 0.15 + Math.random() * 1.6; } else ten = Math.max(0, ten - 4);
      if (ten >= 100) { tabs--; ten = 0; prog = Math.max(0, prog - 20); UI.toast('✂', '풀탭이 끊어졌습니다!'); $('#tTabs', b).textContent = tabs; if (tabs <= 0) { $('#tBtn', b).disabled = true; $('#tAlt', b).innerHTML = '<p class="bad">모든 풀탭이 끊어졌습니다.</p><button class="btn" id="tSol">🧴 가상 접착 제거제로 천천히 분리 (+10분)</button>'; $('#tSol', b).onclick = () => finish(true, 10); } }
      $('#tProg', b).style.width = Math.min(100, prog) + '%'; $('#tTen', b).style.width = Math.min(100, ten) + '%';
      if (prog >= 100) finish(true);
    }, 50);
    $('#tCancel', b).onclick = () => finish(false);
  }, { size: 'md', noClose: true });
};
