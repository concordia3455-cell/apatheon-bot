// Apatheon - Hoş geldin kartı oluşturucu (v2 - HUD tasarım)
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

const BG_DIR = path.join(__dirname, 'backgrounds');
const FONT_DIR = path.join(__dirname, 'fonts');

// ---- Fontlar (Türkçe destekli Poppins) ----
const reg = (file, name) => {
  const p = path.join(FONT_DIR, file);
  return fs.existsSync(p) && GlobalFonts.registerFromPath(p, name) ? name : 'sans-serif';
};
const F_BOLD = reg('font.ttf', 'PopB');
const F_MED = reg('font-medium.ttf', 'PopM');
const F_REG = reg('font-regular.ttf', 'PopR');

// ---- Temalar (dosya adına göre vurgu rengi) ----
const THEMES = [
  { match: /mor/i,     accent: '#9d6bff', light: '#d9c4ff' },
  { match: /mavi/i,    accent: '#3fb2ff', light: '#bfe6ff' },
  { match: /kirmizi/i, accent: '#ff4d6a', light: '#ffc2cb' },
  { match: /zumrut/i,  accent: '#2fe3a0', light: '#bdf7de' },
];
const themeOf = f => THEMES.find(t => t.match.test(f || '')) || THEMES[0];

function listBackgrounds() {
  if (!fs.existsSync(BG_DIR)) return [];
  return fs.readdirSync(BG_DIR).filter(f => /\.(png|jpe?g|webp)$/i.test(f));
}
function pickBackground(choice) {
  const all = listBackgrounds();
  if (!all.length) return null;
  if (choice && choice !== 'random' && all.includes(choice)) return choice;
  return all[Math.floor(Math.random() * all.length)];
}
const bgCache = new Map();
async function getBg(file) {
  if (!bgCache.has(file)) bgCache.set(file, await loadImage(path.join(BG_DIR, file)));
  return bgCache.get(file);
}
async function loadAvatar(src) {
  if (typeof src === 'string' && /^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error('Avatar indirilemedi: ' + res.status);
    return loadImage(Buffer.from(await res.arrayBuffer()));
  }
  return loadImage(src);
}

// ---- Metin temizleme (süslü Unicode / emoji -> kutucuk olmasın) ----
function clean(text, fallback = '') {
  const t = String(text ?? '').normalize('NFKC')
    .replace(/[^\u0020-\u007E\u00A0-\u024F\u2010-\u2027\u20AC\u2122]/g, '')
    .replace(/\s+/g, ' ').trim();
  return t || fallback;
}

// ---- Tarih ----
const TZ = 'Europe/Istanbul';
const fmtDate = d => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(d);
function ago(date) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 3600000) return 'Az önce';
  const days = Math.floor(diff / 86400000);
  if (days < 1) return 'Bugün';
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return `${months} ay önce`;
  const y = Math.floor(months / 12), m = months % 12;
  return m ? `${y} yıl ${m} ay önce` : `${y} yıl önce`;
}

