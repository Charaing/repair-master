'use strict';
/* =========================================================================
   REPAIR MASTER — SVG 기기 렌더러 (여러 층의 부품을 벡터로 그린다)
   ========================================================================= */

function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function hashStr(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SVG_DEFS = `
<defs>
  <linearGradient id="gMetal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e7ec"/><stop offset=".45" stop-color="#a9b1ba"/><stop offset=".55" stop-color="#c7cdd4"/><stop offset="1" stop-color="#7f8892"/></linearGradient>
  <linearGradient id="gShield" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9dde2"/><stop offset=".5" stop-color="#aeb5bd"/><stop offset="1" stop-color="#8d959e"/></linearGradient>
  <linearGradient id="gCopper" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7a46a"/><stop offset=".5" stop-color="#b8703c"/><stop offset="1" stop-color="#d88f55"/></linearGradient>
  <linearGradient id="gBatt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2d33"/><stop offset="1" stop-color="#15171b"/></linearGradient>
  <linearGradient id="gScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1420"/><stop offset=".6" stop-color="#05070b"/><stop offset="1" stop-color="#0b1018"/></linearGradient>
  <linearGradient id="gKapton" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b86f22"/><stop offset=".5" stop-color="#d99a45"/><stop offset="1" stop-color="#b86f22"/></linearGradient>
  <linearGradient id="gGloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".35" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="gLens" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#4a6a9a"/><stop offset=".35" stop-color="#121a2a"/><stop offset="1" stop-color="#020306"/></radialGradient>
  <radialGradient id="gScrew" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#b9c0c8"/><stop offset="1" stop-color="#5d646c"/></radialGradient>
  <radialGradient id="gSwell" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <radialGradient id="gHeat" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".35"/><stop offset="1" stop-color="#ff3d00" stop-opacity=".08"/></radialGradient>
  <pattern id="pMesh" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#15161a"/><circle cx="2" cy="2" r=".9" fill="#3a3d44"/></pattern>
  <pattern id="pGrille" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#1b1c20"/><circle cx="3.5" cy="3.5" r="1.6" fill="#050506"/></pattern>
  <pattern id="pVent" width="14" height="8" patternUnits="userSpaceOnUse"><rect x="2" y="2" width="9" height="3" rx="1.5" fill="#6d747c" opacity=".55"/></pattern>
  <pattern id="pGraphite" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#26282c"/><path d="M0 10 L10 0" stroke="#30333a" stroke-width="1"/></pattern>
  <pattern id="pRib" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#202226"/><rect width="6" height="2" fill="#2b2e33"/></pattern>
  <filter id="fShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3.5" flood-color="#000" flood-opacity=".45"/></filter>
  <filter id="fSoft" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity=".5"/></filter>
</defs>`;

/* ---------------- 공용 요소 ---------------- */
function screwSVG(x, y, on, sid, i, small) {
  const r = small ? 5 : 6.5;
  if (on) return `<g class="screw" data-kind="screw" data-id="${sid}|${i}"><circle cx="${x}" cy="${y}" r="${r + 5}" fill="transparent"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#gScrew)" stroke="#4a4f55" stroke-width=".8" filter="url(#fSoft)"/><path d="M${x - r * .55} ${y} H${x + r * .55} M${x} ${y - r * .55} V${y + r * .55}" stroke="#3b3f44" stroke-width="1.4" stroke-linecap="round"/></g>`;
  return `<g class="screw hole" data-kind="screw" data-id="${sid}|${i}"><circle cx="${x}" cy="${y}" r="${r + 5}" fill="transparent"/><circle cx="${x}" cy="${y}" r="${r * .9}" fill="#c9a24a" opacity=".85"/><circle cx="${x}" cy="${y}" r="${r * .5}" fill="#1a1a1a"/></g>`;
}
let CRACK_N = 0;
const PHONE_CLIP = { rect: [3, 3, 354, 754, 47] };
function crackSVG(x, y, seed, scale = 1, clip = PHONE_CLIP) {
  const rnd = seeded(seed); let d = '';
  for (let i = 0; i < 9; i++) {
    let a = rnd() * Math.PI * 2, px = x, py = y; d += `M${px} ${py}`;
    for (let k = 0; k < 5; k++) { a += (rnd() - .5) * .9; const L = (18 + rnd() * 40) * scale; px += Math.cos(a) * L; py += Math.sin(a) * L; d += ` L${px.toFixed(1)} ${py.toFixed(1)}`; }
  }
  const cid = 'cl' + (CRACK_N++);
  const shape = clip.r ? `<circle cx="${x}" cy="${y}" r="${clip.r}"/>` : `<rect x="${clip.rect[0]}" y="${clip.rect[1]}" width="${clip.rect[2]}" height="${clip.rect[3]}" rx="${clip.rect[4]}"/>`;
  return `<clipPath id="${cid}">${shape}</clipPath><g class="crack" pointer-events="none" clip-path="url(#${cid})"><path d="${d}" stroke="#000" stroke-width="${(3.2 * scale).toFixed(1)}" fill="none" opacity=".35" transform="translate(1.5 1.5)"/><path d="${d}" stroke="#eef6ff" stroke-width="${(2 * scale).toFixed(1)}" fill="none" opacity=".85" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="${10 * scale}" fill="#eef6ff" opacity=".45"/></g>`;
}
function labelSVG(x, y, txt, size = 9, fill = '#e8edf2', anchor = 'middle', extra = '') {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-family="'Segoe UI','Malgun Gothic',sans-serif" ${extra}>${esc(txt)}</text>`;
}
function smdField(x, y, w, h, seed, density = 1) {
  const rnd = seeded(seed); let s = '';
  const n = Math.floor(w * h / 260 * density);
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * (w - 6), py = y + rnd() * (h - 4); const v = rnd();
    if (v < .55) s += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="4" height="2" fill="${v < .3 ? '#9b8160' : '#30302c'}"/><rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="1" height="2" fill="#d8d2c4"/><rect x="${(px + 3).toFixed(1)}" y="${py.toFixed(1)}" width="1" height="2" fill="#d8d2c4"/>`;
    else if (v < .8) s += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="2.4" height="1.4" fill="#2b2a28"/>`;
    else s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1" fill="#c9a24a"/>`;
  }
  return s;
}
function tracesSVG(x, y, w, h, seed, color) {
  const rnd = seeded(seed); let d = '';
  for (let i = 0; i < 26; i++) {
    let px = x + rnd() * w, py = y + rnd() * h; d += `M${px.toFixed(1)} ${py.toFixed(1)}`;
    for (let k = 0; k < 3; k++) { if (rnd() < .5) px = Math.min(x + w - 2, Math.max(x + 2, px + (rnd() - .5) * 90)); else py = Math.min(y + h - 2, Math.max(y + 2, py + (rnd() - .5) * 70)); d += ` L${px.toFixed(1)} ${py.toFixed(1)}`; }
  }
  return `<path d="${d}" stroke="${color}" stroke-width="1" fill="none" opacity=".45"/>`;
}
function lensSVG(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="url(#gMetal)"/><circle cx="${cx}" cy="${cy}" r="${r + 1.5}" fill="#0b0c0f"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#gLens)"/><circle cx="${cx}" cy="${cy}" r="${r * .45}" fill="#0a0f1a" stroke="#27406b" stroke-width="1"/><ellipse cx="${cx - r * .35}" cy="${cy - r * .4}" rx="${r * .28}" ry="${r * .16}" fill="#fff" opacity=".35" transform="rotate(-30 ${cx} ${cy})"/>`;
}

