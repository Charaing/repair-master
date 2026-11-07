'use strict';
/* =========================================================================
   REPAIR MASTER — 게임 엔진 (상태 · 시간 · 경제 · 기기 상태 · 진단 · 저장)
   ========================================================================= */

const Bus = {
  h: {},
  on(e, f) { (this.h[e] = this.h[e] || []).push(f); },
  emit(e, d) { (this.h[e] || []).forEach(f => f(d)); (this.h['*'] || []).forEach(f => f(e, d)); }
};
const SAVE_KEY = 'repairmaster_save_v1';
let S = null;

/* ---------- 난수 ---------- */
const R = {
  f: () => Math.random(),
  int: (a, b) => a + Math.floor(Math.random() * (b - a + 1)),
  range: (a, b) => a + Math.random() * (b - a),
  pick: a => a[Math.floor(Math.random() * a.length)],
  chance: p => Math.random() < p,
  wpick(pairs) { const tot = pairs.reduce((s, p) => s + p[1], 0); let r = Math.random() * tot; for (const p of pairs) { r -= p[1]; if (r <= 0) return p[0]; } return pairs[pairs.length - 1][0]; }
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DAY = 1440, OPEN = 9 * 60, CLOSE = 19 * 60;

/* ---------- 상태 ---------- */
function newState() {
  const s = {
    ver: 1, t: OPEN, money: 800000, rep: 3.0, xp: 0, savings: 0,
    skills: { knowledge: 0, diag: 0, assembly: 0, speed: 0, consult: 0, parts: 0, biz: 0 },
    tools: { hand: 1, driver: 1, spudger: 80, pick: 40, heater: 1, tweezers: 1, magnifier: 1, brush: 1, tester: 1 },
    upgrades: {}, inv: [], consum: { adhesive: 6 }, scrap: [], minStock: {},
    orders: [], cart: [], packages: [], market: {}, vstock: {},
    queue: [], arrivals: [], tickets: [], records: [], comebacks: [], ledger: [], loans: [], loanHist: [], reviews: [], news: [], mkt: null, shopLv: 0, staff: { hired: {}, vendor: 'normal', cap: 300000 },
    book: {}, flags: {}, tut: { step: 0, active: true, done: false, practice: false },
    bench: null, nextTicket: 1, uid: 1, nextOrder: 1, nextCust: 1,
    dayLog: { rev: 0, exp: 0, repairs: 0 }, history: []
  };
  return s;
}
function newGame() {
  S = newState();
  updateMarket(true);
  // 초기 재고 (부품나라 매입)
  [['pixis:display', 1], ['lumen:battery', 1], ['nova:battery', 1], ['pixis:charge_port', 1], ['lumen:charge_port', 1], ['lumen:display', 1], ['kestrel:stick_l', 1]].forEach(([sku, q]) => {
    for (let i = 0; i < q; i++) { const p = newPart(sku, 'stock', 'normal'); p.defect = false; p.boughtT = -99999; p.cost = refPrice(sku); S.inv.push(p); }
  });
  addLedger(0, '기초', '초기 운영 자금 인수 ' + WON(S.money));
  // 튜토리얼 손님
  S.arrivals.push({ t: OPEN, cust: tutorialCustomer() });
  S.flags.tutorialSpawned = true;
  save();
}

/* ---------- 시간 ---------- */
const dayIdx = (t = S.t) => Math.floor(t / DAY);
const minOfDay = (t = S.t) => t % DAY;
function fmtClock(t = S.t) { const m = minOfDay(t); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(Math.floor(m % 60)).padStart(2, '0'); }
function fmtDay(t = S.t) { const d = dayIdx(t); return (d + 1) + '일차 (' + WEEKDAYS[d % 7] + ')'; }
function fmtDT(t) { return (dayIdx(t) + 1) + '일차 ' + fmtClock(t); }
function speedMul() { return 1 - 0.05 * skillLv('speed'); }
function advance(min, label) {
  min = Math.max(0, min);
  S.t += min;
  const tk = benchTicket(); if (tk) tk.workMin = (tk.workMin || 0) + min;
  processTime();
  Bus.emit('time', { min, label });
}
function workTime(base, kind) {
  let m = base * speedMul();
  if (kind === 'assembly') m *= (1 - 0.03 * skillLv('assembly'));
  return Math.max(0.2, m);
}
function processTime() {
  // 손님 도착
  const arrived = S.arrivals.filter(a => a.t <= S.t);
  if (arrived.length) {
    S.arrivals = S.arrivals.filter(a => a.t > S.t);
    arrived.forEach(a => { a.cust.arriveT = a.t; a.cust.leaveT = a.t + 200 + (albaDoes('greet') ? 120 : 0); S.queue.push(a.cust); Bus.emit('toast', { icon: '🔔', text: a.cust.name + ' 님이 방문했습니다.' }); });
    Bus.emit('queue');
  }
  // 워크인 손님: 영업 시간에 예약된 손님도, 기다리는 손님도 없으면 잠시 뒤 새 손님이 들른다
  walkIn();
  // 기다리다 떠난 손님
  const left = S.queue.filter(c => !c.tutorial && c.leaveT < S.t);
  if (left.length) {
    S.queue = S.queue.filter(c => !left.includes(c));
    left.forEach(c => { S.rep = clamp(S.rep - 0.05, 0, 5); Bus.emit('toast', { icon: '🚪', text: c.name + ' 님이 오래 기다리다 돌아갔습니다. (평판 소폭 하락)' }); });
    Bus.emit('queue');
  }
  // 배송
  S.orders.forEach(o => {
    if (!o.delivered && o.arriveT <= S.t) {
      o.delivered = true; S.packages.push(o.id);
      if (!albaDoes('unbox')) Bus.emit('toast', { icon: '📦', text: VENDORS[o.vendor].name + ' 택배가 도착했습니다! (주문 ' + o.id + ')' });
    }
  });
  bizTick();
}

/* ---------- 경험치 · 스킬 ---------- */
function skillLv(k) { return Math.min(10, Math.floor(Math.sqrt((S.skills[k] || 0) / 25))); }
function playerLv() { return Math.floor(Math.sqrt(S.xp / 50)) + 1; }
function rankName() { const lv = playerLv(); let r = RANKS[0][1]; RANKS.forEach(([l, n]) => { if (lv >= l) r = n; }); return r; }
function lvProgress() { const lv = playerLv(); const a = (lv - 1) ** 2 * 50, b = lv ** 2 * 50; return (S.xp - a) / (b - a); }
function addXP(k, amt) {
  if (amt <= 0) return;
  const before = skillLv(k), plBefore = playerLv();
  S.skills[k] = (S.skills[k] || 0) + amt; S.xp += amt;
  if (skillLv(k) > before) Bus.emit('toast', { icon: '⭐', text: SKILLS[k].name + ' Lv' + skillLv(k) + ' 달성! — ' + SKILLS[k].desc, long: true });
  if (playerLv() > plBefore) Bus.emit('levelup', playerLv());
  Bus.emit('xp');
}

/* ---------- 돈 · 장부 ---------- */
function addLedger(amt, cat, memo) { S.ledger.push({ t: S.t, amt, cat, memo }); if (S.ledger.length > 600) S.ledger.shift(); }
function pay(amt, cat, memo) { S.money -= amt; S.dayLog.exp += amt; addLedger(-amt, cat, memo); Bus.emit('money'); }
function earn(amt, cat, memo) { S.money += amt; S.dayLog.rev += amt; addLedger(amt, cat, memo); Bus.emit('money'); }

/* ---------- 부품 인스턴스 ---------- */
function newPart(sku, origin, vendor) {
  const p = { uid: 'P' + (S.uid++), sku, origin, vendor: vendor || null, fault: null, defect: false, grade: vendor ? VENDORS[vendor].grade : '정품', cost: 0, boughtT: S ? S.t : 0, used: false };
  if (sku !== 'adhesive') {
    const [m, s] = sku.split(':'); const sd = slotDef(m, s);
    p.model = m; p.slot = s; p.type = sd.type;
    if (sd.type === 'battery') p.health = vendor === 'cheap' ? R.int(91, 98) : 100;
  }
  if (vendor) p.defect = R.chance(VENDORS[vendor].defect);
  return p;
}
function partLabel(p) { return skuName(p.sku); }

/* ---------- 시장 ---------- */
function updateMarket(init) {
  Object.keys(BASE_PRICE).forEach(t => {
    const cur = S.market[t] || 1;
    S.market[t] = init ? R.range(0.95, 1.08) : clamp(cur * (1 + R.range(-0.05, 0.055)) + (1 - cur) * 0.08, 0.82, 1.3);
  });
  S.vstock = {};
  ALL_SKUS.forEach(sku => Object.keys(VENDORS).forEach(v => {
    const p = v === 'cheap' ? 0.72 : v === 'normal' ? 0.9 : 0.95;
    S.vstock[sku + '|' + v] = sku === 'adhesive' ? 50 : (R.chance(p) ? R.int(1, v === 'premium' ? 5 : 8) : 0);
  }));
}
function marketFactor(sku) { if (sku === 'adhesive') return 1; const [m, s] = sku.split(':'); return S.market[slotDef(m, s).type] || 1; }
function vendorPrice(sku, v) { return Math.max(500, Math.round(skuBasePrice(sku) * VENDORS[v].mult * marketFactor(sku) / 100) * 100); }
function refPrice(sku) { return vendorPrice(sku, 'normal'); }
function shipFee(v) { return Math.round(VENDORS[v].ship * (1 - Math.min(0.4, 0.1 * skillLv('parts')))); }

/* ---------- 주문 · 배송 ---------- */
function placeOrder(express, quiet) {
  if (!S.cart.length) return { ok: false, msg: '장바구니가 비어 있습니다.' };
  const byV = {};
  S.cart.forEach(c => (byV[c.vendor] = byV[c.vendor] || []).push(c));
  let total = 0; const orders = [];
  for (const v in byV) {
    for (const c of byV[v]) if ((S.vstock[c.sku + '|' + v] || 0) < c.qty) return { ok: false, msg: skuName(c.sku) + ' (' + VENDORS[v].name + ') 재고가 부족합니다.' };
    const items = byV[v].map(c => ({ sku: c.sku, qty: c.qty, unit: vendorPrice(c.sku, v) }));
    const sub = items.reduce((s, i) => s + i.unit * i.qty, 0);
    const ex = express && v === 'premium';
    const fee = shipFee(v) + (ex ? VENDORS.premium.express : 0);
    total += sub + fee; orders.push({ v, items, sub, fee, ex });
  }
  if (total > S.money) return { ok: false, msg: '매장 자금이 부족합니다. (필요 ' + WON(total) + ')' };
  const made = [];
  orders.forEach(o => {
    const id = 'O-' + String(S.nextOrder++).padStart(4, '0');
    let arriveT;
    if (o.ex) {
      arriveT = minOfDay() < 15 * 60 ? S.t + 180 : (dayIdx() + 1) * DAY + 10 * 60;
    } else {
      arriveT = shipArrive();
    }
    o.items.forEach(i => S.vstock[i.sku + '|' + o.v] -= i.qty);
    S.orders.push({ id, vendor: o.v, items: o.items, fee: o.fee, sub: o.sub, express: o.ex, placedT: S.t, arriveT, delivered: false, opened: false });
    pay(o.sub + o.fee, '부품 매입', id + ' ' + VENDORS[o.v].name + ' (배송비 ' + WON(o.fee) + ' 포함)' + (quiet ? ' [알바 주문]' : ''));
    made.push(id);
  });
  S.cart = [];
  if (quiet) return { ok: true, msg: made.join(', ') + ' 주문 (총 ' + WON(total) + ')' };
  addXP('parts', 4 * orders.length);
  advance(3, '주문');
  return { ok: true, msg: orders.length + '건의 주문이 접수되었습니다. 총 ' + WON(total) };
}
const ORDER_STAGES = ['주문 접수', '상품 준비', '배송 시작', '배송 중', '배송 완료'];
function orderStage(o) {
  if (o.delivered) return 4;
  const f = (S.t - o.placedT) / Math.max(1, o.arriveT - o.placedT);
  return f < 0.12 ? 0 : f < 0.35 ? 1 : f < 0.55 ? 2 : 3;
}
/* 배송: 업체·등급과 관계없이 1~2일 뒤 영업 시간 중 도착 */
function shipArrive() { return (dayIdx() + R.int(1, 2)) * DAY + R.int(10 * 60, 17 * 60); }
function unbox(orderId, quiet) {
  const o = S.orders.find(x => x.id === orderId); if (!o || o.opened) return [];
  o.opened = true; S.packages = S.packages.filter(x => x !== orderId);
  const out = [];
  o.items.forEach(i => {
    for (let k = 0; k < i.qty; k++) {
      if (i.sku === 'adhesive') { S.consum.adhesive = (S.consum.adhesive || 0) + 1; continue; }
      const p = newPart(i.sku, 'stock', o.vendor); p.cost = i.unit; p.orderId = o.id; p.boughtT = S.t;
      if (o.free) p.defect = R.chance(VENDORS[o.vendor].defect * 0.5);
      let note = '';
      if (p.defect && R.chance(0.15 + 0.15 * skillLv('parts'))) { p.knownDefect = true; note = '외관 검수 중 불량 발견: 커넥터 핀이 휘어 있습니다! (교환 신청 가능)'; }
      S.inv.push(p); out.push({ p, note });
    }
  });
  const adh = o.items.filter(i => i.sku === 'adhesive').reduce((s, i) => s + i.qty, 0);
  if (adh) out.push({ adhesive: adh });
  addXP('parts', 3 + out.length);
  if (!quiet) advance(2, '택배 개봉');
  return out;
}
function returnItem(uid) {
  const p = S.inv.find(x => x.uid === uid);
  if (!p) return { ok: false, msg: '재고에서 찾을 수 없습니다.' };
  if (p.origin !== 'stock' || p.used) return { ok: false, msg: '사용했던 부품은 반품할 수 없습니다.' };
  if (S.t - p.boughtT > 7 * DAY) return { ok: false, msg: '구매 후 7일이 지나 반품할 수 없습니다.' };
  const refund = Math.round(p.cost * 0.9 / 100) * 100;
  S.inv = S.inv.filter(x => x !== p); earn(refund, '반품 환불', skuName(p.sku) + ' 반품 (수수료 10%)');
  return { ok: true, msg: '반품 완료: ' + WON(refund) + ' 환불 (반품 수수료 10% 차감)' };
}
function claimExchange(p, whereArr) {
  if (p.origin !== 'stock' || !p.vendor) return { ok: false, msg: '구매한 부품만 교환 신청할 수 있습니다.' };
  if (p.exchangeChecked) return { ok: false, msg: '이미 판매자 검수에서 정상 판정을 받은 부품입니다.' };
  if (p.defect) {
    whereArr.splice(whereArr.indexOf(p), 1);
    const id = 'O-' + String(S.nextOrder++).padStart(4, '0');
    S.orders.push({ id, vendor: p.vendor, items: [{ sku: p.sku, qty: 1, unit: p.cost }], fee: 0, sub: 0, placedT: S.t, arriveT: shipArrive(), delivered: false, opened: false, free: true });
    addXP('parts', 8);
    return { ok: true, msg: '판매자 검수 결과: 초기 불량 확인. 교환품이 발송됩니다 (' + id + ').' };
  }
  p.exchangeChecked = true;
  pay(5000, '반송비', skuName(p.sku) + ' 교환 반려');
  return { ok: false, msg: '판매자 검수 결과 "정상 제품"으로 반려되었습니다. 반송비 ₩5,000이 청구되었습니다.' };
}

/* ---------- 기기 인스턴스 ---------- */
function createDevice(modelId, faults, opts = {}) {
  const m = MODELS[modelId];
  const dev = { modelId, serial: m.code + '-' + R.int(100000, 999999), slots: {}, conns: {}, software: null, tray: [], view: m.openSide, lciRed: false };
  m.slots.forEach(s => {
    const p = newPart(skuOf(modelId, s.id), 'original', null);
    p.grade = '정품'; p.defect = false;
    if (s.type === 'battery') p.health = opts.battHealth != null ? opts.battHealth : R.int(81, 96);
    dev.slots[s.id] = { part: p, screws: (s.screws || []).map(() => true), adhesive: s.adhesive ? 'intact' : null, cut: [false, false, false, false], clips: [false, false, false, false, false, false], open: false, heated: false };
  });
  m.conns.forEach(c => dev.conns[c.id] = { on: true, loose: false });
  (faults || []).forEach(f => applyFault(dev, f.id || f));
  return dev;
}
function faultSlot(modelId, fid) {
  const f = FAULTS[fid]; if (!f || !f.slots) return null;
  const m = MODELS[modelId]; return f.slots.find(id => m.slots.some(s => s.id === id)) || null;
}
function faultValid(modelId, fid) {
  const f = FAULTS[fid]; const m = MODELS[modelId];
  if (f.software) return true;
  if (f.conn) return m.conns.some(c => c.id === f.conn);
  if (f.lcdOnly && (!slotDef(modelId, 'display') || slotDef(modelId, 'display').type !== 'display_lcd')) return false;
  return !!faultSlot(modelId, fid);
}
function applyFault(dev, fid, opts = {}) {
  const f = FAULTS[fid];
  if (f.software) { dev.software = fid; return; }
  if (f.conn) { dev.conns[f.conn].loose = true; return; }
  const sid = faultSlot(dev.modelId, fid); const p = dev.slots[sid].part;
  p.fault = fid;
  if (f.health) p.health = opts.health != null ? opts.health : R.int(f.health[0], f.health[1]);
  if (f.swollen) p.swollen = true;
}
function partOf(dev, sid) { return dev.slots[sid] ? dev.slots[sid].part : null; }
function partDead(p) { return !!(p.defect || (p.fault && FAULTS[p.fault] && FAULTS[p.fault].dead)); }
const SEV = { ok: 0, na: 0, intermittent: 1, weak: 1, erratic: 1, partial: 2, drift: 2, stuck: 2, some_btn: 2, pairfail: 4, blur: 2, distorted: 2, lines: 2, volume_fail: 2, dark: 3, power_fail: 3, none: 4 };
function worse(a, b) { return (SEV[b] || 0) > (SEV[a] || 0) ? b : a; }
function evalPath(dev, key) {
  const path = MODELS[dev.modelId].paths[key]; if (!path) return 'na';
  let st = 'ok';
  for (const req of path) {
    if (req.startsWith('c:')) { const c = dev.conns[req.slice(2)]; if (!c.on) return 'none'; if (c.loose) st = worse(st, 'intermittent'); continue; }
    const p = partOf(dev, req); if (!p) return 'none';
    if (p.model !== dev.modelId) return 'none';
    if (partDead(p)) return 'none';
    const f = p.fault && FAULTS[p.fault]; if (f && f.eff && f.eff[key]) st = worse(st, f.eff[key]);
  }
  return st;
}
function battInfo(dev) {
  const p = partOf(dev, 'battery'); const c = dev.conns.c_batt;
  if (!p) return { present: false };
  const health = partDead(p) ? 0 : p.health;
  return { present: true, connected: c.on, health, swollen: !!p.swollen, dead: health < 10 };
}
function boardState(dev) {
  const b = partOf(dev, 'mainboard'); if (!b) return 'missing';
  if (partDead(b) || (b.fault && FAULTS[b.fault].pmic)) return 'pmic';
  return 'ok';
}
function chargeStatus(dev) {
  const bs = boardState(dev); if (bs !== 'ok') return 'none';
  return evalPath(dev, 'charge');
}
function bootState(dev, charger) {
  const bs = boardState(dev);
  if (bs === 'missing') return { ok: false, why: 'noboard' };
  if (bs === 'pmic') return { ok: false, why: 'pmic' };
  const bi = battInfo(dev); const battOk = bi.present && bi.connected && !bi.dead;
  const chg = charger && chargeStatus(dev) !== 'none';
  if (!battOk && !chg) return { ok: false, why: (!bi.present || !bi.connected) ? 'nobatt' : 'battdead' };
  const btn = evalPath(dev, 'buttons'); const btnOk = !(btn === 'none' || btn === 'power_fail');
  if (!btnOk && !chg) return { ok: false, why: 'button' };
  if (dev.software === 'sw_bootloop') return { ok: false, why: 'bootloop' };
  return { ok: true, viaCharger: !battOk || !btnOk };
}
const FUNC_KEYS = ['power', 'battery', 'charge', 'display', 'touch', 'camera_rear', 'camera_front', 'speaker', 'earpiece', 'mic', 'vibration', 'buttons', 'signal', 'wireless_charge', 'stick_l', 'stick_r', 'trig_l', 'trig_r'];
const FUNC_NAMES = { power: '전원·부팅', battery: '배터리', charge: '유선 충전', display: '화면 출력', touch: '터치', camera_rear: '후면 카메라', camera_front: '전면 카메라', speaker: '라우드 스피커', earpiece: '통화 스피커', mic: '마이크', vibration: '진동', buttons: '버튼', signal: '무선 통신', wireless_charge: '무선 충전', stick_l: 'L 스틱', stick_r: 'R 스틱', trig_l: 'L 트리거', trig_r: 'R 트리거' };
function evalAll(dev, charger) {
  const boot = bootState(dev, charger);
  const r = { _boot: boot, power: boot.ok ? 'ok' : 'none' };
  r.charge = chargeStatus(dev);
  const P = MODELS[dev.modelId].paths;
  ['display', 'touch', 'camera_rear', 'camera_front', 'speaker', 'earpiece', 'mic', 'vibration', 'buttons', 'signal', 'stick_l', 'stick_r', 'trig_l', 'trig_r'].forEach(k => {
    r[k] = !P[k] ? 'na' : boot.ok ? evalPath(dev, k) : 'noboot';
  });
  if (boot.ok) {
    if (dev.software === 'sw_touch' && r.touch === 'ok') r.touch = 'erratic';
    const b = partOf(dev, 'mainboard'); if (b && b.fault === 'board_baseband') r.signal = 'none';
    if (dev.software === 'fw_pair' && r.signal === 'ok') r.signal = 'pairfail';
  }
  r.wireless_charge = MODELS[dev.modelId].paths.wireless_charge ? (boardState(dev) === 'ok' && battInfo(dev).present ? evalPath(dev, 'wireless_charge') : 'none') : 'na';
  const bi = battInfo(dev);
  r.battery = !bi.present || !bi.connected ? 'none' : bi.dead ? 'dead' : bi.swollen ? 'swollen' : bi.health < 80 ? 'worn' : dev.software === 'sw_drain' ? 'drain' : 'ok';
  return r;
}
const ST_KO = { ok: '정상', na: '해당 없음', none: '작동 안 함', noboot: '부팅 안 됨', intermittent: '간헐적 끊김', weak: '약함', erratic: '오작동', partial: '일부 영역 불량', blur: '초점 불량·흐림', distorted: '소리 찢어짐', lines: '줄·얼룩', volume_fail: '음량 버튼 불량', dark: '매우 어두움', power_fail: '전원 버튼 불량', drift: '쏠림(드리프트)', stuck: '눌린 채 복귀 안 됨', some_btn: '일부 버튼 무반응', pairfail: '페어링 실패' };
const stKo = st => ST_KO[st] || st;
function funcOK(st) { return st === 'ok' || st === 'na'; }

/* ---------- 분해/조립 규칙 ---------- */
function mSlot(dev, sid) { return MODELS[dev.modelId].slots.find(s => s.id === sid); }
function mConn(dev, cid) { return MODELS[dev.modelId].conns.find(c => c.id === cid); }
function coverList(dev, sd) {
  const m = MODELS[dev.modelId]; const list = (sd.coveredBy || []).slice();
  const shell = m.shell[sd.side]; if (shell && shell !== sd.id) list.push(shell);
  return list;
}
function coveringNow(dev, sd) { return coverList(dev, sd).filter(id => dev.slots[id].part && !dev.slots[id].open); }
function isAccessible(dev, sid) { return coveringNow(dev, mSlot(dev, sid)).length === 0; }
function connCovering(dev, c) {
  const m = MODELS[dev.modelId]; const list = (c.coveredBy || []).slice();
  const shell = m.shell[c.side]; if (shell && shell !== c.owner) list.push(shell);
  return list.filter(id => dev.slots[id].part && !dev.slots[id].open);
}
function connPresent(dev, c) { return !!(dev.slots[c.owner].part && dev.slots[c.board].part); }
function slotScrewsLeft(dev, sid) { return dev.slots[sid].screws.filter(Boolean).length; }
function slotConns(dev, sid) { return MODELS[dev.modelId].conns.filter(c => c.owner === sid || c.board === sid); }
function adhesiveBlock(dev, sd) {
  const st = dev.slots[sd.id];
  if (!sd.adhesive) return null;
  const a = st.adhesive;
  if (a === 'none' || a === 'cut') return null;
  if (sd.adhesive.kind === 'clip') return 'clip';
  if (sd.adhesive.kind === 'tab') return 'tab';
  if (sd.adhesive.heat && a === 'intact') return 'heat';
  return 'cut';
}
function nameOf(type) { const b = S.book[type]; return b && b.lv >= 2 ? PART_TYPES[type].name : '알 수 없는 부품'; }
function slotName(dev, sid) { const sd = mSlot(dev, sid); const b = S.book[sd.type]; return (b && b.lv >= 2) ? (sd.label || PART_TYPES[sd.type].name) : '알 수 없는 부품'; }
function canRemove(dev, sid) {
  const sd = mSlot(dev, sid), st = dev.slots[sid];
  if (!st.part) return { ok: false, msg: '이미 비어 있는 자리입니다.' };
  const cov = coveringNow(dev, sd);
  if (cov.length) return { ok: false, code: 'covered', msg: '위에 ' + cov.map(id => slotName(dev, id)).join(', ') + '이(가) 덮고 있습니다. 먼저 제거하세요.' };
  const sc = slotScrewsLeft(dev, sid);
  if (sc) { const E = MODELS[dev.modelId].edge; const onEdge = E && E.screws && E.screws.slot === sid; return { ok: false, code: 'screws', msg: '나사 ' + sc + '개가 조여져 있습니다. 드라이버로 풀어주세요.' + (onEdge ? ' 이 나사는 기기 아랫면(충전 포트 양옆)에 있습니다. ⤵ 아랫면 버튼으로 폰을 세워 보세요.' : '') }; }
  const ab = adhesiveBlock(dev, sd);
  if (ab === 'heat') return { ok: false, code: 'heat', msg: '강한 접착제로 붙어 있습니다. 히팅 패드로 먼저 가열하세요.' };
  if (ab === 'cut') return { ok: false, code: 'cut', msg: '접착면이 남아 있습니다. 오프닝 픽을 선택하고 노란 점선을 따라 드래그해 잘라내세요.' };
  if (ab === 'clip') return { ok: false, code: 'clip', msg: '플라스틱 클립이 걸려 있습니다. 오프닝 픽으로 테두리의 클립(주황색 표시)을 해제하세요.' };
  if (sd.hinge && !st.open) return { ok: true, open: true };
  const cs = slotConns(dev, sid).filter(c => dev.conns[c.id].on && connPresent(dev, c));
  if (cs.length) return { ok: false, code: 'conn', msg: '아직 연결된 커넥터가 있습니다: ' + cs.map(c => S.skills && skillLv('knowledge') >= 2 ? c.label : '커넥터').join(', ') + '. 스퍼저로 분리하세요.' };
  if (ab === 'tab') return { ok: true, tab: true };
  return { ok: true };
}
function doRemove(dev, sid) {
  const sd = mSlot(dev, sid), st = dev.slots[sid];
  const p = st.part; st.part = null; st.open = false; st.heated = false; st.cut = [false, false, false, false]; st.clips = st.clips.map(() => false);
  if (sd.adhesive) st.adhesive = 'none';
  st.screws = st.screws.map(() => false);
  slotConns(dev, sid).forEach(c => { dev.conns[c.id].on = false; });
  dev.tray.push(p);
  return p;
}
function canInstall(dev, p) {
  const m = MODELS[dev.modelId];
  if (p.model !== dev.modelId) {
    const sd = m.slots.find(s => s.type === p.type);
    return { ok: false, msg: '이 부품은 ' + MODELS[p.model].name + '용입니다. ' + (sd ? '같은 종류지만 크기·커넥터 규격이 ' + m.name + '와 맞지 않습니다.' : m.name + '에는 이런 부품 자리가 없습니다.') };
  }
  const sd = mSlot(dev, p.slot); const st = dev.slots[p.slot];
  if (st.part) return { ok: false, msg: '그 자리에는 이미 부품이 장착되어 있습니다.' };
  if (sd.side !== dev.view) return { ok: false, msg: '이 부품은 기기의 ' + (sd.side === 'front' ? '앞면' : '뒷면') + '에 설치됩니다. 기기를 뒤집어 주세요.' };
  const cov = coveringNow(dev, sd);
  if (cov.length) return { ok: false, msg: '그 자리 위에 ' + cov.map(id => slotName(dev, id)).join(', ') + '이(가) 있어 넣을 수 없습니다.' };
  return { ok: true, sd };
}
function doInstall(dev, p, withTape) {
  const sd = mSlot(dev, p.slot), st = dev.slots[p.slot];
  dev.tray = dev.tray.filter(x => x !== p);
  st.part = p; st.screws = st.screws.map(() => false); st.cut = [false, false, false, false]; st.clips = st.clips.map(() => false); st.heated = false;
  if (sd.adhesive) st.adhesive = sd.adhesive.kind === 'clip' ? 'intact' : (withTape ? 'new' : 'none');
  st.open = !!sd.hinge;
  if (p.origin === 'stock') p.used = true;
}

/* ---------- 손님 · 의뢰 생성 ---------- */
function avatarSeed() { return { skin: R.pick(['#f1c9a5', '#e8b48e', '#d39c74', '#f6d7bd', '#c98b62']), hair: R.pick(['#2b2220', '#4a3426', '#1b1b1f', '#7a5a3a', '#8c8c8c', '#5a3b2a']), style: R.int(0, 3), shirt: R.pick(['#3f6db3', '#c2493d', '#3c8c6a', '#e0a63a', '#6b4fa0', '#4b5563', '#d06b9b']), glasses: R.chance(0.25) }; }
function tutorialCustomer() {
  const dev = createDevice('pixis', ['disp_lines'], { battHealth: 91 });
  dev.slots.display.part.cracked = true;
  return { cid: 'C' + (S.nextCust++), tutorial: true, name: '김민지', persona: PERSONAS[0], avatar: { skin: '#f3cfb0', hair: '#2b2220', style: 1, shirt: '#3c8c6a', glasses: false },
    modelId: 'pixis', device: dev, faults: [{ id: 'disp_lines', noticed: true }], cause: 'drop', ageMonths: 14, budget: 260000, deadlineDays: 2,
    complaint: '어제 핸드폰을 떨어뜨렸는데요, 화면에 줄이 생기고 터치도 잘 안 돼요.', asked: {}, exterior: { screenCrack: true, backCrack: false, lensCrack: false, dent: false, lifted: false }, scenario: 'drop_screen' };
}
function genCustomer(opts = {}) {
  const modelId = opts.modelId || R.wpick([['lumen', 3], ['pixis', 3], ['nova', 2.2], ['orbit', 2.4], ['kestrel', 2.2]]);
  const cat = devCat(modelId);
  const valid = SCENARIOS.filter(s => (s.cat || 'phone') === cat && (!s.models || s.models.includes(modelId)) && (s.pick || s.multi).some(([f]) => faultValid(modelId, f)));
  const sc = R.wpick(valid.map(s => [s, s.w]));
  const faults = [];
  const usedSlots = new Set();
  const addF = (fid, noticed) => {
    if (!faultValid(modelId, fid)) return false;
    const k = FAULTS[fid].software ? 'sw' : FAULTS[fid].conn ? FAULTS[fid].conn : faultSlot(modelId, fid);
    if (usedSlots.has(k)) return false;
    usedSlots.add(k); faults.push({ id: fid, noticed }); return true;
  };
  if (sc.multi) {
    const pool = sc.multi.filter(([f]) => faultValid(modelId, f));
    const n = R.chance(0.3) ? 3 : 2; let guard = 0;
    while (faults.length < Math.min(n, pool.length) && guard++ < 30) addF(R.wpick(pool), true);
  } else {
    addF(R.wpick(sc.pick.filter(([f]) => faultValid(modelId, f))), true);
  }
  (sc.extra || []).forEach(([f, p]) => { if (R.chance(p)) addF(f, R.chance(0.45)); });
  const ageMonths = sc.cause === 'age' ? R.int(20, 40) : R.int(3, 30);
  let battHealth = clamp(Math.round(100 - ageMonths * R.range(0.35, 0.6)), 81, 99);
  const dev = createDevice(modelId, faults, { battHealth });
  if (sc.cause === 'water') dev.lciRed = true;
  const ext = { screenCrack: false, backCrack: false, lensCrack: false, dent: R.chance(0.35), lifted: false };
  faults.forEach(f => {
    const fd = FAULTS[f.id];
    if (fd.crack && sc.cause === 'drop') { dev.slots.display.part.cracked = true; ext.screenCrack = true; }
    if (fd.lens) { dev.slots.camera_rear.part.cracked = true; ext.lensCrack = true; }
    if (fd.swollen) ext.lifted = true;
  });
  if (sc.cause === 'drop' && dev.slots.back_glass && R.chance(0.25)) { dev.slots.back_glass.part.cracked = true; ext.backCrack = true; }
  const persona = R.pick(PERSONAS);
  const intro = R.pick(causeText(modelId)[sc.cause].intro);
  const says = faults.filter(f => f.noticed).map(f => R.pick((cat === 'pad' && FAULTS[f.id].sayPad) || FAULTS[f.id].say));
  const complaint = intro + ' ' + says.join(' 그리고 ');
  const fair = fairPrice(modelId, faults.map(f => f.id));
  let budget = fair * R.range(0.98, 1.65) * persona.budget;
  if (R.chance(0.12)) budget = fair * R.range(0.6, 0.85);
  budget = Math.max(15000, Math.round(budget / 5000) * 5000);
  return { cid: 'C' + (S.nextCust++), name: R.pick(NAMES), persona, avatar: avatarSeed(), modelId, device: dev, faults, cause: sc.cause, scenario: sc.id,
    ageMonths, budget, deadlineDays: R.int(1, 3) + persona.patience, complaint, asked: {}, exterior: ext };
}
function fairPrice(modelId, fids) {
  let sum = 0;
  fids.forEach(fid => {
    const f = FAULTS[fid];
    if (f.software) sum += LABOR.software;
    else if (f.conn) sum += LABOR.reseat;
    else if (f.cleanable === 'brush') sum += LABOR.cleaning;
    else { const sid = faultSlot(modelId, fid); const sd = slotDef(modelId, sid); sum += skuBasePrice(skuOf(modelId, sid)) + LABOR[sd.type]; }
  });
  return sum;
}
function candidatesFor(cust) {
  const sc = SCENARIOS.find(s => s.id === cust.scenario); if (!sc) return [];
  return [...(sc.pick || []), ...(sc.multi || [])].map(x => x[0]).filter(f => faultValid(cust.modelId, f)).map(f => FAULTS[f].name);
}
const QUESTIONS = [
  { id: 'when', q: '언제부터 그랬어요?', a: c => ({ drop: '이틀 전에 떨어뜨린 뒤로 이래요.', water: '어제 물에 빠진 뒤부터요.', age: '몇 주 전부터 점점 심해졌어요.', sudden: '어제 밤부터 갑자기요.', unknown: '정확히는 모르겠는데 일주일쯤 됐어요.' })[c.cause] },
  { id: 'cause', q: '떨어뜨리거나 물에 젖은 적 있나요?', a: c => causeText(c.modelId)[c.cause].q },
  { id: 'charger', q: '충전기나 케이블을 바꿔 보셨어요?', a: c => c.faults.some(f => ['port_lint', 'port_corroded', 'port_broken', 'flex_torn', 'board_pmic', 'batt_dead'].includes(f.id)) ? '네, 집에 있는 거 다 꽂아봤는데 똑같아요.' : '충전은 잘 되는 것 같아요.' },
  { id: 'age', q: '사용하신 지 얼마나 됐어요?', a: c => c.ageMonths + '개월쯤 됐어요.' },
  { id: 'budget', q: '예산은 어느 정도 생각하세요?', a: c => { const acc = skillLv('consult') >= 2 ? R.range(0.95, 1.0) : R.range(0.75, 1.2); return '음… ' + WON(Math.round(c.budget * acc / 10000) * 10000) + ' 정도까지는 생각하고 있어요.'; } },
  { id: 'deadline', q: '언제까지 필요하세요?', a: c => c.deadlineDays + '일 안에는 꼭 받아야 해요.' },
  { id: 'prev', q: '다른 곳에서 수리받은 적 있어요?', a: c => c.warranty ? '여기서 지난번에 고쳤잖아요. 그래서 다시 온 거예요.' : '아니요, 처음 맡기는 거예요.' }
];

/* ---------- 의뢰(티켓) ---------- */
function shelfCap() { return (S.upgrades.shelf ? 7 : 4) + shopLoc().shelf; }
function createTicket(cust, form) {
  const id = 'R-' + String(S.nextTicket++).padStart(4, '0');
  const tk = {
    id, cust: { name: cust.name, avatar: cust.avatar, persona: cust.persona, cid: cust.cid }, modelId: cust.modelId, device: cust.device,
    faults: cust.faults, cause: cust.cause, scenario: cust.scenario, complaint: form.symptom || cust.complaint, budget: cust.budget,
    deadlineT: (dayIdx() + cust.deadlineDays) * DAY + CLOSE, created: S.t, status: cust.warranty ? 'repairing' : 'diagnosing',
    quote: cust.warranty ? { lines: [{ label: '보증 수리 (무상)', price: 0 }], total: 0 } : null,
    warranty: !!cust.warranty, parentId: cust.parentId || null, tutorial: !!cust.tutorial,
    diagLog: [], hints: 0, workMin: 0, intake: form, satAdj: 0, qcPass: false, ageMonths: cust.ageMonths, candidates: candidatesFor(cust)
  };
  S.tickets.push(tk);
  S.queue = S.queue.filter(c => c !== cust);
  // 접수서 정확도
  const ex = cust.exterior; let correct = 0, total = 0;
  ['screenCrack', 'backCrack', 'lensCrack', 'dent', 'lifted'].forEach(k => { total++; if (!!form.ext[k] === !!ex[k]) correct++; });
  addXP('consult', 4 + correct);
  tk.intakeScore = correct + '/' + total;
  advance(5, '접수');
  Bus.emit('tickets');
  return tk;
}
function benchTicket() { return S && S.bench ? S.tickets.find(t => t.id === S.bench) : null; }
function customerDecide(tk, total, isAdd) {
  const lv = skillLv('consult');
  const budget = tk.budget * (1 + 0.04 * lv) * (S.upgrades.sofa ? 1.03 : 1) * (tk.tutorial ? 1 : shopLoc().budget);
  const prev = isAdd ? tk.quote.total : 0;
  const ratio = total / budget;
  if (tk.tutorial && ratio <= 1.6) return { res: 'accept', text: '네, 그렇게 해주세요! 잘 부탁드려요.' };
  if (ratio <= 0.55) return { res: 'accept', text: '어? 생각보다 훨씬 싸네요! 바로 해주세요.', sat: 0.3 };
  if (ratio <= 1) return { res: 'accept', text: isAdd ? '추가로요? …알겠어요, 같이 고쳐주세요.' : '네, 그 가격이면 진행해 주세요.', sat: isAdd ? -0.3 : 0 };
  if (ratio <= 1.12 && R.chance(0.55 + 0.05 * lv)) return { res: 'accept', text: '좀 비싸긴 한데… 필요하니까 해주세요.', sat: -0.5 };
  if (ratio <= 1.4) { const offer = Math.max(prev + 1000, Math.round(budget / 1000) * 1000); return { res: 'counter', offer, text: '음… ' + WON(offer) + '이면 할게요. 안 될까요?' }; }
  return { res: 'reject', text: R.pick(['너무 비싸요. 그 돈이면 새로 사는 게 낫겠어요.', '생각보다 많이 나오네요… 그냥 다른 데 알아볼게요.', '그 가격은 좀… 수리 안 할게요. 기기 돌려주세요.']) };
}
function applyQuote(tk, lines, total, isAdd, decision) {
  if (decision.res === 'accept') {
    if (isAdd) { tk.quote.lines.push(...lines); tk.quote.total = total; }
    else tk.quote = { lines, total };
    tk.status = 'repairing'; tk.satAdj += decision.sat || 0;
  } else if (decision.res === 'reject') {
    if (!isAdd) { tk.status = 'rejected'; tk.quote = null; }
    else tk.satAdj -= 0.5;
  }
  Bus.emit('tickets');
}

/* ---------- 진단 검사 ---------- */
const TESTS = [
  { id: 'power', name: '전원 상태 검사', min: 5, icon: '⏻' },
  { id: 'charge', name: '충전 반응 검사', min: 4, icon: '🔌' },
  { id: 'display', name: '화면 출력 검사', min: 3, icon: '🖥', cat: 'phone' },
  { id: 'touch', name: '터치 반응 검사', min: 3, icon: '👆', cat: 'phone' },
  { id: 'camera', name: '카메라 작동 검사', min: 3, icon: '📷', cat: 'phone' },
  { id: 'audio', name: '스피커·마이크 검사', min: 4, icon: '🔊', cat: 'phone' },
  { id: 'input', name: '입력 검사(스틱·트리거·버튼)', min: 4, icon: '🎮', cat: 'pad' },
  { id: 'wireless', name: '무선 연결 검사', min: 4, icon: '📶' },
  { id: 'hw', name: '하드웨어 자가진단(진동·버튼)', min: 3, icon: '🧩' },
  { id: 'battery', name: '배터리 상태 검사', min: 4, icon: '🔋' },
  { id: 'software', name: '소프트웨어 이상 검사', min: 6, icon: '💾' }
];
function runTest(dev, id) {
  const pad = devCat(dev.modelId) === 'pad';
  const pro = !!S.tools.tester_pro; const L = []; const H = [];
  const add = (t, c) => L.push({ t, c: c || '' });
  const hint = t => H.push(t);
  const bootB = bootState(dev, false), bootC = bootState(dev, true);
  const ev = evalAll(dev, true);
  const noBootMsg = '기기가 켜지지 않아 검사할 수 없습니다. (충전기를 연결해도 부팅되지 않음)';
  const whyTxt = (why, ch) => ({
    noboard: '메인보드가 장착되어 있지 않습니다.',
    pmic: pro ? '반응 없음. 외부 전원 인가 시 대기 전류 1.84A (정상 0.00~0.02A) — 보드 단락 의심' : '전원 버튼을 눌러도 반응 없음. 전류 0.00A',
    nobatt: ch ? '충전기 전원으로도 부팅되지 않음' : '배터리가 연결되어 있지 않아 전원이 공급되지 않습니다.',
    battdead: pro ? '반응 없음. 배터리 전압 2.91V (정상 3.6~4.4V)' : '반응 없음 (전류 흐름 없음)',
    button: pro ? '반응 없음. 대기 전류는 정상(0.01A)이지만 전원 버튼 입력 신호가 감지되지 않음' : '전원 버튼을 눌러도 반응 없음',
    bootloop: pro ? '로고 표시 후 재시작 반복. 부팅 전류 패턴이 일정 지점에서 반복됨' : '로고 화면이 뜬 뒤 꺼졌다 켜지기를 반복합니다.'
  })[why] || '반응 없음';
  switch (id) {
    case 'power':
      add('[배터리만 연결] ' + (bootB.ok ? (pro ? '정상 부팅. 부팅 전류 0.42A → 대기 0.11A 안정' : '정상 부팅됨') : whyTxt(bootB.why, false)), bootB.ok ? 'ok' : 'bad');
      if (!bootB.ok) add('[충전기 연결] ' + (bootC.ok ? '부팅됨! (외부 전원이 있으면 켜짐)' : whyTxt(bootC.why, true)), bootC.ok ? 'warn' : 'bad');
      if (!pad && bootC.ok && ev.display !== 'ok' && ev.vibration === 'ok') add('※ 화면은 확인이 어렵지만 부팅 진동이 느껴집니다.', 'info');
      if (!bootB.ok && bootC.ok) hint('외부 전원으로는 켜진다 → 배터리 자체(방전·노후) 또는 전원 버튼 계통. 배터리 상태 검사와 하드웨어 자가진단으로 구분해 보세요.');
      if (!bootC.ok && bootC.why === 'pmic') hint('충전기로도 전혀 반응이 없다면 충전 경로/전원 관리 회로(메인보드) 계통일 수 있습니다. 충전 반응 검사로 확인.');
      if (bootC.why === 'bootloop') hint('로고까지 뜬다는 건 하드웨어 전원 경로는 살아 있다는 뜻. 소프트웨어 검사를 해보세요.');
      break;
    case 'charge': {
      const cs = chargeStatus(dev); const bi = battInfo(dev);
      if (boardState(dev) === 'missing') add('메인보드가 없어 검사할 수 없습니다.', 'bad');
      else if (cs === 'none') add(pro ? '충전 반응 없음. 입력 전류 0.00A @ 5V' : '충전기를 꽂아도 반응 없음 (0.0A)', 'bad');
      else if (cs === 'intermittent') add(pro ? '불안정: 0.00A ↔ 1.6A 반복. 케이블을 기울이면 끊김' : '충전이 됐다 끊겼다 반복합니다. 케이블을 움직이면 변화가 있음', 'warn');
      else if (!bi.present || !bi.connected) add('충전 회로 반응은 있으나 배터리가 검출되지 않음', 'warn');
      else add(pro ? '정상 충전 1.82A @ 9V (고속 충전 협상 성공)' : '충전 중 표시 정상, 전류 양호', 'ok');
      if (cs === 'intermittent') hint('간헐 충전은 포트 이물질·부식이 흔합니다. 확대경으로 포트 안을 관찰해 보세요. 청소로 해결될 수도 있습니다.');
      if (cs === 'none') hint('완전 무반응이면 포트 단자 파손, 포트~보드 사이 플렉스, 또는 전원 관리 회로를 의심. 다른 하단 기능(마이크·스피커)도 같이 죽었는지 확인해 보세요.');
      break;
    }
    case 'display':
      if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
      add({ ok: '화면 출력 정상. 색상·밝기 이상 없음', lines: '세로 줄 여러 개와 검은 잉크 번짐이 보입니다', none: '화면이 켜지지 않습니다 (기기는 부팅된 상태)', dark: '화면이 매우 어둡습니다. 손전등을 비추면 아이콘이 희미하게 보입니다', intermittent: '화면이 깜빡이며 간헐적으로 꺼집니다. 기기 상단을 살짝 누르면 변화가 있습니다' }[ev.display] || ev.display, ev.display === 'ok' ? 'ok' : 'bad');
      if (ev.display === 'none') hint('부팅은 되는데 화면만 없다면: 패널 고장, 커넥터 접촉 불량, (LCD라면) 백라이트 고장이 후보입니다.');
      if (ev.display === 'dark') hint('희미하게 보인다 = 영상 신호는 있고 빛만 없다 → LCD 백라이트 계통.');
      if (ev.display === 'intermittent') hint('눌렀을 때 변하는 깜빡임은 커넥터 접촉 불량의 전형적인 신호입니다. 교체 전에 재장착부터!');
      if (ev.display === 'lines') hint('줄·번짐은 패널 물리 손상이 대부분. 다만 접촉 불량 가능성도 열어두세요.');
      break;
    case 'touch':
      if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
      if (ev.display === 'none' || ev.display === 'dark') { add('화면이 보이지 않아 터치 격자 검사를 할 수 없습니다.', 'warn'); break; }
      add({ ok: '전 영역 터치 정상', partial: '격자 검사: 하단 약 1/3 영역 터치 불가', none: '터치 반응 없음', intermittent: '터치가 간헐적으로 끊깁니다', erratic: '손대지 않은 곳이 저절로 눌립니다(고스트 터치). 위치가 불규칙합니다' }[ev.touch] || ev.touch, ev.touch === 'ok' ? 'ok' : 'bad');
      if (ev.touch === 'erratic') hint('불규칙한 고스트 터치는 소프트웨어(입력 드라이버) 문제일 수도 있습니다. 소프트웨어 검사를 함께 보세요.');
      if (ev.touch === 'none') hint('화면은 나오는데 터치만 안 되면 터치 센서(디지타이저)·터치 커넥터 쪽입니다.');
      break;
    case 'camera':
      if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
      [['camera_rear', '후면'], ['camera_front', '전면']].forEach(([k, n]) => add(n + ' 카메라: ' + ({ ok: '정상 촬영', none: '카메라를 열 수 없음 (검은 화면·오류)', blur: '초점이 잡히지 않고 화면이 떨림' }[ev[k]] || ev[k]), ev[k] === 'ok' ? 'ok' : 'bad'));
      if (ev.camera_rear === 'none' || ev.camera_front === 'none') hint('"열 수 없음"이면 모듈 불량 또는 커넥터 분리. 소프트웨어 검사의 장치 목록에서 인식 여부를 확인하세요.');
      break;
    case 'audio':
      if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
      add('라우드 스피커: ' + ({ ok: '정상 재생', none: '소리 없음', distorted: '소리가 찢어지고 지직거림' }[ev.speaker] || ev.speaker), ev.speaker === 'ok' ? 'ok' : 'bad');
      add('통화 스피커: ' + ({ ok: '정상', none: '소리 없음' }[ev.earpiece] || ev.earpiece), ev.earpiece === 'ok' ? 'ok' : 'bad');
      add('마이크 녹음: ' + ({ ok: '정상 녹음', none: '녹음 신호 없음' }[ev.mic] || ev.mic), ev.mic === 'ok' ? 'ok' : 'bad');
      if (ev.mic === 'none' && (ev.speaker === 'none')) hint('하단 마이크와 스피커가 함께 안 되면, 둘을 잇는 공통 경로(충전 포트 모듈·메인 플렉스)를 의심.');
      break;
    case 'input': {
      if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
      const SK = { ok: '중앙 복귀 정상 · 전 방향 입력 정상', drift: pro ? '손을 뗀 상태 입력값 0.21 (정상 0.02 이하) — 한쪽으로 쏠림' : '손을 떼도 커서가 천천히 한쪽으로 흘러감', none: '입력 신호 없음' };
      const TG = { ok: '0→100% 부드럽게 입력 · 복귀 정상', stuck: pro ? '놓아도 68%에서 멈춤 · 값이 튐' : '놓아도 눌린 상태로 남아 있음', none: '입력 신호 없음' };
      [['stick_l', 'L 스틱', SK], ['stick_r', 'R 스틱', SK], ['trig_l', 'L 트리거', TG], ['trig_r', 'R 트리거', TG]].forEach(([k, n, T]) => add(n + ': ' + (T[ev[k]] || stKo(ev[k])), ev[k] === 'ok' ? 'ok' : 'bad'));
      add('버튼: ' + ({ ok: '모든 버튼 입력 정상', some_btn: 'A·B 버튼 입력이 간헐적으로 끊기거나 무반응', power_fail: '홈 버튼 무반응 (나머지 버튼 정상)', none: '모든 버튼 입력 없음' }[ev.buttons] || stKo(ev.buttons)), ev.buttons === 'ok' ? 'ok' : 'bad');
      if (ev.stick_l === 'drift' || ev.stick_r === 'drift') hint('손을 뗐는데도 입력이 남는 건 스틱 가변저항 트랙 마모(드리프트)의 전형. 확대경으로 모듈을 보면 검은 가루가 보일 수 있습니다.');
      if (ev.trig_l === 'stuck' || ev.trig_r === 'stuck') hint('복귀하지 않는 트리거는 스프링 이탈이 흔합니다. ⤴ 윗면 보기로 트리거 모양을 확인해 보세요.');
      if (ev.buttons === 'some_btn') hint('여러 버튼이 함께 약하면 버튼 아래 고무 멤브레인 마모·오염을 의심. 메인보드를 들어내야 꺼낼 수 있습니다.');
      if (ev.stick_l === 'none' || ev.stick_r === 'none' || ev.trig_l === 'none' || ev.trig_r === 'none') hint('입력이 아예 없으면 해당 모듈 커넥터가 빠져 있지 않은지 먼저 확인하세요.');
      break;
    }
    case 'wireless': {
      if (pad) {
        if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
        add('블루투스: ' + ({ ok: '정상 연결 · 신호 양호', weak: pro ? '신호 -91dBm (매우 약함) · 1~2m만 떨어져도 끊김' : '연결은 되지만 조금만 떨어져도 끊김', none: '기기가 검색되지 않음', pairfail: '기기는 검색되지만 페어링 실패(인증 오류)' }[ev.signal] || stKo(ev.signal)), ev.signal === 'ok' ? 'ok' : 'bad');
        if (ev.signal === 'weak') hint('가까이서만 연결된다면 안테나(또는 안테나 커넥터) 문제일 가능성이 큽니다.');
        if (ev.signal === 'pairfail') hint('검색은 되는데 페어링만 실패한다 → 하드웨어보다 펌웨어 문제일 수 있습니다. 소프트웨어 검사를 해보세요.');
        break;
      }
      if (!bootC.ok) { add(noBootMsg, 'bad'); } else {
        const b = partOf(dev, 'mainboard'); const modem = b && b.fault === 'board_baseband';
        add('셀룰러: ' + ({ ok: '신호 4칸 · IMEI 정상', weak: (pro ? '신호 -118dBm (매우 약함)' : '신호 0~1칸') + ' · IMEI 정상 인식', none: modem ? '서비스 없음 · IMEI 읽기 실패' : '신호 없음 · IMEI 정상 인식' }[ev.signal] || ev.signal), ev.signal === 'ok' ? 'ok' : 'bad');
        if (ev.signal === 'weak' || (ev.signal === 'none' && !modem)) hint('IMEI가 정상이면 모뎀은 살아 있다 → 안테나(또는 안테나 연결) 문제일 가능성이 큽니다.');
        if (modem) hint('IMEI를 읽지 못한다 = 모뎀(메인보드) 계통. 안테나 교체로는 해결되지 않습니다.');
      }
      if (ev.wireless_charge === 'na') add('무선 충전: 이 모델은 무선 충전을 지원하지 않습니다.', 'info');
      else add('무선 충전 패드: ' + (ev.wireless_charge === 'ok' ? '정상 반응' : '반응 없음'), ev.wireless_charge === 'ok' ? 'ok' : 'bad');
      break;
    }
    case 'hw':
      if (!bootC.ok) { add(noBootMsg, 'bad'); break; }
      add('진동 모터' + (pad ? '(좌·우)' : '') + ': ' + (ev.vibration === 'ok' ? '정상' : '진동 없음'), ev.vibration === 'ok' ? 'ok' : 'bad');
      if (pad) { add('버튼: ' + ({ ok: '홈·A·B·X·Y·방향키 입력 정상', some_btn: '일부 버튼(A·B) 입력 불량', power_fail: '홈(전원) 버튼 입력 없음', none: '모든 버튼 입력 없음' }[ev.buttons] || stKo(ev.buttons)), ev.buttons === 'ok' ? 'ok' : 'bad'); if (ev.buttons === 'power_fail') hint('홈 버튼이 전원 버튼 역할을 하므로, 홈 버튼이 고장 나면 "전원이 안 켜져요"처럼 보입니다.'); break; }
      add('버튼: ' + ({ ok: '전원·음량 버튼 입력 정상', power_fail: '전원 버튼 입력 없음 (음량 버튼 정상)', volume_fail: '음량 버튼 입력 없음 (전원 버튼 정상)', none: '모든 버튼 입력 없음' }[ev.buttons] || ev.buttons), ev.buttons === 'ok' ? 'ok' : 'bad');
      if (ev.buttons === 'power_fail' || ev.buttons === 'none') hint('전원 버튼이 안 되면 "전원이 안 켜져요"처럼 보입니다. 배터리·보드는 멀쩡할 수 있어요.');
      break;
    case 'battery': {
      const bi = battInfo(dev);
      if (!bi.present || !bi.connected) { add('배터리가 연결되어 있지 않습니다.', 'bad'); break; }
      if (pro) {
        add('배터리 분석기: 건강도 ' + bi.health + '% · 충전 사이클 ' + Math.round((100 - bi.health) * 9 + 40) + '회 · 내부저항 ' + (bi.health < 80 ? '높음' : '정상'), bi.health >= 80 ? 'ok' : 'bad');
        if (bi.swollen) add('셀 두께 이상 감지 — 팽창 의심', 'bad');
        if (dev.software === 'sw_drain') add('대기 소모 전류가 비정상적으로 높음 (380mA, 정상 20mA 이하)', 'warn');
      } else {
        if (!bootC.ok) { add('기기가 켜지지 않아 운영체제의 배터리 정보를 읽을 수 없습니다. (진단 보드가 있으면 직접 측정 가능)', 'bad'); break; }
        const est = clamp(bi.health + R.int(-7, 7), 0, 100);
        add('운영체제 보고 배터리 상태: 약 ' + est + '% (추정치, 오차 있음)', est >= 80 ? 'ok' : 'warn');
        if (bi.dead) add('전압이 매우 낮아 정확한 측정 불가', 'bad');
      }
      if (bi.health < 80) hint('건강도 80% 미만은 갑작스러운 꺼짐·빠른 소모의 흔한 원인. 교체 대상입니다.');
      if (bi.health >= 80 && dev.software === 'sw_drain') hint('배터리는 건강한데 빨리 닳는다면 소프트웨어 과소모를 의심.');
      break;
    }
    case 'software': {
      if (boardState(dev) !== 'ok' || !(bootC.ok || bootC.why === 'bootloop')) { add('복구 모드에 진입할 수 없습니다. (전원·보드 문제가 먼저 해결되어야 함)', 'bad'); break; }
      if (dev.software === 'sw_bootloop') { add('복구 모드 진단: 시스템 파티션 손상 감지 — 부팅 반복의 원인', 'bad'); hint('하드웨어가 아니라 소프트웨어 문제입니다. "소프트웨어 재설치"로 복구할 수 있습니다.'); break; }
      const m = MODELS[dev.modelId];
      if (pad) {
        const detp = (k, n) => { const ok = ev[k] !== 'none' && ev[k] !== 'noboot'; add('장치 목록 · ' + n + ': ' + (ok ? '인식됨' : '미검출'), ok ? 'ok' : 'bad'); };
        detp('stick_l', 'L 스틱'); detp('stick_r', 'R 스틱'); detp('trig_l', 'L 트리거'); detp('trig_r', 'R 트리거'); detp('vibration', '진동 모터');
        if (dev.software === 'fw_pair') { add('오류 로그: 페어링 키 저장 영역 손상 (pair_store CRC 오류)', 'bad'); hint('하드웨어가 아닌 펌웨어 문제입니다. "소프트웨어 재설치"(펌웨어 재설치)로 고칠 수 있습니다.'); }
        else add('펌웨어 무결성: 이상 없음', 'ok');
        break;
      }
      const det = (k, n) => { const ok = ev[k] !== 'none' && ev[k] !== 'noboot'; add('장치 목록 · ' + n + ': ' + (ok ? '인식됨' : '미검출'), ok ? 'ok' : 'bad'); };
      det('display', '디스플레이 컨트롤러'); det('touch', '터치 컨트롤러'); det('camera_rear', '후면 카메라'); det('camera_front', '전면 카메라');
      det('mic', '하단 마이크'); det('speaker', '스피커 앰프');
      const b = partOf(dev, 'mainboard'); add('모뎀: ' + (b && b.fault === 'board_baseband' ? 'IMEI 읽기 실패' : 'IMEI 정상'), b && b.fault === 'board_baseband' ? 'bad' : 'ok');
      if (dev.software === 'sw_touch') { add('오류 로그: 입력 드라이버 충돌 1,284건 (input_hal crash)', 'bad'); hint('하드웨어가 아닌 드라이버 오류. 소프트웨어 재설치로 고칠 수 있습니다.'); }
      else if (dev.software === 'sw_drain') { add('오류 로그: 백그라운드 프로세스 "syncd"가 CPU 94% 상시 점유', 'bad'); hint('부품 교체 없이 소프트웨어 재설치로 해결 가능한 배터리 소모입니다.'); }
      else add('운영체제 무결성: 이상 없음', 'ok');
      if (m.paths.wireless_charge) det('wireless_charge', '무선 충전 수신부');
      break;
    }
  }
  return { lines: L, hints: H };
}
function inspectText(dev, kind, id, inTray) {
  const lvTool = S.tools.microscope ? 2 : 1;
  const pre = lvTool === 2 ? '[현미경] ' : '[확대경] ';
  if (kind === 'lci') return pre + (dev.lciRed ? '침수 감지 라벨이 빨갛게 변해 있다 → 이 기기는 물에 젖은 적이 있다.' : '침수 감지 라벨은 흰색. 침수 흔적 없음.');
  if (kind === 'conn') {
    const c = dev.conns[id]; const cd = mConn(dev, id);
    if (c.loose) return pre + (lvTool >= 2 ? FAULTS.disp_loose.visual.text : FAULTS.disp_loose.visual.basic);
    return pre + cd.label + ': ' + (c.on ? '단단히 결합되어 있다.' : '분리된 상태. 핀 손상은 없다.');
  }
  if (kind === 'port') {
    const p = partOf(dev, 'charge_port');
    if (!p) return pre + '포트 모듈이 없다.';
    const f = p.fault && FAULTS[p.fault];
    if (f && f.visual && f.visual.ext && f.visual.need <= lvTool) return pre + '충전 포트 내부: ' + f.visual.text;
    if (f && f.visual && f.visual.ext) return pre + '포트 안쪽이 어두워 잘 보이지 않는다. (더 좋은 장비가 필요할 수도)';
    return pre + '충전 포트 내부는 깨끗하다.';
  }
  if (kind === 'chip') {
    const [sid, ctype] = id.split('|'); const p = partOf(dev, sid);
    const f = p && p.fault && FAULTS[p.fault];
    let t = pre + PART_TYPES[ctype].name + ' 칩이다. ';
    if (f && f.visual && f.visual.chip === ctype) t += f.visual.need <= lvTool ? f.visual.text : '주변에 무언가 있는 것 같지만 확대경으로는 확실하지 않다.';
    else t += '눈에 띄는 손상은 없다.';
    return t;
  }
  const p = kind === 'part' ? id : partOf(dev, id);
  if (!p) return '';
  const out = [];
  if (p.cracked) out.push('유리가 깨져 있다.');
  if (p.swollen) out.push('배터리가 부풀어 있다!');
  const f = p.fault && FAULTS[p.fault];
  if (f && f.visual) {
    if (f.visual.need <= lvTool) out.push(f.visual.text);
    else out.push(f.visual.basic || '미세한 흔적이 있는 것 같지만 확대경으로는 확신할 수 없다.');
  } else if (p.fault === 'short') out.push('커넥터 주변이 검게 그을려 있다. 단락 흔적!');
  else if (p.fault === 'heat_damage') out.push('패널 일부가 열에 변색되어 있다.');
  if (p.defect) { if (lvTool >= 2 && R.chance(0.6)) out.push('커넥터 핀 하나가 미세하게 휘어 있다 (초기 불량 의심).'); }
  if (p.type === 'battery') out.push('라벨: 3.87V · ' + (p.origin === 'original' ? '정품' : p.grade + '급 호환품'));
  if (p.grade === 'B') out.push('마감이 다소 거칠다 (B급 호환 부품).');
  if (!out.length || (out.length === 1 && p.type === 'battery')) out.unshift('외관상 특별한 이상은 보이지 않는다.');
  return pre + out.join(' ');
}

/* ---------- 최종 점검 · 반환 ---------- */
function assemblyIssues(dev) {
  const m = MODELS[dev.modelId]; const I = { missing: [], screws: 0, conns: [], loose: [], adhesive: [], open: [] };
  m.slots.forEach(sd => {
    const st = dev.slots[sd.id];
    if (!st.part) { I.missing.push(sd); return; }
    I.screws += st.screws.filter(x => !x).length;
    if (sd.hinge && st.open) I.open.push(sd);
    if (sd.adhesive && sd.adhesive.kind === 'glue' && (st.adhesive === 'none' || st.adhesive === 'cut')) I.adhesive.push(sd);
  });
  m.conns.forEach(c => { if (connPresent(dev, c) && !dev.conns[c.id].on) I.conns.push(c); if (dev.conns[c.id].loose && dev.conns[c.id].on) I.loose.push(c); });
  return I;
}
function qcReport(dev) {
  const ev = evalAll(dev, false); const I = assemblyIssues(dev);
  const fails = FUNC_KEYS.filter(k => !funcOK(ev[k]));
  return { ev, I, fails, pass: !fails.length && !I.missing.length && !I.screws && !I.conns.length && !I.open.length };
}
function refDevice(tk, faultList) {
  const dev = createDevice(tk.modelId, [], { battHealth: 100 });
  faultList.forEach(f => {
    const fd = FAULTS[f.id]; let h;
    if (fd.health) { const sid = faultSlot(tk.modelId, f.id); const p = partOf(tk.device, sid); h = p ? p.health : 60; }
    applyFault(dev, f.id, { health: h });
  });
  return dev;
}
function faultStillPresent(dev, fid) {
  const f = FAULTS[fid];
  if (f.software) return dev.software === fid;
  if (f.conn) return dev.conns[f.conn].loose;
  const sid = faultSlot(dev.modelId, fid); const p = partOf(dev, sid);
  return !!(p && p.fault === fid);
}
function evaluateReturn(tk) {
  const dev = tk.device; const I = assemblyIssues(dev);
  const actual = evalAll(dev, false);
  const keep = tk.status === 'rejected' ? tk.faults : tk.faults.filter(f => !f.noticed && faultStillPresent(dev, f.id));
  const ref = evalAll(refDevice(tk, keep), false);
  const complaintEv = evalAll(refDevice(tk, tk.faults.filter(f => f.noticed)), false);
  const problems = [];
  FUNC_KEYS.forEach(k => {
    if (funcOK(ref[k]) && !funcOK(actual[k])) problems.push({ k, complaint: !funcOK(complaintEv[k]) && tk.status !== 'rejected', st: actual[k] });
  });
  I.missing.forEach(sd => { if (!problems.some(p => p.missing === sd.id)) problems.push({ missing: sd.id, label: sd.label || PART_TYPES[sd.type].name }); });
  return { problems, I, actual };
}
function closeTicket(tk, forceFail) {
  const dev = tk.device; const ret = evaluateReturn(tk); const I = ret.I;
  const rejected = tk.status === 'rejected';
  const success = !ret.problems.length && !forceFail;
  const fb = [];
  let paid = 0, sat;
  const late = Math.max(0, Math.ceil((S.t - tk.deadlineT) / DAY));
  // 불필요 교체 판정
  const unnecessary = dev.tray.filter(p => p.origin === 'original' && !p.fault && !p.defect && !p.cracked && !(p.type === 'battery' && p.health < 80) && !['shield', 'heatsink'].includes(p.type));
  const installedNew = MODELS[dev.modelId].slots.map(sd => partOf(dev, sd.id)).filter(p => p && p.origin === 'stock' && !p.countedCost);
  const partsCost = installedNew.reduce((s, p) => s + (p.cost || 0), 0);
  installedNew.forEach(p => { p.countedCost = true; });
  if (rejected) {
    sat = success ? 3 : 1;
    fb.push(success ? '수리를 거절한 고객에게 기기를 원래 상태로 돌려드렸습니다.' : '거절한 고객의 기기가 맡길 때보다 나빠진 상태로 반환되었습니다!');
  } else if (success) {
    paid = tk.quote ? tk.quote.total : 0;
    sat = 5 + tk.satAdj - Math.min(2, late) - (I.screws ? 1 : 0) - (I.adhesive.length ? 0.5 : 0) + (S.upgrades.sofa ? 0.3 : 0);
    sat = clamp(Math.round(sat * 2) / 2, 1, 5);
  } else {
    sat = 1;
  }
  ret.problems.forEach(p => fb.push(p.missing ? '❌ 부품 누락: ' + p.label : (p.complaint ? '❌ 원래 증상 미해결: ' : '❌ 수리 중 새로 생긴 문제: ') + FUNC_NAMES[p.k] + ' (' + stKo(p.st) + ')'));
  if (I.screws) fb.push('⚠ 나사 ' + I.screws + '개 누락 — 고정이 약해 재방문 가능성');
  if (I.adhesive.length) fb.push('⚠ 접착 테이프 미부착: ' + I.adhesive.map(s => PART_TYPES[s.type].name).join(', '));
  if (late) fb.push('⏰ 약속한 기한보다 ' + late + '일 늦었습니다.');
  if (unnecessary.length) fb.push('💸 정상 부품을 불필요하게 교체: ' + unnecessary.map(p => PART_TYPES[p.type].name).join(', '));
  if (paid > 0) earn(paid, '수리비', tk.id + ' ' + tk.cust.name + ' (' + MODELS[tk.modelId].name + ')');
  // 경험치
  if (!rejected) {
    const diff = MODELS[tk.modelId].difficulty;
    const hintMul = tk.tutorial ? 1 : Math.pow(0.7, tk.hints);
    if (success) {
      addXP('assembly', Math.round((15 + diff * 6) * hintMul));
      if (!unnecessary.length) { addXP('diag', Math.round((25 + diff * 8) * hintMul)); fb.unshift('🎯 정확한 진단! 진단 경험치 보너스'); }
      addXP('consult', Math.round(sat * 3));
      if (tk.workMin < 90) addXP('speed', 10);
      S.dayLog.repairs++;
    } else addXP('diag', 5);
  }
  S.rep = clamp(S.rep + (sat - 3) * 0.07 - (success ? 0 : 0.15), 0, 5);
  // 트레이 정리
  dev.tray.slice().forEach(p => { if (p.origin === 'original') S.scrap.push(p); else S.inv.push(p); });
  dev.tray = [];
  // 재방문 예약
  const cb = [];
  if (success && !rejected) {
    if (I.screws && R.chance(0.4)) cb.push({ reason: 'screws', say: '지난번에 고친 뒤로 화면(뒷판)이 살짝 들뜨고 삐걱거려요.' });
    if (I.adhesive.length && R.chance(0.3)) cb.push({ reason: 'adhesive', say: '지난번 수리 후에 틈이 벌어진 것 같아요. 물 들어갈까 봐 걱정돼요.' });
    MODELS[dev.modelId].slots.forEach(sd => { const p = partOf(dev, sd.id); if (p && p.origin === 'stock' && p.vendor && R.chance(VENDORS[p.vendor].failLater)) { cb.push({ reason: 'partfail', part: p, say: '지난번에 바꾼 ' + PART_TYPES[p.type].name + '이(가) 또 고장 났어요!' }); } });
    tk.faults.filter(f => !f.noticed && faultStillPresent(dev, f.id)).forEach(f => { if (R.chance(0.4)) cb.push({ reason: 'hidden', fid: f.id, say: '다른 데도 고장 난 걸 나중에 알았어요. ' + R.pick(FAULTS[f.id].say) }); });
  }
  cb.slice(0, 1).forEach(c => {
    const warranty = c.reason !== 'hidden';
    if (c.part) { c.part.fault = 'short'; c.part.lateFail = true; }
    const hidden = tk.faults.filter(f => f.id !== c.fid && faultStillPresent(dev, f.id)).map(f => ({ id: f.id, noticed: false }));
    S.comebacks.push({ day: dayIdx() + R.int(2, 7), cust: { name: tk.cust.name, avatar: tk.cust.avatar, persona: tk.cust.persona, modelId: tk.modelId, device: dev,
      faults: (c.fid ? [{ id: c.fid, noticed: true }] : []).concat(hidden), cause: 'unknown', scenario: null, ageMonths: tk.ageMonths + 1, budget: c.fid ? Math.round(fairPrice(tk.modelId, [c.fid]) * 1.3 / 1000) * 1000 : 0,
      deadlineDays: 2, complaint: c.say, asked: {}, warranty, parentId: tk.id, exterior: {}, comebackReason: c.reason } });
  });
  // 기록
  const rec = {
    id: tk.id, t: S.t, created: tk.created, name: tk.cust.name, model: MODELS[tk.modelId].name, complaint: tk.complaint,
    diagnosis: tk.quote ? tk.quote.lines.map(l => l.label).join(', ') : '(견적 없음)',
    truth: tk.faults.map(f => FAULTS[f.id].name + (f.noticed ? '' : ' (고객 미인지)')).join(', ') || '(고장 없음 — 보증 점검)',
    replaced: installedNew.map(p => PART_TYPES[p.type].name + ' [' + (VENDORS[p.vendor] ? VENDORS[p.vendor].name : '-') + ']').join(', ') || '없음',
    partsCost, paid, workMin: Math.round(tk.workMin), result: rejected ? (success ? '수리 거절·반환' : '거절·손상 반환') : success ? '수리 완료' : '수리 실패',
    warrantyUntil: success && !rejected ? S.t + 30 * DAY : null, sat, warranty: tk.warranty, feedback: fb, hints: tk.hints
  };
  S.records.unshift(rec);
  addReview(rec, tk);
  S.tickets = S.tickets.filter(x => x !== tk);
  if (S.bench === tk.id) S.bench = null;
  advance(5, '반환');
  Bus.emit('tickets');
  save();
  return { rec, success, paid, sat, fb };
}

function walkIn() {
  if (S.tut.active && !S.tut.done) return;
  const m = minOfDay(), d = dayIdx();
  if (m < OPEN || m > 17 * 60 + 30) return;
  if (S.queue.some(c => !c.tutorial)) return;
  if (S.arrivals.some(a => dayIdx(a.t) === d)) return;
  if (S.tickets.length >= shelfCap()) return;
  S.flags.walkins = S.flags.walkins || {};
  if ((S.flags.walkins[d] || 0) >= 4) return;
  S.flags.walkins[d] = (S.flags.walkins[d] || 0) + 1;
  S.arrivals.push({ t: Math.min(d * DAY + 17 * 60 + 40, S.t + R.int(20, 70)), cust: genCustomer() });
}
/* ---------- 하루 처리 ---------- */
function scheduleDay() {
  const d = dayIdx();
  let n = 2 + (S.rep >= 3.6 ? 1 : 0) + (S.rep >= 4.4 ? 1 : 0) + (S.upgrades.sign ? 1 : 0) + shopLoc().cust + reviewCustBonus() + newsCustBonus(d) + R.int(-1, 1) - (S.rep < 2 ? 1 : 0);
  n = clamp(n, 1, 10);
  const times = []; for (let i = 0; i < n; i++) times.push(d * DAY + R.int(9 * 60 + 20, 17 * 60 + 30));
  times.sort((a, b) => a - b).forEach(t => S.arrivals.push({ t, cust: genCustomer() }));
  // 재방문
  S.comebacks.filter(c => c.day <= d).forEach(c => {
    const cust = c.cust; cust.cid = 'C' + (S.nextCust++); cust.arrival = true;
    S.arrivals.push({ t: d * DAY + R.int(10 * 60, 16 * 60), cust });
  });
  S.comebacks = S.comebacks.filter(c => c.day > d);
  S.arrivals.sort((a, b) => a.t - b.t);
}
function endDay() {
  const d = dayIdx(); const sum = { day: d + 1, rev: S.dayLog.rev, exp: S.dayLog.exp, repairs: S.dayLog.repairs, notes: [] };
  if (S.queue.length) { const n = S.queue.filter(c => !c.tutorial).length; S.rep = clamp(S.rep - 0.04 * n, 0, 5); if (n) sum.notes.push('응대하지 못한 손님 ' + n + '명이 돌아갔습니다.'); S.queue = S.queue.filter(c => c.tutorial); }
  // 미도착 손님은 내일로 이월하지 않음
  S.arrivals = S.arrivals.filter(a => a.cust.tutorial);
  // 전기요금(일)
  const elec = 6000 + Math.max(0, Math.round((minOfDay() - CLOSE) / 60)) * 1500;
  pay(elec, '전기요금', (d + 1) + '일차 전기요금');
  // 자동 발주
  if (S.upgrades.autoorder) {
    const need = [];
    Object.entries(S.minStock).forEach(([sku, min]) => {
      const have = sku === 'adhesive' ? S.consum.adhesive : S.inv.filter(p => p.sku === sku).length;
      const pending = S.orders.filter(o => !o.opened).reduce((s, o) => s + o.items.filter(i => i.sku === sku).reduce((a, i) => a + i.qty, 0), 0);
      if (have + pending < min) need.push({ sku, vendor: 'normal', qty: min - have - pending });
    });
    if (need.length) { const saved = S.cart; S.cart = need.filter(n => (S.vstock[n.sku + '|normal'] || 0) >= n.qty); if (S.cart.length) { const r = placeOrder(false); sum.notes.push('자동 발주: ' + r.msg); } S.cart = saved; }
  }
  sum.notes.unshift('전기요금 ' + WON(elec) + ' 청구' + (minOfDay() > CLOSE ? ' (야간 연장 영업 포함)' : ''));
  const nd = d + 1;
  bizEndDay(sum);
  loansDaily(sum, nd % 7 === 0);
  if (nd % 7 === 0) {
    const bizCut = 1 - 0.03 * skillLv('biz');
    const rent = Math.round(shopLoc().rent * bizCut), senior = 300000, salary = 200000;
    pay(rent, '임대료', '주간 임대료 (' + shopLoc().name + ')'); pay(senior, '직원 급여', '박준호 선임 주급'); pay(salary, '직원 급여', '내 주급');
    S.savings += salary;
    sum.notes.push('주간 고정비 청구: 임대료 ' + WON(rent) + ', 선임 급여 ' + WON(senior) + ', 내 급여 ' + WON(salary) + ' (내 통장 누적 ' + WON(S.savings) + ')');
    const wk = S.history.slice(-6); const profit = wk.reduce((s, h) => s + h.rev - h.exp, 0) + S.dayLog.rev - S.dayLog.exp;
    if (profit > 0) addXP('biz', 30); else addXP('biz', 8);
    sum.notes.push('이번 주 손익(고정비 포함): ' + WON(profit));
  } else sum.notes.push('주간 고정비 정산까지 ' + (7 - (nd % 7)) + '일');
  sum.exp = S.dayLog.exp;
  S.history.push({ day: d + 1, rev: S.dayLog.rev, exp: S.dayLog.exp, money: S.money, rep: S.rep });
  // 다음 날
  S.t = (d + 1) * DAY + OPEN;
  S.dayLog = { rev: 0, exp: 0, repairs: 0 };
  processTime();
  updateMarket(false);
  sum.notes.push('부품 시세가 변동되었습니다.');
  S.tickets.forEach(tk => { if (tk.deadlineT < S.t && !tk.lateWarned) { tk.lateWarned = true; S.rep = clamp(S.rep - 0.1, 0, 5); sum.notes.push('⏰ ' + tk.cust.name + ' 님 수리 기한이 지났습니다. 고객이 전화로 항의했습니다.'); } });
  scheduleDay(); // 튜토리얼 진행 중이어도 다음 날 손님은 온다
  if (S.money < 0) sum.notes.push('⚠ 매장 자금이 마이너스입니다! 사장님이 걱정하고 있습니다.');
  sum.money = S.money; sum.rep = S.rep;
  save();
  Bus.emit('day', sum);
  return sum;
}

/* ---------- 도구 ---------- */
function hasTool(k) { return !!S.tools[k]; }
function buyTool(k) {
  const t = TOOLS[k];
  if (S.tools[k] && !['spudger', 'pick'].includes(k)) return { ok: false, msg: '이미 보유 중입니다.' };
  if (S.money < t.price) return { ok: false, msg: '자금이 부족합니다.' };
  pay(t.price, '도구 구입', t.name); S.tools[k] = 1;
  return { ok: true, msg: t.name + ' 구입 완료! ' + t.desc };
}
function refillTool(k) {
  const price = k === 'spudger' ? 6000 : 8000;
  if (S.money < price) return { ok: false, msg: '자금이 부족합니다.' };
  pay(price, '도구 구입', TOOLS[k].name + ' 새 제품'); S.tools[k] = k === 'spudger' ? 80 : 40;
  return { ok: true, msg: TOOLS[k].name + '을(를) 새것으로 교체했습니다.' };
}
function wearTool(k) {
  if (typeof S.tools[k] === 'number' && !['hand'].includes(k) && (k === 'spudger' || k === 'pick')) {
    S.tools[k] = Math.max(0, S.tools[k] - 1);
    if (S.tools[k] === 5) Bus.emit('toast', { icon: '🔧', text: TOOLS[k].name + '이(가) 거의 닳았습니다. 장비몰에서 새로 구입하세요.' });
  }
}
function toolUsable(k) { if (k === 'spudger' || k === 'pick') return S.tools[k] > 0; return !!S.tools[k]; }
function buyUpgrade(k) {
  const u = UPGRADES[k];
  if (S.upgrades[k]) return { ok: false, msg: '이미 설치되어 있습니다.' };
  if (u.req && Object.entries(u.req).some(([s, lv]) => skillLv(s) < lv)) return { ok: false, msg: '조건: ' + Object.entries(u.req).map(([s, lv]) => SKILLS[s].name + ' Lv' + lv).join(', ') };
  if (S.money < u.price) return { ok: false, msg: '자금이 부족합니다.' };
  pay(u.price, '매장 업그레이드', u.name); S.upgrades[k] = true;
  return { ok: true, msg: u.name + ' 완료!' };
}

/* ---------- 교과서 ---------- */
function discover(type, lv) {
  if (!PART_TYPES[type]) return false;
  const b = S.book[type] || (S.book[type] = { lv: 0, fav: false, memo: '' });
  if (b.lv >= lv) return false;
  const first = b.lv === 0; b.lv = lv;
  if (first) Bus.emit('discover', type);
  else Bus.emit('booklv', { type, lv });
  return true;
}
function discoveredCount() { return BOOK_ORDER.filter(t => (S.book[t] || {}).lv >= 2).length; }

/* ---------- 저장 ---------- */
let saveTimer = null;
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); } }
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 600); }
function load() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return false; const s = JSON.parse(raw); if (!s || s.ver !== 1) return false; S = Object.assign(newState(), s); return true; } catch (e) { return false; }
}
function exportSave() { return JSON.stringify(S); }
function importSave(txt) { const s = JSON.parse(txt); if (!s || s.ver !== 1 || typeof s.t !== 'number') throw new Error('올바른 세이브 파일이 아닙니다.'); S = Object.assign(newState(), s); save(); }
