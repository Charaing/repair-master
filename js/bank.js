'use strict';
/* =========================================================================
   REPAIR MASTER — 대출 (가상 은행 "새싹저축은행")
   이자는 매일 쌓이고, 7일마다 주간 정산 때 (이자 + 원금 분할금)이 자동 출금된다.
   ========================================================================= */
const LOAN_PRODUCTS = [
  { id: 'emergency', name: '비상 운영자금', icon: '🆘', max: 300000, rate: 0.03, weeks: 4, reqText: '조건 없음 · 금리 높음', req: () => true },
  { id: 'small', name: '소상공인 운영자금', icon: '🏪', max: 1500000, rate: 0.012, weeks: 8, reqText: '평판 2.5 이상', req: () => S.rep >= 2.5 },
  { id: 'equip', name: '장비·확장 시설자금', icon: '🛠', max: 4000000, rate: 0.008, weeks: 16, reqText: '평판 3.3 이상 · 7일차부터', req: () => S.rep >= 3.3 && dayIdx() >= 6 }
];
const loanProduct = id => LOAN_PRODUCTS.find(p => p.id === id);
const loanLeft = () => (S.loans || []).reduce((a, l) => a + l.left + l.interest, 0);
function creditLimit() {
  const weeks = Math.floor(dayIdx() / 7);
  const lim = 600000 + Math.max(0, S.rep - 2) * 800000 + Math.min(10, weeks) * 150000 - (S.flags.loanLate || 0) * 300000;
  return Math.max(0, Math.floor(lim / 100000) * 100000);
}
function creditRoom() { return Math.max(0, creditLimit() - (S.loans || []).reduce((a, l) => a + l.left, 0)); }
function loanInstallment(l) { return l.interest + Math.min(l.left, Math.ceil(l.principal / l.weeks / 1000) * 1000); }
function takeLoan(pid, amt) {
  const p = loanProduct(pid); S.loans = S.loans || [];
  if (!p) return { ok: false, msg: '상품을 찾을 수 없습니다.' };
  if (!p.req()) return { ok: false, msg: '대출 조건을 충족하지 못했습니다: ' + p.reqText };
  if (S.loans.some(l => l.pid === pid)) return { ok: false, msg: '같은 상품의 대출이 이미 있습니다. 먼저 상환하세요.' };
  amt = Math.round(amt / 10000) * 10000;
  if (amt < 100000) return { ok: false, msg: '최소 대출 금액은 ₩100,000입니다.' };
  if (amt > p.max) return { ok: false, msg: '이 상품의 최대 한도는 ' + WON(p.max) + '입니다.' };
  if (amt > creditRoom()) return { ok: false, msg: '신용 한도가 부족합니다. (남은 한도 ' + WON(creditRoom()) + ')' };
  const l = { id: 'L' + (S.nextLoan = (S.nextLoan || 0) + 1), pid, name: p.name, principal: amt, left: amt, interest: 0, rate: p.rate, weeks: p.weeks, startT: S.t, paidInt: 0 };
  S.loans.push(l);
  S.money += amt; addLedger(amt, '대출', p.name + ' 실행 (' + l.id + ')'); Bus.emit('money');
  save();
  return { ok: true, loan: l, msg: p.name + ' ' + WON(amt) + '이(가) 매장 계좌로 입금되었습니다.' };
}
function repayLoan(id, amt) {
  const l = (S.loans || []).find(x => x.id === id); if (!l) return { ok: false, msg: '대출을 찾을 수 없습니다.' };
  amt = Math.min(amt, l.left + l.interest);
  if (amt <= 0) return { ok: false, msg: '상환할 금액이 없습니다.' };
  if (amt > S.money) return { ok: false, msg: '매장 자금이 부족합니다. (보유 ' + WON(S.money) + ')' };
  applyLoanPayment(l, amt);
  save();
  return { ok: true, msg: WON(amt) + ' 상환했습니다.' + (S.loans.includes(l) ? ' 남은 잔액 ' + WON(l.left + l.interest) : ' 대출을 모두 갚았습니다! 🎉') };
}
function applyLoanPayment(l, amt) {
  const pi = Math.min(l.interest, amt); if (pi > 0) { pay(pi, '대출 이자', l.name + ' 이자'); l.interest -= pi; l.paidInt += pi; }
  const pp = Math.min(l.left, amt - pi); if (pp > 0) { S.money -= pp; l.left -= pp; addLedger(-pp, '대출 상환', l.name + ' 원금 상환'); Bus.emit('money'); }
  if (l.left <= 0 && l.interest <= 0) { S.loans = S.loans.filter(x => x !== l); (S.loanHist = S.loanHist || []).push({ id: l.id, name: l.name, principal: l.principal, paidInt: l.paidInt, endT: S.t }); }
}
/* endDay에서 호출: 하루 이자 누적, 주간 정산일에는 분할 상환 자동 출금 */
function loansDaily(sum, weekly) {
  (S.loans || []).forEach(l => { l.interest += Math.round(l.left * l.rate / 7); });
  if (!weekly || !(S.loans || []).length) return;
  S.loans.slice().forEach(l => {
    const due = loanInstallment(l);
    applyLoanPayment(l, due);
    sum.notes.push('🏦 ' + l.name + ' 주간 상환 ' + WON(due) + ' 자동 출금' + (S.loans.includes(l) ? ' (잔액 ' + WON(l.left + l.interest) + ')' : ' — 완납!'));
  });
  if (S.money < 0) {
    S.flags.loanLate = (S.flags.loanLate || 0) + 1; S.rep = clamp(S.rep - 0.1, 0, 5);
    sum.notes.push('⚠ 대출 상환 후 잔고가 마이너스입니다. 연체로 기록되어 신용 한도가 줄고 평판이 떨어졌습니다.');
  }
}

