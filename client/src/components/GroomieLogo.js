import { useEffect, useRef } from 'react';

// ── Drawing helpers ──────────────────────────────────────────────────────────

function taper(ctx, ax, ay, bx, by, hw1, hw2, color) {
  const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.3) return;
  const nx = -dy / len, ny = dx / len;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(ax + nx * hw1, ay + ny * hw1);
  ctx.lineTo(bx + nx * hw2, by + ny * hw2);
  if (hw2 < 0.4) ctx.lineTo(bx, by);
  else ctx.lineTo(bx - nx * hw2, by - ny * hw2);
  ctx.lineTo(ax - nx * hw1, ay - ny * hw1);
  ctx.closePath();
  ctx.fill();
}

function bladeCurved(ctx, pivX, pivY, tipX, tipY, side, bwPiv, spread, color) {
  const cpY = pivY + (tipY - pivY) * 0.46;
  const cpX = tipX + side * spread;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pivX, pivY);
  ctx.lineTo(pivX + side * bwPiv, pivY);
  ctx.quadraticCurveTo(cpX, cpY, tipX, tipY);
  ctx.closePath();
  ctx.fill();
}

function exitPt(rx, ry, oR, tx, ty) {
  const a = Math.atan2(ty - ry, tx - rx);
  return { x: rx + oR * Math.cos(a), y: ry + oR * Math.sin(a) };
}

// "i" stem with no dot — pill-shaped rounded rect
function iStem(ctx, iCX, BL, FS, color) {
  const sw = FS * 0.135;
  const sh = FS * 0.69;
  const r  = sw * 0.5;
  const top = BL - sh;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(iCX, top + r, r, Math.PI, 0);
  ctx.lineTo(iCX + r, BL - r);
  ctx.arc(iCX, BL - r, r, 0, Math.PI);
  ctx.lineTo(iCX - r, top + r);
  ctx.closePath();
  ctx.fill();
}

