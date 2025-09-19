/* Particles Sandbox - single-file JS (works with index.html + style.css)
   Features:
   - Desktop + Mobile (two-finger erase, pinch-to-resize, responsive UI)
   - Extra particles: Acid, Ice, Electricity
   - Presets, Save/Load JSON, Export PNG
   - Brush shapes (circle/square), fast-forward, undo (small)
*/

// ---- Config & DOM ----
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const typeEl = document.getElementById('type');
const sizeEl = document.getElementById('size');
const sizeLabel = document.getElementById('sizeLabel');
const shapeEl = document.getElementById('shape');
const speedEl = document.getElementById('speed');
const ffBtn = document.getElementById('ff');
const gravityEl = document.getElementById('gravity');
const drawToggle = document.getElementById('drawToggle');
const pauseBtn = document.getElementById('pause');
const stepBtn = document.getElementById('step');
const clearBtn = document.getElementById('clear');
const randomBtn = document.getElementById('random');
const savePNG = document.getElementById('savePNG');
const saveJSON = document.getElementById('saveJSON');
const loadJSON = document.getElementById('loadJSON');
const loadFile = document.getElementById('loadFile');
const presetSelect = document.getElementById('preset');
const presetBtn = document.getElementById('presetBtn');
const mobileCap = document.getElementById('mobileCap');
const gridOverlay = document.getElementById('gridOverlay');
const undoEnable = document.getElementById('undoEnable');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');

sizeEl.oninput = ()=> sizeLabel.textContent = sizeEl.value;
speedEl.oninput = ()=> {}; // label not shown, speed used directly

// ---- Particle definitions ----
const EMPTY=0, SAND=1, WATER=2, OIL=3, WALL=4, SMOKE=5, FIRE=6, ACID=7, ICE=8, ELEC=9;
const PARTICLES = {
  [SAND]: {name:'Sand', color:[214,179,112], behavior:'fall'},
  [WATER]: {name:'Water', color:[95,179,255], behavior:'liquid'},
  [OIL]: {name:'Oil', color:[120,90,40], behavior:'oil'},
  [WALL]: {name:'Wall', color:[70,80,90], behavior:'solid'},
  [SMOKE]: {name:'Smoke', color:[180,180,190,150], behavior:'rise'},
  [FIRE]: {name:'Fire', color:[255,120,50], behavior:'burn'},
  [ACID]: {name:'Acid', color:[100,240,120], behavior:'acid'},
  [ICE]: {name:'Ice', color:[180,220,255], behavior:'solid'},
  [ELEC]: {name:'Electric', color:[240,240,120], behavior:'spark'}
};

// populate type select
(function populateTypes(){
  for(const id of Object.keys(PARTICLES)){
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = PARTICLES[id].name;
    typeEl.appendChild(opt);
  }
  typeEl.value = SAND;
})();

// ---- Presets (kept in JS so only 3 files) ----
const PRESETS = {
  dam: {desc:'Sand dam with basin', fn: (gridW,gridH,grid,cellIndex)=>{
    // horizontal wall near bottom
    for(let x=0;x<gridW;x++) grid[cellIndex(x,gridH-4)] = WALL;
    // sand pile behind the wall
    for(let x=10;x<gridW-10;x++) for(let y=gridH-10;y<gridH-4;y++) if(Math.random()<0.4) grid[cellIndex(x,y)] = SAND;
    // water left side
    for(let y=gridH-8;y<gridH-4;y++) for(let x=2;x<10;x++) grid[cellIndex(x,y)] = WATER;
  }},
  waterfall: {desc:'Water pouring', fn: (gridW,gridH,grid,cellIndex)=>{
    for(let y=2;y<gridH/2;y+=1) grid[cellIndex(4,y)] = WATER;
    for(let x=0;x<6;x++) grid[cellIndex(x,gridH-2)] = WALL;
  }},
  volcano: {desc:'Fire fountain / lava', fn: (gridW,gridH,grid,cellIndex)=>{
    for(let y=gridH-6;y<gridH;y++){
      for(let x=gridW/2-6;x<gridW/2+6;x++){
        if(Math.random()<0.8) grid[cellIndex(x,y)] = FIRE;
      }
    }
    for(let x=gridW/2-20;x<gridW/2+20;x++) grid[cellIndex(x,gridH-1)] = WALL;
  }}
};
(function populatePresets(){
  for(const k of Object.keys(PRESETS)){
    const opt = document.createElement('option'); opt.value=k; opt.textContent=k; presetSelect.appendChild(opt);
  }
})();

