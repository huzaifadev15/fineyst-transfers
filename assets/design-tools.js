/* assets/design-tools.js
 * Fineyst edit tools: Swap Colors, Add Text, Crop, Eraser, Filters.
 * Reads the artwork from <img data-canvas-art>, and when the customer applies an edit it fires
 *   document 'dtf:artwork-edited' { detail:{ file } }  (PNG File)
 * which the section's upload script turns into a fresh upload + editor reload.
 * Text Studio lazy-loads Fabric.js (cdnjs) and Google Fonts. */
(() => {
if (window.__designTools) return; window.__designTools = true;
const $ = (s, r = document) => r.querySelector(s);
const el = h => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CHK = 'conic-gradient(#ddd 25%,#fff 0 50%,#ddd 0 75%,#fff 0) 0 0/16px 16px';
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
const toHex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const lum = (r, g, b) => .299 * r + .587 * g + .114 * b;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c };
const rd = c => c.getContext('2d', { willReadFrequently: true });
const art = () => $('[data-canvas-art]');
let main = null;

/* ---------- CSS ---------- */
const css = `
.de-ov,.de-ov *{box-sizing:border-box}
.editor-rail.edit-tools{flex:0 0 172px;width:172px;max-width:none;display:flex;flex-direction:column;gap:2px;border:0;background:none;padding:0}
.edit-tools .rail-label{font:700 11px/1 system-ui;letter-spacing:.08em;color:#667085;text-transform:uppercase;padding:4px 6px 8px}
.et-row{display:flex;align-items:center;gap:10px;width:100%;padding:7px 6px;border:0;border-radius:8px;background:none;font:600 .92rem system-ui;cursor:pointer;text-align:left;color:#1a1a1a}
.et-row:hover{background:#f3f5f7}.et-row:disabled{opacity:.5}
.et-ic{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex:none}
.et-ic--ai{background:#e6f0ff;color:#2563eb}.et-ic--swap{background:#f1e8ff;color:#7c3aed}.et-ic--text{background:#e3f7ea;color:#16a34a}
.et-ic--up{background:#e5e9ff;color:#4338ca}.et-ic--crop{background:#eef0f3;color:#475467}.et-ic--erase{background:#fde8e8;color:#dc2626}.et-ic--filt{background:#fff1dc;color:#ea580c}
.edit-tools .rail-tool{border:0;background:none;padding:0;margin:0;box-shadow:none}
.edit-tools .rail-tool-head{display:flex;align-items:center;gap:10px;padding:7px 6px;border:0;background:none;font:600 .92rem system-ui}
.edit-tools .rail-tool-head .et-label{flex:1}
.edit-tools .rail-more-panel{margin:2px 0 6px 42px;display:flex;flex-direction:column;gap:2px}
.edit-tools .rail-more-panel[hidden]{display:none}
.edit-tools .rail-more-panel a{font-size:.85rem;padding:6px 8px;border-radius:6px;color:#344054;text-decoration:none}.edit-tools .rail-more-panel a:hover{background:#f3f5f7}
@media(max-width:720px){.editor-rail.edit-tools{flex:none;width:100%;flex-direction:row;flex-wrap:wrap}.et-row{width:auto}}
.de-ov{--de:var(--brand,#12A150);--de-t:#eaf7ef;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:14px;font:14px/1.4 system-ui,-apple-system,sans-serif;color:#111}
.de-m{background:#fff;border-radius:14px;width:100%;max-height:96vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.de-m.full{max-width:none!important;height:96vh}
.de-h{display:flex;justify-content:space-between;align-items:flex-start;padding:16px 20px 6px}.de-h h3{margin:0;font-size:18px}.de-h p{margin:4px 0 0;color:#666;font-size:13px}
.de-x{border:0;background:none;font-size:20px;cursor:pointer;color:#333}
.de-b{padding:8px 20px 14px;overflow:auto;flex:1}.de-m.full .de-b{display:flex;padding:0;overflow:hidden}
.de-f{display:flex;gap:8px;padding:12px 20px;border-top:1px solid #eee;align-items:center}.de-f .sp{flex:1}
.de-btn{padding:9px 16px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;font:inherit;font-weight:600}
.de-btn.p{background:var(--de);border-color:var(--de);color:#fff}.de-btn:disabled{opacity:.45;cursor:not-allowed}.de-btn.on{border-color:var(--de);color:var(--de);background:var(--de-t)}
.de-two{display:flex;gap:24px;align-items:flex-start}.de-two>div:last-child{flex:1;min-width:0}
.de-cw{position:relative;display:inline-block;line-height:0;border-radius:12px;overflow:hidden;background:${CHK};touch-action:none}
.de-cw canvas{max-width:100%;max-height:58vh;width:auto;height:auto;display:block}
.de-bg{position:absolute;top:8px;right:8px;background:#fff;border-radius:8px;padding:6px;display:flex;gap:6px;line-height:1;box-shadow:0 1px 6px rgba(0,0,0,.2);z-index:3}
.de-sw{width:20px;height:20px;border-radius:5px;border:1px solid #aaa;cursor:pointer;padding:0}
.de-pal{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0 16px}
.de-pc{width:46px;height:46px;border-radius:10px;border:2px solid #ddd;cursor:pointer;padding:0}.de-pc.on{border-color:var(--de);box-shadow:0 0 0 2px var(--de-t)}
.de-chk{background:conic-gradient(#ccc 25%,#fff 0 50%,#ccc 0 75%,#fff 0) 0 0/10px 10px}
.de-b h4{margin:6px 0;font-size:16px;display:flex;gap:8px;align-items:center}
.de-n{background:var(--de);color:#fff;border-radius:50%;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
.de-b label{display:inline-flex;gap:6px;align-items:center;margin:4px 14px 4px 0}
.de-hint{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);background:#fff;border-radius:20px;padding:6px 12px;font-size:12px;white-space:nowrap;box-shadow:0 1px 6px rgba(0,0,0,.2);line-height:1.2;pointer-events:none}
.de-crop{position:absolute;border:2px solid var(--de);box-shadow:0 0 0 9999px rgba(0,0,0,.55);cursor:move;touch-action:none;background:linear-gradient(#fff6 1px,transparent 1px) 0 33.3%/100% 33.3%,linear-gradient(90deg,#fff6 1px,transparent 1px) 33.3% 0/33.3% 100%}
.de-crop i{position:absolute;width:14px;height:14px;background:#fff;border:2px solid var(--de);border-radius:3px}
.de-ring{position:fixed;border:2px solid #fff;outline:1px solid #000;border-radius:50%;pointer-events:none;z-index:100000;display:none;transform:translate(-50%,-50%)}
.de-tabs{display:inline-flex;background:#f1f1f1;border-radius:10px;padding:4px;gap:4px;margin-bottom:12px}
.de-tabs button{border:0;background:none;padding:8px 14px;border-radius:8px;cursor:pointer;font:inherit;font-weight:600;color:#555}.de-tabs button.on{background:#fff;color:#111;box-shadow:0 1px 3px #0003}
.de-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
.de-ft{border:2px solid #e5e5e5;border-radius:10px;padding:6px;cursor:pointer;text-align:center;font-weight:600;font-size:13px;background:#fff}.de-ft.on{border-color:var(--de);color:var(--de)}
.de-ft canvas{width:100%;height:auto;border-radius:6px;display:block;margin-bottom:4px;background:conic-gradient(#ccc 25%,#fff 0 50%,#ccc 0 75%,#fff 0) 0 0/12px 12px}
.de-side{width:76px;border-right:1px solid #eee;display:flex;flex-direction:column;gap:6px;padding:8px}
.de-side button{border:0;background:none;padding:10px 0;border-radius:8px;cursor:pointer;font:inherit;font-size:20px;display:flex;flex-direction:column;align-items:center;color:#444}.de-side small{font-size:12px}.de-side .on{background:var(--de-t);color:var(--de)}
.de-panel{width:290px;border-right:1px solid #eee;padding:14px;overflow:auto}
.de-edit{flex:1;display:flex;flex-direction:column;min-width:0;background:#f6f7f9}
.de-tb{display:flex;gap:6px;align-items:center;padding:8px 12px;background:#fff;border-bottom:1px solid #eee;flex-wrap:wrap;position:relative}
.de-tb.off .de-ctl{opacity:.4;pointer-events:none}
.de-tb select,.de-tb input[type=number]{padding:6px;border:1px solid #ddd;border-radius:6px;font:inherit}.de-tb input[type=number]{width:60px}
.de-tb button{border:1px solid transparent;background:none;border-radius:6px;padding:6px 9px;cursor:pointer;font:inherit}.de-tb button.on{background:var(--de-t);border-color:var(--de)}
.de-pop{position:absolute;top:100%;right:12px;background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px;z-index:5;display:none;width:240px;box-shadow:0 8px 24px #0003}
.de-pop label{display:flex;justify-content:space-between;align-items:center;margin:6px 0}
.de-cvwrap{flex:1;overflow:auto;display:flex;align-items:center;justify-content:center;padding:16px}
.de-cvhold{line-height:0;background:${CHK};box-shadow:0 2px 12px #0003}
.de-style{border:1px solid #e5e5e5;border-radius:10px;padding:14px 6px;text-align:center;cursor:pointer;background:#fff;font-size:24px;white-space:nowrap;overflow:hidden}.de-style small{display:block;font:600 12px system-ui;color:#333;margin-top:8px}
.de-ly{display:flex;gap:6px;align-items:center;padding:8px;border:1px solid #e5e5e5;border-radius:8px;margin-bottom:6px;cursor:pointer}.de-ly.on{border-color:var(--de);background:var(--de-t)}.de-ly span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.de-ly button{border:0;background:none;cursor:pointer}
@media(max-width:720px){.de-two{flex-direction:column}.de-m.full .de-b{flex-wrap:wrap;overflow:auto}.de-panel{width:100%}.de-edit{min-height:60vh}}`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

/* ---------- glue to the page ---------- */
function source() {
  const i = art(); if (!i || !i.src || !i.naturalWidth) return null;
  const s = Math.min(1, 3000 / Math.max(i.naturalWidth, i.naturalHeight)), c = cvs(Math.round(i.naturalWidth * s), Math.round(i.naturalHeight * s));
  c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
  try { c.getContext('2d').getImageData(0, 0, 1, 1) } catch (e) { return null }
  return c;
}
function commit(c) {
  c.toBlob(b => {
    const file = new File([b], 'artwork-edited-' + Date.now() + '.png', { type: 'image/png' });
    document.dispatchEvent(new CustomEvent('dtf:artwork-edited', { detail: { file } }));
  }, 'image/png');
}
const setCanvas = commit;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-edit-tool]'); if (!b) return;
  main = source();
  if (!main) { const z = $('[data-upload-browse]'); if (z) { z.scrollIntoView({ behavior: 'smooth', block: 'center' }); z.click() } return; }
  ({ swap: swapColors, text: textStudio, crop: cropper, erase: eraser, filters })[b.dataset.editTool]();
});

