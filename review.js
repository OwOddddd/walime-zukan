// 圖鑑審閱用的畫筆標註。在詳細頁的立繪或任一表情上圈選、寫建議。
// 標註存在這台裝置的瀏覽器（localStorage），按「匯出標註」下載成 JSON 檔再傳出去。
// 在圖鑑頁自己的程式之後載入，用到它的 app、byId、route 與 detail 產生的 DOM。
(() => {
  const KEY = 'walime-zukan-review-v1';
  const load = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.notes)) return d; } catch (e) {} return { name: '', notes: [] }; };
  const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } };
  const NS = 'http://www.w3.org/2000/svg';

  function exportAll() {
    const d = load();
    if (!d.notes.length) { alert('還沒有任何標註。'); return; }
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const body = JSON.stringify({ name: d.name, exported: new Date().toISOString(), notes: d.notes }, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    a.download = `和萊姆圖鑑標註-${d.name || '未署名'}-${day}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const FOOT = `<div class="row"><label>你的名字 <input type="text" class="rv-name" maxlength="20" placeholder="例：小明"></label>
    <button class="rv-export">匯出標註</button><span class="hint rv-count"></span></div>`;
  function foot(root) {
    const name = root.querySelector('.rv-name');
    name.value = load().name;
    name.oninput = () => { const d = load(); d.name = name.value.trim(); save(d); };
    root.querySelector('.rv-export').onclick = exportAll;
    const upd = () => { root.querySelector('.rv-count').textContent = `全部共 ${load().notes.length} 則`; };
    upd(); return upd;
  }

  // 首頁：說明與匯出
  function homeBar() {
    const bar = document.createElement('section');
    bar.className = 'rv rv-top';
    bar.innerHTML = `<p class="hint">點進任一隻和萊姆，在詳細頁按紅色的「標註」：在立繪或表情上圈出要改的地方，寫下建議後儲存。看完後在這裡（或任一詳細頁底部）填名字、按「匯出標註」，把下載的檔案傳給我。標註只存在這台裝置的瀏覽器裡。</p>` + FOOT;
    app.prepend(bar);
    foot(bar);
  }

  // 詳細頁
  function detailPanel(c) {
    const art = app.querySelector('.detail');
    // 可以畫的圖：0 是立繪，1 起是各表情
    const svgs = [app.querySelector('.top > svg'), ...app.querySelectorAll('.faces svg')];
    const targetName = i => i === 0 ? '立繪' : '表情「' + c.faces[i - 1].name + '」';
    const inks = svgs.map(s => { const g = document.createElementNS(NS, 'g'); g.setAttribute('pointer-events', 'none'); s.appendChild(g); return g; });

    const box = document.createElement('section');
    box.className = 'rv';
    box.innerHTML = `<div class="row"><button class="mark rv-start">標註</button><span class="hint">在立繪或下面任一個表情上圈出要改的地方，也可以只寫文字建議。</span></div>
      <div class="rv-edit" hidden>
        <p class="hint">在圖上按住拖曳圈選（可以畫好幾筆、畫在不同張圖上），再寫下建議。</p>
        <textarea class="rv-note" placeholder="這裡要改什麼？"></textarea>
        <div class="row"><button class="rv-ok">儲存</button><button class="ghost rv-undo">復原一筆</button><button class="ghost rv-cancel">取消</button></div>
      </div>
      <h2 class="rv-h"></h2><ul class="rv-list"></ul>
      <div class="foot">${FOOT}</div>`;
    art.after(box);
    const q = s => box.querySelector(s);
    const edit = q('.rv-edit'), note = q('.rv-note'), list = q('.rv-list'), startBtn = q('.rv-start');
    const updCount = foot(box);

    const pathD = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ',' + p[1]).join(' ');
    const drawStroke = (g, pts) => { const e = document.createElementNS(NS, 'g');
      e.innerHTML = `<path d="${pathD(pts)}" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><path d="${pathD(pts)}" fill="none" stroke="#e5322d" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      g.appendChild(e); return e; };
    const clearInk = () => { inks.forEach(g => g.innerHTML = ''); list.querySelectorAll('li.on').forEach(li => li.classList.remove('on')); };

    let drawing = false, strokes = [], cur = null;
    svgs.forEach((svg, si) => {
      const toSvg = e => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const s = p.matrixTransform(svg.getScreenCTM().inverse()); return [Math.round(s.x), Math.round(s.y)]; };
      svg.addEventListener('pointerdown', e => {
        if (!drawing) return;
        e.preventDefault(); svg.setPointerCapture(e.pointerId);
        cur = { t: si, pts: [toSvg(e)] }; strokes.push(cur);
        cur.el = drawStroke(inks[si], cur.pts);
      });
      svg.addEventListener('pointermove', e => {
        if (!drawing || !cur || cur.t !== si) return;
        const p = toSvg(e), l = cur.pts[cur.pts.length - 1];
        if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 2) return;
        cur.pts.push(p);
        cur.el.querySelectorAll('path').forEach(x => x.setAttribute('d', pathD(cur.pts)));
      });
      svg.addEventListener('pointerup', () => { cur = null; });
      svg.addEventListener('pointercancel', () => { cur = null; });
    });
    const setDrawing = on => { drawing = on; svgs.forEach(s => s.classList.toggle('rv-draw', on)); edit.hidden = !on; startBtn.disabled = on; };
    startBtn.onclick = () => { clearInk(); strokes = []; note.value = ''; setDrawing(true); svgs[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    q('.rv-undo').onclick = () => { const s = strokes.pop(); if (s) s.el.remove(); };
    q('.rv-cancel').onclick = () => { setDrawing(false); clearInk(); strokes = []; };
    q('.rv-ok').onclick = () => {
      const t = note.value.trim();
      if (!t && !strokes.length) { note.focus(); return; }
      const targets = [...new Set(strokes.map(s => s.t))].sort((a, b) => a - b);
      const d = load();
      d.notes.push({ id: Date.now().toString(36), char: c.id, charName: c.name, targets: targets.map(targetName), note: t,
        strokes: strokes.map(s => ({ target: s.t === 0 ? 'main' : 'face:' + c.faces[s.t - 1].name, pts: s.pts })), at: new Date().toISOString() });
      if (!save(d)) alert('這個瀏覽器不能儲存（可能是無痕模式），標註會在關掉頁面後消失。');
      setDrawing(false); clearInk(); strokes = [];
      render(); updCount();
    };
    const idxOf = target => target === 'main' ? 0 : 1 + c.faces.findIndex(f => 'face:' + f.name === target);

    function render() {
      const mine = load().notes.filter(n => n.char === c.id);
      q('.rv-h').textContent = mine.length ? `${c.name}的標註（${mine.length}）` : '';
      list.innerHTML = '';
      mine.forEach(n => {
        const li = document.createElement('li');
        li.innerHTML = `<div class="meta"></div><div class="txt"></div><div class="row"><button class="ghost">看圈選</button><button class="ghost">刪除</button></div>`;
        li.querySelector('.meta').textContent = n.targets.length ? '圈在：' + n.targets.join('、') : '文字建議';
        li.querySelector('.txt').textContent = n.note || '（只有圈選，沒有文字）';
        const [see, del] = li.querySelectorAll('button');
        see.disabled = !n.strokes.length;
        see.onclick = () => {
          if (drawing) return;
          clearInk();
          let first = null;
          n.strokes.forEach(s => { const i = idxOf(s.target); if (i < 0) return; drawStroke(inks[i], s.pts); if (first == null) first = i; });
          li.classList.add('on');
          if (first != null) svgs[first].scrollIntoView({ behavior: 'smooth', block: 'center' });
        };
        del.onclick = () => {
          if (!confirm('刪除這則標註？')) return;
          const d = load(); d.notes = d.notes.filter(x => x.id !== n.id); save(d);
          clearInk(); render(); updCount();
        };
        list.appendChild(li);
      });
    }
    render();
  }

  function augment() {
    const m = location.hash.match(/^#c\/(.+)$/);
    const c = m && byId(m[1]);
    if (c) detailPanel(c); else homeBar();
  }
  addEventListener('hashchange', augment); // 圖鑑自己的 route 先註冊，這裡在它畫完之後才跑
  augment();
})();