// ---- Grid & rendering ----
let DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
let CELL = 3;
let gridW = 128, gridH = 80;
let grid = null, nextGrid = null;

function cellIndex(x,y){ return x + y*gridW; }

function initGrid(){
  grid = new Uint8Array(gridW*gridH);
  nextGrid = new Uint8Array(gridW*gridH);
}

function adaptCanvas(){
  // choose canvas pixel size while capping on mobile for perf
  const rectW = Math.max(320, Math.floor(window.innerWidth * 0.6));
  const rectH = Math.max(240, Math.floor(window.innerHeight * 0.6));
  if(mobileCap && mobileCap.checked && window.innerWidth < 900){
    DPR = 1; CELL = 4;
  } else {
    DPR = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    CELL = 3;
  }
  // size canvas to full available width of the canvas container
  const container = canvas.parentElement.getBoundingClientRect();
  const wCSS = Math.floor(container.width);
  const hCSS = Math.floor(window.innerHeight - 48);
  canvas.style.width = wCSS + 'px';
  canvas.style.height = hCSS + 'px';
  canvas.width = Math.max(64, Math.floor(wCSS * DPR));
  canvas.height = Math.max(48, Math.floor(hCSS * DPR));
  // compute logical grid
  gridW = Math.max(48, Math.floor(canvas.width / (CELL*DPR)));
  gridH = Math.max(32, Math.floor(canvas.height / (CELL*DPR)));
  initGrid();
}
window.addEventListener('resize', adaptCanvas);
window.addEventListener('orientationchange', adaptCanvas);
adaptCanvas();

// ---- Undo (small) ----
const HISTORY_MAX = 6;
let history = [], historyPos = -1;
function pushHistory(){
  if(!undoEnable.checked) return;
  const snap = grid.slice(); // copy
  if(historyPos < history.length-1) history.splice(historyPos+1);
  history.push(snap);
  if(history.length > HISTORY_MAX) history.shift();
  historyPos = history.length-1;
}
undoBtn.onclick = ()=>{
  if(historyPos>0){ historyPos--; grid.set(history[historyPos]); }
};
redoBtn.onclick = ()=>{
  if(historyPos < history.length-1){ historyPos++; grid.set(history[historyPos]); }
};

// ---- Input: pointer / touch / gestures ----
let pointers = new Map(); // track active pointers
let painting = false;
let erasing = false;
let lastPinchDist = null;
let activePointerId = null;

function clientToGrid(clientX, clientY){
  const r = canvas.getBoundingClientRect();
  const gx = Math.floor((clientX - r.left) / r.width * gridW);
  const gy = Math.floor((clientY - r.top) / r.height * gridH);
  return {x: gx, y: gy};
}

function setEraseToggle(val){
  drawToggle.dataset.erase = val? '1' : '0';
  drawToggle.textContent = 'Erase: ' + (val? 'On' : 'Off');
  erasing = !!val;
}
drawToggle.addEventListener('click', ()=> setEraseToggle(drawToggle.dataset.erase === '0'));