/* ---------- shared helpers ---------- */
function modal(title, sub, { wide = 980, full = false } = {}) {
  const o = el(`<div class="de-ov"><div class="de-m ${full ? 'full' : ''}" style="max-width:${wide}px"><div class="de-h"><div><h3>${title}</h3><p>${sub || ''}</p></div><button class="de-x" aria-label="Close">✕</button></div><div class="de-b"></div><div class="de-f"></div></div></div>`);
  document.body.appendChild(o);
  const close = () => { o.remove(); const a = art(); if (a) a.style.filter = '' }; $('.de-x', o).onclick = close;
  return { o, body: $('.de-b', o), foot: $('.de-f', o), close };
}
function footer(m, H, ok, fn) {
  m.foot.innerHTML = (H ? '<button class="de-btn" data-a="u">↶ Undo</button><button class="de-btn" data-a="r">Redo ↷</button>' : '') + `<span class="sp"></span><button class="de-btn" data-a="c">Cancel</button><button class="de-btn p" data-a="o">${ok}</button>`;
  const q = a => $(`[data-a=${a}]`, m.foot); q('c').onclick = m.close; q('o').onclick = () => { fn(); m.close() };
  if (H) { q('u').onclick = () => H.undo(); q('r').onclick = () => H.redo() }
  const upd = () => { if (H) { q('u').disabled = !H.u; q('r').disabled = !H.r } }; upd(); return upd;
}
function hist(get, set, cb) {
  const U = [], R = [], cap = Math.max(4, Math.min(30, Math.floor(2e8 / (main.width * main.height * 4))));
  return { push() { U.push(get()); if (U.length > cap) U.shift(); R.length = 0; cb() }, undo() { if (U.length) { R.push(get()); set(U.pop()); cb() } },
    redo() { if (R.length) { U.push(get()); set(R.pop()); cb() } }, get u() { return U.length }, get r() { return R.length } };
}
function bgPicker(wrap) {
  const d = el('<div class="de-bg"></div>');
  [CHK, '#000', '#fff', '#5cff5c', 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)'].forEach(v => { const b = el('<button class="de-sw"></button>'); b.style.background = v; b.onclick = () => wrap.style.background = v; d.appendChild(b) });
  wrap.appendChild(d);
}
function pt(e, c) { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * c.width / r.width, y: (e.clientY - r.top) * c.height / r.height } }
function flood(w, h, sx, sy, match) {
  const m = new Uint8Array(w * h), st = [sy * w + sx]; if (!match(st[0] * 4)) return m; m[st[0]] = 1;
  while (st.length) { const p = st.pop(), x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 && p - 1, x < w - 1 && p + 1, y > 0 && p - w, y < h - 1 && p + w]) { if (q === false || m[q]) continue; if (match(q * 4)) { m[q] = 1; st.push(q) } } }
  return m;
}
function palette(px) {
  const map = new Map(); let empty = false;
  for (let i = 0; i < px.length; i += 16) { if (px[i + 3] < 10) { empty = true; continue } if (px[i + 3] < 200) continue;
    const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4), e = map.get(k) || [0, 0, 0, 0]; e[0] += px[i]; e[1] += px[i + 1]; e[2] += px[i + 2]; e[3]++; map.set(k, e) }
  const arr = [...map.values()].sort((a, b) => b[3] - a[3]).map(e => [e[0] / e[3] | 0, e[1] / e[3] | 0, e[2] / e[3] | 0]), out = [];
  for (const c of arr) { if (out.every(o => dist(o, c) > 45)) out.push(c); if (out.length >= 8) break }
  return { colors: out, empty };
}

