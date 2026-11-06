'use strict';
/* =========================================================================
   REPAIR MASTER — 업무용 컴퓨터 (부품몰 · 고객관리 · 수리기록 · 재고 · 회계 · 매장)
   ========================================================================= */
const Computer = { app: null, mallTab: 'search', q: '', fModel: '', fType: '', recQ: '' };
const APPS = [
  { id: 'mall', name: '파츠허브', icon: '🛒', title: 'PartsHub — 부품 쇼핑몰' },
  { id: 'crm', name: '고객 관리', icon: '👥', title: 'RepairDesk — 고객·의뢰 관리' },
  { id: 'records', name: '수리 기록', icon: '🗂', title: '수리 기록 검색' },
  { id: 'inv', name: '재고 관리', icon: '📦', title: '재고 관리' },
  { id: 'acct', name: '회계', icon: '💰', title: '회계 장부' },
  { id: 'mgmt', name: '매장·커리어', icon: '🏪', title: '매장 운영 · 직원 성장' },
  { id: 'sys', name: '설정', icon: '⚙', title: '시스템 · 저장 관리' }
];
Computer.open = function (app) {
  UI.show('computer');
  Computer.app = app || null;
  Computer.render();
  Bus.emit('act', { type: 'computer', app });
};
Computer.render = function () {
  const desk = $('#desktop');
  desk.innerHTML = `<div class="icons">${APPS.map(a => `<button class="dicon" data-app="${a.id}"><i>${a.icon}</i><span>${a.name}</span></button>`).join('')}</div>
    <div class="taskbar"><button class="start" id="pcExit">⏻ 컴퓨터 끄기</button><div class="tb-apps">${APPS.map(a => `<button class="${Computer.app === a.id ? 'on' : ''}" data-app="${a.id}">${a.icon}</button>`).join('')}</div><div class="tb-clock">${fmtDay()}<br>${fmtClock()}</div></div>
    ${Computer.app ? `<div class="window"><div class="win-h"><span>${APPS.find(a => a.id === Computer.app).icon} ${APPS.find(a => a.id === Computer.app).title}</span><button class="x" id="winX">✕</button></div><div class="win-b" id="winB"></div></div>` : ''}`;
  $$('[data-app]', desk).forEach(b => b.onclick = () => { Computer.app = b.dataset.app; Computer.render(); Bus.emit('act', { type: 'computer', app: Computer.app }); });
  $('#pcExit').onclick = () => UI.show('shop');
  if (Computer.app) { $('#winX').onclick = () => { Computer.app = null; Computer.render(); }; Computer['app_' + Computer.app]($('#winB')); }
  UI.hud();
};
Computer.refresh = () => { if (UI.screen === 'computer') { const sc = $('#winB') ? $('#winB').scrollTop : 0; Computer.render(); if ($('#winB')) $('#winB').scrollTop = sc; } };

