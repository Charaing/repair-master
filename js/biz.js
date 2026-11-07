'use strict';
/* =========================================================================
   REPAIR MASTER — 매장 확장: 손님 리뷰 · 알바 · 가상 증권/코인 · 뉴스 · 이사
   (모든 회사·코인·뉴스는 게임 속 가상 데이터입니다)
   ========================================================================= */

/* ---------- 매장 위치 (이사) ---------- */
const SHOP_LOCS = [
  { name: '골목 수리점', area: '주택가 골목 1층', rent: 250000, cust: 0, budget: 1, shelf: 0, price: 0, rep: 0, wall: ['#3b4048', '#4c535c'], desc: '처음 시작한 작은 가게. 동네 손님 위주로 찾아온다.' },
  { name: '역세권 상가 수리점', area: '지하철역 앞 상가 1층', rent: 450000, cust: 1, budget: 1.08, shelf: 2, price: 3000000, rep: 3.2, wall: ['#34485a', '#46607a'], desc: '유동 인구가 많다. 하루 손님 +1명, 손님 예산 +8%, 수리 선반 +2칸.' },
  { name: '번화가 대로변 매장', area: '번화가 대로변 단독 매장', rent: 800000, cust: 2, budget: 1.18, shelf: 4, price: 8000000, rep: 3.8, wall: ['#3d3552', '#584a78'], desc: '눈에 잘 띄는 큰 매장. 하루 손님 +2명, 손님 예산 +18%, 수리 선반 +4칸.' },
  { name: '리페어마스터 수리센터', area: '도심 빌딩 1층 대형 센터', rent: 1500000, cust: 4, budget: 1.3, shelf: 7, price: 20000000, rep: 4.3, wall: ['#2f4a40', '#3f6a5a'], desc: '지역 대표 수리센터. 하루 손님 +4명, 손님 예산 +30%, 수리 선반 +7칸.' }
];
function shopLoc() { return SHOP_LOCS[S.shopLv || 0]; }
function moveShop(lv) {
  const L = SHOP_LOCS[lv];
  if (!L || lv <= (S.shopLv || 0)) return { ok: false, msg: '지금보다 더 좋은 곳으로만 이사할 수 있습니다.' };
  if (lv > (S.shopLv || 0) + 1) return { ok: false, msg: '한 단계씩 차례로 옮겨야 합니다.' };
  if (S.rep < L.rep) return { ok: false, msg: '평판 ' + L.rep.toFixed(1) + ' 이상이어야 건물주가 계약해 줍니다.' };
  if (S.money < L.price) return { ok: false, msg: '자금이 부족합니다. (필요 ' + WON(L.price) + ')' };
  pay(L.price, '이사·인테리어', L.name + ' 보증금·인테리어·이사 비용');
  S.shopLv = lv;
  advance(120, '이사');
  addXP('biz', 40);
  return { ok: true, msg: '🎉 ' + L.name + '(으)로 이사했습니다! 주간 임대료는 ' + WON(L.rent) + '입니다.' };
}

/* ---------- 손님 리뷰 ---------- */
const REVIEW_TXT = {
  5: ['정말 친절하고 꼼꼼하게 고쳐주셨어요. 강력 추천합니다!', '다른 데서 못 고친다던 걸 여기서 고쳤어요 👍', '설명도 자세히 해주시고 가격도 합리적이에요.', '맡긴 날 바로 고쳐주셨어요. 단골 될게요!', '새 기기처럼 깔끔하게 돌아왔어요.'],
  4: ['잘 고쳐주셨어요. 조금 기다리긴 했지만 만족합니다.', '친절하세요. 가격은 살짝 있는 편이에요.', '수리 잘 됐어요. 다음에도 올게요.', '설명이 친절해서 믿음이 갔어요.'],
  3: ['고쳐지긴 했는데 생각보다 오래 걸렸어요.', '그냥 무난했어요.', '가격이 조금 비싼 느낌이에요.'],
  2: ['수리는 됐는데 마감이 좀 아쉬워요.', '응대가 조금 아쉬웠어요.', '기대했던 것보다는 별로였어요.'],
  1: ['고쳐준다더니 그대로예요. 비추합니다.', '맡기기 전보다 더 이상해졌어요…', '다시는 안 갈 것 같아요.']
};
const maskName = n => n ? n[0] + '*'.repeat(Math.max(1, n.length - 1)) : '익명';
function addReview(rec, tk) {
  S.reviews = S.reviews || [];
  if (!R.chance(tk.tutorial ? 1 : 0.7)) return null;
  const stars = clamp(Math.round(rec.sat), 1, 5);
  let text = R.pick(REVIEW_TXT[stars]);
  const extra = [];
  const late = rec.feedback.find(f => f.startsWith('⏰'));
  if (late) extra.push('약속한 날짜보다 늦게 받았어요.');
  if (rec.feedback.some(f => f.includes('나사'))) extra.push('뒷판이 살짝 덜그럭거려요.');
  if (rec.result.includes('거절')) { text = stars >= 3 ? '견적이 생각보다 비싸서 수리는 안 했어요. 그래도 기기는 그대로 잘 돌려주셨어요.' : '수리 안 하고 돌려받았는데 상태가 이상해요.'; }
  if (rec.warranty) extra.push('보증 수리로 다시 봐주셨어요.');
  const rv = { id: 'RV' + (S.uid++), t: S.t, name: maskName(rec.name), model: rec.model, stars, text: [text].concat(extra).join(' '), reply: null, recId: rec.id };
  S.reviews.unshift(rv);
  if (S.reviews.length > 120) S.reviews.length = 120;
  Bus.emit('toast', { icon: '⭐', text: '새 리뷰가 달렸습니다: ' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + ' "' + rv.text.slice(0, 26) + (rv.text.length > 26 ? '…' : '') + '"' });
  return rv;
}
function reviewStats() {
  const list = (S.reviews || []).slice(0, 40);
  const avg = list.length ? list.reduce((s, r) => s + r.stars, 0) / list.length : 0;
  const dist = [5, 4, 3, 2, 1].map(n => (S.reviews || []).filter(r => r.stars === n).length);
  return { n: (S.reviews || []).length, avg, dist };
}
/* 리뷰 평점이 손님 수에 주는 영향 (최근 리뷰 5개 이상일 때) */
function reviewCustBonus() { const r = reviewStats(); if (r.n < 5) return 0; return r.avg >= 4.5 ? 1 : r.avg < 2.5 ? -1 : 0; }
const REVIEW_REPLIES = {
  thanks: '소중한 리뷰 감사합니다! 다음에도 꼼꼼하게 수리해 드리겠습니다. 🙂',
  sorry: '불편을 드려 정말 죄송합니다. 다시 방문해 주시면 무상으로 점검해 드리겠습니다.',
  explain: '말씀 감사합니다. 부품 수급과 작업 과정을 더 자세히 안내드리도록 개선하겠습니다.'
};
function replyReview(id, kind) {
  const rv = (S.reviews || []).find(r => r.id === id); if (!rv || rv.reply) return { ok: false, msg: '이미 답글을 달았습니다.' };
  rv.reply = { kind, text: REVIEW_REPLIES[kind], t: S.t };
  addXP('consult', 2);
  let msg = '답글을 달았습니다.';
  if (rv.stars <= 2 && kind !== 'thanks') { S.rep = clamp(S.rep + 0.03, 0, 5); msg += ' 정중한 사과 답글을 본 사람들이 좋게 봤습니다. (평판 소폭 상승)'; }
  if (rv.stars <= 2 && kind === 'thanks') { S.rep = clamp(S.rep - 0.02, 0, 5); msg += ' 불만 리뷰에 "감사합니다"만 달아서 오히려 반응이 나쁩니다. (평판 소폭 하락)'; }
  advance(2, '리뷰 답글');
  return { ok: true, msg };
}

