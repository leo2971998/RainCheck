// ---- RainCheck shared helpers: prepended to every use_figma script ----
const HEX = h => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };
const SOLID = h => [{ type: 'SOLID', color: HEX(h) }];
// PayProof tokens (AppTheme.jsx) + four weather states, same chroma family
const C = {
  paper: '#FEF7ED', card: '#FFFFFF', ink: '#1F2937', muted: '#596273', line: '#E5DFD7', brand: '#B94308', white: '#FFFFFF',
  clear: '#D98E2B', clearBg: '#FFF3DC',
  cloudy: '#6B7B93', cloudyBg: '#EEF1F5',
  rain: '#3B7DD8', rainBg: '#E4EDFA',
  storm: '#B23A48', stormBg: '#F9E4E7',
};
const fonts = await figma.listAvailableFontsAsync();
const FAMILY = fonts.some(f => f.fontName.family === 'Geist') ? 'Geist' : 'Inter';
const styles = fonts.filter(f => f.fontName.family === FAMILY).map(f => f.fontName.style);
const pick = (...cands) => cands.find(s => styles.includes(s)) || 'Regular';
const W = { r: pick('Regular'), m: pick('Medium', 'Regular'), s: pick('SemiBold', 'Semi Bold', 'Semibold', 'Medium'), b: pick('Bold', 'SemiBold') };
await Promise.all([...new Set(Object.values(W))].map(style => figma.loadFontAsync({ family: FAMILY, style })));

function text(chars, o = {}) {
  const t = figma.createText();
  t.fontName = { family: FAMILY, style: W[o.weight || 'r'] };
  t.characters = chars;
  t.fontSize = o.size || 16;
  t.fills = SOLID(o.color || C.ink);
  t.lineHeight = { value: o.lh || Math.round((o.size || 16) * 1.3), unit: 'PIXELS' };
  if (o.ls) t.letterSpacing = { value: o.ls, unit: 'PIXELS' };
  if (o.upper) t.textCase = 'UPPER';
  if (o.name) t.name = o.name;
  return t;
}
function col(props = {}) { const f = figma.createAutoLayout('VERTICAL'); f.set(props); return f; }
function row(props = {}) { const f = figma.createAutoLayout('HORIZONTAL'); f.set(props); return f; }
function pad(f, t, r = t, b = t, l = r) { f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l; return f; }
// Append then stretch to parent width. Text gets height auto-resize.
function add(parent, node, fillWidth = true) {
  parent.appendChild(node);
  if (fillWidth) { node.layoutSizingHorizontal = 'FILL'; if (node.type === 'TEXT') node.textAutoResize = 'HEIGHT'; }
  return node;
}
function fixedW(node, w) { node.layoutSizingHorizontal = 'FIXED'; node.resize(w, node.height); return node; }
function divider(parent) { const d = figma.createFrame(); d.name = 'divider'; d.resize(10, 1); d.fills = SOLID(C.line); return add(parent, d); }
function icon(kind, size, color, name) {
  const n = figma.createNodeFromSvg(SVG[kind].replace(/currentColor/g, color).replace('W_H', `width="${size}" height="${size}"`));
  n.resize(size, size); n.name = name || `icon/${kind}`; return n;
}
function button(label, o = {}) {
  const b = row({ name: o.name || `Button/${label}`, cornerRadius: 14, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', itemSpacing: 8 });
  pad(b, 16, 20);
  if (o.outline) { b.fills = SOLID(C.card); b.strokes = SOLID(o.stroke || C.line); b.strokeWeight = 1.5; b.strokeAlign = 'INSIDE'; }
  else b.fills = SOLID(o.bg || C.brand);
  const t = text(label, { size: 16, weight: 's', color: o.fg || (o.outline ? C.ink : C.white), lh: 20 });
  b.appendChild(t);
  if (o.iconAfter) b.appendChild(icon(o.iconAfter, 18, o.fg || (o.outline ? C.ink : C.white)));
  return b;
}
function phone(name, x) {
  const p = col({ name, fills: SOLID(C.paper), itemSpacing: 20, clipsContent: true, cornerRadius: 0 });
  pad(p, 24, 24, 28, 24);
  figma.currentPage.appendChild(p);
  p.counterAxisSizingMode = 'FIXED';
  p.resize(390, 844);
  p.primaryAxisSizingMode = 'AUTO';
  p.minHeight = 844;
  p.x = x; p.y = 0;
  return p;
}
function section(parent, label) {
  return add(parent, text(label, { size: 12, weight: 'm', color: C.muted, ls: 0.8, upper: true, lh: 16, name: 'section label' }));
}
const STATE = {
  clear: { name: 'Clear', color: C.clear, bg: C.clearBg, icon: 'sun' },
  cloudy: { name: 'Cloudy', color: C.cloudy, bg: C.cloudyBg, icon: 'cloud' },
  rain: { name: 'Rain', color: C.rain, bg: C.rainBg, icon: 'rain' },
  storm: { name: 'Storm', color: C.storm, bg: C.stormBg, icon: 'storm' },
};
// 14-day strip. days: [{ d:'Th', n:'11', s:'clear' }, ...]
function strip(parent, days) {
  const s = add(parent, row({ name: 'Next 14 days', itemSpacing: 2, primaryAxisAlignItems: 'SPACE_BETWEEN', counterAxisAlignItems: 'MIN' }));
  for (const day of days) {
    const st = STATE[day.s];
    const emphasized = day.s === 'rain' || day.s === 'storm';
    const c = col({ name: `day/${day.n}`, itemSpacing: 4, counterAxisAlignItems: 'CENTER', cornerRadius: 8 });
    pad(c, 6, 0);
    c.fills = emphasized ? SOLID(st.bg) : [];
    s.appendChild(c);
    c.counterAxisSizingMode = 'FIXED'; c.resize(22, 60); c.primaryAxisSizingMode = 'AUTO';
    c.appendChild(text(day.d, { size: 11, weight: 'm', color: C.muted, lh: 14 }));
    c.appendChild(icon(st.icon, 16, st.color));
    c.appendChild(text(day.n, { size: 12, weight: 's', color: emphasized ? st.color : C.ink, lh: 14 }));
  }
  return s;
}
const SVG = {
  sun: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  cloud: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 18h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 9.6 4.25 4.25 0 0 0 7 18z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  rain: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 15h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 6.6 4.25 4.25 0 0 0 7 15z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  storm: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 14h10a4 4 0 0 0 .6-7.96A6 6 0 0 0 6.1 5.6 4.25 4.25 0 0 0 7 14z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M13 14l-2.5 4H14l-2.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  umbrella: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 12v6a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 5l-7 7 7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bank: '<svg W_H viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9l9-5 9 5M5 9v9M9 9v9M15 9v9M19 9v9M3 20h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