/* ---------------- 부품별 그리기 ---------------- */
const DRAW = {};
DRAW.frame = (m, side, dev) => {
  const st = m.style; const frontDisp = dev && dev.slots.display && dev.slots.display.part;
  let s = `<rect x="-6" y="-6" width="372" height="772" rx="56" fill="url(#gMetal)" filter="url(#fShadow)"/>`;
  s += `<rect x="-6" y="-6" width="372" height="772" rx="56" fill="${st.frame}" opacity=".55"/>`;
  // 측면 버튼(프레임 돌출)
  const bx = side === 'back' ? 366 : -10;
  const btnSide = side === 'back' ? -10 : 366;
  s += `<rect x="${btnSide}" y="170" width="5" height="62" rx="2" fill="${st.frame}" stroke="#6b737c"/><rect x="${btnSide}" y="250" width="5" height="44" rx="2" fill="${st.frame}" stroke="#6b737c"/>`;
  s += `<rect x="${bx}" y="210" width="5" height="70" rx="2" fill="${st.frame}" stroke="#6b737c"/>`;
  // 안테나 밴드
  s += `<rect x="40" y="-6" width="4" height="10" fill="#3b3f44"/><rect x="316" y="-6" width="4" height="10" fill="#3b3f44"/><rect x="40" y="756" width="4" height="10" fill="#3b3f44"/><rect x="316" y="756" width="4" height="10" fill="#3b3f44"/>`;
  // 내부 캐비티
  s += `<rect x="6" y="6" width="348" height="748" rx="44" fill="#1a1c20"/>`;
  if (side !== m.openSide || side === 'back') {
    // 반대편 디스플레이 뒷면이 보이는 영역
    s += `<rect x="12" y="12" width="336" height="736" rx="40" fill="${(side === 'back' && frontDisp) ? 'url(#pGraphite)' : '#0e0f12'}"/>`;
    if (side === 'back' && frontDisp) s += `<rect x="40" y="320" width="280" height="260" rx="8" fill="#3a2f25" opacity=".35"/>`;
    if (side === 'back' && !frontDisp) s += labelSVG(180, 440, '앞면 디스플레이 없음 — 프레임이 비어 보인다', 11, '#55606b');
  } else {
    s += `<rect x="12" y="12" width="336" height="736" rx="40" fill="#2a2d32"/><rect x="18" y="18" width="324" height="724" rx="36" fill="none" stroke="#3a3e44" stroke-width="2"/>`;
  }
  // 프레임 보스·리브
  s += `<g opacity=".7">${[[30, 30], [330, 30], [30, 730], [330, 730]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#454a50"/>`).join('')}</g>`;
  if (m.lci && m.lci.side === side) {
    const { x, y } = m.lci;
    s += `<g data-kind="lci" class="lci"><rect x="${x - 4}" y="${y - 4}" width="22" height="22" fill="transparent"/><rect x="${x}" y="${y}" width="14" height="14" rx="2" fill="${dev && dev.lciRed ? '#d8343a' : '#f3f3f0'}" stroke="#777" stroke-width=".8"/><path d="M${x + 2} ${y + 12} L${x + 12} ${y + 2}" stroke="#999" stroke-width=".6"/></g>`;
  }
  return s;
};
DRAW.back_glass = (sd, p, st, m, dev) => {
  const c = m.style; let s = `<rect x="0" y="0" width="360" height="760" rx="50" fill="${c.back}"/>`;
  s += `<rect x="0" y="0" width="360" height="760" rx="50" fill="url(#gGloss)"/>`;
  s += `<linearGradient id="gBk_${m.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.back2}" stop-opacity=".55"/><stop offset="1" stop-color="${c.back}" stop-opacity="0"/></linearGradient><rect x="0" y="0" width="360" height="760" rx="50" fill="url(#gBk_${m.id})"/>`;
  // 카메라 섬
  s += `<rect x="22" y="22" width="124" height="156" rx="30" fill="#0f1828" stroke="#5f6f8a" stroke-width="1.5"/><rect x="22" y="22" width="124" height="156" rx="30" fill="url(#gGloss)"/>`;
  s += lensSVG(60, 62, 19) + lensSVG(60, 138, 19) + lensSVG(110, 100, 17);
  s += `<circle cx="113" cy="48" r="6" fill="#f2e7c9" stroke="#999"/><circle cx="113" cy="152" r="4" fill="#1a1a1a"/>`;
  const cam = partOf(dev, 'camera_rear'); if (cam && cam.cracked) s += crackSVG(60, 138, 77, .45, { r: 24 });
  s += labelSVG(180, 420, m.brand, 26, '#c9d6ee', 'middle', 'letter-spacing="10" font-weight="300" opacity=".85"');
  s += labelSVG(180, 712, 'Model ' + m.code + ' · S/N ' + (dev ? dev.serial : ''), 8.5, '#9fb0cc', 'middle', 'opacity=".7"');
  s += labelSVG(180, 724, 'Designed by ' + m.brand + ' · 가상 브랜드', 7.5, '#9fb0cc', 'middle', 'opacity=".55"');
  if (p.cracked) s += crackSVG(250, 560, 33, 1.1);
  const b = partOf(dev, 'battery');
  if (b && b.swollen) s += `<ellipse cx="180" cy="460" rx="120" ry="150" fill="url(#gSwell)"/><path d="M8 300 Q4 460 8 620" stroke="#fff" stroke-width="2" opacity=".5" fill="none"/>`;
  if (st.adhesive === 'heated') s += `<rect x="0" y="0" width="360" height="760" rx="50" fill="url(#gHeat)"/>`;
  return s;
};
DRAW.back_cover = (sd, p, st, m, dev) => {
  const c = m.style; let s = `<rect x="0" y="0" width="360" height="760" rx="50" fill="${c.back}"/><rect x="0" y="0" width="360" height="760" rx="50" fill="url(#gGloss)" opacity=".5"/>`;
  s += `<rect x="6" y="6" width="348" height="748" rx="45" fill="none" stroke="#000" stroke-opacity=".25" stroke-width="2"/>`;
  s += `<rect x="28" y="28" width="56" height="132" rx="26" fill="#101413" stroke="#577" stroke-width="1"/>` + lensSVG(56, 62, 15) + lensSVG(56, 120, 13);
  s += `<circle cx="56" cy="148" r="4" fill="#f3ead0"/>`;
  s += `<circle cx="180" cy="210" r="27" fill="${c.back2}" stroke="#244" stroke-width="2"/><circle cx="180" cy="210" r="21" fill="none" stroke="#1d3d34" stroke-width="1" stroke-dasharray="3 2"/>`;
  s += labelSVG(180, 610, m.brand, 22, '#bfe8d9', 'middle', 'letter-spacing="8" opacity=".75"');
  s += labelSVG(180, 712, 'Model ' + m.code + ' · S/N ' + (dev ? dev.serial : ''), 8.5, '#bfe8d9', 'middle', 'opacity=".6"');
  const cam = partOf(dev, 'camera_rear'); if (cam && cam.cracked) s += crackSVG(56, 62, 91, .35, { r: 20 });
  const b = partOf(dev, 'battery');
  if (b && b.swollen) s += `<ellipse cx="180" cy="450" rx="120" ry="150" fill="url(#gSwell)"/><path d="M356 300 Q362 450 356 600" stroke="#fff" stroke-width="2" opacity=".5" fill="none"/>`;
  return s;
};
DRAW.back_fixed = (m, dev) => {
  const c = m.style; let s = `<rect x="0" y="0" width="360" height="760" rx="50" fill="${c.back}"/><rect x="0" y="0" width="360" height="760" rx="50" fill="url(#gGloss)"/>`;
  s += `<rect x="22" y="22" width="100" height="120" rx="26" fill="#cfc6b8" stroke="#a79c8c"/>` + lensSVG(56, 58, 16) + lensSVG(56, 108, 14) + `<circle cx="98" cy="50" r="5" fill="#fff6dc" stroke="#999"/>`;
  const cam = partOf(dev, 'camera_rear'); if (cam && cam.cracked) s += crackSVG(56, 58, 51, .4, { r: 20 });
  s += labelSVG(180, 400, m.brand, 24, '#8c8170', 'middle', 'letter-spacing="9" opacity=".8"');
  s += labelSVG(180, 712, 'Model ' + m.code + ' · S/N ' + (dev ? dev.serial : ''), 8.5, '#8c8170', 'middle', 'opacity=".8"');
  s += labelSVG(180, 726, '후면 글라스 일체형 — 분해 불가', 7.5, '#8c8170', 'middle', 'opacity=".7"');
  return `<g data-kind="backfixed">${s}</g>`;
};
function drawDisplayFront(sd, p, st, m, dev) {
  const lcd = sd.type === 'display_lcd';
  let s = `<rect x="0" y="0" width="360" height="760" rx="50" fill="#07080a"/>`;
  const ax = lcd ? 14 : 8, ay = lcd ? 44 : 8, aw = 360 - ax * 2, ah = lcd ? 660 : 744;
  s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" rx="${lcd ? 8 : 42}" fill="url(#gScreen)"/>`;
  s += `<path d="M0 0 L240 0 L60 760 L0 760 Z" fill="#fff" opacity=".035"/>`;
  if (m.id === 'nova') s += `<circle cx="180" cy="32" r="9" fill="#000" stroke="#1c1f26" stroke-width="2"/><rect x="150" y="6" width="60" height="3" rx="1.5" fill="#1b1d22"/>`;
  else if (m.id === 'pixis') s += `<rect x="146" y="20" width="68" height="22" rx="11" fill="#000" stroke="#1c1f26"/><rect x="152" y="7" width="56" height="3" rx="1.5" fill="#1b1d22"/>`;
  else s += `<path d="M164 44 Q180 66 196 44 Z" fill="#000"/><rect x="146" y="18" width="68" height="4" rx="2" fill="#16181c"/>` + labelSVG(180, 735, m.brand, 12, '#4f5a66', 'middle', 'letter-spacing="5"');
  if (p.cracked) s += crackSVG(268, 590, hashStr(p.uid), 1);
  if (p.fault === 'disp_lines' || p.fault === 'heat_damage') { if (p.cracked) s += `<ellipse cx="268" cy="600" rx="38" ry="26" fill="#000" opacity=".8"/>`; }
  if (st.adhesive === 'heated') s += `<rect x="0" y="0" width="360" height="760" rx="50" fill="url(#gHeat)"/>`;
  return s;
}
DRAW.display_oled = drawDisplayFront;
DRAW.display_lcd = drawDisplayFront;
function drawDisplayRear(sd, p, m) {
  let s = `<rect x="0" y="0" width="360" height="760" rx="50" fill="#2b2e33" filter="url(#fShadow)"/><rect x="10" y="10" width="340" height="740" rx="42" fill="url(#pGraphite)"/>`;
  s += `<rect x="40" y="200" width="280" height="300" rx="6" fill="url(#gCopper)" opacity=".55"/>`;
  s += labelSVG(180, 360, (sd.type === 'display_lcd' ? 'LCD' : 'OLED') + ' PANEL — 뒷면', 13, '#cfd6de', 'middle', 'opacity=".75"');
  s += labelSVG(180, 380, '(앞으로 열어 둔 상태 · 손 도구로 클릭하면 닫기)', 9.5, '#9aa4ae', 'middle');
  s += `<rect x="330" y="84" width="34" height="46" rx="3" fill="url(#gKapton)"/>`;
  if (p.cracked) s += crackSVG(92, 590, 12, .8);
  return s;
}
DRAW.mainboard = (sd, p, st, m, dev) => {
  const { x, y, w, h } = sd; const seed = hashStr(m.id + 'mb');
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${m.style.pcb}" stroke="#c9a24a" stroke-width="2"/>`;
  s += tracesSVG(x + 4, y + 4, w - 8, h - 8, seed, '#7fd3a5');
  s += smdField(x + 6, y + 6, w - 12, h - 12, seed + 3, 1.1);
  (sd.chips || []).forEach(c => {
    const cx = x + c.x, cy = y + c.y;
    if (c.type === 'soc') s += `<g data-kind="chip" data-id="${sd.id}|soc" class="chip"><rect x="${cx}" y="${cy}" width="${c.w}" height="${c.h}" rx="4" fill="url(#gMetal)" stroke="#555"/>${labelSVG(cx + c.w / 2, cy + c.h / 2 + 3, m.brand[0] + '-CORE', 9, '#3a3f45', 'middle', 'font-weight="700"')}</g>`;
    else s += `<g data-kind="chip" data-id="${sd.id}|${c.type}" class="chip"><rect x="${cx}" y="${cy}" width="${c.w}" height="${c.h}" rx="2" fill="#111214" stroke="#3a3a3a"/>${labelSVG(cx + c.w / 2, cy + c.h / 2 + 3, { ram: 'LPDDR5', storage: 'UFS3.1', pmic: 'PM-7' }[c.type], 6.5, '#9aa0a6')}</g>`;
  });
  if (p.fault === 'board_pmic' && S.tools.microscope) { const pc = sd.chips.find(c => c.type === 'pmic'); s += `<circle cx="${x + pc.x + pc.w + 3}" cy="${y + pc.y + 4}" r="4" fill="#2a1a10" opacity=".8"/>`; }
  if (dev && dev.lciRed) s += `<g opacity=".5">${[0, 1, 2, 3].map(i => `<circle cx="${x + 30 + i * 9}" cy="${y + h - 20}" r="2.5" fill="#bfe3c0"/>`).join('')}</g>`;
  return s;
};
DRAW.shield = (sd) => {
  const { x, y, w, h } = sd;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#gShield)" stroke="#6c737b" stroke-width="1.2" filter="url(#fSoft)"/>`;
  s += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="6" fill="none" stroke="#fff" stroke-opacity=".35"/>`;
  if (w > 120 && h > 80) s += `<rect x="${x + 20}" y="${y + h * .35}" width="${w - 40}" height="${h * .3}" fill="url(#pVent)"/>`;
  s += labelSVG(x + w - 14, y + h - 12, 'EMI', 8, '#5d646c', 'end', 'font-weight="700"');
  s += `<rect x="${x + 10}" y="${y + h - 22}" width="26" height="12" fill="url(#gCopper)" opacity=".7"/>`;
  return s;
};
DRAW.battery = (sd, p, st, m) => {
  const { x, y, w, h } = sd;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="url(#gBatt)" stroke="#000" stroke-width="1"/>`;
  const lx = x + 14, ly = y + 30, lw = w - 28, lh = Math.min(150, h * .45);
  s += `<rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="6" fill="#e8edf2"/>`;
  const cap = { nova: '4,700', pixis: '3,900', lumen: '5,000' }[m.id];
  s += labelSVG(lx + 12, ly + 26, 'Li-ion Polymer Battery', 13, '#1c2733', 'start', 'font-weight="700"');
  s += labelSVG(lx + 12, ly + 46, '3.87V ⎓ ' + cap + 'mAh', 11, '#334', 'start');
  s += labelSVG(lx + 12, ly + 64, m.brand + ' ENERGY · ' + (p.origin === 'original' ? 'GENUINE' : p.grade + ' GRADE'), 9, '#556', 'start');
  s += `<rect x="${lx + 12}" y="${ly + lh - 30}" width="20" height="18" fill="none" stroke="#c33" stroke-width="1.5"/><path d="M${lx + 22} ${ly + lh - 28} l-5 9 h10 z" fill="#c33"/>`;
  s += labelSVG(lx + 40, ly + lh - 16, '가상 부품 · 손상 시 사용 금지', 8, '#a33', 'start');
  s += `<rect x="${x + w / 2 - 20}" y="${y - 4}" width="40" height="10" rx="2" fill="#111"/>`;
  if (st.adhesive === 'intact' || st.adhesive === 'new') {
    [0.25, 0.5, 0.75].forEach(f => { s += `<rect x="${x + w * f - 10}" y="${y + h - 26}" width="20" height="32" rx="3" fill="#f3f3f0" stroke="#bbb"/>`; s += labelSVG(x + w * f, y + h - 6, 'PULL', 6.5, '#666'); });
  }
  if (p.swollen) s += `<ellipse cx="${x + w / 2}" cy="${y + h / 2 + 20}" rx="${w * .42}" ry="${h * .36}" fill="url(#gSwell)"/><ellipse cx="${x + w / 2}" cy="${y + h / 2 + 20}" rx="${w * .42}" ry="${h * .36}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-dasharray="4 4"/>`;
  return s;
};
DRAW.coil = (sd) => {
  const { x, y, w, h } = sd; const cx = x + w / 2, cy = y + h / 2 + 10;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#121316" stroke="#2a2b30" filter="url(#fSoft)"/>`;
  s += `<rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${h - 20}" rx="8" fill="none" stroke="url(#gCopper)" stroke-width="3" opacity=".9"/>`;
  for (let r = 26; r <= 92; r += 6) s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="url(#gCopper)" stroke-width="2.6"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="22" fill="#0b0b0d"/>` + labelSVG(cx, cy + 4, 'Qi · NFC', 9, '#b8703c');
  s += `<path d="M${cx + 92} ${cy} L${x + w - 8} ${y + 22}" stroke="url(#gCopper)" stroke-width="5"/>`;
  return s;
};
DRAW.camera_rear = (sd, p, st, m) => {
  const { x, y, w, h } = sd; let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#141518" stroke="#3a3c42" filter="url(#fSoft)"/>`;
  const n = m.style.camCount;
  if (m.id === 'nova') s += lensSVG(x + 30, y + 32, 17) + lensSVG(x + 30, y + 88, 17) + lensSVG(x + 74, y + 60, 15);
  else if (m.id === 'pixis') s += lensSVG(x + 28, y + 30, 16) + lensSVG(x + 60, y + 66, 14);
  else s += lensSVG(x + w / 2, y + 30, 14) + lensSVG(x + w / 2, y + 84, 12);
  s += `<rect x="${x + 6}" y="${y + h - 14}" width="${w - 12}" height="8" rx="2" fill="url(#gKapton)" opacity=".8"/>`;
  if (p.cracked) s += crackSVG(x + 30, y + 88, 5, .3, { r: 16 });
  return s;
};
DRAW.camera_front = (sd) => { const { x, y, w, h } = sd; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#1b1c20" stroke="#44474e"/>` + lensSVG(x + w / 2, y + h / 2, Math.min(w, h) * .25); };
DRAW.earpiece = (sd) => { const { x, y, w, h } = sd; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#pMesh)" stroke="#555"/><circle cx="${x + 6}" cy="${y + h / 2}" r="2.5" fill="#d3ad52"/><circle cx="${x + w - 6}" cy="${y + h / 2}" r="2.5" fill="#d3ad52"/>`; };
DRAW.antenna = (sd) => {
  const { x, y, w, h } = sd; let d = `M${x + 6} ${y + h / 2}`; for (let i = 0; i < 8; i++) d += ` l${(w - 12) / 8} ${i % 2 ? -(h / 3) : h / 3}`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#2a2214" stroke="#6b5520"/><path d="${d}" stroke="#e0b44a" stroke-width="2.2" fill="none"/><circle cx="${x + w - 6}" cy="${y + 6}" r="3" fill="url(#gMetal)"/>`;
};
DRAW.button_flex = (sd) => {
  const { x, y, w, h } = sd; let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#gKapton)" stroke="#8a5216" stroke-width=".7"/>`;
  [0.15, 0.4, 0.62].forEach(f => s += `<circle cx="${x + w / 2}" cy="${y + h * f}" r="${w * .38}" fill="url(#gMetal)" stroke="#666"/>`);
  return s;
};
DRAW.flex_cable = (sd, p) => {
  const { x, y, w, h } = sd; let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#gKapton)" stroke="#8a5216" stroke-width=".7"/>`;
  for (let i = 1; i < 4; i++) s += `<line x1="${x + i * w / 4}" y1="${y + 8}" x2="${x + i * w / 4}" y2="${y + h - 8}" stroke="#7a3d0c" stroke-width=".8" opacity=".7"/>`;
  s += `<rect x="${x - 1}" y="${y}" width="${w + 2}" height="14" rx="2" fill="#2a2a2a"/><rect x="${x - 1}" y="${y + h - 14}" width="${w + 2}" height="14" rx="2" fill="#2a2a2a"/>`;
  if (p.fault === 'flex_torn') s += `<path d="M${x - 1} ${y + h * .45} l${w * .5} 6 l${w * .5 + 2} -8" stroke="#1a1a1a" stroke-width="3" fill="none"/>`;
  return s;
};
DRAW.charge_port = (sd, p, st, m) => {
  const { x, y, w, h } = sd; let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${m.style.pcb}" stroke="#c9a24a" stroke-width="1.5"/>`;
  s += smdField(x + 4, y + 4, w - 8, h - 8, hashStr(m.id + 'cp'), .8);
  const px = x + w / 2 - 22, py = y + h - 16;
  s += `<rect x="${px}" y="${py}" width="44" height="14" rx="7" fill="url(#gMetal)" stroke="#555"/><rect x="${px + 6}" y="${py + 4}" width="32" height="6" rx="3" fill="#111"/>`;
  if (!slotDef(m.id, 'microphone')) s += `<circle cx="${x + w / 2 - 44}" cy="${y + h - 10}" r="5" fill="url(#gMetal)" stroke="#555"/><circle cx="${x + w / 2 - 44}" cy="${y + h - 10}" r="1.6" fill="#000"/>`;
  if (p.fault === 'port_corroded') { const rnd = seeded(9); for (let i = 0; i < 24; i++) s += `<circle cx="${px + rnd() * 50 - 3}" cy="${py - rnd() * 18}" r="${1 + rnd() * 1.8}" fill="${rnd() < .5 ? '#7fd1a0' : '#e8f2e9'}" opacity=".85"/>`; }
  return s;
};
DRAW.speaker = (sd) => {
  const { x, y, w, h } = sd;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="url(#pRib)" stroke="#000" filter="url(#fSoft)"/>`;
  s += `<rect x="${x + 12}" y="${y + 12}" width="${Math.min(w - 24, 90)}" height="${h - 24}" rx="6" fill="url(#pGrille)" stroke="#333"/>`;
  s += labelSVG(x + w - 12, y + h - 12, 'SPK', 9, '#888', 'end', 'font-weight="700"');
  s += `<circle cx="${x + w - 18}" cy="${y + 18}" r="3" fill="#d3ad52"/><circle cx="${x + w - 28}" cy="${y + 18}" r="3" fill="#d3ad52"/>`;
  return s;
};
DRAW.microphone = (sd) => { const { x, y, w, h } = sd; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="#222" stroke="#000"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="3" fill="url(#gMetal)"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="1" fill="#000"/>`; };
DRAW.vibration = (sd) => {
  const { x, y, w, h } = sd;
  if (sd.round) return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 2}" fill="url(#gMetal)" stroke="#555"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="${w / 3}" fill="none" stroke="#777"/>` + labelSVG(x + w / 2, y + h / 2 + 3, 'ERM', 7, '#444');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5" fill="url(#gMetal)" stroke="#555"/><path d="M${x + 8} ${y + h / 2} ${Array.from({ length: 8 }, (_, i) => `l${(w - 30) / 8} ${i % 2 ? -6 : 6}`).join(' ')}" stroke="#555" fill="none"/>` + labelSVG(x + w - 10, y + h / 2 + 3, 'LRA', 8, '#333', 'end', 'font-weight="700"');
};
DRAW.heatsink = (sd) => { const { x, y, w, h } = sd; return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#gCopper)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#gGloss)"/>` + labelSVG(x + w / 2, y + h / 2, 'VAPOR CHAMBER', 12, '#6b3a14', 'middle', 'letter-spacing="2" opacity=".7"'); };
DRAW.midplate = (sd, p) => {
  const { x, y, w, h } = sd;
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#2c3034" stroke="#111" filter="url(#fSoft)"/>`;
  s += `<rect x="${x + 6}" y="${y + 6}" width="${w - 12}" height="${h - 12}" rx="9" fill="url(#pRib)" opacity=".6"/>`;
  s += `<path d="M${x + 10} ${y + 70} V${y + 12} H${x + 120} M${x + 200} ${y + 12} H${x + w - 12} V${y + 90} M${x + w - 12} ${y + 150} V${y + h - 12} H${x + w - 80}" stroke="#d6a640" stroke-width="3" fill="none"/>`;
  s += `<rect x="${x + 16}" y="${y + 14}" width="70" height="128" rx="24" fill="#16181b" stroke="#444"/>`;
  s += labelSVG(x + w / 2, y + h / 2 + 4, 'MIDPLATE · LDS ANT', 10, '#8c939a', 'middle', 'letter-spacing="2"');
  if (p.fault === 'ant_weak') s += `<path d="M${x + w - 12} ${y + 200} l-6 4 l8 6" stroke="#2c3034" stroke-width="5"/>`;
  return s;
};

/* ---------------- 커넥터 ---------------- */
function connSVG(dev, c, m, opts) {
  const st = dev.conns[c.id]; const present = connPresent(dev, c); const ownerIn = !!dev.slots[c.owner].part;
  const boardIn = !!dev.slots[c.board].part; if (!boardIn) return '';
  let s = '';
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const ownerSd = mSlot(dev, c.owner);
  const ownerOpen = ownerSd.hinge && dev.slots[c.owner].open;
  if (ownerIn && (ownerSd.side === c.side || c.ribbonFrom || ownerOpen)) {
    let fx, fy;
    if (ownerOpen) { fx = -4; fy = cy; }
    else if (c.ribbonFrom && ownerSd.side !== c.side) [fx, fy] = c.ribbonFrom;
    else { fx = Math.max(ownerSd.x, Math.min(ownerSd.x + ownerSd.w, cx)); fy = Math.max(ownerSd.y, Math.min(ownerSd.y + ownerSd.h, cy)); if (fx === cx && fy === cy) { fy = ownerSd.y + ownerSd.h / 2; } }
    const ty = st.on ? cy : cy - 10;
    if (ownerSd.type === 'antenna') s += `<path d="M${fx} ${fy} Q${(fx + cx) / 2} ${fy - 20} ${cx} ${ty}" stroke="#1d1d1f" stroke-width="2.6" fill="none"/><path d="M${fx} ${fy} Q${(fx + cx) / 2} ${fy - 20} ${cx} ${ty}" stroke="#666" stroke-width=".8" fill="none"/>`;
    else { const wd = Math.min(c.w * .72, 16); s += `<path d="M${fx} ${fy} L${cx} ${ty}" stroke="#7a420f" stroke-width="${wd + 2}" stroke-linecap="square"/><path d="M${fx} ${fy} L${cx} ${ty}" stroke="url(#gKapton)" stroke-width="${wd}" stroke-linecap="square"/>`; }
  }
  // 소켓
  s += `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="1.5" fill="#1a1a1c" stroke="#c9a24a" stroke-width=".8"/>`;
  for (let i = 0; i < Math.floor(c.w / 3); i++) s += `<rect x="${c.x + 2 + i * 3}" y="${c.y + c.h / 2 - 1}" width="1.3" height="2" fill="#d6b45a"/>`;
  // 플러그
  if (ownerIn) {
    const dy = st.on ? (st.loose ? -2.5 : 0) : -10; const rot = st.loose && st.on ? `rotate(-6 ${cx} ${cy})` : '';
    s += `<g transform="translate(0 ${dy}) ${rot}" ${st.on ? '' : 'opacity=".9"'}><rect x="${c.x - 1}" y="${c.y - 1}" width="${c.w + 2}" height="${c.h + 2}" rx="2" fill="${st.on ? '#2b2c30' : '#3a3b40'}" stroke="${st.on ? '#0c0c0d' : '#e7c35a'}" stroke-width="${st.on ? 1 : 1.4}" ${st.on ? '' : 'filter="url(#fSoft)"'}/><rect x="${c.x + 2}" y="${c.y + 2}" width="${c.w - 4}" height="${c.h - 4}" rx="1" fill="url(#gShield)" opacity=".55"/></g>`;
  }
  if (opts.connLabels) s += labelSVG(cx, c.y - (st.on ? 4 : 14), c.label, 7.5, '#ffe9a6', 'middle', 'class="clabel"');
  const hi = opts.hiConns && opts.hiConns.includes(c.id);
  return `<g class="conn${st.on ? ' on' : ''}${hi ? ' hi' : ''}" data-kind="conn" data-id="${c.id}"><rect x="${c.x - 8}" y="${c.y - 14}" width="${c.w + 16}" height="${c.h + 22}" fill="transparent"/>${s}${hi ? `<rect x="${c.x - 4}" y="${c.y - 4}" width="${c.w + 8}" height="${c.h + 8}" rx="3" fill="none" stroke="#ffd36b" stroke-width="1.5" stroke-dasharray="3 2"/>` : ''}</g>`;
}

/* ---------------- 전체 기기 ---------------- */
function segLines(sd) {
  const { x, y, w, h } = sd; const i = 7;
  return [[x + 30, y + i, x + w - 30, y + i], [x + w - i, y + 40, x + w - i, y + h - 40], [x + 30, y + h - i, x + w - 30, y + h - i], [x + i, y + 40, x + i, y + h - 40]];
}
const CLIP_POS = [[6, 160], [6, 560], [354, 160], [354, 560], [180, 6], [180, 754]];
function renderDevice(dev, opts = {}) {
  const m = MODELS[dev.modelId]; const side = dev.view;
  if (side === 'bottom') return renderEdge(dev, opts);
  let body = DRAW.frame(m, side, dev);
  if (side === 'back' && m.backFixed) {
    body += DRAW.back_fixed(m, dev);
    return wrapDevice(body, '', opts);
  }
  const items = [];
  m.slots.forEach(sd => {
    if (sd.side !== side) return; const st = dev.slots[sd.id]; if (!st.part) return; if (sd.hinge && st.open) return;
    items.push({ z: sd.z, html: slotSVG(dev, sd, st, m, opts) });
  });
  m.conns.forEach(c => { if (c.side !== side) return; const z = c.z != null ? c.z : mSlot(dev, c.board).z + 0.5; const html = connSVG(dev, c, m, opts); if (html) items.push({ z, html }); });
  items.sort((a, b) => a.z - b.z);
  body += items.map(i => i.html).join('');
  // 미니게임 오버레이: 접착 절단선 / 클립
  if (opts.tool === 'pick') {
    m.slots.forEach(sd => {
      if (sd.side !== side || !sd.adhesive) return; const st = dev.slots[sd.id];
      if (!st.part || (sd.hinge && st.open) || !isAccessible(dev, sd.id)) return;
      if (sd.adhesive.kind === 'glue' && (st.adhesive === 'heated' || st.adhesive === 'new' || (st.adhesive === 'intact' && !sd.adhesive.heat))) {
        segLines(sd).forEach((L, i) => { body += `<line x1="${L[0]}" y1="${L[1]}" x2="${L[2]}" y2="${L[3]}" class="seg${st.cut[i] ? ' cut' : ''}" data-kind="seg" data-id="${sd.id}|${i}"/>`; });
      }
      if (sd.adhesive.kind === 'clip' && st.adhesive === 'intact') {
        CLIP_POS.forEach(([cx, cy], i) => { body += `<g class="clip${st.clips[i] ? ' off' : ''}" data-kind="clip" data-id="${sd.id}|${i}"><circle cx="${cx}" cy="${cy}" r="16" fill="transparent"/><rect x="${cx - 9}" y="${cy - 6}" width="18" height="12" rx="3"/></g>`; });
      }
    });
  }
  // 열린 힌지(디스플레이) — 왼쪽에 펼쳐 둠
  let open = '';
  m.slots.forEach(sd => {
    const st = dev.slots[sd.id];
    if (sd.hinge && st.part && st.open && sd.side === side) {
      open += `<g transform="translate(-392 0)"><g class="part${opts.selected === sd.id ? ' sel' : ''}" data-kind="slot" data-id="${sd.id}">${drawDisplayRear(sd, st.part, m)}<rect class="hl" fill="none" stroke="none" pointer-events="none" x="0" y="0" width="360" height="760" rx="50"/></g></g>`;
    }
  });
  return wrapDevice(body, open, opts);
}
/* ---------- 아랫면(충전 포트 쪽) 보기 ---------- */
function renderEdge(dev, opts = {}) {
  const m = MODELS[dev.modelId], E = m.edge, T = E.t, st = m.style;
  const disp = dev.slots.display, dsd = mSlot(dev, 'display');
  const backPart = m.backFixed ? true : m.slots.some(sd => sd.side === 'back' && (sd.type === 'back_glass' || sd.type === 'back_cover') && dev.slots[sd.id].part);
  const frontOn = disp && disp.part && !disp.open;
  // 화면 쪽(위)·뒷면 쪽(아래)이 원근감 있게 보이도록
  let s = `<ellipse cx="180" cy="${T + 12}" rx="176" ry="7" fill="#000" opacity=".3"/>`;
  s += `<path d="M14 0 L346 0 L318 -70 L42 -70 Z" fill="${frontOn ? '#0a0b0e' : '#1a1c20'}" opacity=".7"/>`;
  s += labelSVG(180, -78, frontOn ? '▲ 화면 쪽' : '▲ 화면 쪽 (화면이 열려 있음)', 10, '#9fb3c3');
  // 프레임
  s += `<rect x="-6" y="0" width="372" height="${T}" rx="${T / 2}" fill="url(#gMetal)" filter="url(#fShadow)"/><rect x="-6" y="0" width="372" height="${T}" rx="${T / 2}" fill="${st.frame}" opacity=".55"/>`;
  s += `<rect x="4" y="1.5" width="352" height="3.5" rx="1.75" fill="${frontOn ? '#050608' : '#3a2f22'}"/>`;
  s += `<rect x="4" y="${T - 5}" width="352" height="3.5" rx="1.75" fill="${backPart ? st.back : '#3a2f22'}"/>`;
  s += `<rect x="40" y="0" width="4" height="${T}" fill="#3b3f44"/><rect x="316" y="0" width="4" height="${T}" fill="#3b3f44"/>`;
  // 마이크·스피커 구멍
  const my = T / 2;
  for (let i = 0; i < E.micN; i++) { const x = E.mic[0] + (E.mic[1] - E.mic[0]) * (E.micN === 1 ? .5 : i / (E.micN - 1)); s += `<circle cx="${x}" cy="${my}" r="2.6" fill="#08090b" stroke="#555b62" stroke-width=".6"/>`; }
  for (let x = E.spk[0]; x <= E.spk[1]; x += 9) s += `<circle cx="${x}" cy="${my}" r="3.2" fill="#08090b" stroke="#555b62" stroke-width=".6"/>`;
  if (E.jack) s += `<circle cx="${E.jack}" cy="${my}" r="7" fill="#08090b" stroke="#6b737c" stroke-width="1.2"/><circle cx="${E.jack}" cy="${my}" r="4" fill="#1a1c20"/>`;
  // 충전 포트
  const pp = dev.slots.charge_port && dev.slots.charge_port.part;
  let port = `<rect x="150" y="${my - 12}" width="60" height="24" fill="transparent"/><rect x="160" y="${my - 6.5}" width="40" height="13" rx="6.5" fill="#030304" stroke="#8a9199" stroke-width="1.2"/>`;
  if (pp) {
    port += `<rect x="168" y="${my - 1.6}" width="24" height="3.2" rx="1.2" fill="#2a2c30"/>`;
    for (let k = 0; k < 8; k++) port += `<rect x="${169 + k * 2.9}" y="${my - 1.4}" width="1.4" height="2.8" fill="#c9a24a"/>`;
    if (pp.fault === 'port_lint') port += `<path d="M163 ${my + 4} q4 -3 8 0 q4 2 8 -1 q5 3 9 0 q4 2 8 -1" stroke="#9a948a" stroke-width="2.2" fill="none" opacity=".9"/><circle cx="196" cy="${my + 3}" r="1.6" fill="#a49d92"/>`;
    if (pp.fault === 'port_corroded') port += `<circle cx="172" cy="${my - 2}" r="1.6" fill="#5fb37a"/><circle cx="185" cy="${my + 2}" r="2" fill="#4c9d68"/><circle cx="191" cy="${my - 1}" r="1.3" fill="#7ac98f"/><circle cx="178" cy="${my + 3}" r="1.1" fill="#9ad8a7"/>`;
    if (pp.fault === 'port_broken') port += `<path d="M171 ${my} l6 -2 l5 3" stroke="#d6b35c" stroke-width="1.2" fill="none"/>`;
  } else port += labelSVG(180, my + 2.5, '비어 있음', 5.5, '#777');
  s += `<g data-kind="port" class="porthot">${port}</g>`;
  // 아랫면 나사 (예: 픽시스 화면 고정 나사)
  if (E.screws) { const sid = E.screws.slot, sst = dev.slots[sid]; if (sst && sst.part && !sst.open) E.screws.xs.forEach((x, i) => { s += screwSVG(x, my, sst.screws[i], sid, i, true); }); }
  s += labelSVG(180, T + 58, '아랫면 — 충전 포트 · 스피커 · 마이크' + (E.screws ? ' · 고정 나사' : ''), 10.5, '#cfe6e2');
  return `<g class="devroot"><g class="phone edge">${s}</g></g>`;
}
function wrapDevice(body, open, opts) { return `<g class="devroot">${open}<g class="phone">${body}</g></g>`; }
function slotSVG(dev, sd, st, m, opts) {
  const p = st.part; const fn = DRAW[sd.type] || DRAW.shield;
  let s = fn(sd, p, st, m, dev);
  const edgeScr = m.edge && m.edge.screws && m.edge.screws.slot === sd.id;
  if (!edgeScr) (sd.screws || []).forEach(([x, y], i) => s += screwSVG(x, y, st.screws[i], sd.id, i, sd.type !== 'shield' && sd.type !== 'midplate' && sd.type !== 'mainboard'));
  const unknown = !(S.book[sd.type] && S.book[sd.type].lv >= 2);
  const r = sd.hinge || sd.type === 'back_glass' || sd.type === 'back_cover' || sd.type.startsWith('display') ? 50 : (sd.round ? sd.w / 2 : 8);
  let badge = '';
  if (unknown && opts.showUnknown !== false) badge = `<g class="unk"><circle cx="${sd.x + sd.w - 4}" cy="${sd.y + 4}" r="9" fill="#ffcc3a" stroke="#6b4d00"/>${labelSVG(sd.x + sd.w - 4, sd.y + 8, '?', 12, '#3a2a00', 'middle', 'font-weight="800"')}</g>`;
  return `<g class="part${opts.selected === sd.id ? ' sel' : ''}" data-kind="slot" data-id="${sd.id}">${s}<rect class="hl" fill="none" stroke="none" pointer-events="none" x="${sd.x}" y="${sd.y}" width="${sd.w}" height="${sd.h}" rx="${r}"/>${badge}</g>`;
}

/* ---------------- 교과서·트레이용 아이콘 ---------------- */
function partIconSVG(type, size = 120) {
  const chipLike = { soc: 'N-CORE', ram: 'LPDDR5', storage: 'UFS3.1', pmic: 'PM-7' };
  if (chipLike[type]) {
    const metal = type === 'soc';
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><rect x="6" y="6" width="88" height="88" rx="8" fill="#1d3a56"/>${tracesSVG(8, 8, 84, 84, 4, '#7fd3a5')}<rect x="24" y="24" width="52" height="52" rx="${metal ? 6 : 3}" fill="${metal ? 'url(#gMetal)' : '#111'}" stroke="#555"/>${labelSVG(50, 54, chipLike[type], 9, metal ? '#333' : '#aaa', 'middle', 'font-weight="700"')}</svg>`;
  }
  if (type === 'fan') return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><rect x="8" y="8" width="84" height="84" rx="12" fill="#222"/><circle cx="50" cy="50" r="36" fill="#111" stroke="#444"/>${[0, 60, 120, 180, 240, 300].map(a => `<path d="M50 50 Q${50 + 30 * Math.cos(a * Math.PI / 180)} ${50 + 30 * Math.sin(a * Math.PI / 180)} ${50 + 34 * Math.cos((a + 40) * Math.PI / 180)} ${50 + 34 * Math.sin((a + 40) * Math.PI / 180)}" stroke="#666" stroke-width="7" fill="none"/>`).join('')}<circle cx="50" cy="50" r="9" fill="url(#gMetal)"/></svg>`;
  if (type === 'ssd') return `<svg viewBox="0 0 100 100" width="${size}" height="${size}"><rect x="10" y="38" width="80" height="24" rx="2" fill="#1d3a56" stroke="#c9a24a"/><rect x="20" y="42" width="26" height="16" fill="#111"/><rect x="52" y="42" width="26" height="16" fill="#111"/><rect x="82" y="42" width="8" height="16" fill="#d6b45a"/></svg>`;
  let found = null;
  for (const mid of ['nova', 'pixis', 'lumen']) { const sd = MODELS[mid].slots.find(s => s.type === type); if (sd) { found = { m: MODELS[mid], sd }; break; } }
  if (!found) return '';
  const { m, sd } = found;
  const fakeDev = { modelId: m.id, slots: {}, conns: {}, lciRed: false, serial: m.code + '-000000' };
  m.slots.forEach(s => fakeDev.slots[s.id] = { part: null });
  const p = { uid: 'icon', origin: 'original', grade: '정품', type, fault: null };
  const st = { adhesive: 'cut', screws: [], cut: [] };
  const pad = 10; const vb = sd.type.startsWith('display') || sd.type.startsWith('back') ? `-10 -10 380 780` : `${sd.x - pad} ${sd.y - pad} ${sd.w + pad * 2} ${sd.h + pad * 2}`;
  const inner = sd.type.startsWith('display') ? drawDisplayFront(sd, p, st, m, fakeDev) : (DRAW[sd.type] || DRAW.shield)(sd, p, st, m, fakeDev);
  return `<svg viewBox="${vb}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`;
}
function partThumb(p, size = 54) { return partIconSVG(p.type, size); }