/* ---------- 1. SWAP COLORS ---------- */
function swapColors() {
  const m = modal('Swap Colors', 'Swap colors everywhere, change one part, fill empty areas, or make things transparent.', { wide: 1040 });
  const w = main.width, h = main.height, cv = cvs(w, h), c = rd(cv); c.drawImage(main, 0, 0); const orig = c.getImageData(0, 0, w, h);
  m.body.innerHTML = `<div class="de-two"><div style="flex:0 0 46%;max-width:46%"><div class="de-cw" id="cw"></div><div style="text-align:center;margin-top:8px"><button class="de-btn" id="hold">Hold to see the original</button></div></div>
  <div><h4><span class="de-n">1</span> Select the color or part of your image you want to change</h4><div class="de-pal" id="pal"></div>
  <div id="s2" style="display:none"><h4><span class="de-n">2</span> Change it to</h4><div class="de-pal" id="pre"></div>
  <h4><span class="de-n">3</span> Options</h4><label><input type="radio" name="sc" value="all" checked> Everywhere</label><label><input type="radio" name="sc" value="area"> Only this part</label><br>
  <label>Tolerance <input type="range" id="tol" min="5" max="150" value="45"></label><br><br><button class="de-btn p" id="go">Swap</button></div></div></div>`;
  const cw = $('#cw', m.o); cw.appendChild(cv); bgPicker(cw); cw.appendChild(el('<div class="de-hint">Click any part of the image to pick it</div>'));
  let sel = null, to = '#ff0000', cur = null;
  const H = hist(() => c.getImageData(0, 0, w, h), d => { c.putImageData(d, 0, 0); refreshPal() }, () => upd());
  const upd = footer(m, H, 'Apply', () => setCanvas(cv));
  function refreshPal() {
    const { colors, empty } = palette(c.getImageData(0, 0, w, h).data), p = $('#pal', m.o); p.innerHTML = '';
    if (empty) { const b = el('<button class="de-pc de-chk" title="Empty areas"></button>'); b.onclick = () => choose({ empty: true, x: -1, y: -1 }, b); p.appendChild(b) }
    colors.forEach(col => { const b = el('<button class="de-pc"></button>'); b.style.background = toHex(col); b.onclick = () => choose({ rgb: col, x: -1, y: -1 }, b); p.appendChild(b) });
  }
  function choose(s, btn) { sel = s; [...$('#pal', m.o).children].forEach(x => x.classList.toggle('on', x === btn)); $('#s2', m.o).style.display = 'block'; if (s.x < 0) m.o.querySelector('input[value=all]').checked = true }
  const pre = $('#pre', m.o), mark = b => [...pre.children].forEach(x => x.classList.toggle('on', x === b));
  ['#ff0000', '#ff8a00', '#ffd400', '#22c55e', '#0ea5e9', '#2563eb', '#a855f7', '#ec4899', '#000000', '#ffffff'].forEach(col => {
    const b = el('<button class="de-pc" style="width:34px;height:34px"></button>'); b.style.background = col; b.onclick = () => { to = col; inp.value = col; mark(b) }; pre.appendChild(b) });
  const inp = el('<input type="color" value="#ff0000" style="width:40px;height:36px">'); inp.oninput = () => { to = inp.value; mark(null) }; pre.appendChild(inp);
  const tb = el('<button class="de-pc de-chk" style="width:34px;height:34px" title="Transparent"></button>'); tb.onclick = () => { to = 'transparent'; mark(tb) }; pre.appendChild(tb);
  cv.onpointerdown = e => { const p = pt(e, cv), x = Math.floor(p.x), y = Math.floor(p.y), d = c.getImageData(x, y, 1, 1).data; choose(d[3] < 10 ? { empty: true, x, y } : { rgb: [d[0], d[1], d[2]], x, y }, null) };
  $('#go', m.o).onclick = () => {
    if (!sel || (sel.empty && to === 'transparent')) return;
    const d = c.getImageData(0, 0, w, h), px = d.data, tol = +$('#tol', m.o).value, scope = m.o.querySelector('input[name=sc]:checked').value,
      tr = to === 'transparent', tc = tr ? null : hex2rgb(to), sr = sel.rgb, sl = sr ? lum(...sr) || 1 : 1,
      dd = i => Math.hypot(px[i] - sr[0], px[i + 1] - sr[1], px[i + 2] - sr[2]),
      match = sel.empty ? (i => px[i + 3] < 10) : (i => px[i + 3] >= 10 && dd(i) <= tol);
    let mask;
    if (scope === 'area' && sel.x >= 0) mask = flood(w, h, sel.x, sel.y, match); else { mask = new Uint8Array(w * h); for (let p = 0; p < w * h; p++) if (match(p * 4)) mask[p] = 1 }
    H.push();
    for (let p = 0; p < w * h; p++) { if (!mask[p]) continue; const i = p * 4;
      if (sel.empty) { px[i] = tc[0]; px[i + 1] = tc[1]; px[i + 2] = tc[2]; px[i + 3] = 255; continue }
      const wt = 1 - dd(i) / tol * .5; if (tr) { px[i + 3] *= 1 - wt; continue }
      const k = Math.min(1.7, Math.max(.25, lum(px[i], px[i + 1], px[i + 2]) / sl)); // keeps shading / glitter
      for (let q = 0; q < 3; q++) px[i + q] = Math.min(255, px[i + q] * (1 - wt) + tc[q] * k * wt) }
    c.putImageData(d, 0, 0); refreshPal();
  };
  const hold = $('#hold', m.o);
  hold.onpointerdown = () => { cur = c.getImageData(0, 0, w, h); c.putImageData(orig, 0, 0) };
  ['onpointerup', 'onpointerleave'].forEach(ev => hold[ev] = () => { if (cur) { c.putImageData(cur, 0, 0); cur = null } });
  refreshPal();
}