// pointer events (unified for mouse + touch)
canvas.addEventListener('pointerdown', (e)=>{
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, e);
  if(pointers.size === 2){
    // two-finger gesture: force erase mode while two pointers down
    setEraseToggle(true);
  }
  activePointerId = e.pointerId;
  painting = true;
  if(pointers.size === 2){ // handle pinch initial distance
    const ps = Array.from(pointers.values());
    lastPinchDist = Math.hypot(ps[0].clientX - ps[1].clientX, ps[0].clientY - ps[1].clientY);
  }
  handlePaintAt(e.clientX, e.clientY);
});
canvas.addEventListener('pointermove', (e)=>{
  if(!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, e);
  if(pointers.size === 2){
    // pinch to change brush size
    const ps = Array.from(pointers.values());
    const d = Math.hypot(ps[0].clientX - ps[1].clientX, ps[0].clientY - ps[1].clientY);
    if(lastPinchDist){
      const delta = d - lastPinchDist;
      if(Math.abs(delta) > 8){
        let newSize = parseInt(sizeEl.value,10) + Math.sign(delta);
        newSize = Math.max(1, Math.min(64, newSize));
        sizeEl.value = newSize; sizeLabel.textContent = newSize;
        lastPinchDist = d;
      }
    }
  } else if(painting){
    handlePaintAt(e.clientX, e.clientY);
  }
});
window.addEventListener('pointerup', (e)=>{
  if(pointers.has(e.pointerId)) pointers.delete(e.pointerId);
  if(pointers.size < 2) lastPinchDist = null;
  if(pointers.size < 2){
    // restore erase toggle only if it wasn't manual
    setEraseToggle(drawToggle.dataset.erase === '1'); // leave as user set it
  }
  painting = false;
  activePointerId = null;
});
canvas.addEventListener('pointercancel', (e)=>{ pointers.delete(e.pointerId); painting=false; activePointerId=null; lastPinchDist=null; });

function handlePaintAt(clientX, clientY){
  // if two pointers active we are erasing (already set)
  const {x,y} = clientToGrid(clientX, clientY);
  const brush = parseInt(sizeEl.value,10);
  const shape = shapeEl.value;
  const type = erasing ? EMPTY : parseInt(typeEl.value,10);
  // draw circle or square brush
  for(let j=-brush;j<=brush;j++) for(let i=-brush;i<=brush;i++){
    if(shape === 'circle' && (i*i + j*j > brush*brush)) continue;
    const xx = x + i, yy = y + j;
    if(xx<0||yy<0||xx>=gridW||yy>=gridH) continue;
    grid[cellIndex(xx,yy)] = type;
  }
}

// also support mouse dragging quickly
canvas.addEventListener('mousedown', (e)=> e.preventDefault());
canvas.addEventListener('contextmenu', (e)=> e.preventDefault());

// keyboard shortcuts (desktop)
window.addEventListener('keydown', (e)=>{
  if(e.key.toLowerCase()==='p'){ running = !running; pauseBtn.textContent = running? 'Pause' : 'Resume'; }
  if(e.key.toLowerCase()==='c'){ grid.fill(EMPTY); pushHistory(); }
  if(e.key.toLowerCase()==='e'){ setEraseToggle(drawToggle.dataset.erase === '0'); }
});

// ---- Buttons ----
let running = true;
pauseBtn.addEventListener('click', ()=> { running = !running; pauseBtn.textContent = running? 'Pause' : 'Resume'; });
stepBtn.addEventListener('click', ()=> { step(); render(); });
ffBtn.addEventListener('click', ()=> { // cycle fast-forward x1 -> x2 -> x4 -> x1
  const cur = ffBtn.dataset.ff || '1';
  if(cur === '1'){ ffBtn.dataset.ff='2'; ffBtn.textContent = '×2'; } 
  else if(cur === '2'){ ffBtn.dataset.ff='4'; ffBtn.textContent = '×4'; }
  else { ffBtn.dataset.ff='1'; ffBtn.textContent = '×1'; }
});
clearBtn.addEventListener('click', ()=> { pushHistory(); grid.fill(EMPTY); });
randomBtn.addEventListener('click', ()=> { pushHistory(); for(let i=0;i<grid.length;i++) grid[i] = Math.random()<0.06? SAND : EMPTY; });
savePNG.addEventListener('click', ()=> { const link = document.createElement('a'); link.download='particles.png'; link.href = canvas.toDataURL(); link.click(); });
saveJSON.addEventListener('click', ()=> {
  const data = {w:gridW,h:gridH,grid:Array.from(grid)};
  const blob = new Blob([JSON.stringify(data)],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'particles.json'; a.click();
});
loadJSON.addEventListener('click', ()=> loadFile.click());
loadFile.addEventListener('change', e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=> { try { const parsed = JSON.parse(r.result); if(parsed && parsed.grid){ if(parsed.w && parsed.h){ gridW = parsed.w; gridH = parsed.h; grid = new Uint8Array(parsed.grid); nextGrid = new Uint8Array(grid.length); adaptCanvas(); } else { grid.set(parsed.grid); } } } catch(err){ alert('Invalid JSON file'); } };
  r.readAsText(f);
});
presetBtn.addEventListener('click', ()=> {
  const val = presetSelect.value; if(!val) return;
  pushHistory();
  grid.fill(EMPTY);
  PRESETS[val].fn(gridW,gridH,grid,cellIndex);
});