// ---- Çizim yardımcıları ----
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function spacedWidth(ctx, text, spacing) {
  const chars = [...text];
  return chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
}
function spaced(ctx, text, cx, y, spacing) {
  const chars = [...text];
  let x = cx - spacedWidth(ctx, text, spacing) / 2;
  const prev = ctx.textAlign; ctx.textAlign = 'left';
  chars.forEach(c => { ctx.fillText(c, x, y); x += ctx.measureText(c).width + spacing; });
  ctx.textAlign = prev;
}
function fit(ctx, text, font, maxW, start, min = 24) {
  let s = start;
  do { ctx.font = `${s}px ${font}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > min);
}
function bracket(ctx, x, y, sx, sy, len) {
  ctx.beginPath();
  ctx.moveTo(x, y + sy * len); ctx.lineTo(x, y); ctx.lineTo(x + sx * len, y);
  ctx.stroke();
}

/**
 * o: { avatarURL, username, serverName, count, createdAt, joinedAt, background, footer }
 */
async function makeWelcomeImage(o) {
  const W = 1100, H = 560, cx = W / 2;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const file = pickBackground(o.background);
  const th = themeOf(file);
  const username = clean(o.username, 'Yeni Üye');
  const serverName = clean(o.serverName, 'Apatheon');

  // 1) Arka plan
  if (file) {
    const bg = await getBg(file);
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#120a2a'); g.addColorStop(1, '#2f1a63');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(0, 0, W, H);
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(0,0,0,0.20)'); vg.addColorStop(0.4, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // 2) Çerçeve + köşe braketleri
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.30)'; ctx.lineWidth = 2;
  rr(ctx, 16, 16, W - 32, H - 32, 22); ctx.stroke();
  ctx.strokeStyle = th.accent; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.shadowColor = th.accent; ctx.shadowBlur = 14;
  bracket(ctx, 16, 16, 1, 1, 46); bracket(ctx, W - 16, 16, -1, 1, 46);
  bracket(ctx, 16, H - 16, 1, -1, 46); bracket(ctx, W - 16, H - 16, -1, -1, 46);
  ctx.restore();

  // 3) Üst bilgi (büyük)
  ctx.textBaseline = 'middle';
  ctx.fillStyle = th.accent; ctx.beginPath(); ctx.arc(60, 58, 7, 0, Math.PI * 2); ctx.fill();
  ctx.font = `26px ${F_BOLD}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
  ctx.fillText(serverName.toUpperCase(), 82, 58);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'right'; ctx.font = `20px ${F_MED}`; ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(fmtDate(new Date()), W - 60, 58);

  // 4) Avatar: büyük HUD halkası
  const ay = 176, ar = 80;
  const glow = ctx.createRadialGradient(cx, ay, ar * 0.9, cx, ay, ar * 2.6);
  glow.addColorStop(0, th.accent + '99'); glow.addColorStop(1, th.accent + '00');
  ctx.fillStyle = glow; ctx.fillRect(cx - ar * 2.7, ay - ar * 2.7, ar * 5.4, ar * 5.4);

  ctx.save(); ctx.translate(cx, ay);
  const R1 = ar + 22;
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, long = i % 6 === 0, l = long ? 12 : 6;
    ctx.strokeStyle = long ? th.light : th.accent; ctx.globalAlpha = long ? 0.95 : 0.5; ctx.lineWidth = long ? 3 : 1.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * R1, Math.sin(a) * R1); ctx.lineTo(Math.cos(a) * (R1 + l), Math.sin(a) * (R1 + l)); ctx.stroke();
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = th.accent;
  ctx.shadowColor = th.accent; ctx.shadowBlur = 16;
  [[-0.95, -0.35], [0.15, 0.7], [1.15, 1.6], [2.2, 2.75]].forEach(([a, b]) => {
    ctx.beginPath(); ctx.arc(0, 0, ar + 14, a * Math.PI, b * Math.PI); ctx.stroke();
  });
  ctx.restore();

  const ring = ctx.createLinearGradient(cx - ar, ay - ar, cx + ar, ay + ar);
  ring.addColorStop(0, '#ffffff'); ring.addColorStop(0.5, th.accent); ring.addColorStop(1, th.light);
  ctx.beginPath(); ctx.arc(cx, ay, ar + 7, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, ay, ar + 3, 0, Math.PI * 2); ctx.fillStyle = '#0b0818'; ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, ay, ar, 0, Math.PI * 2); ctx.clip();
  try { ctx.drawImage(await loadAvatar(o.avatarURL), cx - ar, ay - ar, ar * 2, ar * 2); }
  catch { ctx.fillStyle = '#5865F2'; ctx.fillRect(cx - ar, ay - ar, ar * 2, ar * 2); }
  ctx.restore();

  // 5) Başlık + kullanıcı adı (büyük)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `26px ${F_BOLD}`;
  const title = 'HOŞ GELDİN', tw = spacedWidth(ctx, title, 12);
  const lineY = 304, gapX = 28, lineLen = 130;
  [[-1, cx - tw / 2 - gapX], [1, cx + tw / 2 + gapX]].forEach(([dir, x0]) => {
    const g = ctx.createLinearGradient(x0, 0, x0 + dir * lineLen, 0);
    g.addColorStop(0, th.accent); g.addColorStop(1, th.accent + '00');
    ctx.strokeStyle = g; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x0 + dir * lineLen, lineY); ctx.stroke();
  });
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 12;
  ctx.fillStyle = th.light; spaced(ctx, title, cx, lineY, 12);

  fit(ctx, username, F_BOLD, W - 160, 64, 30);
  const nw = ctx.measureText(username).width;
  const ng = ctx.createLinearGradient(cx - nw / 2, 0, cx + nw / 2, 0);
  ng.addColorStop(0, '#ffffff'); ng.addColorStop(0.7, '#ffffff'); ng.addColorStop(1, th.light);
  ctx.fillStyle = ng; ctx.fillText(username, cx, 358);
  ctx.shadowBlur = 0;

  // 6) Bilgi kartları (büyük yazı)
  const created = o.createdAt ? new Date(o.createdAt) : null;
  const joined = o.joinedAt ? new Date(o.joinedAt) : new Date();
  const isNew = created && (Date.now() - created.getTime()) < 7 * 86400000;
  const cnt = Number(o.count).toLocaleString('tr-TR');
  const cards = [
    { label: "DISCORD'A KATILDI", value: created ? fmtDate(created) : '-', sub: created ? (isNew ? 'Yeni hesap · ' + ago(created) : ago(created)) : '', warn: isNew },
    { label: 'SUNUCUYA KATILDI', value: fmtDate(joined), sub: ago(joined) },
    { label: 'ÜYE SIRASI', value: `#${cnt}`, sub: `${cnt}. üyemiz` },
  ];
  const gap = 16, pad = 56, ch = 106, cy0 = 408, cw = (W - pad * 2 - gap * 2) / 3;
  cards.forEach((c, i) => {
    const x = pad + i * (cw + gap);
    ctx.save();
    rr(ctx, x, cy0, cw, ch, 18);
    ctx.fillStyle = 'rgba(8,6,20,0.70)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = th.accent; rr(ctx, x + 16, cy0 + 22, 4, ch - 44, 2); ctx.fill();
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `15px ${F_BOLD}`; ctx.fillStyle = th.accent;
    let lx = x + 36; [...c.label].forEach(k => { ctx.fillText(k, lx, cy0 + 26); lx += ctx.measureText(k).width + 1.5; });
    fit(ctx, c.value, F_BOLD, cw - 56, 32, 18);
    ctx.fillStyle = '#ffffff'; ctx.fillText(c.value, x + 36, cy0 + 60);
    ctx.font = `17px ${F_MED}`; ctx.fillStyle = c.warn ? '#ffc861' : 'rgba(255,255,255,0.75)';
    ctx.fillText(c.sub, x + 36, cy0 + 88);
  });

  // 7) Alt imza
  ctx.textAlign = 'center'; ctx.font = `13px ${F_MED}`; ctx.fillStyle = 'rgba(255,255,255,0.55)';
  spaced(ctx, clean(o.footer, 'APATHEON  ·  PROFESYONEL HİZMET'), cx, 534, 5);

  return canvas.toBuffer('image/png');
}

module.exports = { makeWelcomeImage, listBackgrounds, clean };
