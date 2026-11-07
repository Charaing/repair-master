'use strict';
/* =========================================================================
   REPAIR MASTER — 작업대 (분해 · 조립 · 진단)
   ========================================================================= */
const WB = {
  tool: 'hand', selected: null, vb: null, tab: 'tray', lastMsg: '', msgType: '', flipping: false,
  get tk() { return benchTicket(); },
  get dev() { const t = benchTicket(); return t ? t.device : null; }
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function openBench(ticketId) {
  if (ticketId) S.bench = ticketId;
  const tk = WB.tk;
  if (!tk) { UI.toast('📋', '작업할 의뢰가 없습니다. 먼저 손님을 접수하세요.'); return; }
  UI.show('bench');
  WB.selected = null; WB.vb = null; WB.faceView = null; WB.tool = toolUsable(WB.tool) ? WB.tool : 'hand';
  WB.msg('기기를 작업대에 올렸습니다. 왼쪽 도구를 고르고 부품을 직접 조작하세요. (휠/핀치: 확대, 드래그: 이동)', 'info');
  WB.render();
  Bus.emit('act', { type: 'benchOpen' });
}
function closeBench() { UI.show('shop'); save(); }

WB.msg = function (t, type) { t = fixJosa(t); WB.lastMsg = t; WB.msgType = type || ''; const el = $('#stageMsg'); if (el) { el.textContent = t; el.className = 'stage-msg ' + (type || ''); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); } };

WB.baseVB = function () {
  const dev = WB.dev; const m = MODELS[dev.modelId];
  if (dev.view === 'bottom') return m.cat === 'pad' ? { x: -30, y: -120, w: 540, h: 300 } : { x: -30, y: -130, w: 420, h: 330 };
  if (m.vb) return { ...m.vb };
  const open = m.slots.some(sd => sd.hinge && dev.slots[sd.id].part && dev.slots[sd.id].open && sd.side === dev.view);
  return open ? { x: -440, y: -110, w: 840, h: 980 } : { x: -50, y: -110, w: 460, h: 980 };
};
WB.applyVB = function () { const v = WB.vb; $('#devSvg').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); };
WB.fit = function () { WB.vb = WB.baseVB(); WB.applyVB(); };
WB.zoom = function (f, cx, cy) {
  const v = WB.vb; if (cx == null) { cx = v.x + v.w / 2; cy = v.y + v.h / 2; }
  const nw = clamp(v.w * f, 120, 1400), k = nw / v.w;
  WB.vb = { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: nw, h: v.h * k }; WB.applyVB();
};

WB.render = function () {
  const dev = WB.dev; if (!dev) return;
  const tk = WB.tk;
  const opts = { tool: WB.tool, selected: WB.selected, connLabels: skillLv('knowledge') >= 2 || (S.tut.active && !S.tut.done), hiConns: (skillLv('knowledge') >= 3 || S.tut.active) && WB.selected ? slotConns(dev, WB.selected).map(c => c.id) : null };
  const svg = $('#devSvg'); svg.innerHTML = renderDevice(dev, opts);
  const prevBase = WB._base; const nb = WB.baseVB();
  if (!WB.vb || !prevBase || prevBase.x !== nb.x) WB.vb = nb;
  WB._base = nb; WB.applyVB();
  const M = MODELS[dev.modelId], edgeName = M.edgeName || '아랫면';
  $('#sideLabel').textContent = ({ back: '뒷면', front: '앞면', bottom: edgeName }[dev.view]) + ' · ' + M.name;
  $('#stage').dataset.tool = WB.tool; $('#btnEdge').classList.toggle('on', dev.view === 'bottom');
  $('#btnEdge').textContent = (M.cat === 'pad' ? '⤴ ' : '⤵ ') + edgeName;
  // 도구
  $('#toolRail').innerHTML = TOOL_ORDER.filter(k => hasTool(k)).map(k => {
    const t = TOOLS[k]; let name = t.name, dur = '';
    if (k === 'driver' && S.tools.driver_e) name = TOOLS.driver_e.name;
    if (k === 'heater' && S.tools.heater_pro) name = TOOLS.heater_pro.name;
    if (k === 'magnifier' && S.tools.microscope) name = TOOLS.microscope.name;
    if (k === 'spudger' || k === 'pick') dur = `<i class="dur" style="--d:${S.tools[k] / (k === 'spudger' ? 80 : 40)}"></i>`;
    return `<button class="tool${WB.tool === k ? ' on' : ''}${toolUsable(k) ? '' : ' broken'}" data-tool="${k}" title="${esc(name)} — ${esc(t.desc)}">${UI.toolIcon(k)}<span>${esc(name)}</span>${dur}</button>`;
  }).join('');
  // 헤더
  $('#benchInfo').innerHTML = `<b>${tk.id}</b> ${esc(tk.cust.name)} · ${MODELS[tk.modelId].name} <span class="st st-${tk.status}">${UI.statusName(tk.status)}</span> <span class="dl ${S.t > tk.deadlineT ? 'late' : ''}">기한 ${fmtDT(tk.deadlineT)}</span>`;
  WB.renderSide();
  WB.discoverVisible();
  const el = $('#stageMsg'); if (el && el.textContent !== WB.lastMsg) { el.textContent = WB.lastMsg; el.className = 'stage-msg ' + WB.msgType; }
  UI.hud();
  Bus.emit('render');
  saveSoon();
};
WB.discoverVisible = function () {
  const dev = WB.dev; const m = MODELS[dev.modelId]; const found = [];
  m.slots.forEach(sd => { if (sd.side === dev.view && dev.slots[sd.id].part && isAccessible(dev, sd.id) && !(m.backFixed && dev.view === 'back') && !(m.frontFixed && dev.view === 'front')) { if (discover(sd.type, 1)) found.push(sd.type); } });
  if (found.length) { UI.toast('✨', '새로운 부품을 발견했습니다! 클릭해서 무엇인지 확인해 보세요.'); WB.msg('새로운 부품을 발견했습니다! (노란 ? 표시) 부품을 클릭하면 이름과 기초 설명이 교과서에 기록됩니다.', 'good'); }
};