// ---- internal PRESETS reference for presetBtn (compatible with UI presetSelect) ----
const PRESETS = PRESETS || PRESETS; // keep eslint happy
Object.assign(PRESETS, PRESETS); // (no-op) — presets already defined above
for(const k of Object.keys(PRESETS)) {
  // nothing else: presetSelect already populated
}

// ---- Simulation step rules ----
let nextGrid = null;
function ensureBuffers(){
  if(!nextGrid || nextGrid.length !== grid.length) nextGrid = new Uint8Array(grid.length);
}
ensureBuffers();

function step(){
  ensureBuffers();
  nextGrid.set(grid);
  const grav = parseFloat(gravityEl.value);
  const w = gridW, h = gridH;
  for(let y=h-1;y>=0;y--){
    for(let x=0;x<w;x++){
      const i = cellIndex(x,y);
      const p = grid[i];
      if(!p) continue;
      switch(PARTICLES[p].behavior){
        case 'fall': {
          if(y+1<h && grid[cellIndex(x,y+1)]===EMPTY){ nextGrid[cellIndex(x,y+1)] = p; nextGrid[i] = EMPTY; }
          else {
            const dirs = Math.random()<0.5? [1,-1] : [-1,1];
            for(const d of dirs){
              const nx = x + d;
              if(nx>=0 && nx<w && y+1<h && grid[cellIndex(nx,y+1)]===EMPTY){ nextGrid[cellIndex(nx,y+1)] = p; nextGrid[i] = EMPTY; break; }
            }
          }
        } break;

        case 'liquid': {
          if(y+1<h && grid[cellIndex(x,y+1)]===EMPTY){ nextGrid[cellIndex(x,y+1)] = p; nextGrid[i] = EMPTY; }
          else {
            const dirs = Math.random()<0.5? [1,-1] : [-1,1];
            for(const d of dirs){
              const nx = x + d;
              if(nx>=0 && nx<w && grid[cellIndex(nx,y)]===EMPTY){ nextGrid[cellIndex(nx,y)] = p; nextGrid[i] = EMPTY; break; }
            }
          }
        } break;

        case 'oil': {
          // floats on water
          if(y+1<h && grid[cellIndex(x,y+1)]===WATER){ nextGrid[cellIndex(x,y+1)] = OIL; nextGrid[i] = WATER; }
          else {
            // flows sideways
            const dirs = [1,-1];
            for(const d of dirs){
              const nx = x + d;
              if(nx>=0 && nx<w && grid[cellIndex(nx,y)]===EMPTY){ nextGrid[cellIndex(nx,y)] = OIL; nextGrid[i] = EMPTY; break; }
            }
          }
        } break;

        case 'rise': {
          if(y-1>=0 && grid[cellIndex(x,y-1)]===EMPTY){ nextGrid[cellIndex(x,y-1)] = SMOKE; nextGrid[i] = EMPTY; }
          else {
            const dirs = [1,-1];
            for(const d of dirs){ const nx = x+d; if(nx>=0 && nx<w && y-1>=0 && grid[cellIndex(nx,y-1)]===EMPTY){ nextGrid[cellIndex(nx,y-1)] = SMOKE; nextGrid[i] = EMPTY; break; } }
          }
          if(Math.random() < 0.01) nextGrid[i] = EMPTY;
        } break;

        case 'burn': {
          if(Math.random() < 0.02) nextGrid[i] = EMPTY;
          const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
          for(const [dx,dy] of neigh){
            const nx = x+dx, ny = y+dy;
            if(nx>=0 && nx<w && ny>=0 && ny<h){
              const j = cellIndex(nx,ny);
              if(grid[j] === OIL && Math.random() < 0.3) nextGrid[j] = FIRE;
              if(grid[j] === EMPTY && Math.random() < 0.05) nextGrid[j] = SMOKE;
            }
          }
        } break;

        case 'acid': {
          // dissolves nearby non-wall cells
          const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
          for(const [dx,dy] of neigh){
            const nx=x+dx, ny=y+dy;
            if(nx>=0 && nx<w && ny>=0 && ny<h){
              const j = cellIndex(nx,ny);
              if(grid[j] && grid[j] !== WALL && Math.random() < 0.12) nextGrid[j] = ACID;
            }
          }
        } break;

        case 'spark': {
          if(Math.random() < 0.12) nextGrid[i] = EMPTY;
          const dir = Math.random()<0.5? -1:1;
          const nx = x + dir;
          if(nx>=0 && nx<w && grid[cellIndex(nx,y)]===EMPTY) nextGrid[cellIndex(nx,y)] = ELEC;
          // sparks can ignite water into steam (smoke)
          const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
          for(const [dx,dy] of neigh){
            const nx2 = x+dx, ny2 = y+dy;
            if(nx2>=0 && nx2<w && ny2>=0 && ny2<h){
              const j = cellIndex(nx2,ny2);
              if(grid[j] === WATER && Math.random() < 0.08) nextGrid[j] = SMOKE;
            }
          }
        } break;

        default: break;
      }
    }
  }
  // swap
  const tmp = grid; grid = nextGrid; nextGrid = tmp;
}

