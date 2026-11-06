'use strict';
/* =========================================================================
   REPAIR MASTER — 튜토리얼 (첫 손님을 통해 자연스럽게 배우기)
   ========================================================================= */
const TUT = {};
const tutTk = () => S.tickets.find(t => t.tutorial);
const tutDev = () => { const t = tutTk(); return t ? t.device : null; };
const TF = () => (S.tut.f = S.tut.f || {});
const TSTEPS = [
  { t: '어서 와요! 오늘부터 같이 일할 <b>박준호 선임</b>이에요. 마침 첫 손님이 오셨네요. 왼쪽의 <b>접수대</b>를 눌러 손님을 맞이해 봐요.', hi: 'scene:counter', ok: () => TF().counter || !!tutTk() },
  { t: '손님 말은 <b>단서</b>일 뿐이에요. 같은 증상도 원인이 여러 가지거든요. 추가 질문으로 정보를 더 얻어봐요. <b>"떨어뜨리거나 물에 젖은 적 있나요?"</b>를 눌러봐요.', ok: () => { const c = S.queue.find(c => c.tutorial); return (c && c.asked.cause) || !!tutTk(); } },
  { t: '좋아요, 떨어뜨렸군요. 이제 <b>"기기 확인 · 접수서 작성"</b>을 눌러 모델과 외관을 확인해요. 뒷면 아래 작은 글씨의 <b>Model 코드</b>로 모델을 알 수 있어요. 화면 유리가 깨졌는지도 체크!', ok: () => !!tutTk() },
  { t: '접수 완료! 기기는 대기 선반에 보관됐어요. 가운데 <b>작업대</b>를 눌러 기기를 올려봐요.', hi: 'scene:bench', ok: () => TF().bench },
  { t: '분해하기 전에 먼저 <b>진단</b>! 오른쪽 <b>[진단]</b> 탭에서 <b>화면 출력 검사</b>와 <b>터치 반응 검사</b>를 실행해 봐요.', hi: 'tab:diag', ok: () => { const t = tutTk(); return t && t.diagLog.some(d => d.test === 'display') && t.diagLog.some(d => d.test === 'touch'); } },
  { t: '화면에 줄이 생기고 아래쪽 터치가 안 되죠? <b>디스플레이 패널 손상</b>일 가능성이 높아요. 위쪽 <b>📖 교과서</b> 버튼을 눌러 OLED 디스플레이 페이지를 읽어봐요. (작업대에서 화면을 한 번 클릭해 식별하면 이름이 기록돼요)', hi: 'btn:btnBenchBook', ok: () => TF().bookDisp },
  { t: '이제 손님께 견적을 안내해요. <b>[의뢰]</b> 탭 → <b>견적 작성</b>에서 <b>디스플레이 교체</b>를 체크하고 안내해요. 공임은 기본값이면 충분해요.', hi: 'tab:ticket', ok: () => { const t = tutTk(); return t && t.status !== 'diagnosing'; } },
  { t: '수리 동의를 받았어요! 부품이 있는지 확인해야죠. 위쪽 <b>📦 재고</b> 버튼(또는 트레이의 "재고에서 꺼내기")으로 재고를 열어 <b>픽시스 S3 디스플레이</b>가 있는지 봐요. 지금은 꺼내지 말고 닫아도 돼요.', hi: 'btn:btnBenchStock', ok: () => TF().stock },
  { t: '분해 시작! 픽시스 S3는 <b>화면 쪽으로 여는 구조</b>예요. 화면을 고정하는 <b>나사 2개</b>는 기기 <b>아랫면</b>, 충전 포트 양옆에 있어요. 위쪽 <b>⤵ 아랫면</b> 버튼으로 폰을 세운 뒤 <b>드라이버</b>를 고르고, 나사 위를 <b>꾹 누르고 있으면</b> 나사가 돌아가며 풀려요. (확대: 휠/핀치)', hi: 'btn:btnEdge', ok: () => { const d = tutDev(); return d && (d.slots.display.screws.every(x => !x) || d.slots.display.open || d.slots.display.part.origin === 'stock'); } },
  { t: '화면은 접착제로 붙어 있어요. <b>히팅 패드</b>를 고르고 화면을 클릭해 따뜻하게 데워요. 버튼을 누르고 있다가 온도가 초록 구간에 머물게 하면 돼요. (교육용 가상 작업이에요)', hi: 'tool:heater', ok: () => { const d = tutDev(); return d && (['heated', 'cut', 'none', 'new'].includes(d.slots.display.adhesive) || d.slots.display.open); } },
  { t: '이제 <b>오프닝 픽</b>을 고르고 화면 가장자리의 <b>노란 점선</b>을 따라 드래그해서 접착면 네 구간을 모두 잘라요.', hi: 'tool:pick', ok: () => { const d = tutDev(); return d && (['cut', 'none', 'new'].includes(d.slots.display.adhesive) || d.slots.display.open); } },
  { t: '<b>손</b> 도구로 화면을 클릭하면 책처럼 왼쪽으로 펼쳐져요. 플렉스 케이블이 아직 연결되어 있으니 조심!', hi: 'tool:hand', ok: () => { const d = tutDev(); return d && (d.slots.display.open || !d.slots.display.part || d.slots.display.part.origin === 'stock'); } },
  { t: '오른쪽 위 커넥터들을 덮고 있는 <b>금속 실드 플레이트</b>가 보이죠? 드라이버로 나사 4개를 하나씩 꾹 눌러 풀고, 손으로 플레이트를 떼어내요.', ok: () => { const d = tutDev(); return d && !d.slots.plate.part; } },
  { t: '가장 중요한 규칙! 다른 커넥터를 만지기 전에 <b>배터리 커넥터부터 분리</b>해요. <b>스퍼저</b>를 고르고 맨 아래 "배터리 커넥터"를 클릭해요.', hi: 'tool:spudger', ok: () => { const d = tutDev(); return d && (!d.conns.c_batt.on || d.slots.display.part && d.slots.display.part.origin === 'stock'); } },
  { t: '이제 <b>디스플레이 커넥터</b>와 <b>터치 커넥터</b>를 스퍼저로 분리하고, 손 도구로 펼쳐진 화면을 클릭해 <b>완전히 떼어내요</b>.', ok: () => { const d = tutDev(); return d && (!d.slots.display.part || d.slots.display.part.origin === 'stock'); } },
  { t: '고장 난 화면이 트레이에 올라갔어요. 트레이의 <b>📦 재고에서 꺼내기</b>로 새 디스플레이를 가져와서, 기기 위로 <b>드래그</b>하거나 <b>설치</b>를 눌러요.', hi: 'tab:tray', ok: () => { const d = tutDev(); return d && d.slots.display.part && d.slots.display.part.origin === 'stock'; } },
  { t: '새 화면이 열린 상태로 장착됐어요. 스퍼저로 <b>디스플레이·터치 커넥터</b>를 연결하고, <b>마지막에 배터리 커넥터</b>를 연결해요. 그다음 트레이의 <b>실드 플레이트</b>를 설치하고 나사 4개를 조여요.', ok: () => { const d = tutDev(); return d && d.conns.c_disp.on && d.conns.c_touch.on && d.conns.c_batt.on && d.slots.plate.part && d.slots.plate.screws.every(Boolean); } },
  { t: '<b>손</b> 도구로 펼쳐진 화면을 클릭해 닫아요. 새 접착 테이프를 붙이면 방수와 고정이 좋아져요. 그리고 <b>⤵ 아랫면</b>으로 폰을 세워 포트 양옆 나사 2개를 다시 조여요.', ok: () => { const d = tutDev(); return d && !d.slots.display.open && d.slots.display.screws.every(Boolean); } },
  { t: '조립 끝! <b>[진단]</b> 탭의 <b>✅ 최종 기능 점검</b>을 눌러 모든 기능이 정상인지 확인해요.', hi: 'tab:diag', ok: () => { const t = tutTk(); return t && t.qcPass; } },
  { t: '완벽해요! 이제 작업대를 닫고(오른쪽 위 ✕) <b>접수대 → 기기 반환</b> 탭에서 손님께 돌려드려요.', hi: 'scene:counter', ok: () => TF().returned },
  { t: '첫 수리 완료, 축하해요! 🎉 이제부터 손님은 랜덤으로 와요. 부품이 없으면 <b>컴퓨터의 부품몰</b>에서 주문하고, 택배가 오면 문 옆 상자를 열어요. 모르는 게 있으면 저를 클릭해요!', final: true, ok: () => false }
];
TUT.cur = () => TSTEPS[S.tut.step];
TUT.currentText = () => TUT.cur() ? TUT.cur().t.replace(/<[^>]+>/g, '') : '';
TUT.check = function () {
  if (!S.tut.active || S.tut.done) return;
  let moved = false;
  while (S.tut.step < TSTEPS.length && TSTEPS[S.tut.step].ok()) { S.tut.step++; moved = true; }
  if (moved) { TUT.render(true); saveSoon(); } else TUT.highlight();
};
TUT.render = function (pulse) {
  const card = $('#tutCard');
  if (!S.tut.active || S.tut.done) { card.classList.add('hidden'); TUT.highlight(true); return; }
  const st = TUT.cur(); if (!st) return;
  card.classList.remove('hidden');
  card.innerHTML = `<div class="tc-av">${UI.avatar(SENIOR_AV, 52)}</div><div class="tc-b"><div class="tc-h"><b>박 선임</b> <small>${S.tut.practice ? '연습 의뢰' : '튜토리얼'} ${Math.min(S.tut.step + 1, TSTEPS.length)}/${TSTEPS.length}</small><button class="tc-min" title="접기">–</button></div><div class="tc-t">${st.t}</div>
    <div class="tc-act">${st.final ? '<button class="btn primary sm" id="tcDone">시작하기!</button>' : '<button class="btn xs" id="tcSkip">튜토리얼 건너뛰기</button>'}</div></div>`;
  if (pulse) { card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }
  $('.tc-min', card).onclick = () => card.classList.toggle('mini');
  const d = $('#tcDone'); if (d) d.onclick = TUT.finish;
  const s = $('#tcSkip'); if (s) s.onclick = () => UI.choice('튜토리얼 건너뛰기', '튜토리얼을 종료할까요? 나중에 선임을 클릭하거나 설정에서 가이드를 다시 볼 수 있습니다.', [['종료', TUT.finish], ['계속하기', () => { }]]);
  TUT.highlight();
};
TUT.highlight = function (clear) {
  $$('.tut-hi').forEach(e => e.classList.remove('tut-hi'));
  if (clear || !S.tut.active || S.tut.done) return;
  const st = TUT.cur(); if (!st || !st.hi) return;
  const [k, v] = st.hi.split(':');
  let el = null;
  if (k === 'scene') el = $(`#scene [data-act="${v}"]`);
  if (k === 'tab') el = $(`#benchTabs [data-tab="${v}"]`);
  if (k === 'tool') el = $(`#toolRail [data-tool="${v}"]`);
  if (k === 'btn') el = $('#' + v);
  if (el) el.classList.add('tut-hi');
};
TUT.finish = function () {
  const wasPractice = S.tut.practice;
  S.tut.done = true; S.tut.active = false;
  if (!wasPractice && !S.flags.firstDayScheduled) {
    S.flags.firstDayScheduled = true;
    const d = dayIdx(); const from = Math.max(S.t + 30, d * DAY + 10 * 60), to = d * DAY + 17 * 60 + 30;
    if (from < to) { for (let i = 0; i < 2; i++) S.arrivals.push({ t: R.int(from, to), cust: genCustomer() }); S.arrivals.sort((a, b) => a.t - b.t); }
  }
  // 튜토리얼 손님이 아직 남아 있다면 일반 손님으로 전환
  S.queue.forEach(c => { if (c.tutorial) c.leaveT = S.t + 240; });
  TUT.render(); save(); UI.hud();
};
TUT.practice = function () {
  const c = tutorialCustomer(); c.name = '연습 손님'; c.budget = 300000;
  const p = newPart('pixis:display', 'stock', 'normal'); p.defect = false; p.cost = 0; p.boughtT = S.t; S.inv.push(p);
  S.queue.unshift(c); c.arriveT = S.t; c.leaveT = S.t + 9999;
  S.tut = { step: 0, active: true, done: false, practice: true, f: {} };
  UI.toast('🧑‍🔧', '연습용 디스플레이 1개가 재고에 지급되었습니다. 접수대로 가보세요!', true);
  UI.show('shop'); TUT.render(true); save();
};
const GUIDE = [
  ['고객 응대', '접수대를 눌러 손님의 증상을 듣고, 추가 질문으로 원인 단서(낙하·침수·사용 기간·예산·기한)를 모읍니다.'],
  ['접수서', '기기 뒷면의 Model 코드로 모델을 확인하고, 외관 상태를 체크해 접수합니다. 외관 점검이 정확할수록 상담 경험치를 얻습니다.'],
  ['진단', '작업대의 [진단] 탭에서 검사를 실행합니다. 결과는 실제 기기 상태와 연결되어 있어, 불가능한 원인을 하나씩 지울 수 있습니다.'],
  ['교과서', '모르는 부품은 클릭해 식별하고, 교과서에서 역할·위치·고장 증상을 확인합니다. 작업 경험이 쌓일수록 페이지가 채워집니다.'],
  ['견적', '[의뢰] 탭에서 필요한 항목만 골라 견적을 보냅니다. 너무 비싸면 거절, 너무 싸면 손해입니다.'],
  ['부품 주문', '컴퓨터 → 파츠허브에서 호환 부품을 업체별로 비교해 주문합니다. 배송에는 게임 시간이 걸리고, 도착하면 택배 상자를 열어 재고에 넣습니다.'],
  ['분해', '드라이버(나사를 꾹 눌러 돌려 풀기) → 히팅 패드(가열) → 오프닝 픽(접착 절단·클립) → 스퍼저(커넥터) → 손/핀셋(부품 들기). 가려진 부품은 위의 부품을 먼저 치워야 합니다.'],
  ['안전 규칙', '다른 커넥터를 만지기 전에 배터리 커넥터를 먼저 분리하고, 조립할 때는 마지막에 연결합니다.'],
  ['조립·점검', '새 부품을 트레이에서 드래그해 장착하고 나사·커넥터를 원래대로. [진단] 탭의 최종 기능 점검을 통과하면 반환 준비 완료.'],
  ['반환·성장', '접수대의 기기 반환 탭에서 돌려드리면 수리비와 경험치를 받습니다. 정확한 진단일수록 보너스가 큽니다.']
];
TUT.guide = function () {
  let i = 0;
  UI.modal('📘 튜토리얼 가이드', '<div id="gBody"></div><div class="row between"><button class="btn" id="gPrev">◀ 이전</button><span id="gNum"></span><button class="btn primary" id="gNext">다음 ▶</button></div>', (b, w) => {
    const draw = () => { $('#gBody', b).innerHTML = `<div class="senior-say">${UI.avatar(SENIOR_AV, 64)}<div class="bubble"><h3>${i + 1}. ${GUIDE[i][0]}</h3><p>${GUIDE[i][1]}</p></div></div>`; $('#gNum', b).textContent = (i + 1) + ' / ' + GUIDE.length; $('#gPrev', b).disabled = i === 0; $('#gNext', b).textContent = i === GUIDE.length - 1 ? '닫기' : '다음 ▶'; };
    $('#gPrev', b).onclick = () => { i--; draw(); }; $('#gNext', b).onclick = () => { if (i === GUIDE.length - 1) return UI.closeModal(w); i++; draw(); };
    draw();
  }, { size: 'md' });
};
function initTutorialHooks() {
  Bus.on('act', a => {
    if (!S.tut.active || S.tut.done) return;
    const f = TF();
    if (a.type === 'scene' && a.act === 'counter') f.counter = true;
    if (a.type === 'benchOpen') { const t = tutTk(); if (t && S.bench === t.id) f.bench = true; }
    if (a.type === 'book' && (a.page === 'display_oled')) f.bookDisp = true;
    if (a.type === 'stockView' || (a.type === 'computer' && a.app === 'inv')) f.stock = true;
    if (a.type === 'closed') { f.returned = true; }
    setTimeout(TUT.check, 0);
  });
  ['render', 'tickets', 'queue'].forEach(e => Bus.on(e, () => setTimeout(TUT.check, 0)));
}