/* ---------- 사이드 패널 ---------- */
WB.renderSide = function () {
  $$('#benchTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === WB.tab));
  const box = $('#benchPanel'); const dev = WB.dev, tk = WB.tk;
  if (WB.tab === 'tray') {
    const items = dev.tray.map(p => {
      const known = S.book[p.type] && S.book[p.type].lv >= 2;
      const tag = p.origin === 'original' ? '<span class="tag orig">기존 부품</span>' : `<span class="tag new">새 부품 · ${VENDORS[p.vendor] ? VENDORS[p.vendor].name : ''} ${p.grade}</span>`;
      const compat = p.model === dev.modelId ? '' : `<span class="tag bad">${MODELS[p.model].name}용</span>`;
      return `<div class="tray-item" data-uid="${p.uid}"><div class="thumb">${partThumb(p, 54)}</div><div class="ti-body"><b>${known ? esc(skuName(p.sku).replace(MODELS[p.model].name + ' ', '')) : '알 수 없는 부품'}</b><div>${tag}${compat}${p.knownDefect ? '<span class="tag bad">불량 확인</span>' : ''}</div>
        <div class="ti-act"><button data-a="install">설치</button><button data-a="inspect">관찰</button>${p.origin === 'stock' ? '<button data-a="stock">재고로</button><button data-a="claim">불량 교환</button>' : ''}${S.tools.ultrasonic && p.type === 'charge_port' ? '<button data-a="clean">초음파 세척</button>' : ''}</div></div></div>`;
    }).join('');
    box.innerHTML = `<div class="panel-head"><h3>작업 트레이</h3><button class="btn sm" id="btnFromStock">📦 재고에서 꺼내기</button></div>
      <p class="hint">부품을 기기 위로 <b>드래그</b>하거나 '설치'를 누르면 원래 자리에 장착됩니다. 나사·커넥터는 장착 후 따로 체결해야 합니다.</p>
      <div class="tray">${items || '<div class="empty">트레이가 비어 있습니다. 분리한 부품이 여기에 놓입니다.</div>'}</div>
      ${WB.screwMat()}<div class="consum">접착 테이프 재고: <b>${S.consum.adhesive || 0}</b>장</div>`;
  } else if (WB.tab === 'diag') {
    const pro = !!S.tools.tester_pro;
    const showHints = skillLv('diag') >= 2 || (S.tut.active && tk.tutorial);
    box.innerHTML = `<div class="panel-head"><h3>진단 검사</h3><span class="muted">${pro ? '진단 보드' : 'USB 전류 측정기'}</span></div>
      <p class="hint">검사는 <b>현재 기기 상태 그대로</b> 실행됩니다. 분해 중이라면 빠진 부품·분리된 커넥터도 결과에 반영됩니다.</p>
      <div class="tests">${TESTS.filter(t => !t.cat || t.cat === devCat(WB.dev.modelId)).map(t => `<button class="test" data-test="${t.id}"><i>${t.icon}</i>${t.name}<small>${t.min}분</small></button>`).join('')}</div>
      <div class="diag-actions"><button class="btn" id="btnSwReinstall">💾 소프트웨어 재설치 (40분)</button><button class="btn" id="btnSenior">🧑‍🔧 박 선임에게 묻기</button><button class="btn primary" id="btnQC">✅ 최종 기능 점검</button></div>
      <div class="diaglog">${tk.diagLog.slice().reverse().map(d => `<div class="dl-entry"><div class="dl-h">${d.icon || ''} ${esc(d.name)} <small>${fmtClock(d.t)}</small></div>${d.lines.map(l => `<div class="dl-line ${l.c}">${esc(l.t)}</div>`).join('')}${showHints ? d.hints.map(h => `<div class="dl-hint">💡 ${esc(h)}</div>`).join('') : ''}</div>`).join('') || '<div class="empty">아직 실행한 검사가 없습니다.</div>'}</div>
      ${!showHints ? '<p class="muted small">진단 능력 Lv2가 되면 검사 결과 해석 힌트가 표시됩니다.</p>' : ''}`;
  } else if (WB.tab === 'info') {
    const sid = WB.selected;
    if (!sid) { box.innerHTML = `<div class="panel-head"><h3>부품 정보</h3></div><div class="empty">부품을 클릭하면 정보가 표시됩니다.</div>${WB.toolHelp()}`; return; }
    const sd = mSlot(dev, sid), st = dev.slots[sid], p = st.part; const known = S.book[sd.type] && S.book[sd.type].lv >= 2;
    const conns = slotConns(dev, sid);
    box.innerHTML = `<div class="panel-head"><h3>${known ? esc(sd.label || PART_TYPES[sd.type].name) : '알 수 없는 부품'}</h3><button class="btn sm" id="btnBookPart">📖 교과서</button></div>
      <div class="info-icon">${partIconSVG(sd.type, 110)}</div>
      <p>${known ? esc(PART_TYPES[sd.type].short) : '아직 정체를 모르는 부품입니다. 교과서에서 비슷한 모양을 찾아보세요.'}</p>
      <table class="kv"><tr><td>상태</td><td>${p ? (sd.hinge && st.open ? '열림(힌지)' : '장착됨') : '비어 있음'}</td></tr>
      ${sd.screws ? `<tr><td>나사</td><td>${st.screws.filter(Boolean).length}/${sd.screws.length} 체결</td></tr>` : ''}
      ${sd.adhesive ? `<tr><td>고정</td><td>${{ glue: '접착제', clip: '클립', tab: '풀탭 테이프' }[sd.adhesive.kind]} · ${{ intact: '원래 접착 상태', heated: '가열됨(부드러워짐)', cut: '분리됨', none: '없음', new: '새 테이프' }[st.adhesive]}</td></tr>` : ''}
      ${conns.length ? `<tr><td>커넥터</td><td>${conns.map(c => `${skillLv('knowledge') >= 1 || S.tut.active ? esc(c.label) : '커넥터'}: <b class="${dev.conns[c.id].on ? 'ok' : 'bad'}">${dev.conns[c.id].on ? '연결' : '분리'}</b>`).join('<br>')}</td></tr>` : ''}
      ${p ? `<tr><td>부품</td><td>${p.origin === 'original' ? '기존(고객) 부품' : '교체 부품 · ' + p.grade}</td></tr>` : ''}</table>`;
  } else if (WB.tab === 'ticket') {
    const q = tk.quote;
    box.innerHTML = `<div class="panel-head"><h3>의뢰 ${tk.id}</h3><span class="st st-${tk.status}">${UI.statusName(tk.status)}</span></div>
      <div class="cust-line">${UI.avatar(tk.cust.avatar, 44)}<div><b>${esc(tk.cust.name)}</b> (${tk.cust.persona.label})<br><small>${MODELS[tk.modelId].name} · 기한 ${fmtDT(tk.deadlineT)}</small></div></div>
      <blockquote>“${esc(tk.complaint)}”</blockquote>
      ${tk.intake && tk.intake.memo ? `<p class="small">접수 메모: ${esc(tk.intake.memo)}</p>` : ''}
      ${tk.warranty ? '<p class="tag warn">보증 수리 — 비용은 매장 부담입니다.</p>' : ''}
      ${skillLv('diag') >= 3 && tk.candidates.length ? `<div class="cands"><b>추론 가능한 원인 후보</b> (진단 Lv3)<br>${tk.candidates.map(c => `<span class="tag">${esc(c)}</span>`).join(' ')}</div>` : ''}
      <h4>견적</h4>${q ? `<ul class="qlines">${q.lines.map(l => `<li>${esc(l.label)} <b>${WON(l.price)}</b></li>`).join('')}</ul><p>합계 <b>${WON(q.total)}</b></p>` : '<p class="muted">아직 견적을 보내지 않았습니다. 진단 후 견적을 작성하세요.</p>'}
      <div class="row">${tk.status === 'diagnosing' ? '<button class="btn primary" id="btnQuote">📝 견적 작성</button>' : ''}${tk.status === 'repairing' && !tk.warranty ? '<button class="btn" id="btnQuoteAdd">➕ 추가 견적</button>' : ''}${tk.status === 'rejected' ? '<p class="tag bad">고객이 수리를 거절했습니다. 원래대로 조립해 반환하세요.</p>' : ''}</div>
      <p class="small muted">작업 시간 누적: ${Math.round(tk.workMin)}분 · 선임 힌트 사용 ${tk.hints}회</p>`;
  }
};
/* 자석 나사 매트: 풀어 둔 나사를 부품별로 모아 둔다 (분리한 부품의 나사도 매트에 남음) */
WB.screwMat = function () {
  const dev = WB.dev; const m = MODELS[dev.modelId];
  const rows = m.slots.filter(sd => (sd.screws || []).length).map(sd => {
    const st = dev.slots[sd.id]; const n = st.part ? st.screws.filter(x => !x).length : sd.screws.length;
    return n ? { name: sd.label || nameOf(sd.type), n, out: !st.part, edge: m.edge && m.edge.screws && m.edge.screws.slot === sd.id } : null;
  }).filter(Boolean);
  if (!rows.length) return '';
  const total = rows.reduce((a, r) => a + r.n, 0);
  return `<div class="screwmat"><div class="sm-h">🧲 나사 매트 <small>풀어 둔 나사 ${total}개</small></div>${rows.map(r => `<div class="sm-row"><span>${esc(r.name)}${r.edge ? ' <small>(아랫면)</small>' : ''}</span><span class="sm-dots">${'<i></i>'.repeat(Math.min(r.n, 10))}</span><b>${r.n}</b>${r.out ? '' : ' <small class="muted">장착 중·미체결</small>'}</div>`).join('')}</div>`;
};
WB.toolHelp = function () {
  return `<div class="toolhelp"><h4>도구 사용법</h4><ul>
  <li><b>손</b>: 부품 들어내기 · 화면 열기/닫기</li><li><b>드라이버</b>: 나사 클릭 → 풀기/조이기</li><li><b>스퍼저</b>: 커넥터 클릭 → 분리/연결</li>
  <li><b>히팅 패드</b>: 접착 부품 클릭 → 가열 미니게임</li><li><b>오프닝 픽</b>: 노란 점선을 드래그해 접착면 절단 · 주황 클립 클릭</li>
  <li><b>핀셋</b>: 작은 부품 집기</li><li><b>확대경</b>: 부품·칩·커넥터·침수 라벨·포트 관찰</li><li><b>브러시</b>: 충전 포트 청소</li></ul></div>`;
};

/* ---------- 조작 ---------- */
WB.click = function (kind, id) {
  const dev = WB.dev; const tool = WB.tool;
  if (!toolUsable(tool)) { WB.msg(TOOLS[tool].name + '이(가) 닳아서 쓸 수 없습니다. 컴퓨터의 장비몰에서 새로 사세요.', 'bad'); return; }
  if (kind === 'frontfixed') { WB.msg('앞면 쉘은 열 필요가 없습니다. 버튼·스틱 부품은 모두 뒷면 쉘을 열면 나옵니다. 뒤집어서 뒷면 나사부터 푸세요.', 'info'); return; }
  if (kind === 'backfixed') { WB.msg('픽시스 S3는 후면 글라스가 프레임과 일체형이라 뒤로는 열 수 없습니다. 기기를 뒤집어 앞면(화면)으로 분해하세요.', 'warn'); return; }
  if (dev.view === 'bottom' && kind !== 'port' && kind !== 'screw') return WB.msg((MODELS[dev.modelId].edgeName || '아랫면') + '에서는 충전 포트와 나사만 다룰 수 있습니다. 같은 버튼을 다시 눌러 눕히세요.', 'info');
  if (kind === 'slot') { WB.select(id); }
  if (tool === 'magnifier') return WB.inspect(kind, id);
  switch (kind) {
    case 'slot':
      if (tool === 'hand' || tool === 'tweezers') return WB.handSlot(id);
      if (tool === 'driver') { if (S.tools.driver_e) return WB.screwAll(id); return WB.msg('드라이버로는 부품 위의 나사(은색 원)를 하나씩 클릭하세요. 전동 드라이버가 있으면 부품 클릭으로 한 번에 풀 수 있습니다.', 'info'); }
      if (tool === 'heater') return WB.heat(id);
      if (tool === 'pick') { const sd = mSlot(dev, id); const st = dev.slots[id]; if (sd.adhesive && sd.adhesive.kind === 'glue' && st.adhesive === 'intact' && sd.adhesive.heat) return WB.msg('접착제가 아직 딱딱합니다. 히팅 패드로 먼저 가열하세요.', 'warn'); if (sd.adhesive && sd.adhesive.kind === 'tab') return WB.msg('배터리는 손 도구로 풀탭을 당겨 분리합니다.', 'info'); return WB.msg('노란 점선(접착면)이나 주황색 클립이 보이면 그 위를 드래그/클릭하세요.', 'info'); }
      if (tool === 'spudger') return WB.msg('스퍼저는 커넥터(작은 검은 사각형)를 클릭해 분리·연결합니다.', 'info');
      if (tool === 'brush') { if (mSlot(dev, id).type === 'charge_port') return WB.brush(); return WB.msg('브러시는 충전 포트 청소용입니다.', 'info'); }
      return;
    case 'screw': if (tool !== 'driver') return WB.msg('나사는 드라이버로 풀거나 조입니다.', 'info'); return WB.screw(id);
    case 'conn': if (tool !== 'spudger') return WB.msg('커넥터는 스퍼저로 분리·연결합니다. (금속 도구는 단락 위험)', 'info'); return WB.toggleConn(id);
    case 'clip': if (tool === 'pick') return WB.clip(id); return;
    case 'seg': if (tool === 'pick') return WB.cutSeg(id); return;
    case 'port': if (tool === 'brush') return WB.brush(); if (dev.view !== 'bottom') return; return WB.msg('충전 포트 입구입니다. 확대경으로 관찰하거나 브러시로 청소할 수 있습니다.', 'info');
    case 'chip': WB.select(id.split('|')[0]); return WB.msg('메인보드 위의 칩입니다. 확대경으로 보면 어떤 칩인지 알 수 있습니다.', 'info');
    case 'lci': return WB.msg('작은 라벨이 붙어 있습니다. 확대경으로 관찰해 보세요.', 'info');
  }
};
WB.select = function (sid) {
  WB.selected = sid; const sd = mSlot(WB.dev, sid);
  if (discover(sd.type, 2)) { UI.toast('📖', '교과서에 기록됨: ' + PART_TYPES[sd.type].name); addXP('knowledge', 4); }
  if (WB.tab === 'info' || window.innerWidth > 900) { /* keep tab */ }
  Bus.emit('act', { type: 'select', sid });
};
WB.handSlot = function (sid) {
  const dev = WB.dev, sd = mSlot(dev, sid), st = dev.slots[sid];
  if (!st.part) return;
  if (sd.hinge && st.open) {
    const anyConn = slotConns(dev, sid).some(c => dev.conns[c.id].on && connPresent(dev, c));
    if (anyConn) { const names = slotConns(dev, sid).filter(c => dev.conns[c.id].on && connPresent(dev, c)).map(c => c.label).join(', '); return UI.choice('화면(디스플레이)', '화면을 완전히 떼어내려면 먼저 스퍼저로 커넥터를 분리해야 합니다 (' + names + '). 지금은 닫기만 할 수 있어요.', [['화면 닫기', () => WB.closeHinge(sid)], ['그대로 두기', () => WB.msg('스퍼저를 고르고 화면 쪽 커넥터를 클릭해 분리하세요: ' + names, 'info')]]); }
    UI.choice('화면(디스플레이)', '열려 있는 화면을 어떻게 할까요?', [['닫기', () => WB.closeHinge(sid)], ['완전히 떼어내기', () => WB.removeNow(sid)]]);
    return;
  }
  const r = canRemove(dev, sid);
  if (!r.ok) { WB.msg(r.msg, 'warn'); Bus.emit('act', { type: 'blocked', code: r.code, sid }); return; }
  if (sd.tool === 'tweezers' && WB.tool !== 'tweezers') return WB.msg('작고 섬세한 부품이라 손으로는 집기 어렵습니다. 핀셋을 사용하세요.', 'warn');
  if (r.open) {
    st.open = true; advance(workTime(1.5, 'assembly'));
    WB.msg('화면을 책처럼 옆으로 펼쳤습니다. 플렉스 케이블이 아직 연결되어 있으니 조심하세요.', 'good');
    WB.selected = null; WB.vb = null; WB.render(); Bus.emit('act', { type: 'open', sid }); return;
  }
  if (r.tab) return UI.pullTab(ok => { if (ok) { st.adhesive = 'cut'; WB.removeNow(sid); } else WB.render(); });
  WB.removeNow(sid);
};
WB.removeNow = function (sid) {
  const dev = WB.dev, sd = mSlot(dev, sid);
  const conns = slotConns(dev, sid).filter(c => dev.conns[c.id].on && connPresent(dev, c));
  if (conns.length) return WB.msg('연결된 커넥터를 먼저 분리하세요: ' + conns.map(c => c.label).join(', '), 'warn');
  doRemove(dev, sid); advance(workTime(2, 'assembly'));
  discover(sd.type, 3); addXP('assembly', 2);
  WB.msg((sd.label || nameOf(sd.type)) + '을(를) 분리해 트레이에 올렸습니다. 아래에 있던 부품이 드러났습니다.', 'good');
  WB.selected = null; WB.render(); Bus.emit('act', { type: 'remove', sid });
};
WB.closeHinge = function (sid) {
  const dev = WB.dev, st = dev.slots[sid];
  const finish = tape => {
    if (tape) { S.consum.adhesive--; st.adhesive = 'new'; st.cut = st.cut.map(() => false); }
    st.open = false; advance(workTime(1.5, 'assembly'));
    WB.msg('화면을 닫았습니다.' + (st.adhesive === 'new' ? ' 새 접착 테이프로 밀봉했습니다.' : ' (접착 테이프 없이 닫음 — 방수·고정이 약합니다)'), st.adhesive === 'new' ? 'good' : 'warn');
    WB.vb = null; WB.render(); Bus.emit('act', { type: 'close', sid });
  };
  if (st.adhesive !== 'new' && st.adhesive !== 'intact' && (S.consum.adhesive || 0) > 0) UI.choice('접착 테이프', '새 접착 테이프를 붙이고 닫을까요? (재고 ' + S.consum.adhesive + '장)', [['테이프 붙이고 닫기', () => finish(true)], ['그냥 닫기', () => finish(false)]]);
  else finish(false);
};
WB.screw = function (id, held) {
  const [sid, i] = id.split('|'); const dev = WB.dev, st = dev.slots[sid];
  if (!st.part) return;
  if (!isAccessible(dev, sid)) return WB.msg('다른 부품에 가려져 드라이버가 닿지 않습니다.', 'warn');
  if (!held && !S.tools.driver_e) return WB.msg('나사 위에서 드라이버를 꾹 누르고 있으면 나사가 돌아갑니다.', 'info');
  st.screws[i] = !st.screws[i];
  advance(workTime(S.tools.driver_e ? 0.3 : 1, 'assembly'));
  WB.msg(st.screws[i] ? '나사를 조였습니다.' : '나사를 풀었습니다. (남은 나사 ' + slotScrewsLeft(dev, sid) + '개)', '');
  addXP('assembly', 0.5); WB.render(); Bus.emit('act', { type: 'screw', sid });
};
/* 드라이버를 누르고 있는 동안 나사가 실제로 돌아간다 (풀 때는 반시계, 조일 때는 시계 방향) */
WB.holdScrew = function (id, el) {
  const [sid, i] = id.split('|'); const dev = WB.dev, st = dev.slots[sid];
  if (!el || !st || !st.part || !toolUsable('driver') || !isAccessible(dev, sid)) return null;
  const tighten = !st.screws[i];
  const lv = skillLv('assembly');
  const turns = tighten ? 3 : 4;
  const dur = S.tools.driver_e ? 380 : Math.max(520, 1250 - lv * 110);
  const NS = 'http://www.w3.org/2000/svg';
  WB.unwrapScrew(el);
  const body = el.children[1]; if (!body || body.tagName !== 'circle') return null;
  const cx = +body.getAttribute('cx'), cy = +body.getAttribute('cy'), r = +body.getAttribute('r');
  const head = document.createElementNS(NS, 'g'); head.setAttribute('class', 'sc-head'); [...el.children].slice(1).forEach(c => head.appendChild(c)); el.appendChild(head);
  const C = 2 * Math.PI * (r + 5);
  const ring = document.createElementNS(NS, 'circle'); ring.setAttribute('class', 'sc-ring');
  Object.entries({ cx, cy, r: r + 5, fill: 'none', stroke: tighten ? '#7ff0c0' : '#ffd36b', 'stroke-width': 2.6, 'stroke-dasharray': C, 'stroke-dashoffset': C, transform: `rotate(-90 ${cx} ${cy})`, 'pointer-events': 'none' }).forEach(([k, v]) => ring.setAttribute(k, v));
  el.appendChild(ring);
  const t0 = performance.now(); let raf = 0, done = false, cancelled = false;
  const finish = () => { if (done || cancelled) return; done = true; cancelAnimationFrame(raf); clearTimeout(timer); WB.screw(id, true); };
  const timer = setTimeout(finish, dur + 20);
  WB.msg((tighten ? '나사를 조이는 중' : '나사를 푸는 중') + '… 드라이버를 누르고 있으세요. (' + (tighten ? '시계 방향' : '반시계 방향') + ' ' + turns + '바퀴)', 'info');
  const tick = now => {
    const k = Math.min(1, (now - t0) / dur);
    const ang = (tighten ? 1 : -1) * k * 360 * turns;
    const sc = tighten ? 1.18 - 0.18 * k : 1 + 0.18 * k;  // 풀릴수록 나사 머리가 떠오르고, 조일수록 가라앉음
    head.setAttribute('transform', `translate(${cx} ${cy}) scale(${sc}) rotate(${ang}) translate(${-cx} ${-cy})`);
    ring.setAttribute('stroke-dashoffset', C * (1 - k));
    if (k >= 1) return finish();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    get done() { return done; },
    cancel() {
      if (done) return;
      if (performance.now() - t0 >= dur) return finish();
      cancelled = true; clearTimeout(timer); cancelAnimationFrame(raf); ring.parentNode && ring.parentNode.removeChild(ring); WB.unwrapScrew(el);
      const k = Math.min(1, (performance.now() - t0) / dur);
      WB.msg(k < 0.12 ? '나사는 드라이버를 꾹 누르고 있어야 돌아갑니다. (짧게 누르면 돌아가지 않아요)' : '드라이버를 중간에 뗐습니다. 나사가 ' + (tighten ? '덜 조여진' : '아직 다 풀리지 않은') + ' 상태입니다. 처음부터 다시 돌리세요.', 'warn');
    }
  };
};
/* 돌리던 나사 그림을 원래 구조로 되돌린다 (취소 후 다시 누를 수 있게) */
WB.unwrapScrew = function (el) {
  [...el.querySelectorAll(':scope > g.sc-head')].forEach(h => { while (h.firstChild) el.insertBefore(h.firstChild, h); h.remove(); });
  [...el.querySelectorAll(':scope > circle.sc-ring')].forEach(r => r.remove());
};
WB.screwAll = function (sid) {
  const dev = WB.dev, st = dev.slots[sid];
  if (!st.part || !st.screws.length) return WB.msg('이 부품에는 나사가 없습니다.', 'info');
  if (!isAccessible(dev, sid)) return WB.msg('다른 부품에 가려져 드라이버가 닿지 않습니다.', 'warn');
  const target = st.screws.some(Boolean) ? false : true;
  st.screws = st.screws.map(() => target); advance(workTime(0.3 * st.screws.length, 'assembly'));
  WB.msg('전동 드라이버로 나사 ' + st.screws.length + '개를 ' + (target ? '조였습니다.' : '풀었습니다.'), 'good');
  WB.render(); Bus.emit('act', { type: 'screw', sid });
};
WB.toggleConn = function (cid) {
  const dev = WB.dev, c = mConn(dev, cid), st = dev.conns[cid];
  if (!dev.slots[c.owner].part) return WB.msg('이 소켓에 꽂을 부품이 없습니다.', 'info');
  const cov = connCovering(dev, c);
  if (cov.length) return WB.msg('커넥터 위를 ' + cov.map(id => slotName(dev, id)).join(', ') + '이(가) 덮고 있습니다.', 'warn');
  const doIt = (risky) => {
    const wasLoose = st.loose;
    st.on = !st.on; if (st.on) st.loose = false;
    wearTool('spudger'); advance(workTime(0.8, 'assembly'));
    let txt = (skillLv('knowledge') >= 1 || S.tut.active ? c.label : '커넥터') + (st.on ? '를 연결했습니다. "딸깍"' : '를 분리했습니다.');
    if (wasLoose && st.on) { txt += ' 이전보다 단단하게 체결되는 느낌입니다.'; const tk = WB.tk; tk.reseated = true; }
    if (risky && R.chance(0.3) && c.owner !== 'battery') {
      const p = dev.slots[c.owner].part; p.fault = 'short';
      UI.toast('⚡', '스파크! 배터리가 연결된 상태에서 커넥터를 다뤄 부품이 손상되었습니다.', true);
      txt = '⚡ 단락 발생! ' + nameOf(p.type) + '이(가) 손상되었을 수 있습니다. 다음부터는 배터리 커넥터를 먼저 분리하세요.';
      WB.msg(txt, 'bad');
    } else WB.msg(txt, st.on ? 'good' : '');
    addXP('assembly', 1); addXP('knowledge', 0.5);
    WB.render(); Bus.emit('act', { type: 'conn', cid, on: st.on });
  };
  const batt = dev.conns.c_batt;
  if (cid !== 'c_batt' && batt && batt.on && dev.slots.battery.part) {
    if (S.tut.active && !S.tut.done) { UI.senior('잠깐! 배터리 커넥터가 아직 연결되어 있어요. 전기가 흐르는 상태에서 다른 커넥터를 만지면 부품이 타버릴 수 있어요. 배터리 커넥터부터 분리해요!'); return; }
    UI.choice('⚠ 배터리 연결 상태', '배터리가 연결된 상태입니다. 이대로 다른 커넥터를 다루면 단락으로 부품이 손상될 수 있습니다. (게임 속 가상 위험)', [['배터리부터 분리할게요', () => WB.msg('좋은 판단입니다. 배터리 커넥터를 먼저 분리하세요.', 'good')], ['위험을 감수하고 진행', () => doIt(true)]]);
    return;
  }
  doIt(false);
};
WB.clip = function (id) {
  const [sid, i] = id.split('|'); const st = WB.dev.slots[sid];
  if (st.clips[i]) return; st.clips[i] = true; wearTool('pick'); advance(workTime(0.5, 'assembly'));
  const left = st.clips.filter(x => !x).length;
  if (!left) { st.adhesive = 'cut'; WB.msg('모든 클립을 풀었습니다. 이제 손으로 커버를 들어낼 수 있습니다.', 'good'); }
  else WB.msg('클립 하나가 "톡" 하고 풀렸습니다. (남은 클립 ' + left + '개)', '');
  WB.render(); Bus.emit('act', { type: 'clip' });
};
WB.cutSeg = function (id) {
  const [sid, i] = id.split('|'); const st = WB.dev.slots[sid];
  if (st.cut[i]) return false;
  st.cut[i] = true; wearTool('pick'); advance(workTime(1.2, 'assembly'));
  if (st.cut.every(Boolean)) { st.adhesive = 'cut'; WB.msg('접착면을 모두 잘라냈습니다! 이제 들어 올릴 수 있습니다.', 'good'); Bus.emit('act', { type: 'cut', sid }); }
  else WB.msg('접착면 한 구간을 잘라냈습니다. (남은 구간 ' + st.cut.filter(x => !x).length + ')', '');
  WB.render(); return true;
};
WB.heat = function (sid) {
  const dev = WB.dev, sd = mSlot(dev, sid), st = dev.slots[sid];
  if (!sd.adhesive || sd.adhesive.kind !== 'glue' || !sd.adhesive.heat) return WB.msg('이 부품은 가열할 필요가 없습니다.', 'info');
  if (st.adhesive !== 'intact') return WB.msg(st.adhesive === 'heated' ? '이미 충분히 가열되었습니다. 오프닝 픽으로 접착면을 자르세요.' : '접착제가 이미 분리되어 있거나 새 테이프 상태입니다. (새 테이프는 가열 없이 픽으로 자를 수 있음)', 'info');
  if (!isAccessible(dev, sid)) return WB.msg('다른 부품에 가려져 있습니다.', 'warn');
  UI.heatGame(res => {
    if (!res.ok) { WB.msg('가열을 중단했습니다.', ''); return; }
    st.adhesive = 'heated'; advance(workTime(res.min, 'assembly'));
    if (res.overheat) {
      if (sd.type.startsWith('display') && !st.part.fault) { st.part.fault = 'heat_damage'; WB.msg('🔥 과열! 화면 패널 일부가 변색되었습니다. (가상 손상)', 'bad'); }
      else { const b = dev.slots.battery && dev.slots.battery.part; if (b) b.health = Math.max(5, b.health - 8); WB.msg('🔥 과열! 아래의 배터리가 열 스트레스를 받았습니다. (가상 손상)', 'bad'); }
    } else WB.msg('접착제가 부드러워졌습니다. 이제 오프닝 픽으로 노란 점선을 따라 잘라내세요.', 'good');
    addXP('assembly', 3); WB.render(); Bus.emit('act', { type: 'heat', sid });
  });
};
WB.brush = function () {
  const dev = WB.dev; const p = dev.slots.charge_port.part;
  if (!p) return WB.msg('충전 포트 모듈이 없습니다.', 'info');
  advance(workTime(5));
  if (p.fault === 'port_lint') { p.fault = null; WB.tk.cleaned = true; WB.msg('브러시로 긁어내자 뭉친 먼지가 쏙 빠져나왔습니다! 포트가 깨끗해졌습니다.', 'good'); addXP('diag', 6); discover('charge_port', 4); }
  else if (p.fault === 'port_corroded') WB.msg('부식은 브러시로 제거되지 않습니다. 모듈 교체가 필요하거나, 초음파 세척기로 세척할 수 있습니다.', 'warn');
  else WB.msg('포트를 청소했지만 특별히 나온 것은 없습니다.', '');
  WB.render(); Bus.emit('act', { type: 'brush' });
};
WB.inspect = function (kind, id) {
  const dev = WB.dev; let txt;
  if (kind === 'slot') { if (!dev.slots[id].part) return; txt = inspectText(dev, 'slot', id); }
  else if (kind === 'chip') { const ctype = id.split('|')[1]; if (discover(ctype, 2)) { UI.toast('📖', '교과서에 기록됨: ' + PART_TYPES[ctype].name); addXP('knowledge', 3); } txt = inspectText(dev, 'chip', id); }
  else if (kind === 'conn' || kind === 'lci' || kind === 'port') txt = inspectText(dev, kind, id);
  else return;
  if (kind === 'lci') S.flags.lciSeen = true;
  advance(workTime(1)); addXP('diag', 1);
  WB.msg(txt, 'info'); WB.render();
  WB.tk.diagLog.push({ t: S.t, name: '관찰', icon: '🔍', lines: [{ t: txt, c: 'info' }], hints: [] });
  Bus.emit('act', { type: 'inspect', kind, id });
};
WB.installFromTray = function (uid) {
  const dev = WB.dev; const p = dev.tray.find(x => x.uid === uid); if (!p) return;
  const r = canInstall(dev, p);
  if (!r.ok) { WB.msg(r.msg, 'warn'); return; }
  const sd = r.sd;
  const finish = tape => {
    if (tape) S.consum.adhesive--;
    doInstall(dev, p, tape); advance(workTime(2.5, 'assembly'));
    discover(p.type, 3); addXP('assembly', 2);
    const nm = sd.label || nameOf(p.type);
    WB.msg(nm + '을(를) 제자리에 장착했습니다.' + (sd.screws && sd.screws.length ? ' 나사 ' + sd.screws.length + '개를 조여주세요' + (MODELS[dev.modelId].edge.screws && MODELS[dev.modelId].edge.screws.slot === sd.id ? ' (⤵ 아랫면, 충전 포트 양옆).' : '.') : '') + (slotConns(dev, sd.id).length ? ' 커넥터 연결도 잊지 마세요.' : '') + (sd.hinge ? ' 화면은 열린 상태로 장착됩니다. 커넥터를 연결한 뒤 손 도구로 닫으세요.' : ''), 'good');
    WB.vb = null; WB.render(); Bus.emit('act', { type: 'install', sid: sd.id, uid });
  };
  if (sd.adhesive && sd.adhesive.kind !== 'clip' && !sd.hinge && (S.consum.adhesive || 0) > 0) UI.choice('접착 테이프', (sd.adhesive.kind === 'tab' ? '배터리 고정 테이프' : '새 접착 테이프') + '를 붙여서 장착할까요? (재고 ' + S.consum.adhesive + '장)', [['테이프 붙이고 장착', () => finish(true)], ['테이프 없이 장착', () => finish(false)]]);
  else finish(false);
};
WB.trayAction = function (uid, a) {
  const dev = WB.dev; const p = dev.tray.find(x => x.uid === uid); if (!p) return;
  if (a === 'install') return WB.installFromTray(uid);
  if (a === 'inspect') { const t = inspectText(dev, 'part', p); WB.msg(t, 'info'); advance(1); WB.tk.diagLog.push({ t: S.t, name: '관찰(트레이)', icon: '🔍', lines: [{ t, c: 'info' }], hints: [] }); discover(p.type, 2); WB.render(); return; }
  if (a === 'stock') { dev.tray = dev.tray.filter(x => x !== p); S.inv.push(p); WB.msg('부품을 재고로 되돌렸습니다.' + (p.used ? ' (한 번 장착했던 부품이라 반품은 불가)' : ''), ''); WB.render(); return; }
  if (a === 'claim') { const r = claimExchange(p, dev.tray); WB.msg(r.msg, r.ok ? 'good' : 'warn'); UI.toast(r.ok ? '📦' : '❌', r.msg, true); WB.render(); return; }
  if (a === 'clean') {
    advance(30);
    if (p.fault === 'port_corroded') { p.fault = null; WB.msg('초음파 세척 완료! 부식이 깨끗하게 제거되었습니다. 다시 장착할 수 있습니다.', 'good'); addXP('diag', 6); WB.tk.cleaned = true; }
    else WB.msg('세척했지만 특별한 변화는 없습니다.', ''); WB.render();
  }
};
WB.runTest = function (id) {
  const tk = WB.tk; const t = TESTS.find(x => x.id === id);
  advance(workTime(t.min));
  const r = runTest(tk.device, id);
  tk.diagLog.push({ t: S.t, name: t.name, icon: t.icon, lines: r.lines, hints: r.hints, test: id });
  addXP('diag', 2);
  WB.msg(t.name + ' 완료 — 결과는 진단 탭 기록을 확인하세요.', 'info');
  WB.render(); Bus.emit('act', { type: 'test', id });
};
WB.swReinstall = function () {
  const dev = WB.dev; const b = bootState(dev, true);
  if (boardState(dev) !== 'ok' || !(b.ok || b.why === 'bootloop')) return WB.msg('기기에 전원이 들어오지 않아 소프트웨어를 설치할 수 없습니다.', 'warn');
  UI.choice('소프트웨어 재설치', '운영체제를 다시 설치합니다 (40분). 실제 수리에서는 고객 데이터 백업 동의가 필요합니다. 진행할까요?', [['재설치', () => {
    advance(workTime(40));
    if (dev.software) { const n = FAULTS[dev.software].name; dev.software = null; WB.msg('재설치 완료! 소프트웨어 문제(' + n + ')가 해결되었습니다.', 'good'); addXP('diag', 8); WB.tk.swFixed = true; }
    else WB.msg('재설치를 마쳤지만 증상에는 변화가 없을 것 같습니다. (소프트웨어 문제가 아니었음)', 'warn');
    WB.tk.diagLog.push({ t: S.t, name: '소프트웨어 재설치', icon: '💾', lines: [{ t: WB.lastMsg, c: dev.software ? 'warn' : 'ok' }], hints: [] });
    WB.render();
  }], ['취소', () => { }]]);
};
WB.qc = function () {
  const tk = WB.tk; advance(workTime(8));
  const r = qcReport(tk.device);
  const lines = FUNC_KEYS.filter(k => r.ev[k] !== 'na').map(k => ({ t: FUNC_NAMES[k] + ': ' + (funcOK(r.ev[k]) ? '정상' : '이상 — ' + stKo(r.ev[k])), c: funcOK(r.ev[k]) ? 'ok' : 'bad' }));
  const I = r.I;
  if (I.missing.length) lines.unshift({ t: '부품 누락: ' + I.missing.map(s => s.label || nameOf(s.type)).join(', '), c: 'bad' });
  if (I.screws) lines.unshift({ t: '나사 ' + I.screws + '개가 체결되지 않았습니다.', c: 'bad' });
  if (I.conns.length) lines.unshift({ t: '분리된 커넥터: ' + I.conns.map(c => c.label).join(', '), c: 'bad' });
  if (I.open.length) lines.unshift({ t: '화면이 열린 상태입니다.', c: 'bad' });
  if (I.adhesive.length) lines.unshift({ t: '접착 테이프 미부착: ' + I.adhesive.map(s => nameOf(s.type)).join(', ') + ' (반환은 가능하지만 만족도 감소)', c: 'warn' });
  tk.diagLog.push({ t: S.t, name: '최종 기능 점검', icon: '✅', lines, hints: [], qc: true });
  tk.qcPass = r.pass; tk.qcT = S.t;
  if (r.pass && tk.status === 'repairing') tk.status = 'ready';
  if (!r.pass && tk.status === 'ready') tk.status = 'repairing';
  WB.tab = 'diag';
  WB.msg(r.pass ? '🎉 모든 기능 검사를 통과했습니다! 접수대에서 고객에게 반환할 수 있습니다.' : '점검에서 문제가 발견되었습니다. 진단 기록을 확인하세요.', r.pass ? 'good' : 'bad');
  addXP('diag', 3); WB.render(); Bus.emit('act', { type: 'qc', pass: r.pass });
};
WB.flip = function () {
  const dev = WB.dev; if (WB.flipping) return; WB.flipping = true;
  const st = $('#stage'); st.classList.add('flip-out');
  setTimeout(() => {
    dev.view = dev.view === 'bottom' ? (WB.faceView || MODELS[dev.modelId].openSide) : dev.view === 'back' ? 'front' : 'back'; WB.selected = null; WB.vb = null; WB.render();
    st.classList.remove('flip-out'); st.classList.add('flip-in');
    setTimeout(() => { st.classList.remove('flip-in'); WB.flipping = false; }, 260);
    Bus.emit('act', { type: 'flip' });
  }, 240);
};
WB.toEdge = function () {
  const dev = WB.dev; if (WB.flipping) return; WB.flipping = true;
  {
    if (dev.view === 'bottom') dev.view = WB.faceView || MODELS[dev.modelId].openSide;
    else { WB.faceView = dev.view; dev.view = 'bottom'; }
    WB.selected = null; WB.vb = null; WB.render();
    if (MODELS[dev.modelId].cat === 'pad') WB.msg(dev.view === 'bottom' ? '컨트롤러를 세워 윗면(충전 포트·트리거 쪽)을 봅니다. 포트 안쪽은 확대경으로 살펴보고 브러시로 청소할 수 있습니다.' : '다시 눕혔습니다.', 'info'); else
    WB.msg(dev.view === 'bottom' ? '폰을 세워 아랫면을 봅니다. 충전 포트 안쪽은 확대경으로 살펴보고, 브러시로 청소할 수 있습니다.' + (MODELS[dev.modelId].edge.screws ? ' 포트 양옆의 고정 나사는 드라이버로 풉니다.' : '') : '다시 눕혔습니다.', 'info');
    WB.flipping = false;
    Bus.emit('act', { type: 'edge', view: dev.view });
  }
};
WB.fromStock = function () {
  const dev = WB.dev; const m = MODELS[dev.modelId];
  const list = S.inv.slice().sort((a, b) => (b.model === dev.modelId) - (a.model === dev.modelId));
  UI.modal('📦 재고에서 부품 꺼내기', `<p class="hint">${m.name}에 맞는 부품이 위쪽에 표시됩니다. 다른 모델용 부품도 꺼낼 수는 있지만 장착되지 않습니다.</p>
    <div class="pick-list">${list.map(p => `<button class="pick-item ${p.model === dev.modelId ? 'fit' : 'nofit'}" data-uid="${p.uid}">${partThumb(p, 40)}<span><b>${esc(skuName(p.sku))}</b><br><small>${p.origin === 'stock' ? (VENDORS[p.vendor] ? VENDORS[p.vendor].name + ' · ' + p.grade : '') : '회수품'} ${p.used ? '· 사용 이력' : ''} ${p.knownDefect ? '· ⚠ 불량' : ''}</small></span></button>`).join('') || '<div class="empty">재고가 없습니다. 컴퓨터의 부품몰에서 주문하세요.</div>'}</div>`, box => {
    $$('.pick-item', box).forEach(b => b.onclick = () => {
      const p = S.inv.find(x => x.uid === b.dataset.uid); if (!p) return;
      S.inv = S.inv.filter(x => x !== p); dev.tray.push(p); UI.closeModal();
      WB.tab = 'tray'; WB.msg(skuName(p.sku) + '을(를) 트레이로 가져왔습니다. 기기 위로 드래그하거나 "설치"를 누르세요.', 'good'); WB.render();
      Bus.emit('act', { type: 'fromStock', uid: p.uid });
    });
  });
  Bus.emit('act', { type: 'stockView' });
};

/* ---------- 포인터 (팬·줌·핀치·절단·드래그 설치) ---------- */
function svgPoint(svg, cx, cy) { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); }
function distSeg(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; const t = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
WB.hitSeg = function (pt) {
  let hit = null;
  $$('#devSvg .seg:not(.cut)').forEach(l => { const d = distSeg(pt.x, pt.y, +l.getAttribute('x1'), +l.getAttribute('y1'), +l.getAttribute('x2'), +l.getAttribute('y2')); if (d < 18) hit = l.dataset.id; });
  return hit;
};
function initBenchInput() {
  const svg = $('#devSvg'); const ptrs = new Map(); let start = null, pinch = null;
  ['contextmenu', 'selectstart', 'dragstart', 'copy'].forEach(ev => $('#stage').addEventListener(ev, e => e.preventDefault()));
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button === 0) e.preventDefault(); // 텍스트 선택·드래그 방지
    try { svg.setPointerCapture(e.pointerId); } catch (err) { } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { if (start && start.hold && !start.hold.done) start.hold.cancel(); const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...WB.vb } }; start = null; return; }
    const tgt = e.target.closest('[data-kind]');
    start = { x: e.clientX, y: e.clientY, vb: { ...WB.vb }, kind: tgt && tgt.dataset.kind, id: tgt && tgt.dataset.id, moved: false, cutting: WB.tool === 'pick' && $$('#devSvg .seg:not(.cut)').length > 0 };
    if (start.kind === 'screw' && WB.tool === 'driver' && toolUsable('driver')) start.hold = WB.holdScrew(start.id, tgt);
  });
  svg.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const f = pinch.d / d; const v = pinch.vb; const cx = v.x + v.w / 2, cy = v.y + v.h / 2; const nw = clamp(v.w * f, 120, 1400);
      WB.vb = { x: cx - nw / 2, y: cy - v.h * (nw / v.w) / 2, w: nw, h: v.h * (nw / v.w) }; WB.applyVB(); return;
    }
    if (!start) { UI.hoverTip(e); return; }
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (start.hold) { if (Math.hypot(dx, dy) > 14 && !start.hold.done) { start.hold.cancel(); start.hold = null; start.moved = true; WB.msg('드라이버가 나사에서 미끄러졌습니다. 나사 위에서 움직이지 말고 누르고 있으세요.', 'warn'); } return; }
    if (Math.hypot(dx, dy) > 6) start.moved = true;
    if (start.cutting) { const pt = svgPoint(svg, e.clientX, e.clientY); const h = WB.hitSeg(pt); if (h) { WB.cutSeg(h); start.cutting = $$('#devSvg .seg:not(.cut)').length > 0; } return; }
    if (start.moved) { const r = svg.getBoundingClientRect(); const sc = Math.max(start.vb.w / r.width, start.vb.h / r.height); WB.vb = { ...start.vb, x: start.vb.x - dx * sc, y: start.vb.y - dy * sc }; WB.applyVB(); }
  });
  const end = e => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (start && start.hold) { if (!start.hold.done) start.hold.cancel(); start = null; return; }
    if (start && !start.moved && start.kind) WB.click(start.kind, start.id);
    start = null;
  };
  svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if (start && start.hold && !start.hold.done) start.hold.cancel(); start = null; pinch = null; });
  svg.addEventListener('pointerleave', () => UI.hideTip());
  svg.addEventListener('wheel', e => { e.preventDefault(); const pt = svgPoint(svg, e.clientX, e.clientY); WB.zoom(e.deltaY > 0 ? 1.12 : 0.89, pt.x, pt.y); }, { passive: false });
  $('#toolRail').addEventListener('click', e => { const b = e.target.closest('.tool'); if (!b) return; WB.tool = b.dataset.tool; WB.msg(TOOLS[WB.tool].name + ' 선택: ' + TOOLS[WB.tool].desc, 'info'); WB.render(); Bus.emit('act', { type: 'tool', tool: WB.tool }); });
  $('#benchTabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; WB.tab = b.dataset.tab; WB.renderSide(); document.body.classList.add('sheet-open'); Bus.emit('act', { type: 'tab', tab: WB.tab }); });
  $('#benchPanel').addEventListener('click', e => {
    const tb = e.target.closest('.test'); if (tb) return WB.runTest(tb.dataset.test);
    const ab = e.target.closest('.ti-act button'); if (ab) return WB.trayAction(ab.closest('.tray-item').dataset.uid, ab.dataset.a);
    const id = e.target.closest('button') && e.target.closest('button').id;
    if (id === 'btnFromStock') WB.fromStock();
    if (id === 'btnSwReinstall') WB.swReinstall();
    if (id === 'btnQC') WB.qc();
    if (id === 'btnSenior') UI.askSenior(WB.tk);
    if (id === 'btnQuote') UI.openQuote(WB.tk, false);
    if (id === 'btnQuoteAdd') UI.openQuote(WB.tk, true);
    if (id === 'btnBookPart') UI.openBook(mSlot(WB.dev, WB.selected).type);
  });
  // 트레이 → 기기 드래그 설치
  let drag = null;
  $('#benchPanel').addEventListener('pointerdown', e => {
    const it = e.target.closest('.tray-item'); if (!it || e.target.closest('button')) return;
    drag = { uid: it.dataset.uid, x: e.clientX, y: e.clientY, ghost: null };
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) {
      const it = $(`.tray-item[data-uid="${drag.uid}"] .thumb`); drag.ghost = document.createElement('div'); drag.ghost.className = 'drag-ghost'; drag.ghost.innerHTML = it ? it.innerHTML : ''; document.body.appendChild(drag.ghost);
      document.body.classList.remove('sheet-open');
    }
    if (drag.ghost) { drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px'; const r = $('#stage').getBoundingClientRect(); $('#stage').classList.toggle('drop-ok', e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom); }
  });
  window.addEventListener('pointerup', e => {
    if (!drag) return; const d = drag; drag = null;
    if (d.ghost) { d.ghost.remove(); $('#stage').classList.remove('drop-ok'); const r = $('#stage').getBoundingClientRect(); if (e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom) WB.installFromTray(d.uid); }
  });
  $('#btnEdge').onclick = () => WB.toEdge();
  $('#btnFlip').onclick = WB.flip;
  $('#btnZin').onclick = () => WB.zoom(0.8); $('#btnZout').onclick = () => WB.zoom(1.25); $('#btnFit').onclick = WB.fit;
  $('#btnBenchClose').onclick = closeBench;
  $('#btnBenchSwitch').onclick = () => UI.pickBenchTicket(true);
  $('#btnBenchBook').onclick = () => UI.openBook(WB.selected ? mSlot(WB.dev, WB.selected).type : null);
  $('#btnBenchStock').onclick = () => WB.fromStock();
  $('#btnSheet').onclick = () => document.body.classList.toggle('sheet-open');
}
