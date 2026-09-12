// ---- Screen 3: Fix applied ----
const p = phone('3 · Fixed — Clear again', 940);

// Confirmation
const done = add(p, col({ name: 'Confirmation', itemSpacing: 10, counterAxisAlignItems: 'MIN' }));
pad(done, 12, 0, 4, 0);
const badge = row({ name: 'check badge', cornerRadius: 999, fills: SOLID(C.clearBg), primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER' });
pad(badge, 14, 14); done.appendChild(badge); badge.appendChild(icon('check', 28, C.clear));
add(done, text('Done. The 24th is Clear.', { size: 28, weight: 'b', lh: 34 }));
add(done, text('$80 moves from Savings to Checking on September 23. You can undo this until then.', { size: 15, color: C.muted, lh: 21 }));

// Strip after fix
const stripWrap = add(p, col({ name: 'Forecast strip', itemSpacing: 10 }));
section(stripWrap, 'Next 14 days');
strip(stripWrap, [
  { d: 'Th', n: '11', s: 'clear' }, { d: 'F', n: '12', s: 'clear' }, { d: 'Sa', n: '13', s: 'clear' }, { d: 'Su', n: '14', s: 'clear' },
  { d: 'M', n: '15', s: 'clear' }, { d: 'Tu', n: '16', s: 'clear' }, { d: 'W', n: '17', s: 'clear' }, { d: 'Th', n: '18', s: 'cloudy' },
  { d: 'F', n: '19', s: 'cloudy' }, { d: 'Sa', n: '20', s: 'cloudy' }, { d: 'Su', n: '21', s: 'cloudy' }, { d: 'M', n: '22', s: 'cloudy' },
  { d: 'Tu', n: '23', s: 'clear' }, { d: 'W', n: '24', s: 'clear' },
]);

// Rainy-day fund
const fund = add(p, col({ name: 'Rainy-day fund', itemSpacing: 12, fills: SOLID(C.card), cornerRadius: 16, strokes: SOLID(C.line), strokeWeight: 1, strokeAlign: 'INSIDE' }));
pad(fund, 16, 16, 16, 16);
const ft = add(fund, row({ name: 'title', itemSpacing: 8, counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'SPACE_BETWEEN' }));
const ftl = row({ itemSpacing: 8, counterAxisAlignItems: 'CENTER' }); ft.appendChild(ftl);
ftl.appendChild(icon('umbrella', 20, C.ink));
ftl.appendChild(text('Rainy-day fund', { size: 17, weight: 's', lh: 22 }));
ft.appendChild(text('$340 of $1,000', { size: 15, weight: 'm', color: C.muted, lh: 20 }));
// progress bar
const track = figma.createFrame(); track.name = 'progress'; track.resize(342, 8); track.cornerRadius = 4; track.fills = SOLID(C.line);
const bar = figma.createRectangle(); bar.name = 'progress fill'; bar.resize(116, 8); bar.cornerRadius = 4; bar.fills = SOLID(C.clear);
track.appendChild(bar); add(fund, track);
add(fund, text('You used $80 of your fund. On Clear days, RainCheck can set aside $5 to rebuild it.', { size: 14, color: C.muted, lh: 19 }));
add(fund, button('Set aside $5 on Clear days', { outline: true, name: 'Button/Secondary' }));

add(p, button('Back to forecast', { bg: C.brand, name: 'Button/Primary' }));

return { createdNodeIds: [p.id], width: p.width, height: p.height };
