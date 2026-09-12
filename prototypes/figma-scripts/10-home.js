// ---- Screen 1: Home / Forecast ----
figma.currentPage.name = 'RainCheck screens';
const p = phone('1 · Home — Forecast', 0);

// Header
const head = add(p, row({ name: 'Header', primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'CENTER' }));
const brand = col({ name: 'Brand', itemSpacing: 2 });
head.appendChild(brand);
brand.appendChild(text('RainCheck', { size: 20, weight: 'b', lh: 24 }));
brand.appendChild(text('Thursday, September 11', { size: 14, color: C.muted, lh: 18 }));
const acct = row({ name: 'Account', itemSpacing: 6, counterAxisAlignItems: 'CENTER', cornerRadius: 999, fills: SOLID(C.card), strokes: SOLID(C.line), strokeWeight: 1, strokeAlign: 'INSIDE' });
pad(acct, 6, 12, 6, 10);
head.appendChild(acct);
acct.appendChild(icon('bank', 16, C.muted));
acct.appendChild(text('Checking', { size: 13, weight: 'm', color: C.muted, lh: 16 }));

// Today card
const today = add(p, col({ name: 'Today card', itemSpacing: 6, fills: SOLID(C.clearBg), cornerRadius: 20 }));
pad(today, 20, 22, 22, 22);
today.appendChild(icon('sun', 44, C.clear, 'icon/state'));
add(today, text('Clear today', { size: 28, weight: 'b', color: C.ink, lh: 34, name: 'state' }));
add(today, text('Safe to spend', { size: 15, color: C.muted, lh: 20 }));
add(today, text('$86', { size: 56, weight: 'b', color: C.ink, lh: 60, ls: -1.5, name: 'safe to spend' }));
add(today, text('Nothing is due until Thursday the 18th.', { size: 15, color: C.muted, lh: 20 }));

// 14-day strip
const stripWrap = add(p, col({ name: 'Forecast strip', itemSpacing: 10 }));
section(stripWrap, 'Next 14 days');
strip(stripWrap, [
  { d: 'Th', n: '11', s: 'clear' }, { d: 'F', n: '12', s: 'clear' }, { d: 'Sa', n: '13', s: 'clear' }, { d: 'Su', n: '14', s: 'clear' },
  { d: 'M', n: '15', s: 'clear' }, { d: 'Tu', n: '16', s: 'clear' }, { d: 'W', n: '17', s: 'clear' }, { d: 'Th', n: '18', s: 'cloudy' },
  { d: 'F', n: '19', s: 'cloudy' }, { d: 'Sa', n: '20', s: 'cloudy' }, { d: 'Su', n: '21', s: 'cloudy' }, { d: 'M', n: '22', s: 'cloudy' },
  { d: 'Tu', n: '23', s: 'cloudy' }, { d: 'W', n: '24', s: 'rain' },
]);

// Heads-up banner
const banner = add(p, col({ name: 'Heads up · rain', itemSpacing: 10, fills: SOLID(C.rainBg), cornerRadius: 16 }));
pad(banner, 16, 16, 16, 16);
const bt = add(banner, row({ name: 'title', itemSpacing: 8, counterAxisAlignItems: 'CENTER' }));
bt.appendChild(icon('rain', 20, C.rain));
add(bt, text('Rain on Wednesday the 24th', { size: 17, weight: 's', color: C.rain, lh: 22 }));
add(banner, text("Rent and car insurance land the same day. You'll be about $80 short before payday.", { size: 15, color: C.ink, lh: 21 }));
add(banner, button('See what you can do', { bg: C.rain, iconAfter: 'arrow', name: 'Button/Primary' }));

// Coming up
const coming = add(p, col({ name: 'Coming up', itemSpacing: 0 }));
section(coming, 'Coming up');
const rows = [
  ['Sep 18', 'Electric', '$162', 'cloudy'],
  ['Sep 22', 'Internet', '$89', 'cloudy'],
  ['Sep 24', 'Rent + car insurance', '$970', 'rain'],
  ['Sep 26', 'Paycheck', '+$1,850', 'clear'],
];
rows.forEach(([date, name, amount, s], i) => {
  const r = add(coming, row({ name: `row/${name}`, itemSpacing: 12, counterAxisAlignItems: 'CENTER' }));
  pad(r, 12, 0);
  const d = text(date, { size: 13, color: C.muted, lh: 18 }); r.appendChild(d); fixedW(d, 56);
  r.appendChild(icon(STATE[s].icon, 18, STATE[s].color));
  add(r, text(name, { size: 16, lh: 20 }));
  r.appendChild(text(amount, { size: 16, weight: 'm', color: s === 'clear' && amount.startsWith('+') ? C.clear : C.ink, lh: 20 }));
  if (i < rows.length - 1) divider(coming);
});

return { createdNodeIds: [p.id], width: p.width, height: p.height, family: FAMILY, weights: W };
