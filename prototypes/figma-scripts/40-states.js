// ---- Sheet: the four weather states + type scale (implementation reference) ----
const sheet = col({ name: 'States & type', fills: SOLID(C.card), itemSpacing: 24, cornerRadius: 20, strokes: SOLID(C.line), strokeWeight: 1, strokeAlign: 'INSIDE' });
pad(sheet, 28, 28, 28, 28);
figma.currentPage.appendChild(sheet);
sheet.counterAxisSizingMode = 'FIXED'; sheet.resize(560, 100); sheet.primaryAxisSizingMode = 'AUTO';
sheet.x = 1410; sheet.y = 0;

add(sheet, text('Weather states', { size: 22, weight: 'b', lh: 28 }));
add(sheet, text('Each day of the forecast gets one of four states from the projected balance. Icon + color + word, never color alone.', { size: 14, color: C.muted, lh: 19 }));

const grid = add(sheet, row({ name: 'states', itemSpacing: 12 }));
const rules = {
  clear: 'Balance stays above your cushion ($200).',
  cloudy: 'Balance dips inside the cushion.',
  rain: 'Balance goes below zero before the next deposit.',
  storm: 'A new or larger bill pushes it further under.',
};
for (const key of ['clear', 'cloudy', 'rain', 'storm']) {
  const st = STATE[key];
  const card = col({ name: `state/${st.name}`, itemSpacing: 8, fills: SOLID(st.bg), cornerRadius: 14 });
  pad(card, 16, 14, 16, 14);
  grid.appendChild(card); card.layoutSizingHorizontal = 'FILL';
  card.appendChild(icon(st.icon, 28, st.color));
  add(card, text(st.name, { size: 17, weight: 's', color: st.color, lh: 22 }));
  add(card, text(rules[key], { size: 12, color: C.ink, lh: 16 }));
  add(card, text(st.color.toUpperCase(), { size: 11, weight: 'm', color: C.muted, lh: 14 }));
}

divider(sheet);
add(sheet, text('Type scale · ' + FAMILY, { size: 17, weight: 's', lh: 22 }));
const scale = [
  ['Big number', 56, 'b', '$86'],
  ['Screen title', 28, 'b', 'Clear today'],
  ['Card title', 17, 's', 'Move $80 from Savings'],
  ['Body (min 15)', 15, 'r', "You'll be about $80 short before payday."],
  ['Button', 16, 's', 'See what you can do'],
  ['Section label', 12, 'm', 'NEXT 14 DAYS'],
];
for (const [label, size, w, sample] of scale) {
  const r = add(sheet, row({ name: `type/${label}`, itemSpacing: 16, counterAxisAlignItems: 'CENTER' }));
  const l = text(`${label} · ${size}px`, { size: 12, color: C.muted, lh: 16 }); r.appendChild(l); fixedW(l, 150);
  add(r, text(sample, { size, weight: w, lh: Math.round(size * 1.2), ls: size >= 40 ? -1.5 : 0 }));
}

divider(sheet);
add(sheet, text('Rules for non-tech-savvy users: one question per screen, one primary button, 44px+ targets, plain words ("bill", not "payment request"), progressive disclosure, no modals.', { size: 13, color: C.muted, lh: 18 }));

return { createdNodeIds: [sheet.id], width: sheet.width, height: sheet.height };