/* ---------- 알바 ---------- */
const ALBA = {
  seoyun: { name: '한서윤', avatar: '👩‍🎓', wage: 150000, desc: '꼼꼼한 대학생. 부품 주문과 택배 정리를 맡길 수 있어요.', tasks: ['autobuy', 'reqbuy', 'unbox'] },
  taehyun: { name: '오태현', avatar: '🧑‍💼', wage: 120000, desc: '말을 잘하는 휴학생. 카운터에서 손님을 응대하고 택배도 정리해요.', tasks: ['greet', 'unbox'] }
};
const ALBA_TASKS = {
  autobuy: { name: '최소 재고 자동 구매', desc: '재고 관리에서 정한 최소 수량보다 부족한 부품을 13시·마감 때 주문' },
  reqbuy: { name: '의뢰 부품 자동 주문', desc: '견적이 승인된 의뢰에 필요한 교체 부품이 재고에 없으면 바로 주문' },
  unbox: { name: '택배 자동 개봉·입고', desc: '도착한 택배를 바로 열어 재고에 넣음 (불량 검수 포함)' },
  greet: { name: '손님 응대', desc: '기다리는 손님에게 차를 내드려 손님이 2시간 더 기다림' }
};
function staffState() { S.staff = S.staff || { hired: {}, vendor: 'normal', cap: 300000 }; S.staff.hired = S.staff.hired || {}; return S.staff; }
function albaDoes(task) { if (!S || (S.tut.active && !S.tut.done)) return false; const st = staffState(); return Object.values(st.hired).some(h => h.tasks && h.tasks[task]); }
function hireAlba(id) {
  const st = staffState(); const a = ALBA[id];
  if (st.hired[id]) return { ok: false, msg: '이미 일하고 있습니다.' };
  st.hired[id] = { since: S.t, tasks: Object.fromEntries(a.tasks.map(t => [t, true])) };
  return { ok: true, msg: a.name + ' 님을 고용했습니다. 급여는 하루 ' + WON(Math.round(a.wage / 7)) + '씩 마감 때 나갑니다.' };
}
function fireAlba(id) { const st = staffState(); if (!st.hired[id]) return { ok: false, msg: '고용 중이 아닙니다.' }; delete st.hired[id]; return { ok: true, msg: ALBA[id].name + ' 님과의 계약을 끝냈습니다.' }; }
function albaWages() { const st = staffState(); return Object.keys(st.hired).reduce((s, id) => s + Math.round(ALBA[id].wage / 7), 0); }
const pendingQty = sku => S.orders.filter(o => !o.opened).reduce((s, o) => s + o.items.filter(i => i.sku === sku).reduce((a, i) => a + i.qty, 0), 0);
const stockQty = sku => sku === 'adhesive' ? (S.consum.adhesive || 0) : S.inv.filter(p => p.sku === sku && !p.knownDefect).length;
/* 알바 자동 구매: 필요한 부품 목록을 만들고, 선호 업체 → 다른 업체 순으로 재고를 찾아 주문 */
function albaBuyRun() {
  const st = staffState(); const want = {};
  if (albaDoes('autobuy')) Object.entries(S.minStock).forEach(([sku, min]) => { const n = min - stockQty(sku) - pendingQty(sku); if (n > 0) want[sku] = (want[sku] || 0) + n; });
  const tkNeed = {}; const tkMark = [];
  if (albaDoes('reqbuy')) S.tickets.forEach(tk => {
    if (tk.status !== 'repairing' || !tk.quote) return;
    tk.albaBought = tk.albaBought || {};
    tk.quote.lines.forEach(l => {
      const sd = slotDef(tk.modelId, l.key); if (!sd || tk.albaBought[l.key]) return;
      const cur = partOf(tk.device, l.key); if (cur && cur.origin === 'stock') return; // 이미 새 부품 장착
      const sku = skuOf(tk.modelId, l.key);
      tkNeed[sku] = (tkNeed[sku] || 0) + 1; tkMark.push([tk, l.key, sku]);
    });
  });
  Object.entries(tkNeed).forEach(([sku, n]) => { const extra = n - Math.max(0, stockQty(sku) - (S.minStock[sku] || 0)) - pendingQty(sku); if (extra > 0) want[sku] = Math.max(want[sku] || 0, 0) + extra; });
  const skus = Object.keys(want); if (!skus.length) { tkMark.forEach(([tk, key]) => tk.albaBought[key] = true); return null; }
  const order = [st.vendor || 'normal', 'normal', 'premium', 'cheap'].filter((v, i, a) => a.indexOf(v) === i);
  let budget = Math.min(st.cap || 300000, Math.max(0, S.money)); const cart = []; const miss = [];
  skus.forEach(sku => {
    const qty = want[sku];
    const v = order.find(v => (S.vstock[sku + '|' + v] || 0) >= qty);
    if (!v) { miss.push(skuName(sku)); return; }
    const cost = vendorPrice(sku, v) * qty;
    if (cost > budget) { miss.push(skuName(sku) + '(예산 초과)'); return; }
    budget -= cost; cart.push({ sku, vendor: v, qty });
  });
  if (!cart.length) return miss.length ? { msg: '알바: 부품을 주문하지 못했습니다 — ' + miss.join(', ') } : null;
  const saved = S.cart; S.cart = cart; const r = placeOrder(false, true); S.cart = saved;
  if (r.ok) tkMark.forEach(([tk, key, sku]) => { if (cart.some(c => c.sku === sku) || stockQty(sku) > 0) tk.albaBought[key] = true; });
  const names = cart.map(c => skuName(c.sku) + ' ×' + c.qty).join(', ');
  return { msg: '🧑‍🔧 알바 자동 구매: ' + names + (r.ok ? ' — ' + r.msg : ' — 실패: ' + r.msg) + (miss.length ? ' (구하지 못함: ' + miss.join(', ') + ')' : '') };
}
function albaUnbox(o) {
  const out = unbox(o.id, true); const n = out.filter(x => x.p).length;
  const bad = out.filter(x => x.note).length;
  Bus.emit('toast', { icon: '📦', text: '알바가 택배(' + o.id + ')를 열어 부품 ' + n + '개를 입고했습니다.' + (bad ? ' 불량 의심 ' + bad + '개는 재고에 표시해 뒀어요.' : ''), long: !!bad });
}