/* ---------- 2. CROP ---------- */
function cropper() {
  const m = modal('Crop your design', 'Drag the corners to crop. Drag inside to move.', { wide: 820 });
  const w = main.width, h = main.height, cv = cvs(w, h); cv.getContext('2d').drawImage(main, 0, 0);
  m.body.innerHTML = '<div style="text-align:center"><div class="de-cw" id="cw"></div></div>';
  const cw = $('#cw', m.o); cw.appendChild(cv);
  const box = el('<div class="de-crop"><i data-h="nw" style="left:-8px;top:-8px;cursor:nwse-resize"></i><i data-h="ne" style="right:-8px;top:-8px;cursor:nesw-resize"></i><i data-h="sw" style="left:-8px;bottom:-8px;cursor:nesw-resize"></i><i data-h="se" style="right:-8px;bottom:-8px;cursor:nwse-resize"></i></div>'); cw.appendChild(box);
  let R = { x: w * .05, y: h * .05, w: w * .9, h: h * .9 }, sq = false, S = null; const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const render = () => { box.style.left = R.x / w * 100 + '%'; box.style.top = R.y / h * 100 + '%'; box.style.width = R.w / w * 100 + '%'; box.style.height = R.h / h * 100 + '%' }; render();
  box.onpointerdown = e => { e.preventDefault(); box.setPointerCapture(e.pointerId); S = { x: e.clientX, y: e.clientY, R: { ...R }, hd: e.target.dataset.h || '' } };
  box.onpointermove = e => { if (!S) return; const r = cv.getBoundingClientRect(), dx = (e.clientX - S.x) * w / r.width, dy = (e.clientY - S.y) * h / r.height, hd = S.hd, s = S.R;
    if (!hd) { R.x = cl(s.x + dx, 0, w - s.w); R.y = cl(s.y + dy, 0, h - s.h) }
    else { let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
      if (hd.includes('w')) x1 += dx; if (hd.includes('e')) x2 += dx; if (hd.includes('n')) y1 += dy; if (hd.includes('s')) y2 += dy;
      let nw = cl(x2 - x1, 20, w), nh = cl(y2 - y1, 20, h); if (sq) nw = nh = Math.min(Math.max(nw, nh), w, h);
      const nx = hd.includes('w') ? s.x + s.w - nw : s.x, ny = hd.includes('n') ? s.y + s.h - nh : s.y;
      R = { x: cl(nx, 0, w - nw), y: cl(ny, 0, h - nh), w: nw, h: nh } }
    render() };
  box.onpointerup = () => S = null;
  const free = el('<button class="de-btn on">Freeform</button>'), sqr = el('<button class="de-btn">Square</button>');
  const setMode = s => { sq = s; free.classList.toggle('on', !s); sqr.classList.toggle('on', s); if (s) { R.w = R.h = Math.min(R.w, R.h); render() } };
  free.onclick = () => setMode(false); sqr.onclick = () => setMode(true);
  footer(m, null, 'Apply Crop', () => { const o = cvs(Math.round(R.w), Math.round(R.h)); o.getContext('2d').drawImage(cv, Math.round(R.x), Math.round(R.y), o.width, o.height, 0, 0, o.width, o.height); setCanvas(o) });
  m.foot.prepend(sqr); m.foot.prepend(free);
}

