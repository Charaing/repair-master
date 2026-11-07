'use strict';
/* =========================================================================
   REPAIR MASTER — 시작점
   ========================================================================= */
function boot() {
  $('#gdefs').innerHTML = SVG_DEFS;
  const loaded = load();
  if (!loaded) newGame();
  // 이벤트 연결
  Bus.on('toast', d => UI.toast(d.icon, d.text, d.long));
  Bus.on('discover', type => { /* 작업대에서 별도 안내 */ });
  Bus.on('levelup', lv => { UI.toast('🏆', '레벨 업! Lv' + lv + ' — ' + rankName(), true); const t = DEVICE_TIERS.find(x => x.lv === lv); if (t) UI.alert('새 기기 단계 해금', t.devices + ' 단계가 해금되었습니다.' + (t.implemented ? '' : ' (이 기기들의 수리 콘텐츠는 아직 준비 중이며 현재 버전에서는 이용할 수 없습니다.)')); });
  Bus.on('time', () => { UI.hud(); if (UI.screen === 'shop') UI.renderScene(); saveSoon(); });
  Bus.on('queue', () => { UI.hud(); if (UI.screen === 'shop') UI.renderScene(); });
  Bus.on('money', () => UI.hud());
  Bus.on('tickets', () => { UI.hud(); saveSoon(); });
  initTutorialHooks();
  initBenchInput();
  initBook();
  // 수리점 화면 핫스팟
  const scene = $('#scene');
  scene.addEventListener('click', e => { const g = e.target.closest('.hot'); if (g) UI.sceneAct(g.dataset.act); });
  scene.addEventListener('pointermove', e => {
    const g = e.target.closest('.hot'); const tip = $('#tooltip');
    if (!g || e.pointerType === 'touch') { tip.style.display = 'none'; return; }
    tip.textContent = g.dataset.label; tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
  });
  scene.addEventListener('pointerleave', () => $('#tooltip').style.display = 'none');
  // HUD
  $('#btnWait').onclick = () => {
    if (UI.screen === 'bench') { advance(30); WB.render(); } else advance(30);
    UI.toast('⏱', '30분이 지났습니다. (' + fmtClock() + ')');
    if (minOfDay() >= CLOSE && !S.flags.closeWarn) { S.flags.closeWarn = dayIdx(); UI.toast('🌙', '영업 시간(19:00)이 지났습니다. 출입문이나 🌙 버튼으로 영업을 마감하세요.', true); }
  };
  $('#btnEnd').onclick = () => UI.endDayFlow();
  $('#btnMenu').onclick = () => UI.modal('메뉴', `<div class="menu-grid"><button class="btn" data-m="save">💾 저장</button><button class="btn" data-m="pc">🖥 컴퓨터 (설정·저장 관리)</button><button class="btn" data-m="guide">📘 튜토리얼 가이드</button><button class="btn" data-m="book">📖 교과서</button><button class="btn" data-m="shop">🏠 수리점으로</button><button class="btn danger" data-m="reset">🔄 새로 시작</button></div>
      <p class="small muted">REPAIR MASTER v0.2 — 스마트폰 4종 · 게임 컨트롤러 1종 수리, 리뷰 · 알바 · 대출 · 가상 투자 · 매장 이전.</p>`, (b, w) => {
    $$('[data-m]', b).forEach(x => x.onclick = () => { UI.closeModal(w); const m = x.dataset.m; if (m === 'save') { save(); UI.toast('💾', '저장했습니다.'); } if (m === 'pc') Computer.open('sys'); if (m === 'guide') TUT.guide(); if (m === 'book') UI.openBook(); if (m === 'shop') UI.show('shop'); if (m === 'reset') UI.restartGame(); });
  }, { size: 'sm' });
  $('#hudAlerts').addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (!a) return; const g = a.dataset.go; if (g === 'counter') UI.openCounter(); if (g === 'packages') UI.openPackages(); if (g === 'inv') Computer.open('inv'); });
  window.addEventListener('beforeunload', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  processTime();
  UI.show(S.bench && benchTicket() && false ? 'bench' : 'shop');
  TUT.render(true);
  if (loaded) UI.toast('💾', '저장된 게임을 불러왔습니다. ' + fmtDay() + ' ' + fmtClock());
  window.addEventListener('resize', () => { if (UI.screen === 'bench') WB.applyVB(); });
}
document.addEventListener('DOMContentLoaded', boot);