/* ---------- 가상 증권 · 코인 ---------- */
const ASSETS = [
  { id: 'NOVA', name: '노바전자', kind: 'stock', p0: 52000, vol: 0.022, desc: '노바 스마트폰 제조사' },
  { id: 'PIXS', name: '픽시스모바일', kind: 'stock', p0: 31000, vol: 0.028, desc: '픽시스 스마트폰 제조사' },
  { id: 'PHUB', name: '파츠허브', kind: 'stock', p0: 12800, vol: 0.032, desc: '부품 쇼핑몰 운영사' },
  { id: 'SSAK', name: '새싹반도체', kind: 'stock', p0: 88000, vol: 0.026, desc: '디스플레이·칩 부품 제조' },
  { id: 'KSTR', name: '케스트렐게임즈', kind: 'stock', p0: 24500, vol: 0.036, desc: '게임 컨트롤러·게임 개발사' },
  { id: 'RPC', name: '리페어코인', kind: 'coin', p0: 1200, vol: 0.06, desc: '수리 업계 결제용 코인' },
  { id: 'BOLT', name: '볼트토큰', kind: 'coin', p0: 85, vol: 0.085, desc: '전기차 충전 포인트 토큰' },
  { id: 'MANGO', name: '망고코인', kind: 'coin', p0: 4.2, vol: 0.12, desc: '밈 코인 (변동성 매우 큼)' }
];
const assetOf = id => ASSETS.find(a => a.id === id);
const MKT_STEP = 20; // 게임 시간 20분마다 가격이 움직임
const TRADE_FEE = 0.003;
function mktState() {
  if (!S.mkt || !S.mkt.px) {
    S.mkt = { t: S.t, px: {}, anchor: {}, hist: {}, drift: {}, hold: {}, nextNews: S.t + R.int(40, 120), realized: 0 };
    ASSETS.forEach(a => { const p = a.p0 * R.range(0.9, 1.1); S.mkt.px[a.id] = p; S.mkt.anchor[a.id] = a.p0; S.mkt.hist[a.id] = Array.from({ length: 40 }, () => p); });
    S.news = S.news || [];
  }
  return S.mkt;
}
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function mktStep() {
  const M = S.mkt;
  ASSETS.forEach(a => {
    const id = a.id; let p = M.px[id];
    M.anchor[id] *= Math.exp(gauss() * a.vol * 0.25);
    const d = M.drift[id]; let dr = 0;
    if (d && d.left > 0) { dr = d.v; d.left--; if (!d.left) delete M.drift[id]; }
    const rev = -0.035 * Math.log(p / M.anchor[id]);
    p *= Math.exp(gauss() * a.vol + dr + rev);
    p = Math.max(a.p0 * 0.02, Math.min(a.p0 * 30, p));
    M.px[id] = p;
    const h = M.hist[id]; h.push(p); if (h.length > 90) h.shift();
  });
}
/* 뉴스: 관련 종목 · 방향 · 크기(%) · 부품 시세/손님 수 영향 */
const NEWS_TPL = [
  { a: 'NOVA', dir: 1, mag: [10, 28], t: '노바전자, 신형 플래그십 사전 예약 역대 최다 기록' },
  { a: 'NOVA', dir: -1, mag: [12, 30], t: '노바전자 신제품 발열 논란… 리콜 검토설까지', rumor: true },
  { a: 'NOVA', dir: 1, mag: [8, 20], t: '노바전자 분기 실적 "어닝 서프라이즈"' },
  { a: 'PIXS', dir: 1, mag: [10, 30], t: '픽시스모바일, 해외 대형 통신사와 공급 계약 체결' },
  { a: 'PIXS', dir: -1, mag: [10, 25], t: '픽시스 S 시리즈 화면 줄 불량 신고 잇따라', part: 'display_oled', pmul: 1.12, cust: 1 },
  { a: 'PHUB', dir: 1, mag: [12, 35], t: '파츠허브, 당일 배송 전국 확대 발표' },
  { a: 'PHUB', dir: -1, mag: [15, 35], t: '파츠허브 물류센터 전산 장애… 일부 주문 지연', rumor: true },
  { a: 'SSAK', dir: -1, mag: [10, 25], t: '새싹반도체 디스플레이 공장 정전 사고… 패널 공급 차질 우려', part: 'display_oled', pmul: 1.18 },
  { a: 'SSAK', dir: 1, mag: [10, 26], t: '새싹반도체, 차세대 배터리 셀 양산 성공', part: 'battery', pmul: 0.9 },
  { a: 'SSAK', dir: -1, mag: [8, 20], t: '배터리 원자재 가격 급등… 부품 단가 인상 불가피', part: 'battery', pmul: 1.15 },
  { a: 'KSTR', dir: 1, mag: [15, 40], t: '케스트렐게임즈 신작, 출시 첫날 동시 접속 100만 돌파', cust: 1 },
  { a: 'KSTR', dir: -1, mag: [15, 35], t: '케스트렐 G1 스틱 쏠림 집단 소송 움직임', rumor: true, cust: 1 },
  { a: 'RPC', dir: 1, mag: [25, 80], t: '대형 수리 프랜차이즈, 리페어코인 결제 도입 검토', rumor: true },
  { a: 'RPC', dir: -1, mag: [25, 60], t: '리페어코인 재단 지갑에서 대량 이체 포착… "먹튀" 우려', rumor: true },
  { a: 'BOLT', dir: 1, mag: [30, 90], t: '볼트토큰, 해외 대형 거래소 상장 확정' },
  { a: 'BOLT', dir: -1, mag: [30, 70], t: '볼트토큰 스마트 계약 해킹 피해 발생' },
  { a: 'MANGO', dir: 1, mag: [40, 150], t: '유명 인플루언서 "망고코인 산다" 한마디에 커뮤니티 들썩', rumor: true },
  { a: 'MANGO', dir: -1, mag: [40, 80], t: '망고코인 개발자 SNS 계정 돌연 삭제', rumor: true },
  { a: '*coin', dir: -1, mag: [15, 40], t: '금융 당국, 가상자산 거래 규제 강화 발표' },
  { a: '*coin', dir: 1, mag: [15, 45], t: '가상자산 시장에 대규모 자금 유입… 코인 일제히 강세' },
  { a: '*stock', dir: 1, mag: [5, 14], t: '기준금리 인하… 증시 전반 상승 기대' },
  { a: '*stock', dir: -1, mag: [6, 15], t: '해외 증시 급락 여파… 국내 증시도 출렁' },
  { a: null, t: '장마 시작… 휴대폰 침수 피해 상담 늘어', cust: 2 },
  { a: null, t: '신학기 시즌, 학생 휴대폰 수리 수요 증가', cust: 1 },
  { a: null, t: '충전 단자 부품 품귀 현상… 도매가 들썩', part: 'charge_port', pmul: 1.2 }
];
function genNews() {
  const M = S.mkt; const tpl = R.pick(NEWS_TPL);
  const targets = tpl.a === '*coin' ? ASSETS.filter(a => a.kind === 'coin') : tpl.a === '*stock' ? ASSETS.filter(a => a.kind === 'stock') : tpl.a ? [assetOf(tpl.a)] : [];
  // 소문(~설) 뉴스는 35% 확률로 반대로 움직이거나 흐지부지된다
  let dir = tpl.dir || 0; if (tpl.rumor && R.chance(0.35)) dir = R.chance(0.5) ? -dir : 0;
  targets.forEach(a => {
    const mag = R.range(tpl.mag[0], tpl.mag[1]) / 100 * (tpl.a && tpl.a[0] === '*' ? R.range(0.6, 1.2) : 1);
    if (!dir) return;
    const total = dir > 0 ? Math.log(1 + mag) : Math.log(1 / (1 + mag));
    const now = total * R.range(0.3, 0.5); const n = R.int(3, 7);
    M.px[a.id] *= Math.exp(now); M.hist[a.id].push(M.px[a.id]);
    M.drift[a.id] = { v: (total - now) / n, left: n };
  });
  if (tpl.part && S.market[tpl.part] != null) S.market[tpl.part] = clamp(S.market[tpl.part] * tpl.pmul, 0.7, 1.45);
  if (tpl.cust) { S.flags.newsCust = { d: dayIdx() + (minOfDay() > 15 * 60 ? 1 : 0), n: tpl.cust }; }
  const item = { id: 'N' + (S.uid++), t: S.t, title: tpl.t, assets: targets.map(a => a.id), part: tpl.part || null, cust: tpl.cust || 0 };
  S.news.unshift(item); if (S.news.length > 60) S.news.length = 60;
  Bus.emit('toast', { icon: '📰', text: '속보: ' + tpl.t });
  return item;
}
function mktTick() {
  const M = mktState();
  let steps = Math.floor((S.t - M.t) / MKT_STEP);
  if (steps <= 0) return;
  M.t += steps * MKT_STEP; steps = Math.min(steps, 30);
  for (let i = 0; i < steps; i++) mktStep();
  if (S.t >= M.nextNews) { const m = minOfDay(); if (m >= 7 * 60 && m <= 23 * 60) genNews(); M.nextNews = S.t + R.int(70, 200); }
  if (UI && UI.screen === 'computer' && ['trade', 'news'].includes(Computer.app)) Computer.refresh();
}
function holdValue() { const M = mktState(); return Object.entries(M.hold).reduce((s, [id, h]) => s + h.q * M.px[id], 0); }
function buyAsset(id, amt) {
  const M = mktState(); const a = assetOf(id); const p = M.px[id];
  amt = Math.floor(amt);
  if (!(amt > 0)) return { ok: false, msg: '금액을 입력하세요.' };
  if (amt > S.money) return { ok: false, msg: '매장 자금이 부족합니다.' };
  let q = (amt / (1 + TRADE_FEE)) / p;
  if (a.kind === 'stock') q = Math.floor(q); else q = Math.floor(q * 10000) / 10000;
  if (q <= 0) return { ok: false, msg: a.kind === 'stock' ? '1주 가격(' + fmtPx(p) + ')보다 금액이 적습니다.' : '금액이 너무 적습니다.' };
  const cost = Math.round(q * p * (1 + TRADE_FEE));
  const h = M.hold[id] || (M.hold[id] = { q: 0, cost: 0 });
  h.q += q; h.cost += cost;
  S.money -= cost; addLedger(-cost, '투자', a.name + ' ' + fmtQ(a, q) + ' 매수 @' + fmtPx(p)); Bus.emit('money');
  advance(1, '매수');
  return { ok: true, msg: a.name + ' ' + fmtQ(a, q) + ' 매수 완료 (' + WON(cost) + ', 수수료 포함)' };
}
function sellAsset(id, frac) {
  const M = mktState(); const a = assetOf(id); const h = M.hold[id]; const p = M.px[id];
  if (!h || h.q <= 0) return { ok: false, msg: '보유 수량이 없습니다.' };
  let q = h.q * frac; if (a.kind === 'stock') q = Math.max(1, Math.round(q)); q = Math.min(h.q, q);
  const got = Math.round(q * p * (1 - TRADE_FEE)); const basis = h.cost * (q / h.q);
  h.cost -= basis; h.q -= q; if (h.q < 1e-6) delete M.hold[id];
  M.realized = (M.realized || 0) + (got - basis);
  S.money += got; addLedger(got, '투자', a.name + ' ' + fmtQ(a, q) + ' 매도 @' + fmtPx(p) + ' (손익 ' + WON(Math.round(got - basis)) + ')'); Bus.emit('money');
  advance(1, '매도');
  return { ok: true, msg: a.name + ' ' + fmtQ(a, q) + ' 매도: ' + WON(got) + ' 입금 (손익 ' + WON(Math.round(got - basis)) + ')' };
}
function fmtPx(p) { return p >= 1000 ? '₩' + Math.round(p).toLocaleString('ko-KR') : p >= 10 ? '₩' + p.toFixed(1) : '₩' + p.toFixed(3); }
function fmtQ(a, q) { return a.kind === 'stock' ? Math.round(q) + '주' : (+q.toFixed(4)).toLocaleString('ko-KR') + '개'; }