/* ---------- 3. ERASER ---------- */
function eraser() {
  const m = modal('Eraser', '', { wide: 1040 });
  const w = main.width, h = main.height, cv = cvs(w, h), c = rd(cv); c.drawImage(main, 0, 0); const oc = cvs(w, h); oc.getContext('2d').drawImage(main, 0, 0);
  m.body.innerHTML = `<div class="de-two"><div style="flex:0 0 52%;max-width:52%"><div class="de-cw" id="cw" style="cursor:none"></div></div><div>
  <div class="de-tabs"><button class="on" data-m="brush">✎ Brush</button><button data-m="magic">✦ Magic Erase</button></div>
  <div id="bw"><b>Brush Size</b> <span id="bv">20</span><br><input type="range" id="bs" min="3" max="100" value="20" style="width:100%"></div>
  <div id="mg" style="display:none"><b>Tolerance</b><br><input type="range" id="tol" min="5" max="150" value="40" style="width:100%"></div>
  <div id="rs"><label><input type="checkbox" id="rest"> Restore erased areas</label></div>
  <p id="ds" style="color:#777;font-size:13px">Drag over any part of your design to erase it. Undo steps back one stroke at a time.</p></div></div>`;
  const cw = $('#cw', m.o); cw.appendChild(cv); bgPicker(cw); cv.style.touchAction = 'none';
  const ring = el('<div class="de-ring"></div>'); m.o.appendChild(ring);
  let mode = 'brush', down = false, last = null;
  const H = hist(() => c.getImageData(0, 0, w, h), d => c.putImageData(d, 0, 0), () => upd());
  const upd = footer(m, H, 'Done', () => setCanvas(cv)); const size = () => +$('#bs', m.o).value;
  $('#bs', m.o).oninput = () => $('#bv', m.o).textContent = size();
  m.o.querySelectorAll('.de-tabs button').forEach(b => b.onclick = () => { mode = b.dataset.m;
    m.o.querySelectorAll('.de-tabs button').forEach(x => x.classList.toggle('on', x === b));
    $('#mg', m.o).style.display = mode === 'magic' ? 'block' : 'none'; $('#rs', m.o).style.display = $('#bw', m.o).style.display = mode === 'brush' ? 'block' : 'none';
    $('#ds', m.o).textContent = mode === 'brush' ? 'Drag over any part of your design to erase it. Undo steps back one stroke at a time.' : 'Click a color to erase all connected pixels of a similar color.'; ring.style.display = 'none' });
  function stroke(a, b) { const k = cv.width / cv.getBoundingClientRect().width; c.save(); c.lineCap = c.lineJoin = 'round'; c.lineWidth = size() * k;
    if ($('#rest', m.o).checked) c.strokeStyle = c.createPattern(oc, 'no-repeat'); else { c.globalCompositeOperation = 'destination-out'; c.strokeStyle = '#000' }
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x + .01, b.y); c.stroke(); c.restore() }
  cv.onpointerdown = e => { const p = pt(e, cv); H.push();
    if (mode === 'brush') { down = true; cv.setPointerCapture(e.pointerId); last = p; stroke(p, p) }
    else { const d = c.getImageData(0, 0, w, h), px = d.data, x = Math.floor(p.x), y = Math.floor(p.y), i0 = (y * w + x) * 4, s = [px[i0], px[i0 + 1], px[i0 + 2]], tol = +$('#tol', m.o).value;
      const mask = flood(w, h, x, y, i => px[i + 3] >= 10 && dist([px[i], px[i + 1], px[i + 2]], s) <= tol); for (let q = 0; q < w * h; q++) if (mask[q]) px[q * 4 + 3] = 0; c.putImageData(d, 0, 0) } };
  cv.onpointermove = e => { if (mode === 'brush') { const s = size(); ring.style.cssText = `display:block;width:${s}px;height:${s}px;left:${e.clientX}px;top:${e.clientY}px`; if (down) { const p = pt(e, cv); stroke(last, p); last = p } } };
  cv.onpointerup = () => down = false; cv.onpointerleave = () => ring.style.display = 'none';
}