/* ---------- 은행 앱 ---------- */
Computer.app_bank = function (el) {
  S.loans = S.loans || [];
  const lim = creditLimit(), room = creditRoom();
  const nextSettle = (Math.floor(dayIdx() / 7) + 1) * 7 - dayIdx();
  el.innerHTML = `<div class="browser"><div class="addr"><span>🔒 https://ssak-bank.kr/biz</span></div><div class="mall-b">
    <div class="acct-top"><div class="kpi"><span>매장 자금</span><b class="${S.money < 0 ? 'bad' : ''}">${WON(S.money)}</b></div><div class="kpi"><span>대출 잔액</span><b class="${S.loans.length ? 'bad' : ''}">${WON(loanLeft())}</b></div><div class="kpi"><span>신용 한도</span><b>${WON(lim)}</b></div><div class="kpi"><span>남은 한도</span><b class="ok">${WON(room)}</b></div></div>
    <p class="small muted">🌱 새싹저축은행 (가상 은행) · 이자는 매일 쌓이고, 주간 정산일(${nextSettle}일 뒤 마감 때)마다 이자 + 원금 분할금이 매장 계좌에서 자동 출금됩니다. 한도는 평판과 영업 기간에 따라 늘고, 연체하면 줄어듭니다.${S.flags.loanLate ? ' <b class="bad">연체 기록 ' + S.flags.loanLate + '회</b>' : ''}</p>
    <h4>내 대출</h4>${S.loans.length ? `<table class="tbl"><thead><tr><th>상품</th><th>원금 잔액</th><th>쌓인 이자</th><th>다음 주 출금</th><th></th></tr></thead><tbody>${S.loans.map(l => `<tr><td><b>${esc(l.name)}</b><br><small class="muted">${l.id} · ${fmtDT(l.startT)} 실행 · 주 ${(l.rate * 100).toFixed(1)}%</small></td><td>${WON(l.left)}</td><td>${WON(l.interest)}</td><td>${WON(loanInstallment(l))}</td><td class="nowrap"><button class="btn sm" data-rp="${l.id}" data-amt="100000">10만 갚기</button> <button class="btn sm primary" data-rp="${l.id}" data-amt="all">전액 상환</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted">진행 중인 대출이 없습니다.</p>'}
    <h4>대출 상품</h4><div class="loan-list">${LOAN_PRODUCTS.map(p => {
      const has = S.loans.some(l => l.pid === p.id), ok = p.req(); const mx = Math.min(p.max, room);
      const opts = []; for (let a = 100000; a <= mx; a += a < 1000000 ? 100000 : 500000) opts.push(a);
      return `<div class="loan-card${ok && !has ? '' : ' off'}"><div class="lc-h">${p.icon} <b>${esc(p.name)}</b></div>
        <div class="small">최대 ${WON(p.max)} · 주 이자 ${(p.rate * 100).toFixed(1)}% · ${p.weeks}주 분할 상환</div><div class="small muted">${esc(p.reqText)}</div>
        ${has ? '<div class="small ok">이용 중</div>' : !ok ? '<div class="small bad">조건 미충족</div>' : !opts.length ? '<div class="small bad">남은 한도 부족</div>' : `<div class="row"><select data-amt-of="${p.id}">${opts.map(a => `<option value="${a}">${WON(a)}</option>`).join('')}</select><button class="btn sm primary" data-loan="${p.id}">대출 신청</button></div>`}</div>`;
    }).join('')}</div>
    ${(S.loanHist || []).length ? `<h4>완납한 대출</h4><table class="tbl"><tbody>${S.loanHist.slice(-10).reverse().map(h => `<tr><td>${esc(h.name)}</td><td>원금 ${WON(h.principal)}</td><td>낸 이자 ${WON(h.paidInt)}</td><td>${fmtDT(h.endT)} 완납</td></tr>`).join('')}</tbody></table>` : ''}
  </div></div>`;
  $$('[data-loan]', el).forEach(b => b.onclick = () => {
    const p = loanProduct(b.dataset.loan); const amt = +$(`[data-amt-of="${p.id}"]`, el).value;
    const per = Math.ceil(amt / p.weeks / 1000) * 1000, wkInt = Math.round(amt * p.rate);
    UI.choice('🏦 대출 신청 확인', `${p.name} ${WON(amt)}을(를) 빌릴까요? 매주 약 ${WON(per + wkInt)} (원금 ${WON(per)} + 이자 약 ${WON(wkInt)})이 ${p.weeks}주 동안 자동 출금됩니다. 총 이자는 약 ${WON(Math.round(amt * p.rate * (p.weeks + 1) / 2))}입니다.`, [['대출 받기', () => { const r = takeLoan(p.id, amt); UI.toast(r.ok ? '🏦' : '⚠', r.msg); Computer.refresh(); UI.hud(); }], ['취소', () => { }]]);
  });
  $$('[data-rp]', el).forEach(b => b.onclick = () => {
    const l = S.loans.find(x => x.id === b.dataset.rp); const amt = b.dataset.amt === 'all' ? l.left + l.interest : +b.dataset.amt;
    const r = repayLoan(l.id, amt); UI.toast(r.ok ? '🏦' : '⚠', r.msg); Computer.refresh(); UI.hud();
  });
};