/* ---------- 부품몰 ---------- */
Computer.app_mall = function (el) {
  const cartN = S.cart.reduce((s, c) => s + c.qty, 0);
  const tabs = [['search', '🔎 부품 검색'], ['cart', '🛒 장바구니 ' + (cartN ? '(' + cartN + ')' : '')], ['orders', '🚚 주문·배송'], ['history', '🧾 구매기록·반품'], ['tools', '🛠 장비몰']];
  el.innerHTML = `<div class="browser"><div class="addr"><span>🔒 https://partshub.shop/${Computer.mallTab}</span></div><div class="mall-tabs">${tabs.map(([k, n]) => `<button class="${Computer.mallTab === k ? 'on' : ''}" data-mt="${k}">${n}</button>`).join('')}</div><div class="mall-b" id="mallB"></div></div>`;
  $$('[data-mt]', el).forEach(b => b.onclick = () => { Computer.mallTab = b.dataset.mt; Computer.refresh(); Bus.emit('act', { type: 'mallTab', tab: b.dataset.mt }); });
  const B = $('#mallB', el);
  ({ search: Computer.mallSearch, cart: Computer.mallCart, orders: Computer.mallOrders, history: Computer.mallHistory, tools: Computer.mallTools })[Computer.mallTab](B);
};
Computer.mallSearch = function (B) {
  const types = [...new Set(ALL_SKUS.filter(s => s !== 'adhesive').map(s => slotDef(...s.split(':')).type))];
  B.innerHTML = `<div class="mall-filter"><input id="mq" placeholder="부품 이름 검색 (예: 배터리, 디스플레이)" value="${esc(Computer.q)}"><select id="mm"><option value="">모든 모델</option>${MODEL_IDS.map(m => `<option value="${m}" ${Computer.fModel === m ? 'selected' : ''}>${MODELS[m].name} 호환</option>`).join('')}</select><select id="mtp"><option value="">모든 종류</option>${types.map(t => `<option value="${t}" ${Computer.fType === t ? 'selected' : ''}>${PART_TYPES[t].name}</option>`).join('')}</select></div>
    <div class="vendor-legend">${Object.values(VENDORS).map(v => `<span><i style="background:${v.color}"></i><b>${v.name}</b> ${v.tag} — ${v.desc} · 배송 ${v.days[0]}~${v.days[1]}일 · 배송비 ${WON(shipFee(v.id))}</span>`).join('')}</div><div id="mres" class="mres"></div>`;
  const draw = () => {
    const q = Computer.q.trim();
    const list = ALL_SKUS.filter(sku => {
      if (Computer.fModel && (sku === 'adhesive' || !sku.startsWith(Computer.fModel + ':'))) return false;
      if (Computer.fType && (sku === 'adhesive' || slotDef(...sku.split(':')).type !== Computer.fType)) return false;
      if (q) { const hay = (skuName(sku) + ' ' + (sku === 'adhesive' ? '' : PART_TYPES[slotDef(...sku.split(':')).type].en + ' ' + MODELS[sku.split(':')[0]].code + ' ' + PART_TYPES[slotDef(...sku.split(':')).type].name)).toLowerCase(); if (!q.toLowerCase().split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false; }
      return true;
    });
    $('#mres', B).innerHTML = list.map(sku => {
      const type = sku === 'adhesive' ? null : slotDef(...sku.split(':')).type;
      const mf = marketFactor(sku); const trend = mf > 1.04 ? '<span class="up">▲ 시세 상승</span>' : mf < 0.96 ? '<span class="down">▼ 시세 하락</span>' : '<span class="flat">— 보합</span>';
      const prices = Object.keys(VENDORS).map(v => vendorPrice(sku, v)); const min = Math.min(...prices);
      const have = sku === 'adhesive' ? S.consum.adhesive : S.inv.filter(p => p.sku === sku).length;
      return `<div class="sku"><div class="sku-img">${type ? partIconSVG(type, 64) : '<div class="tape">TAPE</div>'}</div><div class="sku-b"><b>${esc(skuName(sku))}</b> ${trend}<div class="small muted">${type ? '호환: ' + MODELS[sku.split(':')[0]].name + ' 전용 · 부품 코드 ' + MODELS[sku.split(':')[0]].code + '-' + sku.split(':')[1].toUpperCase() : '범용 방수 접착 시트 (모든 모델)'} · 보유 ${have}개</div>
        <table class="offers">${Object.values(VENDORS).map(v => { const p = vendorPrice(sku, v.id), stk = S.vstock[sku + '|' + v.id] || 0; return `<tr><td><i class="vd" style="background:${v.color}"></i>${v.name}</td><td class="${p === min ? 'best' : ''}">${WON(p)}${p === min ? ' 최저' : ''}</td><td>${v.grade}급</td><td>${stk ? '재고 ' + stk : '<span class="bad">품절</span>'}</td><td><button class="btn sm" data-add="${sku}|${v.id}" ${stk ? '' : 'disabled'}>담기</button></td></tr>`; }).join('')}</table></div></div>`;
    }).join('') || '<div class="empty">검색 결과가 없습니다.</div>';
    $$('[data-add]', B).forEach(b => b.onclick = () => {
      const [sku, v] = b.dataset.add.split('|'); const ex = S.cart.find(c => c.sku === sku && c.vendor === v);
      if (ex) ex.qty++; else S.cart.push({ sku, vendor: v, qty: 1 });
      UI.toast('🛒', skuName(sku) + ' (' + VENDORS[v].name + ') 장바구니에 담았습니다.'); Bus.emit('act', { type: 'cartAdd', sku }); Computer.refresh();
    });
  };
  draw();
  $('#mq', B).oninput = e => { Computer.q = e.target.value; draw(); };
  $('#mm', B).onchange = e => { Computer.fModel = e.target.value; draw(); };
  $('#mtp', B).onchange = e => { Computer.fType = e.target.value; draw(); };
};
Computer.mallCart = function (B) {
  if (!S.cart.length) { B.innerHTML = '<div class="empty">장바구니가 비어 있습니다.</div>'; return; }
  const vendors = [...new Set(S.cart.map(c => c.vendor))];
  let sub = 0; S.cart.forEach(c => sub += vendorPrice(c.sku, c.vendor) * c.qty);
  const ship = vendors.reduce((s, v) => s + shipFee(v), 0);
  B.innerHTML = `<table class="tbl"><thead><tr><th>상품</th><th>업체</th><th>단가</th><th>수량</th><th>소계</th><th></th></tr></thead><tbody>${S.cart.map((c, i) => `<tr><td>${esc(skuName(c.sku))}</td><td>${VENDORS[c.vendor].name}</td><td>${WON(vendorPrice(c.sku, c.vendor))}</td><td><button class="btn xs" data-dq="${i}|-1">−</button> ${c.qty} <button class="btn xs" data-dq="${i}|1">＋</button></td><td>${WON(vendorPrice(c.sku, c.vendor) * c.qty)}</td><td><button class="btn xs" data-rm="${i}">삭제</button></td></tr>`).join('')}</tbody></table>
    <div class="cart-sum"><p>상품 합계 ${WON(sub)} · 배송비 ${WON(ship)} (업체 ${vendors.length}곳)</p>${vendors.includes('premium') ? `<label class="chk"><input type="checkbox" id="cEx"> 프로파츠 당일 특급 배송 (+${WON(VENDORS.premium.express)}, 15시 이전 주문 시 3시간 내 도착)</label>` : ''}<h3>결제 예정 <span id="cTot">${WON(sub + ship)}</span></h3><p class="small muted">매장 자금 ${WON(S.money)}</p><button class="btn primary" id="cOrder">주문하기</button></div>`;
  $$('[data-dq]', B).forEach(b => b.onclick = () => { const [i, d] = b.dataset.dq.split('|').map(Number); S.cart[i].qty += d; if (S.cart[i].qty <= 0) S.cart.splice(i, 1); Computer.refresh(); });
  $$('[data-rm]', B).forEach(b => b.onclick = () => { S.cart.splice(+b.dataset.rm, 1); Computer.refresh(); });
  const ex = $('#cEx', B); if (ex) ex.onchange = () => $('#cTot', B).textContent = WON(sub + ship + (ex.checked ? VENDORS.premium.express : 0));
  $('#cOrder', B).onclick = () => { const r = placeOrder(ex && ex.checked); UI.toast(r.ok ? '✅' : '❌', r.msg, true); if (r.ok) { Computer.mallTab = 'orders'; Bus.emit('act', { type: 'order' }); } Computer.refresh(); };
};
Computer.mallOrders = function (B) {
  const list = S.orders.slice().reverse().filter(o => !o.opened).concat(S.orders.slice().reverse().filter(o => o.opened).slice(0, 8));
  B.innerHTML = list.length ? list.map(o => {
    const st = orderStage(o);
    return `<div class="order"><div class="order-h"><b>${o.id}</b> · ${VENDORS[o.vendor].name}${o.express ? ' · 특급' : ''}${o.free ? ' · 교환품' : ''} <span class="muted">주문 ${fmtDT(o.placedT)}</span> <span class="${o.delivered ? 'ok' : ''}">${o.delivered ? (o.opened ? '수령 완료' : '도착 — 택배 공간에서 개봉하세요') : '도착 예정 ' + fmtDT(o.arriveT)}</span></div>
      <div class="track">${ORDER_STAGES.map((n, i) => `<div class="tstep ${i <= st ? 'done' : ''}"><i></i><span>${n}</span></div>`).join('')}</div>
      <div class="small">${o.items.map(i => esc(skuName(i.sku)) + ' ×' + i.qty).join(', ')} · ${WON(o.sub + o.fee)}</div></div>`;
  }).join('') : '<div class="empty">주문 내역이 없습니다.</div>';
};
Computer.mallHistory = function (B) {
  const items = S.inv.filter(p => p.origin === 'stock' && p.vendor);
  B.innerHTML = `<h4>보유 중인 구매 부품 — 반품 / 불량 교환</h4><p class="small muted">미사용 부품은 구매 후 7일 이내 반품 가능(수수료 10%). 불량이 의심되면 교환을 신청하세요. 정상품으로 판정되면 반송비 ₩5,000이 청구됩니다.</p>
    <table class="tbl"><thead><tr><th>부품</th><th>업체·등급</th><th>구매가</th><th>구매일</th><th>상태</th><th></th></tr></thead><tbody>${items.map(p => `<tr><td>${esc(skuName(p.sku))}</td><td>${VENDORS[p.vendor].name} ${p.grade}</td><td>${WON(p.cost)}</td><td>${p.boughtT < 0 ? '초기 재고' : fmtDT(p.boughtT)}</td><td>${p.used ? '사용 이력' : '미사용'}${p.knownDefect ? ' · <b class="bad">불량 확인</b>' : ''}${p.exchangeChecked ? ' · 검수 정상' : ''}</td><td><button class="btn xs" data-ret="${p.uid}">반품</button> <button class="btn xs" data-ex="${p.uid}">불량 교환</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">구매한 부품이 없습니다.</td></tr>'}</tbody></table>
    <h4>최근 구매 기록</h4><table class="tbl"><tbody>${S.orders.slice(-15).reverse().map(o => `<tr><td>${o.id}</td><td>${fmtDT(o.placedT)}</td><td>${VENDORS[o.vendor].name}</td><td>${o.items.map(i => esc(skuName(i.sku)) + '×' + i.qty).join(', ')}</td><td>${WON(o.sub + o.fee)}</td></tr>`).join('')}</tbody></table>`;
  $$('[data-ret]', B).forEach(b => b.onclick = () => { const r = returnItem(b.dataset.ret); UI.toast(r.ok ? '↩' : '❌', r.msg, true); Computer.refresh(); });
  $$('[data-ex]', B).forEach(b => b.onclick = () => { const p = S.inv.find(x => x.uid === b.dataset.ex); const r = claimExchange(p, S.inv); UI.toast(r.ok ? '📦' : '❌', r.msg, true); Computer.refresh(); });
};
Computer.mallTools = function (B) {
  const buyable = Object.entries(TOOLS).filter(([k, t]) => t.price);
  B.innerHTML = `<p class="hint">장비는 단순 장식이 아닙니다. 구입하면 작업대의 조작 방식과 진단 결과가 실제로 달라집니다.</p><div class="tool-grid">${buyable.map(([k, t]) => `<div class="tcard ${S.tools[k] ? 'owned' : ''}"><h4>${esc(t.name)}</h4><p>${esc(t.desc)}</p><p><b>${WON(t.price)}</b></p>${S.tools[k] ? '<span class="tag ok">보유 중</span>' : `<button class="btn primary sm" data-buy="${k}">구입</button>`}</div>`).join('')}
    <div class="tcard"><h4>플라스틱 스퍼저 (새 제품)</h4><p>현재 내구도 ${S.tools.spudger}/80. 커넥터를 다룰 때마다 닳습니다.</p><p><b>₩6,000</b></p><button class="btn sm" data-ref="spudger">교체 구입</button></div>
    <div class="tcard"><h4>오프닝 픽 세트 (새 제품)</h4><p>현재 내구도 ${S.tools.pick}/40. 접착면 절단·클립 해제 시 닳습니다.</p><p><b>₩8,000</b></p><button class="btn sm" data-ref="pick">교체 구입</button></div></div>`;
  $$('[data-buy]', B).forEach(b => b.onclick = () => { const r = buyTool(b.dataset.buy); UI.toast(r.ok ? '🛠' : '❌', r.msg, true); Computer.refresh(); });
  $$('[data-ref]', B).forEach(b => b.onclick = () => { const r = refillTool(b.dataset.ref); UI.toast(r.ok ? '🛠' : '❌', r.msg); Computer.refresh(); });
};

/* ---------- 고객 관리 ---------- */
Computer.app_crm = function (el) {
  el.innerHTML = `<p>대기 손님 ${S.queue.length}명 · 진행 중 의뢰 ${S.tickets.length}/${shelfCap()}건 · 오늘 남은 예약 방문 ${S.arrivals.length}명(예상)</p>
    <table class="tbl"><thead><tr><th>접수번호</th><th>고객</th><th>모델</th><th>증상</th><th>상태</th><th>기한</th><th>견적</th><th></th></tr></thead><tbody>${S.tickets.map(t => `<tr><td>${t.id}${t.warranty ? ' <span class="tag warn">보증</span>' : ''}</td><td>${esc(t.cust.name)}</td><td>${MODELS[t.modelId].name}</td><td class="small">${esc(t.complaint.slice(0, 40))}…</td><td><span class="st st-${t.status}">${UI.statusName(t.status)}</span></td><td class="${t.deadlineT < S.t ? 'bad' : ''}">${fmtDT(t.deadlineT)}</td><td>${t.quote ? WON(t.quote.total) : '-'}</td><td><button class="btn xs" data-bench="${t.id}">작업대로</button>${t.status === 'diagnosing' ? ` <button class="btn xs" data-q="${t.id}">견적</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">진행 중인 의뢰가 없습니다.</td></tr>'}</tbody></table>`;
  $$('[data-bench]', el).forEach(b => b.onclick = () => openBench(b.dataset.bench));
  $$('[data-q]', el).forEach(b => b.onclick = () => UI.openQuote(S.tickets.find(t => t.id === b.dataset.q), false));
};

/* ---------- 수리 기록 ---------- */
Computer.app_records = function (el) {
  el.innerHTML = `<div class="mall-filter"><input id="rq" placeholder="고객 이름, 모델, 증상, 접수번호로 검색" value="${esc(Computer.recQ)}"></div><div id="rlist"></div>`;
  const draw = () => {
    const q = Computer.recQ.trim();
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = S.records.filter(r => { const hay = [r.id, r.name, r.model, r.complaint, r.truth, r.result, r.replaced || '', r.diagnosis || ''].join(' ').toLowerCase(); return words.every(w => hay.includes(w)); });
    $('#rlist', el).innerHTML = list.length ? list.map(r => `<details class="rec"><summary><b>${r.id}</b> ${esc(r.name)} · ${esc(r.model)} · <span class="${r.result === '수리 완료' ? 'ok' : 'bad'}">${r.result}</span> · ${WON(r.paid)} · <span class="stars">${UI.stars(r.sat)}</span> <span class="muted">${fmtDT(r.t)}</span></summary>
      <table class="kv"><tr><td>고장 증상</td><td>${esc(r.complaint)}</td></tr><tr><td>견적(진단)</td><td>${esc(r.diagnosis)}</td></tr><tr><td>실제 원인</td><td>${esc(r.truth)}</td></tr><tr><td>교체 부품</td><td>${esc(r.replaced)}</td></tr><tr><td>부품 원가</td><td>${WON(r.partsCost)}</td></tr><tr><td>청구 수리비</td><td>${WON(r.paid)}</td></tr><tr><td>작업 시간</td><td>${r.workMin}분</td></tr><tr><td>보증 기간</td><td>${r.warrantyUntil ? fmtDT(r.warrantyUntil) + '까지' : '-'}</td></tr><tr><td>피드백</td><td>${r.feedback.map(esc).join('<br>')}</td></tr></table></details>`).join('') : '<div class="empty">수리 기록이 없습니다.</div>';
  };
  draw(); $('#rq', el).oninput = e => { Computer.recQ = e.target.value; draw(); };
};

/* ---------- 재고 관리 ---------- */
Computer.app_inv = function (el) {
  const groups = {}; S.inv.forEach(p => (groups[p.sku] = groups[p.sku] || []).push(p));
  const skus = [...new Set([...Object.keys(groups), ...Object.keys(S.minStock).filter(s => s !== 'adhesive' && S.minStock[s] > 0)])].sort();
  const low = UI.lowStock();
  el.innerHTML = `${low.length ? `<div class="alert">⚠ 재고 부족: ${low.map(s => esc(skuName(s))).join(', ')}</div>` : ''}
    <p class="small muted">최소 수량을 정해두면 부족할 때 알림이 뜹니다.${S.upgrades.autoorder ? ' <b>자동 발주 활성화됨</b> — 영업 종료 시 부품나라에 자동 주문합니다.' : ' (자동 발주는 매장 업그레이드로 해금)'}</p>
    <table class="tbl"><thead><tr><th></th><th>부품</th><th>부품 코드</th><th>호환 모델</th><th>수량</th><th>평균 원가</th><th>공급업체·등급</th><th>최소 수량</th></tr></thead><tbody>
    <tr><td><div class="tape sm">TAPE</div></td><td>접착 테이프 시트</td><td>ADH-UNI</td><td>전 모델</td><td><b>${S.consum.adhesive}</b></td><td>₩3,000</td><td>소모품</td><td><input type="number" min="0" class="minin" data-min="adhesive" value="${S.minStock.adhesive || 0}"></td></tr>
    ${skus.map(sku => { const g = groups[sku] || []; const [m, sl] = sku.split(':'); const avg = g.length ? g.reduce((s, p) => s + (p.cost || 0), 0) / g.length : 0; return `<tr class="${low.includes(sku) ? 'lowrow' : ''}"><td>${partIconSVG(slotDef(m, sl).type, 32)}</td><td>${esc(skuName(sku))}</td><td>${MODELS[m].code}-${sl.toUpperCase()}</td><td>${MODELS[m].name}</td><td><b>${g.length}</b></td><td>${g.length ? WON(avg) : '-'}</td><td class="small">${[...new Set(g.map(p => (VENDORS[p.vendor] ? VENDORS[p.vendor].name : '회수품') + ' ' + p.grade + (p.knownDefect ? '(불량)' : '') + (p.used ? '(사용)' : '')))].join(', ')}</td><td><input type="number" min="0" class="minin" data-min="${sku}" value="${S.minStock[sku] || 0}"></td></tr>`; }).join('')}</tbody></table>
    <h4>회수 부품함 (고객 기기에서 떼어낸 부품) — ${S.scrap.length}개</h4><p class="small muted">정상일 수도, 고장일 수도 있는 부품입니다. 친환경 폐기 업체에 넘기면 개당 ₩500을 받습니다.</p>
    <div class="scrap">${S.scrap.slice(-30).map(p => `<span class="tag">${esc(PART_TYPES[p.type].name)} (${MODELS[p.model].name})</span>`).join(' ') || '<span class="muted">비어 있음</span>'}</div>${S.scrap.length ? '<button class="btn sm" id="scrapAll">회수 부품 일괄 폐기 처리</button>' : ''}`;
  $$('.minin', el).forEach(i => i.onchange = () => { S.minStock[i.dataset.min] = Math.max(0, +i.value || 0); saveSoon(); UI.hud(); });
  const sa = $('#scrapAll', el); if (sa) sa.onclick = () => { const n = S.scrap.length; S.scrap = []; earn(n * 500, '폐부품 처리', '회수 부품 ' + n + '개'); Computer.refresh(); };
};

/* ---------- 회계 ---------- */
Computer.app_acct = function (el) {
  const cats = {}; S.ledger.forEach(l => { cats[l.cat] = (cats[l.cat] || 0) + l.amt; });
  const hist = S.history.slice(-14);
  const maxV = Math.max(1, ...hist.map(h => Math.max(h.rev, h.exp)));
  const bars = hist.map((h, i) => `<g transform="translate(${30 + i * 44} 0)"><rect x="0" y="${150 - h.rev / maxV * 130}" width="16" height="${h.rev / maxV * 130}" fill="#2fbf71"/><rect x="18" y="${150 - h.exp / maxV * 130}" width="16" height="${h.exp / maxV * 130}" fill="#e0703a"/><text x="17" y="166" font-size="10" fill="#9aa" text-anchor="middle">${h.day}일</text></g>`).join('');
  el.innerHTML = `<div class="acct-top"><div class="kpi"><span>매장 자금</span><b class="${S.money < 0 ? 'bad' : ''}">${WON(S.money)}</b></div><div class="kpi"><span>오늘 매출</span><b class="ok">${WON(S.dayLog.rev)}</b></div><div class="kpi"><span>오늘 지출</span><b>${WON(S.dayLog.exp)}</b></div><div class="kpi"><span>내 급여 누적</span><b>${WON(S.savings)}</b></div></div>
    <h4>일별 매출(초록)·지출(주황)</h4>${hist.length ? `<svg viewBox="0 0 ${40 + hist.length * 44} 175" class="chart">${bars}<line x1="20" y1="150" x2="${30 + hist.length * 44}" y2="150" stroke="#555"/></svg>` : '<p class="muted">영업을 하루 마감하면 그래프가 표시됩니다.</p>'}
    <h4>항목별 합계</h4><table class="tbl"><tbody>${Object.entries(cats).map(([c, v]) => `<tr><td>${esc(c)}</td><td class="${v >= 0 ? 'ok' : 'bad'}">${WON(v)}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">고정비: 임대료 주 ₩250,000 · 선임 급여 주 ₩300,000 · 내 급여 주 ₩200,000 · 전기요금 일 ₩6,000~ (7일마다 정산)</p>
    <h4>최근 거래 내역</h4><table class="tbl"><thead><tr><th>일시</th><th>항목</th><th>내용</th><th>금액</th></tr></thead><tbody>${S.ledger.slice(-60).reverse().map(l => `<tr><td>${fmtDT(l.t)}</td><td>${esc(l.cat)}</td><td class="small">${esc(l.memo)}</td><td class="${l.amt >= 0 ? 'ok' : 'bad'}">${WON(l.amt)}</td></tr>`).join('')}</tbody></table>`;
};

/* ---------- 매장·커리어 ---------- */
Computer.app_mgmt = function (el) {
  const lv = playerLv();
  el.innerHTML = `<div class="career"><div class="kpi"><span>직급</span><b>${rankName()} · Lv${lv}</b><i class="xpbar wide"><b style="width:${(lvProgress() * 100).toFixed(0)}%"></b></i><small>총 경험치 ${Math.round(S.xp)}</small></div><div class="kpi"><span>평판</span><b><span class="stars">${UI.stars(S.rep)}</span> ${S.rep.toFixed(2)}</b></div></div>
    <h4>직원 성장 분야</h4><div class="skills">${Object.entries(SKILLS).map(([k, s]) => { const l = skillLv(k); const a = l * l * 25, b = (l + 1) * (l + 1) * 25; const p = l >= 10 ? 1 : (S.skills[k] - a) / (b - a); return `<div class="skill"><div><b>${s.name}</b> <span>Lv${l}</span></div><i class="xpbar wide"><b style="width:${(p * 100).toFixed(0)}%"></b></i><small>${esc(s.desc)}</small></div>`; }).join('')}</div>
    <h4>취급 기기 단계</h4><table class="tbl"><tbody>${DEVICE_TIERS.map((t, i) => `<tr><td>${i + 1}단계</td><td>${t.devices}</td><td>Lv${t.lv} 해금</td><td>${lv >= t.lv ? (t.implemented ? '<span class="tag ok">취급 중</span>' : '<span class="tag warn">해금됨 · 콘텐츠 준비 중 (현재 버전 미구현)</span>') : '<span class="tag">잠김</span>'}</td></tr>`).join('')}</tbody></table>
    <h4>매장 업그레이드</h4><div class="tool-grid">${Object.entries(UPGRADES).map(([k, u]) => `<div class="tcard ${S.upgrades[k] ? 'owned' : ''}"><h4>${esc(u.name)}</h4><p>${esc(u.desc)}</p>${u.req ? `<p class="small">조건: ${Object.entries(u.req).map(([s, l]) => SKILLS[s].name + ' Lv' + l).join(', ')}</p>` : ''}<p><b>${WON(u.price)}</b></p>${S.upgrades[k] ? '<span class="tag ok">설치됨</span>' : `<button class="btn primary sm" data-up="${k}">구입</button>`}</div>`).join('')}</div>
    <p class="small muted">※ 직접 수리점을 인수해 대형 수리센터로 키우는 기능은 향후 확장 예정이며 현재 버전에는 구현되어 있지 않습니다.</p>`;
  $$('[data-up]', el).forEach(b => b.onclick = () => { const r = buyUpgrade(b.dataset.up); UI.toast(r.ok ? '🏪' : '❌', r.msg, true); Computer.refresh(); });
};

/* ---------- 설정 ---------- */
Computer.app_sys = function (el) {
  el.innerHTML = `<h4>저장</h4><p class="small">게임은 행동할 때마다 브라우저(localStorage)에 자동 저장됩니다.</p>
    <div class="row"><button class="btn" id="sxSave">💾 지금 저장</button><button class="btn" id="sxExp">⬇ 세이브 내보내기 (.json)</button><label class="btn">⬆ 세이브 가져오기<input type="file" id="sxImp" accept=".json,application/json" hidden></label></div>
    <h4>튜토리얼</h4><div class="row"><button class="btn" id="sxGuide">📘 튜토리얼 가이드 다시 보기</button><button class="btn" id="sxPractice">🧑‍🔧 연습 의뢰 받기 (선임 안내 포함)</button></div>
    <h4>초기화</h4><button class="btn danger" id="sxReset">⚠ 새 게임 시작 (현재 진행 삭제)</button>
    <h4>구현 범위 안내</h4><ul class="small"><li>구현됨: 스마트폰 3종(노바 X12·픽시스 S3·루멘 A5) 분해·조립·진단, 교과서, 부품몰·배송·재고, 접수·견적·반환, 경제·성장, 저장.</li><li>미구현(향후): 태블릿·노트북 등 2단계 이후 기기, 직원 고용, 수리점 인수·확장.</li></ul>`;
  $('#sxSave', el).onclick = () => { save(); UI.toast('💾', '저장했습니다.'); };
  $('#sxExp', el).onclick = () => { const blob = new Blob([exportSave()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'repair-master-save-day' + (dayIdx() + 1) + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  $('#sxImp', el).onchange = e => { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { importSave(t); UI.toast('✅', '세이브를 불러왔습니다.'); UI.show('shop'); TUT.render(); } catch (err) { UI.alert('불러오기 실패', err.message); } }); };
  $('#sxGuide', el).onclick = () => TUT.guide();
  $('#sxPractice', el).onclick = () => TUT.practice();
  $('#sxReset', el).onclick = () => UI.choice('새 게임', '정말 현재 진행 상황을 지우고 새로 시작할까요?', [['새로 시작', () => { localStorage.removeItem(SAVE_KEY); newGame(); UI.show('shop'); TUT.render(); }], ['취소', () => { }]]);
};