// ---- Render ----
function render(){
  const w = canvas.width, h = canvas.height;
  const img = ctx.createImageData(w,h);
  const data = img.data;
  const cellW = w / gridW, cellH = h / gridH;

  // clear alpha to 255 background
  for(let i=0;i<data.length;i+=4){ data[i]=10; data[i+1]=18; data[i+2]=36; data[i+3]=255; }

  for(let y=0;y<gridH;y++){
    for(let x=0;x<gridW;x++){
      const p = grid[cellIndex(x,y)];
      if(!p) continue;
      const col = PARTICLES[p].color;
      const r = col[0], g = col[1], b = col[2], a = col[3] || 255;
      const sx = Math.floor(x*cellW), sy = Math.floor(y*cellH);
      const ex = Math.ceil((x+1)*cellW), ey = Math.ceil((y+1)*cellH);
      for(let yy=sy; yy<ey; yy++){
        for(let xx=sx; xx<ex; xx++){
          const idx = (yy*w + xx)*4;
          data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a;
        }
      }
    }
  }
  ctx.putImageData(img,0,0);

  if(gridOverlay && gridOverlay.checked){
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for(let x=0;x<=gridW;x++){ ctx.beginPath(); ctx.moveTo(x*(w/gridW),0); ctx.lineTo(x*(w/gridW),h); ctx.stroke(); }
    for(let y=0;y<=gridH;y++){ ctx.beginPath(); ctx.moveTo(0,y*(h/gridH)); ctx.lineTo(w,y*(h/gridH)); ctx.stroke(); }
  }
}

// ---- Main loop ----
function loop(){
  if(running){
    const ff = parseInt(ffBtn.dataset.ff || '1',10);
    const steps = parseInt(speedEl.value,10) * ff;
    for(let i=0;i<steps;i++) step();
  }
  render();
  requestAnimationFrame(loop);
}

// start
pushHistory = ()=>{ // small helper defined here to capture grid current value
  if(!undoEnable.checked) return;
  const snap = grid.slice();
  if(history.length -1 > historyPos) history.splice(historyPos+1);
  history.push(snap);
  if(history.length > HISTORY_MAX) history.shift();
  historyPos = history.length-1;
};

// initial push
pushHistory();
loop();

// add simple safety: initialize grid if null
if(!grid) initGrid();
requestAnimationFrame(loop);
}

// start
pushHistory = ()=>{ // small helper defined here to capture grid current value
  if(!undoEnable.checked) return;
  const snap = grid.slice();
  if(history.length -1 > historyPos) history.splice(historyPos+1);
  history.push(snap);
  if(history.length > HISTORY_MAX) history.shift();
  historyPos = history.length-1;
};

// initial push
pushHistory();
loop();

// add simple safety: initialize grid if null
if(!grid) initGrid();