/* ---------- 4. FILTERS ---------- */
const FILTERS = [['Original', 'none'], ['Clarendon', 'contrast(1.2) saturate(1.35)'], ['Juno', 'sepia(.25) contrast(1.15) brightness(1.15) saturate(1.8)'], ['Lark', 'contrast(.9) brightness(1.15) saturate(1.1)'],
['Gingham', 'brightness(1.05) hue-rotate(-10deg) contrast(.9)'], ['Reyes', 'sepia(.22) brightness(1.1) contrast(.85) saturate(.75)'], ['Moon', 'grayscale(1) contrast(1.1) brightness(1.1)'], ['Valencia', 'contrast(1.08) brightness(1.08) sepia(.08)'],
['Nashville', 'sepia(.25) contrast(1.2) brightness(1.05) saturate(1.2)'], ['Slumber', 'saturate(.66) brightness(1.05) sepia(.1)'], ['Crema', 'sepia(.5) contrast(.9) saturate(.9)'], ['Ludwig', 'saturate(1.8) brightness(1.05) contrast(1.05)'],
['Aden', 'hue-rotate(-20deg) contrast(.9) saturate(.85) brightness(1.2)'], ['Perpetua', 'contrast(1.1) brightness(1.25) saturate(1.1)'], ['Mayfair', 'contrast(1.1) brightness(1.15) saturate(1.1)'], ['Inkwell', 'grayscale(1) contrast(1.2) brightness(1.1)'],
['Sepia', 'sepia(1)'], ['Vivid', 'saturate(2) contrast(1.1)'], ['Warm', 'sepia(.3) saturate(1.3) hue-rotate(-8deg)'], ['Cool', 'hue-rotate(15deg) saturate(1.1) brightness(1.05)'], ['Fade', 'contrast(.8) brightness(1.2) saturate(.8)'], ['Invert', 'invert(1)']];
function filters() {
  const m = modal('Image Filters', 'Tap a filter to preview it on your design.', { wide: 900 });
  const sm = Math.min(1, 160 / Math.max(main.width, main.height)); let f0 = 'none';
  m.body.innerHTML = '<div class="de-grid"></div>'; const g = $('.de-grid', m.o);
  FILTERS.forEach(([n, f], i) => { const t = el(`<div class="de-ft ${i ? '' : 'on'}"><canvas width="${Math.round(main.width * sm)}" height="${Math.round(main.height * sm)}"></canvas>${n}</div>`);
    const tc = $('canvas', t); tc.getContext('2d').drawImage(main, 0, 0, tc.width, tc.height); tc.style.filter = f;
    t.onclick = () => { f0 = f; [...g.children].forEach(x => x.classList.toggle('on', x === t)); const a = art(); if (a) a.style.filter = f === 'none' ? '' : f }; g.appendChild(t) });
  footer(m, null, 'Apply', () => { const a = art(); if (a) a.style.filter = ''; if (f0 === 'none') return;
    if (!('filter' in CanvasRenderingContext2D.prototype)) return alert('This browser does not support filters (use Chrome/Edge/Firefox).');
    const o = cvs(main.width, main.height), x = o.getContext('2d'); x.filter = f0; x.drawImage(main, 0, 0); setCanvas(o) });
}