// 4-toe gradient paw centered at (cx, cy)
function paw4(ctx, cx, cy, s, c1, c2) {
  const padY = cy + 4.5 * s;
  const toeY = cy - 5 * s;
  const toes = [
    { dx: -8.5 * s, dy:      0, rx: 2.8 * s, ry: 3.1 * s },
    { dx: -2.8 * s, dy: -4.5*s, rx: 2.8 * s, ry: 3.1 * s },
    { dx:  2.8 * s, dy: -4.5*s, rx: 2.8 * s, ry: 3.1 * s },
    { dx:  8.5 * s, dy:      0, rx: 2.8 * s, ry: 3.1 * s },
  ];
  const g = ctx.createLinearGradient(cx - 9 * s, toeY - 3 * s, cx + 9 * s, padY + 4.5 * s);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, padY, 6.5 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  toes.forEach(t => {
    ctx.beginPath();
    ctx.ellipse(cx + t.dx, toeY + t.dy, t.rx, t.ry, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── Core render ──────────────────────────────────────────────────────────────

function render(cv, targetHeight, light) {
  const dpr  = Math.min(window.devicePixelRatio || 1, 2);
  const ctx  = cv.getContext('2d');
  const FS   = 44;
  const FONT = `800 ${FS}px Quicksand, sans-serif`;

  ctx.font = FONT;

  // Measure characters with the live font
  const grW  = ctx.measureText('Gr').width;
  const oW   = ctx.measureText('o').width;
  const mW   = ctx.measureText('m').width;
  const iW   = ctx.measureText('i').width;
  const eW   = ctx.measureText('e').width;

  const PAD  = 12;
  const BL   = 65; // baseline y in the unscaled coordinate system

  const oR   = oW * 0.45;
  const oCY  = BL - oR;
  const o1X  = PAD + grW + oR;
  const o2X  = o1X + oW + 1;
  const mieX = o2X + oR + 2;
  const midX = (o1X + o2X) / 2;
  const iCX  = mieX + mW + iW * 0.5;
  const dotCY = BL - FS * 0.85;

  const pivY = BL + 24;
  const tipY = pivY + 36;
  const pivR = 6;
  const BW_ARM  = 4.5;
  const BW_PIV  = 3.2;
  const SPREAD  = 16;
  const PAW_S   = 0.70;

  // Full unscaled canvas size
  const W = Math.ceil(mieX + mW + iW + eW + PAD);
  const H = Math.ceil(tipY + 16);

  // Scale everything down to fit targetHeight
  const scale  = targetHeight / H;
  const dispW  = Math.ceil(W * scale);

  cv.style.width  = dispW + 'px';
  cv.style.height = targetHeight + 'px';
  cv.width        = dispW * dpr;
  cv.height       = targetHeight * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset before scaling
  ctx.scale(dpr * scale, dpr * scale);
  ctx.clearRect(0, 0, W, H);
  ctx.font = FONT;
  ctx.textBaseline = 'alphabetic';

  // Colour palette (light = white mode for dark navbar)
  const TC   = light ? 'rgba(255,255,255,0.95)' : '#7e22ce';
  const R1   = light ? 'rgba(255,255,255,0.95)' : '#9333ea';
  const R2   = light ? 'rgba(255,255,255,0.80)' : '#d946ef';
  const B1   = light ? 'rgba(255,255,255,0.95)' : '#9333ea';
  const B2   = light ? 'rgba(255,255,255,0.75)' : '#d946ef';
  const PIVC = light ? 'rgba(255,255,255,0.25)' : '#fdf4ff';
  const PIVS = light ? 'rgba(255,255,255,0.80)' : '#7e22ce';
  const PC1  = light ? 'rgba(255,255,255,0.95)' : '#9333ea';
  const PC2  = light ? 'rgba(255,255,255,0.75)' : '#d946ef';

  const e1 = exitPt(o1X, oCY, oR, midX, pivY);
  const e2 = exitPt(o2X, oCY, oR, midX, pivY);

  // Scissors — blade 2 behind, blade 1 in front
  taper(ctx, e2.x, e2.y, midX, pivY, BW_ARM, BW_PIV, B2);
  bladeCurved(ctx, midX, pivY, midX, tipY, -1, BW_PIV, SPREAD, B2);
  taper(ctx, e1.x, e1.y, midX, pivY, BW_ARM, BW_PIV, B1);
  bladeCurved(ctx, midX, pivY, midX, tipY, +1, BW_PIV, SPREAD, B1);

  // Pivot screw
  ctx.fillStyle = PIVC;
  ctx.strokeStyle = PIVS;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(midX, pivY, pivR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Rings ("oo") drawn on top so blades appear to exit them
  ctx.lineWidth = 5;
  ctx.strokeStyle = R1;
  ctx.beginPath(); ctx.arc(o1X, oCY, oR, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = R2;
  ctx.beginPath(); ctx.arc(o2X, oCY, oR, 0, Math.PI * 2); ctx.stroke();

  // Text: "Gr", "m", custom "i" stem (no dot), "e"
  ctx.fillStyle = TC;
  ctx.fillText('Gr', PAD, BL);
  ctx.fillText('m', mieX, BL);
  iStem(ctx, iCX, BL, FS, TC);
  ctx.fillText('e', mieX + mW + iW, BL);

  // 4-toe gradient paw replaces the "i" dot
  paw4(ctx, iCX, dotCY, PAW_S, PC1, PC2);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GroomieLogo({ height = 40, light = false }) {
  const cvRef = useRef(null);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const draw = () => render(cv, height, light);
    if (document.fonts.check('800 44px Quicksand')) {
      draw();
    } else {
      document.fonts.ready.then(draw);
    }
  }, [height, light]);

  return (
    <canvas
      ref={cvRef}
      style={{ display: 'block', cursor: 'pointer' }}
      aria-label="Groomie"
    />
  );
}
