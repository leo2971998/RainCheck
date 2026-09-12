// ---- Screen 2: Rainy day detail + fixes ----
const p = phone('2 · Rainy day — Sep 24', 470);
p.itemSpacing = 16;

// Top bar
const top = add(p, row({ name: 'Top bar', itemSpacing: 10, counterAxisAlignItems: 'CENTER' }));
const backBtn = row({ name: 'Back', cornerRadius: 999, fills: SOLID(C.card), strokes: SOLID(C.line), strokeWeight: 1, strokeAlign: 'INSIDE', primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
pad(backBtn, 10, 10); top.appendChild(backBtn); backBtn.appendChild(icon('back', 20, C.ink));
add(top, text('Wednesday, September 24', { size: 17, weight: 's', lh: 22 }));

// Hero
const hero = add(p, col({ name: 'Day card · rain', itemSpacing: 6, fills: SOLID(C.rainBg), cornerRadius: 20 }));
pad(hero, 20, 22, 20, 22);
const heroTop = add(hero, row({ name: 'state', itemSpacing: 10, counterAxisAlignItems: 'CENTER' }));
heroTop.appendChild(icon('rain', 36, C.rain, 'icon/state'));
add(heroTop, text('Rain', { size: 28, weight: 'b', color: C.rain, lh: 34 }));
add(hero, text('About $80 short', { size: 22, weight: 's', lh: 28, name: 'shortfall' }));
add(hero, text('Two bills land two days before your paycheck on the 26th.', { size: 15, color: C.muted, lh: 20 }));

// What lands that day
const lands = add(p, col({ name: 'What lands that day', itemSpacing: 0, fills: SOLID(C.card), cornerRadius: 16, strokes: SOLID(C.line), strokeWeight: 1, strokeAlign: 'INSIDE' }));
pad(lands, 6, 16, 6, 16);
const lines = [
  ['Balance that morning', '$890', C.muted, 'r'],
  ['Rent', '−$850', C.ink, 'r'],
  ['Car insurance', '−$120', C.ink, 'r'],
  ['After both bills', '−$80', C.storm, 's'],
];
lines.forEach(([label, amt, color, w], i) => {
  const r = add(lands, row({ name: `line/${label}`, itemSpacing: 12, counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'SPACE_BETWEEN' }));
  pad(r, 10, 0);
  add(r, text(label, { size: 15, weight: w, color, lh: 20 }));
  r.appendChild(text(amt, { size: 15, weight: w === 's' ? 's' : 'm', color, lh: 20 }));
  if (i < lines.length - 1) divider(lands);
});

// Bring an umbrella
const fixes = add(p, col({ name: 'Bring an umbrella', itemSpacing: 12 }));
const fh = add(fixes, row({ name: 'heading', itemSpacing: 8, counterAxisAlignItems: 'CENTER' }));
fh.appendChild(icon('umbrella', 20, C.ink));
add(fh, text('Bring an umbrella', { size: 18, weight: 's', lh: 24 }));
add(fixes, text('Pick one. Nothing moves until you tap it.', { size: 14, color: C.muted, lh: 18 }));

const fixList = [
  ['Move $80 from Savings', 'Your rainy-day fund has $420. Money lands the 23rd and the 24th turns Clear.', 'Move $80', true],
  ['Pay car insurance on the 27th', 'Reschedule the bill to the day after payday. Rent still goes out on time.', 'Reschedule', false],
  ['Trim takeout by $80 this week', 'Last week you spent $142 on takeout. Keep it under $62 and the 24th stays Clear.', 'Set a limit', false],
];
for (const [title, detail, cta, primary] of fixList) {
  const card = add(fixes, col({ name: `fix/${title}`, itemSpacing: 12, fills: SOLID(C.card), cornerRadius: 16, strokes: SOLID(primary ? C.rain : C.line), strokeWeight: primary ? 1.5 : 1, strokeAlign: 'INSIDE' }));
  pad(card, 16, 16, 16, 16);
  add(card, text(title, { size: 17, weight: 's', lh: 22 }));
  add(card, text(detail, { size: 14, color: C.muted, lh: 19 }));
  add(card, button(cta, primary ? { bg: C.rain, name: 'Button/Primary' } : { outline: true, name: 'Button/Secondary' }));
}
add(p, text('Estimates use your scheduled bills and typical spending from your bank history.', { size: 12, color: C.muted, lh: 16 }));

return { createdNodeIds: [p.id], width: p.width, height: p.height };