/* ---------- 5. TEXT STUDIO (Fabric.js) ---------- */
const FONTS = ['Montserrat', 'Anton', 'Bungee', 'Pacifico', 'Bangers', 'Lobster', 'Oswald', 'Archivo Black', 'Permanent Marker', 'Playfair Display', 'Arial', 'Georgia'];
const loadFabric = () => window.fabric ? Promise.resolve() : new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) });
async function textStudio() {
  try { await loadFabric() } catch (e) { return alert('Could not load Fabric.js (check internet).') }
  if (!$('#de-fonts')) document.head.appendChild(Object.assign(document.createElement('link'), { id: 'de-fonts', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?' + FONTS.slice(0, 10).map(f => 'family=' + f.replace(/ /g, '+')).join('&') + '&display=swap' }));
  const w = main.width, h = main.height, Sh = (c, x, y, b = 0) => new fabric.Shadow({ color: c, offsetX: x, offsetY: y, blur: b });
  const STY = [['Default', 'Your Text', { fontFamily: 'Montserrat', fontWeight: '800', fill: '#0b1b3a' }, 'font:800 26px Montserrat;color:#0b1b3a'],
    ['Varsity', 'CHAMPS', { fontFamily: 'Anton', fill: '#1b3fa0', stroke: '#f5c400', strokeWidth: 3, paintFirst: 'stroke' }, 'font:26px Anton;color:#1b3fa0;-webkit-text-stroke:1px #f5c400'],
    ['Game Day', 'GAME', { fontFamily: 'Anton', fill: '#111' }, 'font:30px Anton;color:#111'],
    ['Retro Drop', 'RETRO', { fontFamily: 'Bungee', fill: '#f97316', shadow: Sh('#7c2d12', 4, 4) }, 'font:26px Bungee;color:#f97316;text-shadow:2px 2px #7c2d12'],
    ['Sticker Pop', 'POP!', { fontFamily: 'Bangers', fill: '#ec4899', stroke: '#fff', strokeWidth: 6, paintFirst: 'stroke', shadow: Sh('rgba(0,0,0,.35)', 3, 3, 3) }, 'font:30px Bangers;color:#ec4899;text-shadow:0 0 3px #fff,2px 2px 3px #0005'],
    ['Sunset Script', 'Sunset', { fontFamily: 'Pacifico', fill: '#f59e0b' }, 'font:28px Pacifico;color:#f59e0b'],
    ['Hollow', 'HOLLOW', { fontFamily: 'Anton', fill: 'rgba(0,0,0,0)', stroke: '#111', strokeWidth: 2 }, 'font:28px Anton;color:#fff;-webkit-text-stroke:1px #111'],
    ['Echo', 'ECHO', { fontFamily: 'Archivo Black', fill: '#06b6d4', shadow: Sh('rgba(6,182,212,.4)', 6, 6) }, 'font:26px Archivo Black;color:#06b6d4;text-shadow:3px 3px #06b6d466']];
  const m = modal('Text Studio', 'Add and style text, then press Use Design.', { full: true });
  m.body.innerHTML = `<div class="de-side"><button class="on" data-tab="text">T<small>Text</small></button><button data-tab="layers">☰<small>Layers</small></button></div><div class="de-panel" id="pn"></div>
  <div class="de-edit"><div class="de-tb off" id="tb"><span class="de-ctl" style="display:contents"><select id="ff">${FONTS.map(f => `<option>${f}</option>`).join('')}</select>
  <button id="fm">−</button><input type="number" id="fs" min="6" max="1000" value="80"><button id="fp">+</button><input type="color" id="fcol" value="#000000" style="width:34px;height:30px;border:0">
  <button id="bb"><b>B</b></button><button id="ib"><i>I</i></button><button id="ub"><u>U</u></button><button id="sb"><s>S</s></button><button id="cb">aA</button><button id="ef">Effects</button><button id="dl">🗑</button></span>
  <div class="de-pop" id="pop"><label>Outline <input type="color" id="oc" value="#000000"></label><label>Outline width <input type="range" id="ow" min="0" max="20" value="0"></label>
  <label>Shadow <input type="checkbox" id="sh"></label><label>Shadow color <input type="color" id="sc" value="#000000"></label><label>Blur <input type="range" id="sbl" min="0" max="30" value="4"></label><label>Offset <input type="range" id="so" min="0" max="30" value="5"></label></div></div>
  <div class="de-cvwrap"><div class="de-cvhold"><canvas id="fcv"></canvas></div></div></div>`;
  const q = s => $(s, m.o), fc = new fabric.Canvas(q('#fcv'), { width: w, height: h, preserveObjectStacking: true });
  fc.setBackgroundImage(new fabric.Image(main), () => fc.renderAll());
  const A = q('.de-cvwrap'), sc = Math.min((A.clientWidth - 40) / w, (A.clientHeight - 40) / h, 1) || 1;
  fc.setDimensions({ width: w * sc + 'px', height: h * sc + 'px' }, { cssOnly: true });
  Object.assign(fabric.Object.prototype, { transparentCorners: false, cornerColor: '#fff', cornerStrokeColor: '#12A150', borderColor: '#12A150', cornerSize: Math.round(12 / sc), borderScaleFactor: 2 / sc, padding: Math.round(4 / sc) });
  let busy = false, tab = 'text'; const U = [], R = [];
  const snapJ = () => { const bg = fc.backgroundImage; fc.backgroundImage = null; const j = JSON.stringify(fc.toJSON()); fc.backgroundImage = bg; return j }; let cur = snapJ();
  const commitH = () => { if (busy) return; U.push(cur); cur = snapJ(); R.length = 0; upd(); if (tab === 'layers') layers() };
  const restore = j => { busy = true; const bg = fc.backgroundImage; fc.loadFromJSON(j, () => { fc.backgroundImage = bg; fc.renderAll(); busy = false; cur = j; sync(); upd() }) };
  const H = { undo() { if (U.length) { R.push(cur); restore(U.pop()) } }, redo() { if (R.length) { U.push(cur); restore(R.pop()) } }, get u() { return U.length }, get r() { return R.length } };
  const upd = footer(m, H, 'Use Design →', () => { fc.discardActiveObject(); fc.renderAll(); const out = cvs(w, h); out.getContext('2d').drawImage(fc.toCanvasElement(), 0, 0, w, h); fc.dispose(); setCanvas(out) });
  const act = () => { const a = fc.getActiveObject(); return a && a.type === 'i-text' ? a : null };
  const setP = o => { const a = act(); if (!a) return; a.set(o); a.setCoords(); fc.requestRenderAll(); fc.fire('object:modified', { target: a }) };
  function sync() { const a = act(); q('#tb').classList.toggle('off', !a);
    if (a) { q('#ff').value = FONTS.includes(a.fontFamily) ? a.fontFamily : FONTS[0]; q('#fs').value = Math.round(a.fontSize * a.scaleY); q('#fcol').value = /^#/.test(a.fill) ? a.fill : '#000000';
      q('#bb').classList.toggle('on', a.fontWeight === 'bold' || +a.fontWeight >= 700); q('#ib').classList.toggle('on', a.fontStyle === 'italic'); q('#ub').classList.toggle('on', !!a.underline); q('#sb').classList.toggle('on', !!a.linethrough) }
    if (tab === 'layers') layers() }
  function addText(txt, props) { fabric.util.clearFabricFontCache();
    const t = new fabric.IText(txt, Object.assign({ left: w / 2, top: h * .5, originX: 'center', originY: 'center', fontSize: Math.round(w / 8), fill: '#000', textAlign: 'center' }, props));
    document.fonts.load(`40px "${t.fontFamily}"`).finally(() => { fc.add(t); fc.setActiveObject(t); fc.renderAll() }) }
  function panel() { const p = q('#pn');
    if (tab === 'text') { p.innerHTML = '<button class="de-btn p" id="at" style="width:100%">T Add text</button><p style="margin:18px 0 8px;font-size:12px;color:#777;font-weight:700">PREMADE FONT STYLES</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="st"></div>';
      q('#at').onclick = () => addText('Your Text', { fontFamily: 'Montserrat', fontWeight: '800', fill: '#0b1b3a' });
      STY.forEach(([n, t, pr, c]) => { const d = el(`<div class="de-style"><span style="${c}">${esc(t)}</span><small>${n}</small></div>`); d.onclick = () => addText(t, pr); q('#st').appendChild(d) }) } else layers() }
  function layers() { const p = q('#pn'), os = fc.getObjects();
    p.innerHTML = os.slice().reverse().map((o, i) => `<div class="de-ly ${o === fc.getActiveObject() ? 'on' : ''}" data-i="${os.length - 1 - i}"><span>${esc(o.text || 'Layer')}</span><button data-a="up">↑</button><button data-a="dn">↓</button><button data-a="rm">🗑</button></div>`).join('') + '<div class="de-ly" style="opacity:.6;cursor:default">🔒 <span>Design</span></div>';
    p.onclick = e => { const r = e.target.closest('.de-ly[data-i]'); if (!r) return; const o = fc.getObjects()[+r.dataset.i], a = e.target.dataset.a;
      if (a === 'up') fc.bringForward(o); else if (a === 'dn') fc.sendBackwards(o); else if (a === 'rm') fc.remove(o); else fc.setActiveObject(o);
      if (a === 'up' || a === 'dn') fc.fire('object:modified', { target: o }); fc.renderAll(); layers() } }
  m.o.querySelectorAll('.de-side button').forEach(b => b.onclick = () => { tab = b.dataset.tab; m.o.querySelectorAll('.de-side button').forEach(x => x.classList.toggle('on', x === b)); panel() }); panel();
  fc.on({ 'object:added': commitH, 'object:removed': commitH, 'object:modified': commitH, 'selection:created': sync, 'selection:updated': sync, 'selection:cleared': sync });
  q('#ff').onchange = e => { const f = e.target.value; document.fonts.load(`40px "${f}"`).finally(() => { fabric.util.clearFabricFontCache(); setP({ fontFamily: f }) }) };
  const size = d => { const a = act(); if (a) setP({ fontSize: Math.max(6, (+q('#fs').value || a.fontSize) + d), scaleX: 1, scaleY: 1 }); q('#fs').value = Math.round(act()?.fontSize || 0) };
  q('#fm').onclick = () => size(-4); q('#fp').onclick = () => size(4); q('#fs').onchange = () => size(0); q('#fcol').oninput = e => setP({ fill: e.target.value });
  const tg = (id, fn) => q(id).onclick = () => { const a = act(); if (a) { setP(fn(a)); sync() } };
  tg('#bb', a => ({ fontWeight: (a.fontWeight === 'bold' || +a.fontWeight >= 700) ? 'normal' : 'bold' })); tg('#ib', a => ({ fontStyle: a.fontStyle === 'italic' ? 'normal' : 'italic' }));
  tg('#ub', a => ({ underline: !a.underline })); tg('#sb', a => ({ linethrough: !a.linethrough })); tg('#cb', a => ({ text: a.text === a.text.toUpperCase() ? a.text.toLowerCase() : a.text.toUpperCase() }));
  q('#dl').onclick = () => { const a = act(); a && fc.remove(a) };
  q('#ef').onclick = () => { const p = q('#pop'); p.style.display = p.style.display === 'block' ? 'none' : 'block' };
  const fx = () => setP({ stroke: q('#oc').value, strokeWidth: +q('#ow').value, paintFirst: 'stroke', shadow: q('#sh').checked ? Sh(q('#sc').value, +q('#so').value, +q('#so').value, +q('#sbl').value) : null });
  ['#oc', '#ow', '#sh', '#sc', '#sbl', '#so'].forEach(s => q(s).oninput = fx);
}
})();
