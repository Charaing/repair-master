'use strict';
/* =========================================================================
   REPAIR MASTER — 전자기기 수리 백과사전 (교과서)
   ========================================================================= */
const Book = { cur: '_intro', q: '', filter: 'all', back: null };
const BOOK_PAGES = ['_intro', '_safety', ...BOOK_ORDER];
UI.openBook = function (type) {
  Book.back = UI.screen === 'book' ? Book.back : UI.screen;
  if (type) Book.cur = type;
  UI.show('book');
  Book.render(false);
  Bus.emit('act', { type: 'book', page: Book.cur });
};
Book.close = function () { UI.show(Book.back && Book.back !== 'book' ? Book.back : 'shop'); if (UI.screen === 'bench') WB.render(); };
Book.go = function (page) {
  if (page === Book.cur) return;
  const order = BOOK_PAGES; const fwd = order.indexOf(page) > order.indexOf(Book.cur);
  const right = $('#bookRight'); const flip = document.createElement('div');
  flip.className = 'page-flip ' + (fwd ? 'fwd' : 'bwd'); flip.innerHTML = right.innerHTML;
  $('.book').appendChild(flip);
  Book.cur = page; Book.render(true);
  setTimeout(() => flip.remove(), 650);
  document.body.classList.remove('book-index');
  Bus.emit('act', { type: 'book', page });
};
Book.render = function () {
  const total = BOOK_ORDER.length, found = discoveredCount();
  const q = Book.q.trim();
  const list = BOOK_ORDER.filter(t => {
    const b = S.book[t] || {}; const lv = b.lv || 0;
    if (Book.filter === 'found' && lv < 2) return false;
    if (Book.filter === 'fav' && !b.fav) return false;
    if (q) { if (lv < 2) return false; const P = PART_TYPES[t]; return (P.name + P.en + P.short + (b.memo || '')).toLowerCase().includes(q.toLowerCase()); }
    return true;
  });
  $('#bookLeft').innerHTML = `<div class="bk-head"><h2>전자기기 수리 백과</h2><p>발견한 부품 <b>${found}</b> / ${total}</p></div>
    <input class="bk-search" id="bkQ" placeholder="🔎 부품 검색 (발견한 부품만)" value="${esc(Book.q)}">
    <div class="bk-filter">${[['all', '전체'], ['found', '발견'], ['fav', '★ 즐겨찾기']].map(([k, n]) => `<button class="${Book.filter === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
    <ol class="bk-index"><li class="${Book.cur === '_intro' ? 'on' : ''}" data-p="_intro"><span class="ico">📘</span>이 책의 사용법</li><li class="${Book.cur === '_safety' ? 'on' : ''}" data-p="_safety"><span class="ico">⚠</span>안전 수칙과 가상 작업</li>
    ${list.map(t => { const b = S.book[t] || {}; const lv = b.lv || 0; const P = PART_TYPES[t]; return `<li class="${Book.cur === t ? 'on' : ''} ${lv < 2 ? 'locked' : ''}" data-p="${t}"><span class="ico ${lv < 2 ? 'sil' : ''}">${partIconSVG(t, 26)}</span>${lv >= 2 ? esc(P.name) : lv === 1 ? '??? <small>(발견함 · 미식별)</small>' : '???'}${b.fav ? ' <span class="fav">★</span>' : ''}${lv >= 2 ? `<small class="lvdots">${'●'.repeat(lv - 1)}${'○'.repeat(4 - lv)}</small>` : ''}</li>`; }).join('')}</ol>`;
  $('#bookRight').innerHTML = Book.page(Book.cur);
  const qi = $('#bkQ'); qi.oninput = e => { Book.q = e.target.value; const pos = e.target.selectionStart; Book.render(); const n = $('#bkQ'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-f]', $('#bookLeft')).forEach(b => b.onclick = () => { Book.filter = b.dataset.f; Book.render(); });
  $$('[data-p]', $('#bookLeft')).forEach(li => li.onclick = () => Book.go(li.dataset.p));
  const memo = $('#bkMemo'); if (memo) memo.oninput = e => { S.book[Book.cur].memo = e.target.value; saveSoon(); };
  const fav = $('#bkFav'); if (fav) fav.onclick = () => { const b = S.book[Book.cur]; b.fav = !b.fav; save(); Book.render(); };
  const idx = BOOK_PAGES.indexOf(Book.cur);
  $('#bkPrev').disabled = idx <= 0; $('#bkNext').disabled = idx >= BOOK_PAGES.length - 1;
};
Book.page = function (t) {
  if (t === '_intro') return `<article class="pg"><h1>이 책의 사용법</h1><p class="lead">이 책은 처음에는 거의 비어 있다. 직접 기기를 열어보고 부품을 만져볼 때마다 페이지가 채워진다.</p>
    <ol class="steps"><li><b>발견</b> — 작업대에서 부품이 드러나면 '새로운 부품을 발견했습니다!'가 뜨고 목차에 ??? 칸이 생긴다.</li><li><b>식별</b> — 그 부품을 클릭하면 이름·생김새·기초 설명이 기록된다.</li><li><b>작업 경험</b> — 직접 분리하거나 장착하면 위치·다른 부품과의 관계·사용 기기가 해금된다.</li><li><b>수리 경험</b> — 그 부품이 원인인 고장을 실제로 고치면 고장 증상·진단법·교체 가격이 해금된다.</li></ol>
    <p>각 페이지 아래에는 <b>나만의 메모</b>를 남길 수 있고, ★로 즐겨찾기할 수 있다. 메모와 기록은 영구 저장된다.</p><p class="note">💡 같은 증상이라도 원인은 여러 가지일 수 있다. 이 책은 정답표가 아니라 추리의 재료다.</p></article>`;
  if (t === '_safety') return `<article class="pg"><h1>안전 수칙과 가상 작업</h1><p class="lead">이 게임은 전자기기의 구조를 배우기 위한 시뮬레이션이다.</p>
    <ul><li>현실의 리튬 배터리는 찌그러지거나 구멍이 나면 불이 날 수 있다. 게임의 '풀탭 당기기'는 교육용 추상화다.</li><li>가열 작업은 화상·화재 위험이 있다. 게임의 히팅 미니게임은 실제 온도·절차를 안내하지 않는다.</li><li>게임 속 규칙: <b>커넥터 작업 전에는 배터리 커넥터부터 분리</b>, 조립할 때는 <b>배터리 커넥터를 마지막에</b> 연결한다.</li><li>금속 도구 대신 플라스틱 스퍼저로 커넥터를 다룬다.</li><li>고전압 회로나 칩 납땜 같은 위험한 작업은 게임에서 다루지 않는다.</li></ul>
    <p class="note">등장하는 브랜드(노바·픽시스·루멘)와 모델은 모두 가상이다.</p></article>`;
  const P = PART_TYPES[t]; const b = S.book[t] || { lv: 0 }; const lv = b.lv || 0;
  if (lv < 2) return `<article class="pg locked"><div class="pg-ill sil">${partIconSVG(t, 180)}</div><h1>???</h1>
    <p class="lead">${lv === 1 ? '작업대에서 본 적은 있지만 아직 정체를 모르는 부품이다. 다음에 작업대에서 이 부품을 클릭해 식별해 보자.' : P.future ? P.future + ' 같은 기기를 다룰 수 있게 되면 발견할 수 있다. (현재 버전에는 해당 기기 콘텐츠가 구현되어 있지 않다)' : '아직 발견하지 못한 부품이다. 기기를 분해하다 보면 만날 수 있다.'}</p></article>`;
  const lock = (need, html, msg) => lv >= need ? html : `<div class="lockbox">🔒 ${msg}</div>`;
  const prices = MODEL_IDS.filter(m => MODELS[m].slots.some(s => s.type === t)).map(m => { const sd = MODELS[m].slots.filter(s => s.type === t); return sd.map(s => `<tr><td>${MODELS[m].name}${sd.length > 1 ? ' ' + (s.label || '') : ''}</td><td>${WON(refPrice(skuOf(m, s.id)))}</td><td>${WON(vendorPrice(skuOf(m, s.id), 'cheap'))} ~ ${WON(vendorPrice(skuOf(m, s.id), 'premium'))}</td></tr>`).join(''); }).join('');
  return `<article class="pg"><div class="pg-top"><span class="cat">${esc(P.cat)}</span><button class="fav-btn ${b.fav ? 'on' : ''}" id="bkFav" title="즐겨찾기">★</button></div>
    <h1>${esc(P.name)}</h1><p class="en">${esc(P.en)}</p>
    <div class="pg-ill">${partIconSVG(t, 190)}</div>
    <p class="lead">${esc(P.short)}</p>
    <h3>주요 역할</h3><ul>${P.roles.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
    ${lock(3, `<h3>일반적인 위치</h3><p>${esc(P.location)}</p><h3>다른 부품과의 관계</h3><p>${esc(P.relations)}</p><h3>사용하는 기기</h3><p>${esc(P.devices)}</p>`, '직접 분리하거나 장착해 보면 위치·관계 정보가 해금됩니다.')}
    ${lock(3, prices ? `<h3>게임 내 교체 부품 가격</h3><table class="tbl small"><thead><tr><th>모델</th><th>일반 업체 시세</th><th>업체별 범위</th></tr></thead><tbody>${prices}</tbody></table>` : '', '작업 경험 후 가격표가 해금됩니다.')}
    ${lock(4, `<h3>관련될 수 있는 고장 증상</h3><ul>${P.symptoms.map(r => `<li>${esc(r)}</li>`).join('')}</ul><h3>게임 안에서 진단하는 방법</h3><p>${esc(P.diagnose)}</p><p class="note">⚠ ${esc(P.caution)}</p>`, '이 부품이 원인인 고장을 직접 수리하면 증상·진단법이 해금됩니다.')}
    <h3>✍ 나의 메모</h3><textarea id="bkMemo" rows="4" placeholder="이 부품에 대해 알게 된 것을 적어두세요. (자동 저장)">${esc(b.memo || '')}</textarea></article>`;
};
function initBook() {
  $('#bkClose').onclick = Book.close;
  $('#bkPrev').onclick = () => { const i = BOOK_PAGES.indexOf(Book.cur); if (i > 0) Book.go(BOOK_PAGES[i - 1]); };
  $('#bkNext').onclick = () => { const i = BOOK_PAGES.indexOf(Book.cur); if (i < BOOK_PAGES.length - 1) Book.go(BOOK_PAGES[i + 1]); };
  $('#bkIndexBtn').onclick = () => document.body.classList.toggle('book-index');
}