/* ---------- 시간 흐름 훅 (processTime에서 호출) ---------- */
function bizTick() {
  if (!S) return;
  mktTick();
  // 알바: 도착한 택배 자동 개봉
  if (albaDoes('unbox')) S.orders.forEach(o => { if (o.delivered && !o.opened) albaUnbox(o); });
  // 알바: 13시 자동 구매 (하루 한 번), 견적 승인 의뢰 부품은 수시로
  const d = dayIdx(), m = minOfDay();
  if (albaDoes('autobuy') && m >= 13 * 60 && m < CLOSE && S.flags.albaNoon !== d) { S.flags.albaNoon = d; const r = albaBuyRun(); if (r) Bus.emit('toast', { icon: '🧑‍🔧', text: r.msg, long: true }); }
  else if (albaDoes('reqbuy') && m >= OPEN && m < CLOSE && S.tickets.some(tk => tk.status === 'repairing' && tk.quote && tk.quote.lines.some(l => slotDef(tk.modelId, l.key) && !(tk.albaBought || {})[l.key]))) { const r = albaBuyRun(); if (r) Bus.emit('toast', { icon: '🧑‍🔧', text: r.msg, long: true }); }
}
/* 마감 때: 알바 일급 + 자동 구매 */
function bizEndDay(sum) {
  const w = albaWages();
  if (w) { pay(w, '직원 급여', '알바 일급 (' + Object.keys(staffState().hired).map(id => ALBA[id].name).join(', ') + ')'); sum.notes.push('알바 일급 ' + WON(w) + ' 지급'); }
  if (albaDoes('autobuy') || albaDoes('reqbuy')) { const r = albaBuyRun(); if (r) sum.notes.push(r.msg); }
  const hv = S.mkt ? holdValue() : 0; if (hv) sum.notes.push('📈 투자 평가액 ' + WON(Math.round(hv)));
}
function newsCustBonus(d) { const f = S.flags.newsCust; return f && f.d === d ? f.n : 0; }

/* =========================================================================
   컴퓨터 앱
   ========================================================================= */
APPS.splice(APPS.findIndex(a => a.id === 'bank') + 1, 0,
  { id: 'trade', name: '증권·코인', icon: '📈', title: '새싹증권 MTS — 주식 · 코인 (가상 시장)' },
  { id: 'news', name: '뉴스', icon: '📰', title: '오늘의 경제 뉴스 (가상)' },
  { id: 'reviews', name: '리뷰', icon: '⭐', title: '동네지도 — 우리 가게 리뷰' },
  { id: 'staff', name: '알바', icon: '🧑‍🔧', title: '알바 관리' },
  { id: 'realty', name: '부동산', icon: '🏢', title: '상가 부동산 — 매장 이전' }
);

function sparkSVG(h, w, hh, color) {
  const mn = Math.min(...h), mx = Math.max(...h), r = mx - mn || 1;
  const pts = h.map((v, i) => (i / (h.length - 1) * w).toFixed(1) + ',' + (hh - 2 - (v - mn) / r * (hh - 4)).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" class="spark"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
}
Computer.trSel = 'NOVA';
Computer.app_trade = function (el) {
  const M = mktState(); const sel = assetOf(Computer.trSel) || ASSETS[0];
  const chg = id => { const h = M.hist[id]; const base = h[Math.max(0, h.length - 37)]; return (M.px[id] / base - 1) * 100; };
  const hv = holdValue(); const basis = Object.values(M.hold).reduce((s, h) => s + h.cost, 0);
  const row = a => { const c = chg(a.id); const h = M.hold[a.id]; return `<tr class="tr-row${a.id === sel.id ? ' on' : ''}" data-as="${a.id}"><td><b>${esc(a.name)}</b><br><small class="muted">${a.id} · ${a.kind === 'stock' ? '주식' : '코인'}</small></td><td class="nowrap">${fmtPx(M.px[a.id])}</td><td class="${c >= 0 ? 'up' : 'down'} nowrap">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(1)}%</td><td>${sparkSVG(M.hist[a.id].slice(-37), 90, 26, c >= 0 ? '#d23b2f' : '#1f7ad2')}</td><td class="small">${h ? fmtQ(a, h.q) : ''}</td></tr>`; };
  const h = M.hold[sel.id]; const big = M.hist[sel.id]; const c = chg(sel.id);
  const mn = Math.min(...big), mx = Math.max(...big);
  const rel = (M.news || []).filter(n => n.assets.includes(sel.id)).slice(0, 3);
  el.innerHTML = `<div class="browser"><div class="addr"><span>🔒 https://ssak-sec.kr/mts</span></div><div class="mall-b">
    <div class="acct-top"><div class="kpi"><span>매장 자금</span><b>${WON(S.money)}</b></div><div class="kpi"><span>투자 평가액</span><b>${WON(Math.round(hv))}</b></div><div class="kpi"><span>평가 손익</span><b class="${hv - basis >= 0 ? 'up' : 'down'}">${WON(Math.round(hv - basis))}</b></div><div class="kpi"><span>실현 손익(누적)</span><b class="${(M.realized || 0) >= 0 ? 'up' : 'down'}">${WON(Math.round(M.realized || 0))}</b></div></div>
    <p class="small muted">⚠ 게임 속 가상 시장입니다. 가격은 게임 시간 20분마다 크게 움직이고, 뉴스에 따라 급등·급락합니다. "~설" 같은 소문 뉴스는 틀릴 수도 있어요. 매매 수수료 0.3%. 투자금은 매장 자금에서 나갑니다.</p>
    <div class="trade-wrap"><table class="tbl tr-list"><thead><tr><th>종목</th><th>현재가</th><th>12시간</th><th>추이</th><th>보유</th></tr></thead><tbody>${ASSETS.map(row).join('')}</tbody></table>
    <div class="tr-detail"><h4>${esc(sel.name)} <small class="muted">${sel.id} · ${esc(sel.desc)}</small></h4>
      <div class="tr-price"><b>${fmtPx(M.px[sel.id])}</b> <span class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)}%</span></div>
      <div class="tr-chart">${sparkSVG(big, 420, 150, c >= 0 ? '#d23b2f' : '#1f7ad2')}<div class="small muted">최근 ${Math.round(big.length * MKT_STEP / 60)}시간 · 최고 ${fmtPx(mx)} · 최저 ${fmtPx(mn)}</div></div>
      ${h ? `<p class="small">보유 ${fmtQ(sel, h.q)} · 평균 매수가 ${fmtPx(h.cost / h.q)} · 평가 ${WON(Math.round(h.q * M.px[sel.id]))} <b class="${h.q * M.px[sel.id] - h.cost >= 0 ? 'up' : 'down'}">(${(((h.q * M.px[sel.id]) / h.cost - 1) * 100).toFixed(1)}%)</b></p>` : '<p class="small muted">보유하고 있지 않습니다.</p>'}
      <div class="row tr-buy"><input type="number" id="trAmt" min="0" step="10000" placeholder="매수 금액(원)"><button class="btn sm" data-amt="100000">10만</button><button class="btn sm" data-amt="500000">50만</button><button class="btn sm" data-amt="1000000">100만</button><button class="btn primary sm" id="trBuy">매수</button></div>
      <div class="row tr-sell"><span class="small">매도:</span><button class="btn sm" data-sell=".25" ${h ? '' : 'disabled'}>25%</button><button class="btn sm" data-sell=".5" ${h ? '' : 'disabled'}>50%</button><button class="btn danger sm" data-sell="1" ${h ? '' : 'disabled'}>전량</button></div>
      ${rel.length ? `<h4>관련 뉴스</h4><ul class="news-mini">${rel.map(n => `<li><small class="muted">${fmtDT(n.t)}</small> ${esc(n.title)}</li>`).join('')}</ul>` : ''}
    </div></div></div></div>`;
  $$('[data-as]', el).forEach(r => r.onclick = () => { Computer.trSel = r.dataset.as; Computer.refresh(); });
  $$('[data-amt]', el).forEach(b => b.onclick = () => { $('#trAmt', el).value = b.dataset.amt; });
  $('#trBuy', el).onclick = () => { const r = buyAsset(sel.id, +$('#trAmt', el).value); UI.toast(r.ok ? '📈' : '⚠', r.msg); Computer.refresh(); UI.hud(); };
  $$('[data-sell]', el).forEach(b => b.onclick = () => { const r = sellAsset(sel.id, +b.dataset.sell); UI.toast(r.ok ? '💸' : '⚠', r.msg); Computer.refresh(); UI.hud(); });
};
Computer.app_news = function (el) {
  mktState();
  const list = S.news || [];
  el.innerHTML = `<div class="browser"><div class="addr"><span>🔒 https://news.ssak.kr/economy</span></div><div class="mall-b">
    <p class="small muted">게임 속 가상 뉴스입니다. 뉴스는 관련 주식·코인 가격, 부품 시세, 손님 수에 영향을 줍니다. 1~3시간(게임 시간)마다 새 기사가 올라옵니다.</p>
    ${list.length ? `<div class="news-list">${list.map(n => `<div class="news-item"><div class="small muted">${fmtDT(n.t)}${n.assets.length ? ' · 관련: ' + n.assets.map(id => assetOf(id).name).join(', ') : ''}${n.part ? ' · 부품 시세: ' + PART_TYPES[n.part].name : ''}${n.cust ? ' · 수리 수요 영향' : ''}</div><b>${esc(n.title)}</b>${n.assets.length ? ` <button class="btn sm" data-goas="${n.assets[0]}">시세 보기</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">아직 기사가 없습니다. 영업을 하다 보면 속보가 올라옵니다.</div>'}
  </div></div>`;
  $$('[data-goas]', el).forEach(b => b.onclick = () => { Computer.trSel = b.dataset.goas; Computer.app = 'trade'; Computer.render(); });
};
Computer.app_reviews = function (el) {
  const st = reviewStats(); const list = S.reviews || [];
  const bonus = reviewCustBonus();
  el.innerHTML = `<div class="browser"><div class="addr"><span>🔒 https://map.dongne.kr/place/repair-master/reviews</span></div><div class="mall-b">
    <div class="rv-head"><div class="rv-score"><b>${st.n ? st.avg.toFixed(1) : '-'}</b><span class="stars">${UI.stars(st.avg)}</span><small>리뷰 ${st.n}개 (최근 40개 평균)</small></div>
    <div class="rv-dist">${[5, 4, 3, 2, 1].map((n, i) => `<div><span>${n}점</span><i><b style="width:${st.n ? st.dist[i] / st.n * 100 : 0}%"></b></i><small>${st.dist[i]}</small></div>`).join('')}</div></div>
    <p class="small muted">손님 만족도가 리뷰로 남습니다. 리뷰가 5개 이상이고 평균 4.5점 이상이면 하루 손님 +1명, 2.5점 미만이면 -1명. ${bonus > 0 ? '<b class="ok">지금 리뷰 덕분에 손님이 늘고 있어요!</b>' : bonus < 0 ? '<b class="bad">나쁜 리뷰 때문에 손님이 줄고 있어요.</b>' : ''} 불만 리뷰에는 정중한 답글을 달면 평판이 조금 회복됩니다.</p>
    ${list.length ? list.map(r => `<div class="rv"><div class="rv-h"><b>${esc(r.name)}</b> <span class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(5 - r.stars)}</span> <small class="muted">${esc(r.model)} · ${fmtDT(r.t)}</small></div><p>${esc(r.text)}</p>
      ${r.reply ? `<div class="rv-reply"><b>사장님 답글</b> ${esc(r.reply.text)}</div>` : `<div class="row"><button class="btn sm" data-rv="${r.id}" data-k="thanks">🙂 감사 답글</button><button class="btn sm" data-rv="${r.id}" data-k="sorry">🙇 사과 답글</button><button class="btn sm" data-rv="${r.id}" data-k="explain">📝 개선 약속</button></div>`}</div>`).join('') : '<div class="empty">아직 리뷰가 없습니다. 수리를 마치고 기기를 돌려드리면 손님이 리뷰를 남깁니다.</div>'}
  </div></div>`;
  $$('[data-rv]', el).forEach(b => b.onclick = () => { const r = replyReview(b.dataset.rv, b.dataset.k); UI.toast(r.ok ? '💬' : '⚠', r.msg, true); Computer.refresh(); UI.hud(); });
};
Computer.app_staff = function (el) {
  const st = staffState();
  el.innerHTML = `<h4>알바 고용</h4><p class="small muted">알바 급여는 매일 마감 때 일급(주급 ÷ 7)으로 나갑니다. 언제든 그만두게 할 수 있어요.</p>
    <div class="loan-list">${Object.entries(ALBA).map(([id, a]) => { const h = st.hired[id]; return `<div class="loan-card${h ? '' : ''}"><div class="lc-h">${a.avatar} <b>${a.name}</b> ${h ? '<span class="tag ok">근무 중</span>' : ''}</div><div class="small">${esc(a.desc)}</div><div class="small">주급 ${WON(a.wage)} (일급 ${WON(Math.round(a.wage / 7))})</div>
      ${h ? `<div class="small"><b>맡긴 일</b></div>${a.tasks.map(t => `<label class="small chk"><input type="checkbox" data-task="${id}|${t}" ${h.tasks[t] ? 'checked' : ''}> ${ALBA_TASKS[t].name} <span class="muted">— ${ALBA_TASKS[t].desc}</span></label>`).join('')}<div class="row"><button class="btn sm danger" data-fire="${id}">그만두게 하기</button></div>`
        : `<div class="small muted">할 수 있는 일: ${a.tasks.map(t => ALBA_TASKS[t].name).join(', ')}</div><div class="row"><button class="btn sm primary" data-hire="${id}">고용하기</button></div>`}</div>`; }).join('')}</div>
    <h4>자동 구매 설정</h4>
    <div class="row"><label class="small">선호 업체 <select id="stV">${Object.values(VENDORS).map(v => `<option value="${v.id}" ${st.vendor === v.id ? 'selected' : ''}>${v.name} (${v.tag})</option>`).join('')}</select></label>
    <label class="small">1회 구매 한도 <select id="stCap">${[100000, 300000, 500000, 1000000, 2000000].map(c => `<option value="${c}" ${st.cap === c ? 'selected' : ''}>${WON(c)}</option>`).join('')}</select></label>
    <button class="btn sm" id="stInv">📦 최소 재고 수량 정하기</button></div>
    <p class="small muted">선호 업체에 재고가 없으면 다른 업체에서 삽니다. 최소 재고는 '재고 관리' 앱의 "최소 수량" 칸에서 정합니다. 지금 최소 수량이 정해진 부품: ${Object.entries(S.minStock).filter(([, v]) => v > 0).map(([s, v]) => esc(skuName(s)) + ' ' + v + '개').join(', ') || '없음'}</p>
    ${Object.keys(st.hired).length ? '<div class="row"><button class="btn sm" id="stRun">🧑‍🔧 지금 부족한 부품 주문시키기</button></div>' : ''}`;
  $$('[data-hire]', el).forEach(b => b.onclick = () => { const r = hireAlba(b.dataset.hire); UI.toast(r.ok ? '🧑‍🔧' : '⚠', r.msg, true); Computer.refresh(); });
  $$('[data-fire]', el).forEach(b => b.onclick = () => UI.choice('알바 계약 종료', ALBA[b.dataset.fire].name + ' 님을 그만두게 할까요?', [['그만두게 하기', () => { const r = fireAlba(b.dataset.fire); UI.toast('👋', r.msg); Computer.refresh(); }], ['취소', () => { }]]));
  $$('[data-task]', el).forEach(c => c.onchange = () => { const [id, t] = c.dataset.task.split('|'); st.hired[id].tasks[t] = c.checked; saveSoon(); });
  $('#stV', el).onchange = e => { st.vendor = e.target.value; saveSoon(); };
  $('#stCap', el).onchange = e => { st.cap = +e.target.value; saveSoon(); };
  $('#stInv', el).onclick = () => { Computer.app = 'inv'; Computer.render(); };
  if ($('#stRun', el)) $('#stRun', el).onclick = () => { const r = albaBuyRun(); UI.toast('🧑‍🔧', r ? r.msg : '지금은 살 부품이 없어요. (최소 재고가 채워져 있거나, 맡긴 일이 꺼져 있어요)', true); Computer.refresh(); UI.hud(); };
};
Computer.app_realty = function (el) {
  const cur = S.shopLv || 0;
  el.innerHTML = `<div class="browser"><div class="addr"><span>🔒 https://sangga.estate/repair</span></div><div class="mall-b">
    <p>지금 매장: <b>${esc(shopLoc().name)}</b> <small class="muted">(${esc(shopLoc().area)} · 주간 임대료 ${WON(shopLoc().rent)})</small></p>
    <p class="small muted">돈을 모으면 더 좋은 자리로 이사할 수 있습니다. 이사 비용(보증금·인테리어·이사)은 한 번에 나가고, 임대료가 오르는 대신 손님 수·손님 예산·수리 선반이 늘어납니다. 진행 중인 의뢰와 재고, 업그레이드는 그대로 가져갑니다. 한 단계씩 옮길 수 있어요.</p>
    <div class="loan-list">${SHOP_LOCS.map((L, i) => { const here = i === cur, past = i < cur, next = i === cur + 1; const okRep = S.rep >= L.rep, okMoney = S.money >= L.price;
      return `<div class="loan-card${here ? ' cur' : next ? '' : ' off'}"><div class="lc-h">🏪 <b>${esc(L.name)}</b> ${here ? '<span class="tag ok">현재 매장</span>' : past ? '<span class="tag">이전 매장</span>' : ''}</div><div class="small">${esc(L.area)}</div><div class="small">${esc(L.desc)}</div>
        <div class="small">주간 임대료 <b>${WON(L.rent)}</b>${i ? ' · 이사 비용 <b>' + WON(L.price) + '</b> · 필요 평판 ' + L.rep.toFixed(1) : ''}</div>
        ${next ? `<div class="small ${okRep ? 'ok' : 'bad'}">평판 ${S.rep.toFixed(2)} / ${L.rep.toFixed(1)}</div><div class="small ${okMoney ? 'ok' : 'bad'}">자금 ${WON(S.money)} / ${WON(L.price)}</div><div class="row"><button class="btn sm primary" data-move="${i}" ${okRep && okMoney ? '' : 'disabled'}>이사하기</button></div>` : ''}</div>`; }).join('')}</div>
  </div></div>`;
  $$('[data-move]', el).forEach(b => b.onclick = () => { const L = SHOP_LOCS[+b.dataset.move]; UI.choice('🏢 매장 이전', L.name + '(으)로 이사할까요? 이사 비용 ' + WON(L.price) + '이 바로 나가고, 주간 임대료가 ' + WON(shopLoc().rent) + ' → ' + WON(L.rent) + '로 오릅니다.', [['이사하기', () => { const r = moveShop(+b.dataset.move); UI.toast(r.ok ? '🏢' : '⚠', r.msg, true); Computer.refresh(); UI.hud(); }], ['취소', () => { }]]); });
};
