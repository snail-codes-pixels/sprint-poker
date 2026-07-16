import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;
function getSocket() {
  if (!socket) socket = io(window.location.origin, { autoConnect: false });
  return socket;
}

const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k)
};

const SCALES = {
  fibonacci: ['1','2','3','5','8','13','?','☕'],
  tshirt: ['XS','S','M','L','XL','XXL','?','☕']
};

const AVATARS = ['🐱','🐶','🦊','🐼','🐨','🐸','🦁','🐯','🐺','🦝','🐮','🐷','🐙','🦋','🐧','🦄','🐻','🐰','🐭','🐹','🦉','🦕','🌈','🦩'];

// Card metadata — icon + effort + time shown below the number
const CARD_META = {
  '1':  { effortIcon:'⚡', effort:'Min effort', timeIcon:'🕐', time:'Few mins' },
  '2':  { effortIcon:'⚡', effort:'Min effort', timeIcon:'🕐', time:'Few hours' },
  '3':  { effortIcon:'💪', effort:'Mild effort', timeIcon:'📆', time:'A day' },
  '5':  { effortIcon:'💪', effort:'Moderate',    timeIcon:'📆', time:'Few days' },
  '8':  { effortIcon:'🔥', effort:'Severe',      timeIcon:'🗓', time:'A week' },
  '13': { effortIcon:'🔥', effort:'Maximum',     timeIcon:'🗓', time:'A month' },
  '?':  { effortIcon:'🤔', effort:'Unsure',      timeIcon:'',   time:'' },
  '☕': { effortIcon:'',   effort:'Take a',      timeIcon:'',   time:'break!' },
  'XS': { effortIcon:'⚡', effort:'Min effort', timeIcon:'🕐', time:'Few mins' },
  'S':  { effortIcon:'⚡', effort:'Min effort', timeIcon:'🕐', time:'Few hours' },
  'M':  { effortIcon:'💪', effort:'Moderate',   timeIcon:'📆', time:'Few days' },
  'L':  { effortIcon:'🔥', effort:'Severe',     timeIcon:'🗓', time:'A week' },
  'XL': { effortIcon:'🔥', effort:'Maximum',    timeIcon:'🗓', time:'A month' },
  'XXL':{ effortIcon:'🔥', effort:'Extreme',    timeIcon:'🗓', time:'Months' },
};

const POINT_GUIDE = [
  { pts:'1', effort:'Minimum effort', time:'A few minutes', complexity:'Little complexity', risk:'None', bg:'#e8f5ee', border:'#b8dcc8' },
  { pts:'2', effort:'Minimum effort', time:'A few hours',   complexity:'Little complexity', risk:'None', bg:'#e8f5ee', border:'#b8dcc8' },
  { pts:'3', effort:'Mild effort',    time:'A day',         complexity:'Low complexity',    risk:'Low',  bg:'#e8f5ee', border:'#b8dcc8' },
  { pts:'5', effort:'Moderate effort',time:'A few days',    complexity:'Medium complexity', risk:'Moderate', bg:'#fff8e6', border:'#f5d990' },
  { pts:'8', effort:'Severe effort',  time:'A week',        complexity:'Medium complexity', risk:'Moderate', bg:'#fff8e6', border:'#f5d990' },
  { pts:'13',effort:'Maximum effort', time:'A month',       complexity:'High complexity',   risk:'High', bg:'#fff0ee', border:'#f5c0b0' },
];

const css = `
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root {
    --cream:#fdf8f0; --cream2:#f5ede0; --cream3:#efe4d2;
    --felt:#3d7a5c; --felt2:#2f6048; --felt-light:#4e9470; --felt-shine:#5aaf82;
    --brown:#7c5c3a; --brown-light:#a07850;
    --text:#3a2e22; --muted:#9a8470; --card-bg:#fffef9;
    --accent:#e8603c; --accent2:#f0a830; --teal:#30a89a;
    --border:#d8c8b0; --shadow:rgba(60,40,20,.12);
    --font:'Nunito',sans-serif; --display:'Fredoka',sans-serif;
    --bg:var(--cream); --panel:#fff; --panel2:var(--cream);
  }
  body.dark {
    --cream:#1a1a24; --cream2:#22222e; --cream3:#2a2a38;
    --felt:#2a6048; --felt2:#1e4a36; --felt-light:#3a7a5a; --felt-shine:#3a8a66;
    --brown:#a08060; --brown-light:#c0a070;
    --text:#e8e0d0; --muted:#8a8090; --card-bg:#22222e;
    --accent:#e8603c; --accent2:#f0a830; --teal:#30a89a;
    --border:#3a3848; --shadow:rgba(0,0,0,.3);
    --bg:var(--cream); --panel:var(--cream2); --panel2:var(--cream3);
  }
  body { font-family:var(--font); background:var(--cream); color:var(--text); min-height:100vh; overflow-x:hidden; transition:background .3s,color .3s; }
  body::before { content:''; position:fixed; inset:0; background-image:radial-gradient(circle,rgba(128,100,60,.04) 1px,transparent 1px); background-size:26px 26px; pointer-events:none; z-index:0; }
  .app { min-height:100vh; display:flex; flex-direction:column; position:relative; z-index:1; }

  /* Header */
  .header { display:flex; align-items:center; justify-content:space-between; padding:11px 22px; background:var(--cream); border-bottom:2px solid var(--border); position:sticky; top:0; z-index:100; transition:background .3s,border-color .3s; }
  .logo-small { font-family:var(--display); font-size:21px; font-weight:600; background:linear-gradient(135deg,#e8603c,#f0a830 50%,#e87090); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .header-right { display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
  .phase-pill { display:inline-flex; align-items:center; gap:5px; padding:5px 13px; border-radius:20px; font-size:12px; font-weight:700; }
  .phase-voting { background:#e8f5ee; color:#2f6048; border:1.5px solid #b8dcc8; }
  .phase-revealed { background:#fff8e6; color:#b07010; border:1.5px solid #f5d990; }
  .phase-waiting { background:var(--cream2); color:var(--muted); border:1.5px solid var(--border); }
  .room-chip { font-weight:800; font-size:14px; letter-spacing:2px; background:var(--felt); color:#fff; padding:5px 13px; border-radius:20px; cursor:pointer; transition:background .15s; }
  .room-chip:hover { background:var(--felt2); }
  .dark-toggle { width:36px; height:36px; border-radius:50%; border:2px solid var(--border); background:var(--cream2); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:16px; transition:all .15s; flex-shrink:0; }
  .dark-toggle:hover { border-color:var(--brown-light); background:var(--cream3); }

  /* Buttons */
  .btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:10px 20px; border-radius:40px; font-family:var(--font); font-size:14px; font-weight:700; cursor:pointer; border:none; transition:all .15s; white-space:nowrap; }
  .btn:disabled { opacity:.45; cursor:not-allowed; }
  .btn:not(:disabled):active { transform:scale(.97); }
  .btn-primary { background:linear-gradient(135deg,#e8603c,#f0a830); color:#fff; box-shadow:0 3px 12px rgba(232,96,60,.35); }
  .btn-primary:hover:not(:disabled) { box-shadow:0 5px 18px rgba(232,96,60,.45); transform:translateY(-1px); }
  .btn-green { background:linear-gradient(135deg,var(--felt),var(--felt-light)); color:#fff; box-shadow:0 3px 12px rgba(61,122,92,.3); }
  .btn-green:hover:not(:disabled) { box-shadow:0 5px 18px rgba(61,122,92,.4); transform:translateY(-1px); }
  .btn-secondary { background:var(--cream2); color:var(--brown); border:2px solid var(--border); }
  .btn-secondary:hover:not(:disabled) { background:var(--cream3); border-color:var(--brown-light); }
  .btn-ghost { background:transparent; color:var(--muted); border:2px solid var(--border); }
  .btn-ghost:hover:not(:disabled) { color:var(--text); border-color:var(--brown-light); }
  .btn-sm { padding:6px 14px; font-size:12px; }
  .btn-lg { padding:14px 28px; font-size:16px; width:100%; }

  /* Forms */
  .field { margin-bottom:18px; }
  .field label { display:block; font-size:13px; font-weight:700; margin-bottom:6px; color:var(--brown); }
  .input { width:100%; padding:11px 16px; background:var(--panel); border:2px solid var(--border); border-radius:10px; color:var(--text); font-family:var(--font); font-size:14px; font-weight:500; transition:border-color .15s,box-shadow .15s; outline:none; }
  .input:focus { border-color:var(--felt); box-shadow:0 0 0 3px rgba(61,122,92,.12); }
  .input::placeholder { color:var(--muted); font-weight:400; }
  textarea.input { resize:vertical; min-height:90px; line-height:1.5; }
  .input-code { font-family:var(--display); font-size:28px; font-weight:700; text-align:center; letter-spacing:6px; text-transform:uppercase; padding:14px; }
  .hint { font-size:11px; color:var(--muted); margin-top:5px; font-weight:600; }
  .err-box { background:#fff0ee; border:2px solid #f5c0b0; border-radius:10px; padding:10px 14px; font-size:13px; color:#c0402a; margin-bottom:14px; font-weight:700; }

  /* Home */
  .home-page { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; }
  .home-emoji { font-size:clamp(44px,8vw,68px); display:block; text-align:center; margin-bottom:6px; animation:float 3s ease-in-out infinite; }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
  .home-title { font-family:var(--display); font-size:clamp(56px,11vw,96px); font-weight:700; line-height:1; text-align:center; background:linear-gradient(135deg,#e8603c 0%,#f0a830 38%,#e87090 68%,#30a89a 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
  .home-sub { font-size:16px; color:var(--muted); margin-top:10px; font-weight:600; text-align:center; }
  .home-hero { margin-bottom:32px; }
  .home-card { background:var(--panel); border:2px solid var(--border); border-radius:24px; padding:30px; width:100%; max-width:460px; box-shadow:0 8px 40px var(--shadow); transition:background .3s,border-color .3s; }
  .tabs { display:flex; gap:4px; margin-bottom:22px; background:var(--cream2); padding:4px; border-radius:30px; }
  .tab-btn { flex:1; padding:9px; border-radius:26px; font-family:var(--font); font-size:13px; font-weight:700; cursor:pointer; border:none; transition:all .15s; color:var(--muted); background:transparent; }
  .tab-btn.active { background:var(--panel); color:var(--text); box-shadow:0 2px 8px var(--shadow); }
  .scale-grid { display:flex; gap:8px; }
  .scale-card { flex:1; padding:12px 10px; border:2.5px solid var(--border); border-radius:14px; background:var(--cream2); cursor:pointer; text-align:center; transition:all .15s; }
  .scale-card:hover { border-color:var(--felt); }
  .scale-card.selected { border-color:var(--felt); background:#e8f5ee; }
  body.dark .scale-card.selected { background:rgba(61,122,92,.2); }
  .scale-name { font-size:14px; font-weight:800; color:var(--text); }
  .scale-vals { font-size:11px; color:var(--muted); margin-top:3px; font-weight:500; }

  /* Avatar picker */
  .avatar-preview { font-size:36px; width:54px; height:54px; background:var(--panel); border:2.5px solid var(--border); border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .avatar-grid { display:flex; flex-wrap:wrap; gap:7px; justify-content:center; padding:6px 0; }
  .av-opt { width:44px; height:44px; border-radius:12px; border:2.5px solid var(--border); background:var(--cream2); display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer; transition:all .15s; }
  .av-opt:hover { border-color:var(--felt); transform:scale(1.12); }
  .av-opt.picked { border-color:var(--accent); background:#fff0ee; transform:scale(1.14); }
  body.dark .av-opt.picked { background:rgba(232,96,60,.2); }

  /* Point guide */
  .guide-toggle { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:700; color:var(--muted); cursor:pointer; padding:8px 0; border:none; background:none; font-family:var(--font); }
  .guide-toggle:hover { color:var(--text); }
  .guide-table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; border-radius:12px; overflow:hidden; border:1.5px solid var(--border); }
  .guide-table th { background:var(--cream2); color:var(--muted); font-weight:800; padding:7px 10px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.4px; border-bottom:1.5px solid var(--border); }
  .guide-table td { padding:7px 10px; border-bottom:1px solid var(--border); font-weight:600; vertical-align:middle; }
  .guide-table tr:last-child td { border-bottom:none; }
  .guide-pts { font-family:var(--display); font-size:16px; font-weight:700; }

  /* Game layout */
  .game-layout { display:grid; grid-template-columns:1fr 238px; flex:1; height:calc(100vh - 56px); overflow:hidden; }
  .game-main { overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; scroll-behavior:smooth; }
  .game-sidebar { border-left:2px solid var(--border); overflow-y:auto; display:flex; flex-direction:column; background:var(--cream); transition:background .3s; }

  /* Poker table */
  .table-wrap { display:flex; flex-direction:column; align-items:center; padding:4px 0 8px; }
  .table-outer { position:relative; width:min(340px,100%); padding-bottom:34%; }
  .table-felt { position:absolute; inset:0; background:radial-gradient(ellipse at 38% 38%,var(--felt-shine),var(--felt) 45%,var(--felt2)); border-radius:50%; border:5px solid var(--brown-light); box-shadow:0 0 0 2px var(--brown),0 10px 32px rgba(40,25,10,.28),inset 0 3px 14px rgba(0,0,0,.14); display:flex; align-items:center; justify-content:center; overflow:visible; }
  .table-inner { display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px; max-width:120px; text-align:center; }
  .table-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:rgba(255,255,255,.5); }
  .table-story { font-family:var(--display); font-size:13px; font-weight:600; color:rgba(255,255,255,.9); line-height:1.3; }
  .phase-dot { width:9px; height:9px; border-radius:50%; background:var(--accent2); box-shadow:0 0 8px var(--accent2); animation:blink 1.4s ease infinite; }
  .phase-dot.done { background:#fff; box-shadow:0 0 8px #fff; animation:none; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.45} }
  .seat { position:absolute; display:flex; flex-direction:column; align-items:center; gap:3px; transform:translate(-50%,-50%); }
  .seat-card { width:20px; height:28px; border-radius:4px; border:2px dashed rgba(255,255,255,.28); display:flex; align-items:center; justify-content:center; font-size:9px; color:rgba(255,255,255,.35); font-weight:700; background:rgba(0,0,0,.06); }
  .seat-card.has-vote { background:rgba(255,255,255,.88); border:2px solid rgba(255,255,255,.7); box-shadow:0 2px 8px rgba(0,0,0,.18); animation:cardPop .28s cubic-bezier(.34,1.56,.64,1); color:#3a2e22; font-size:11px; font-weight:800; font-family:var(--display); }
  @keyframes cardPop { from{transform:scale(.6) rotate(-8deg);opacity:0} to{transform:scale(1);opacity:1} }
  .seat-avatar { width:36px; height:36px; border-radius:50%; background:#fff; border:2px solid var(--border); display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 2px 8px var(--shadow); position:relative; }
  .seat-avatar.voted-a { border-color:var(--felt); box-shadow:0 0 0 2px rgba(61,122,92,.25),0 2px 8px var(--shadow); }
  .seat-avatar.is-host { border-color:var(--accent2); box-shadow:0 0 0 2px rgba(240,168,48,.28),0 2px 8px var(--shadow); }
  .check-badge { position:absolute; bottom:-2px; right:-2px; width:13px; height:13px; border-radius:50%; background:var(--felt); color:#fff; font-size:7px; font-weight:900; display:flex; align-items:center; justify-content:center; border:1.5px solid #fff; }
  .seat-name { font-size:9px; font-weight:800; color:var(--text); background:var(--panel); padding:1px 5px; border-radius:8px; border:1.5px solid var(--border); white-space:nowrap; max-width:58px; overflow:hidden; text-overflow:ellipsis; }
  .seat-me .seat-name { background:#e8f5ee; border-color:#b8dcc8; }
  body.dark .seat-me .seat-name { background:rgba(61,122,92,.25); }
  .seat-away { opacity:.55; filter:grayscale(.5); }

  /* Panels */
  .panel { background:var(--panel); border:2px solid var(--border); border-radius:20px; padding:20px; box-shadow:0 2px 12px var(--shadow); transition:background .3s,border-color .3s; }
  .prog-row { display:flex; align-items:center; gap:9px; margin-bottom:10px; }
  .prog-lbl { font-size:11px; font-weight:700; color:var(--muted); white-space:nowrap; }
  .prog-bar { flex:1; height:6px; background:var(--cream2); border-radius:3px; overflow:hidden; }
  .prog-fill { height:100%; background:linear-gradient(90deg,var(--felt),var(--felt-light)); border-radius:3px; transition:width .4s; }
  .story-tag { display:inline-block; font-size:11px; font-weight:700; color:var(--teal); background:#e6f7f5; padding:2px 9px; border-radius:10px; margin-bottom:5px; }
  body.dark .story-tag { background:rgba(48,168,154,.2); }
  .story-h { font-family:var(--display); font-size:18px; font-weight:600; line-height:1.3; color:var(--text); margin-bottom:4px; }
  .story-link a { font-size:12px; color:var(--muted); text-decoration:none; font-weight:600; }
  .story-link a:hover { color:var(--teal); }
  .nav-row { display:flex; gap:8px; align-items:center; margin-top:14px; flex-wrap:wrap; }
  .status-note { font-size:12px; color:var(--muted); font-weight:600; }
  .sec-lbl { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:var(--brown); margin-bottom:12px; }

  /* Cards */
  .cards-panel { background:var(--panel); border:2px solid var(--border); border-radius:20px; padding:20px; box-shadow:0 2px 12px var(--shadow); transition:background .3s; }
  .voting-layout { display:grid; grid-template-columns:1fr 1fr; gap:16px; align-items:start; }
  .guide-inline { background:var(--panel); border:2px solid var(--border); border-radius:20px; padding:20px; box-shadow:0 2px 12px var(--shadow); transition:background .3s; }
  .cards-grid { display:flex; flex-wrap:nowrap; gap:10px; justify-content:center; overflow-x:auto; padding-bottom:6px; }
  .pcard { width:108px; height:122px; border-radius:14px; border:2.5px solid var(--border); background:var(--card-bg); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; cursor:pointer; transition:all .15s cubic-bezier(.34,1.56,.64,1); position:relative; user-select:none; color:var(--text); box-shadow:0 2px 8px var(--shadow); padding:8px 10px; }
  .pcard-num { font-family:var(--display); font-size:30px; font-weight:700; line-height:1; margin-bottom:3px; }
  .pcard-row { display:flex; align-items:center; gap:3px; width:100%; justify-content:center; }
  .pcard-icon { font-size:10px; line-height:1; flex-shrink:0; }
  .pcard-effort { font-size:9px; font-weight:800; color:var(--muted); line-height:1.2; white-space:nowrap; }
  .pcard-time { font-size:9px; font-weight:600; color:var(--muted); line-height:1.2; white-space:nowrap; }
  .pcard:hover { border-color:var(--felt); transform:translateY(-7px) rotate(-2deg); box-shadow:0 10px 22px rgba(61,122,92,.2); }
  .pcard:hover .pcard-effort, .pcard:hover .pcard-time, .pcard:hover .pcard-icon { color:var(--felt); }
  .pcard.sel { border-color:var(--felt); background:linear-gradient(160deg,#e8f5ee,#d0ede0); color:var(--felt2); transform:translateY(-9px) rotate(-1.5deg); box-shadow:0 10px 26px rgba(61,122,92,.28); }
  body.dark .pcard.sel { background:linear-gradient(160deg,rgba(61,122,92,.3),rgba(46,96,72,.4)); color:#6dd4a0; }
  .pcard.sel .pcard-effort, .pcard.sel .pcard-time, .pcard.sel .pcard-icon { color:var(--felt); }
  .pcard.sel::after { content:'✓'; position:absolute; top:5px; right:6px; font-size:10px; color:var(--felt); font-weight:900; }

  /* Stats */
  .stats-panel { background:var(--panel); border:2px solid var(--border); border-radius:20px; padding:20px; box-shadow:0 2px 12px var(--shadow); transition:background .3s; }
  .agree-banner { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:14px; margin-bottom:16px; }
  .agree-H { background:#e8f5ee; border:2px solid #b8dcc8; }
  .agree-M { background:#fff8e6; border:2px solid #f5d990; }
  .agree-L { background:#fff0ee; border:2px solid #f5c0b0; }
  body.dark .agree-H { background:rgba(61,122,92,.2); border-color:rgba(61,122,92,.4); }
  body.dark .agree-M { background:rgba(240,168,48,.15); border-color:rgba(240,168,48,.3); }
  body.dark .agree-L { background:rgba(232,96,60,.15); border-color:rgba(232,96,60,.3); }
  .agree-icon { font-size:26px; }
  .agree-title { font-size:14px; font-weight:800; }
  .agree-sub { font-size:12px; color:var(--muted); font-weight:600; margin-top:1px; }
  .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:14px; }
  .stat-pill { background:var(--cream2); border:2px solid var(--border); border-radius:12px; padding:10px 4px; text-align:center; }
  .stat-n { font-family:var(--display); font-size:20px; font-weight:600; color:var(--text); }
  .stat-l { font-size:10px; color:var(--muted); font-weight:700; text-transform:uppercase; letter-spacing:.3px; margin-top:1px; }
  .dist-list { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
  .dist-row { display:flex; align-items:center; gap:8px; }
  .dist-k { font-weight:800; width:30px; text-align:right; font-size:13px; }
  .dist-track { flex:1; height:19px; background:var(--cream2); border-radius:5px; overflow:hidden; border:1.5px solid var(--border); }
  .dist-fill { height:100%; background:linear-gradient(90deg,var(--felt),var(--felt-light)); border-radius:5px; transition:width .5s cubic-bezier(.34,1.56,.64,1); }
  .dist-n { font-size:11px; color:var(--muted); font-weight:700; width:18px; }
  .final-row { display:flex; gap:7px; align-items:center; flex-wrap:wrap; padding-top:12px; border-top:1.5px solid var(--border); }
  .final-lbl { font-size:12px; font-weight:700; color:var(--brown); }
  .final-val { font-family:var(--display); font-size:22px; font-weight:600; color:var(--felt2); background:#e8f5ee; padding:4px 12px; border-radius:10px; }
  body.dark .final-val { background:rgba(61,122,92,.2); color:#6dd4a0; }

  /* Sidebar */
  .sb { padding:14px 15px; border-bottom:1.5px solid var(--border); }
  .sb:last-child { border-bottom:none; }
  .sb-t { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.7px; color:var(--muted); margin-bottom:9px; }
  .p-row { display:flex; align-items:center; gap:8px; padding:5px 7px; border-radius:10px; margin-bottom:4px; }
  .p-row:hover { background:var(--cream2); }
  .p-emo { font-size:19px; width:32px; height:32px; border-radius:50%; background:var(--panel); border:2px solid var(--border); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .p-info { flex:1; min-width:0; }
  .p-name { font-size:13px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .p-status { font-size:10px; color:var(--muted); font-weight:600; }
  .p-badge { font-size:10px; font-weight:800; padding:2px 7px; border-radius:8px; flex-shrink:0; }
  .b-host { background:#fff8e6; color:#b07010; border:1.5px solid #f5d990; }
  .b-voted { background:#e8f5ee; color:var(--felt2); border:1.5px solid #b8dcc8; }
  body.dark .b-host { background:rgba(240,168,48,.15); color:#f0c060; border-color:rgba(240,168,48,.3); }
  body.dark .b-voted { background:rgba(61,122,92,.2); color:#6dd4a0; border-color:rgba(61,122,92,.4); }
  .st-row { padding:7px 9px; border-radius:10px; cursor:pointer; border:1.5px solid transparent; transition:all .1s; margin-bottom:3px; display:flex; align-items:flex-start; gap:6px; }
  .st-row:hover { background:var(--cream2); border-color:var(--border); }
  .st-row.s-cur { background:#e8f5ee; border-color:#b8dcc8; }
  body.dark .st-row.s-cur { background:rgba(61,122,92,.2); border-color:rgba(61,122,92,.4); }
  .st-num { font-size:10px; font-weight:800; color:var(--muted); margin-top:1px; flex-shrink:0; }
  .st-ttl { flex:1; font-size:12px; font-weight:600; color:var(--text); line-height:1.4; }
  .st-pt { font-size:12px; font-weight:800; color:var(--felt2); flex-shrink:0; }
  .code-box { font-family:var(--display); font-size:26px; font-weight:600; letter-spacing:6px; text-align:center; color:var(--felt2); background:var(--cream2); padding:11px; border-radius:13px; border:2.5px dashed var(--felt); cursor:pointer; transition:background .15s; }
  .code-box:hover { background:var(--cream3); }
  .code-hint { font-size:10px; color:var(--muted); text-align:center; margin-top:4px; font-weight:600; }

  .toast { position:fixed; bottom:22px; left:50%; transform:translateX(-50%); background:var(--text); color:var(--cream); border-radius:30px; padding:10px 22px; font-size:13px; font-weight:700; z-index:999; animation:tPop .25s cubic-bezier(.34,1.56,.64,1); }
  @keyframes tPop { from{opacity:0;transform:translateX(-50%) translateY(10px) scale(.9)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
  .fade-in { animation:fIn .28s ease; }
  @keyframes fIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  .empty-state { display:flex; flex-direction:column; align-items:center; padding:32px 20px; text-align:center; }
  .big-code { font-family:var(--display); font-size:42px; font-weight:700; letter-spacing:6px; color:var(--felt2); margin-bottom:8px; }
  .empty-p { color:var(--muted); font-size:13px; font-weight:600; margin-bottom:16px; }

  @media(max-width:700px) {
    .game-layout { grid-template-columns:1fr; grid-template-rows:1fr auto; }
    .game-sidebar { border-left:none; border-top:2px solid var(--border); max-height:240px; }
    .table-outer { padding-bottom:44%; }
    .stats-row { grid-template-columns:repeat(2,1fr); }
    .pcard { width:88px; height:104px; }
    .pcard-num { font-size:24px; }
    .voting-layout { grid-template-columns:1fr; }
  }
  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }
`;

function computeStats(votes) {
  const all = Object.values(votes).filter(Boolean);
  if (!all.length) return null;
  const NM = { XS:1,S:2,M:3,L:5,XL:8,XXL:13 };
  const nums = all.map(v => NM[v] ?? parseFloat(v)).filter(v => !isNaN(v));
  const dist = {};
  all.forEach(v => { dist[v] = (dist[v] || 0) + 1; });
  if (!nums.length) return { distribution:dist, avg:null, median:null, min:null, max:null, agreement:'N/A', consensus:false };
  const s = [...nums].sort((a,b) => a-b);
  const avg = Math.round((s.reduce((a,b) => a+b,0)/s.length)*10)/10;
  const mid = Math.floor(s.length/2);
  const median = s.length%2===0?(s[mid-1]+s[mid])/2:s[mid];
  const uniq = [...new Set(nums)];
  return { distribution:dist, avg, median, min:s[0], max:s[s.length-1], agreement:uniq.length===1?'High':(Math.max(...nums)-Math.min(...nums)<=2?'Medium':'Low'), consensus:uniq.length===1 };
}

function seatPositions(n) {
  return Array.from({length:n},(_,i) => {
    const a=(i/n)*Math.PI*2-Math.PI/2;
    return {x:50+46*Math.cos(a),y:50+44*Math.sin(a)};
  });
}

function Toast({msg,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2100);return()=>clearTimeout(t);},[]);
  return <div className="toast">{msg}</div>;
}

function AvatarPicker({value,onChange}){
  return <div className="avatar-grid">{AVATARS.map(a=><div key={a} className={`av-opt ${value===a?'picked':''}`} onClick={()=>onChange(a)}>{a}</div>)}</div>;
}

function PointGuide(){
  const [open,setOpen]=useState(false);
  return (
    <div style={{marginBottom:18}}>
      <button className="guide-toggle" onClick={()=>setOpen(v=>!v)}>
        <span>{open?'▾':'▸'}</span> {open?'Hide':'Show'} story point guide
      </button>
      {open&&(
        <table className="guide-table">
          <thead><tr>
            <th>Points</th><th>Effort</th><th>Time</th><th>Complexity</th><th>Risk</th>
          </tr></thead>
          <tbody>{POINT_GUIDE.map(r=>(
            <tr key={r.pts} style={{background:r.bg}}>
              <td><span className="guide-pts">{r.pts}</span></td>
              <td>{r.effort}</td><td>{r.time}</td><td>{r.complexity}</td><td>{r.risk}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  );
}

function PokerTable({players,currentStory,phase,myId}){
  const seats=seatPositions(Math.max(players.length,1));
  return(
    <div className="table-wrap">
      <div className="table-outer">
        <div className="table-felt">
          <div className="table-inner">
            {phase==='voting'&&<div className="phase-dot"/>}
            {phase==='revealed'&&<div className="phase-dot done"/>}
            <div className="table-label">{phase==='waiting'?'Waiting to start':phase==='voting'?'Voting…':'Revealed!'}</div>
            {currentStory&&<div className="table-story">{currentStory.title.length>48?currentStory.title.slice(0,47)+'…':currentStory.title}</div>}
          </div>
          {players.map((p,i)=>{
            const pos=seats[i]||{x:50,y:50};
            const voted=currentStory?.votes?.[p.id];
            const isMe=p.id===myId;
            return(
              <div key={p.id} className={`seat ${isMe?'seat-me':''} ${!p.connected?'seat-away':''}`} style={{left:`${pos.x}%`,top:`${pos.y}%`}}>
                <div className={`seat-card ${voted?'has-vote':''}`}>
                  {phase==='revealed'&&voted?voted:(phase==='voting'&&voted?'🂠':'?')}
                </div>
                <div className={`seat-avatar ${voted&&phase==='voting'?'voted-a':''} ${p.isHost?'is-host':''}`}>
                  {p.avatar||'🃏'}
                  {voted&&phase==='voting'&&<div className="check-badge">✓</div>}
                </div>
                <div className="seat-name">{p.name}{isMe?' (you)':''}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatsPanel({stats,story,isHost,onSetFinal,scaleValues}){
  if(!stats) return null;
  const maxN=Math.max(...Object.values(stats.distribution));
  const AGREE={High:{icon:'🎉',t:'High agreement',s:"Everyone's aligned!",c:'agree-H'},Medium:{icon:'🤔',t:'Medium agreement',s:'Pretty close — quick chat?',c:'agree-M'},Low:{icon:'💬',t:'Low agreement',s:'Worth discussing before deciding.',c:'agree-L'},'N/A':{icon:'🃏',t:'Abstract votes',s:'No numeric stats.',c:'agree-M'}};
  const m=AGREE[stats.agreement]||AGREE['N/A'];
  const sorted=Object.entries(stats.distribution).sort((a,b)=>(scaleValues.indexOf(a[0])+(scaleValues.indexOf(a[0])===-1?999:0))-(scaleValues.indexOf(b[0])+(scaleValues.indexOf(b[0])===-1?999:0)));
  return(
    <div className="stats-panel fade-in">
      <div className={`agree-banner ${m.c}`}>
        <span className="agree-icon">{m.icon}</span>
        <div><div className="agree-title">{m.t}</div><div className="agree-sub">{m.s}</div></div>
      </div>
      {stats.avg!==null&&<div className="stats-row">
        {[['Avg',stats.avg],['Median',stats.median],['Min',stats.min],['Max',stats.max]].map(([l,v])=>
          <div key={l} className="stat-pill"><div className="stat-n">{v}</div><div className="stat-l">{l}</div></div>)}
      </div>}
      <div className="sec-lbl">Vote breakdown</div>
      <div className="dist-list">
        {sorted.map(([val,count])=>(
          <div key={val} className="dist-row">
            <span className="dist-k">{val}</span>
            <div className="dist-track"><div className="dist-fill" style={{width:`${(count/maxN)*100}%`}}/></div>
            <span className="dist-n">{count}</span>
          </div>
        ))}
      </div>
      {isHost&&<div className="final-row">
        <span className="final-lbl">Set final:</span>
        {scaleValues.filter(v=>v!=='☕'&&v!=='?').map(v=>(
          <button key={v} className={`btn btn-sm ${story.finalPoint===v?'btn-green':'btn-secondary'}`} onClick={()=>onSetFinal(v)} style={{minWidth:36,borderRadius:20}}>{v}</button>
        ))}
      </div>}
      {story.finalPoint&&<div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
        <span style={{fontSize:13,fontWeight:700,color:'var(--brown)'}}>Final:</span>
        <span className="final-val">{story.finalPoint} pts</span>
      </div>}
    </div>
  );
}

function HomePage({onEnterRoom,darkMode,toggleDark}){
  const [tab,setTab]=useState('create');
  // Shared name persists across tab switch
  const [name,setName]=useState('');
  const [avatar,setAvatar]=useState('🐱');
  const [showPicker,setShowPicker]=useState(false);
  const [scale,setScale]=useState('fibonacci');
  const [storyText,setStoryText]=useState('');
  const [joinCode,setJoinCode]=useState(()=>store.get('pendingJoin')||'');
  // If there's a pending join code, switch to join tab automatically
  useEffect(()=>{ if(store.get('pendingJoin')) setTab('join'); },[]);
  const [joinAvatar,setJoinAvatar]=useState('🐶');
  const [showJoinPicker,setShowJoinPicker]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState('');

  const parseStories=t=>t.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
    const m=l.match(/^(\[(.+?)\]\s*)?(.+?)(\s+https?:\/\/\S+)?$/);
    return {storyId:m?.[2]||'',title:m?.[3]||l,link:m?.[4]?.trim()||''};
  });

  const handleCreate=async()=>{
    if(!name.trim()){setErr('What should we call you? 😊');return;}
    setLoading(true);setErr('');
    try{
      const res=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({hostName:name.trim(),hostAvatar:avatar,scale,stories:parseStories(storyText)})});
      const data=await res.json();
      store.set('session',{roomCode:data.roomCode,playerId:data.playerId,hostToken:data.hostToken,name:name.trim(),avatar});
      onEnterRoom(data.roomCode,data.playerId,data.hostToken,avatar);
    }catch{setErr('Failed to create room — is the server running?');}
    setLoading(false);
  };

  const handleJoin=async()=>{
    if(!name.trim()){setErr('What should we call you? 😊');return;}
    if(!joinCode.trim()){setErr('Enter the room code!');return;}
    setLoading(true);setErr('');
    try{
      const res=await fetch(`/api/rooms/${joinCode.trim().toUpperCase()}/join`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({playerName:name.trim(),playerAvatar:joinAvatar})});
      if(!res.ok){const d=await res.json();setErr(d.error||'Room not found!');setLoading(false);return;}
      const data=await res.json();
      store.set('session',{roomCode:data.roomCode,playerId:data.playerId,hostToken:null,name:name.trim(),avatar:joinAvatar});
      onEnterRoom(data.roomCode,data.playerId,null,joinAvatar);
    }catch{setErr('Failed to join — check the code and try again!');}
    setLoading(false);
  };

  return(
    <div className="home-page">
      <div style={{position:'fixed',top:14,right:18,zIndex:200}}>
        <button className="dark-toggle" onClick={toggleDark} title="Toggle dark mode">{darkMode?'☀️':'🌙'}</button>
      </div>
      <div className="home-hero">
        <span className="home-emoji">🃏</span>
        <div className="home-title">Sprint Poker</div>
        <div className="home-sub">Make sprint planning feel like game night ✨</div>
      </div>
      <div className="home-card fade-in">
        <div className="tabs">
          {['create','join'].map(t=>(
            <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>{setTab(t);setErr('');}}>
              {t==='create'?'✨ New Session':'🚪 Join Session'}
            </button>
          ))}
        </div>
        {err&&<div className="err-box">{err}</div>}

        {/* Name is shared across both tabs */}
        <div className="field">
          <label>Your name</label>
          <input className="input" placeholder="e.g. Alex" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(tab==='create'?handleCreate():handleJoin())}/>
        </div>

        {tab==='create'?(<>
          <div className="field">
            <label>Your avatar</label>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:showPicker?10:0}}>
              <div className="avatar-preview">{avatar}</div>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowPicker(v=>!v)}>{showPicker?'Done ✓':'Change avatar'}</button>
            </div>
            {showPicker&&<AvatarPicker value={avatar} onChange={v=>{setAvatar(v);setShowPicker(false);}}/>}
          </div>
          <div className="field">
            <label>Point scale</label>
            <div className="scale-grid">
              {[{k:'fibonacci',n:'Fibonacci',v:'0,1,2,3,5,8,13…'},{k:'tshirt',n:'T-Shirt',v:'XS,S,M,L,XL,XXL…'}].map(s=>(
                <div key={s.k} className={`scale-card ${scale===s.k?'selected':''}`} onClick={()=>setScale(s.k)}>
                  <div className="scale-name">{s.n}</div><div className="scale-vals">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Stories (one per line, optional)</label>
            <textarea className="input" placeholder={'Fix nav bug\n[UX-142] Onboarding redesign\n[UX-150] Dark mode https://jira/UX-150'} value={storyText} onChange={e=>setStoryText(e.target.value)}/>
            <div className="hint">Format: [ID] Title https://link — all optional except title</div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={loading}>{loading?'Creating…':'🚀 Create Session'}</button>
        </>):(<>
          <div className="field">
            <label>Your avatar</label>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:showJoinPicker?10:0}}>
              <div className="avatar-preview">{joinAvatar}</div>
              <button className="btn btn-secondary btn-sm" onClick={()=>setShowJoinPicker(v=>!v)}>{showJoinPicker?'Done ✓':'Change avatar'}</button>
            </div>
            {showJoinPicker&&<AvatarPicker value={joinAvatar} onChange={v=>{setJoinAvatar(v);setShowJoinPicker(false);}}/>}
          </div>
          <div className="field">
            <label>Room code</label>
            <input className="input input-code" placeholder="ABC123" value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} maxLength={6} onKeyDown={e=>e.key==='Enter'&&handleJoin()}/>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleJoin} disabled={loading}>{loading?'Joining…':'Join Session 🎉'}</button>
        </>)}
      </div>
    </div>
  );
}

function GameRoom({roomCode,playerId,hostToken,myAvatar,darkMode,toggleDark}){
  const [room,setRoom]=useState(null);
  const [stats,setStats]=useState(null);
  const [myVote,setMyVote]=useState(null);
  const [toast,setToast]=useState(null);
  const [addOpen,setAddOpen]=useState(false);
  const [newText,setNewText]=useState('');
  const socketRef=useRef(null);
  const mainRef=useRef(null);
  const addPanelRef=useRef(null);
  const isHost=!!hostToken;

  useEffect(()=>{
    fetch(`/api/rooms/${roomCode}`).then(r=>r.json()).then(d=>{if(d.code)setRoom(d);});
    const s=getSocket();
    socketRef.current=s;
    s.connect();
    s.emit('join_room',{roomCode,playerId});
    s.on('room_updated',r=>{
      setRoom(r);
      if(r.phase==='voting'){const cur=r.stories[r.currentStoryIndex];if(cur&&!cur.votes[playerId])setMyVote(null);}
    });
    s.on('stats',st=>setStats(st));
    return()=>{s.off('room_updated');s.off('stats');s.disconnect();socket=null;};
  },[roomCode,playerId]);

  useEffect(()=>{
    if(room?.phase==='voting'){const cur=room.stories[room.currentStoryIndex];if(cur&&!cur.votes[playerId])setMyVote(null);}
  },[room?.currentStoryIndex]);

  // Auto-scroll to add panel when it opens
  useEffect(()=>{
    if(addOpen&&addPanelRef.current){
      setTimeout(()=>addPanelRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),50);
    }
  },[addOpen]);

  const copy=(t,m)=>navigator.clipboard?.writeText(t).then(()=>setToast(m));
  const emit=(ev,extra={})=>socketRef.current?.emit(ev,{roomCode,hostToken,...extra});
  const castVote=val=>{if(room?.phase!=='voting')return;setMyVote(val);socketRef.current?.emit('vote',{roomCode,playerId,value:val});};

  const addStories=async()=>{
    const stories=newText.split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{
      const m=l.match(/^(\[(.+?)\]\s*)?(.+?)(\s+https?:\/\/\S+)?$/);
      return {storyId:m?.[2]||'',title:m?.[3]||l,link:m?.[4]?.trim()||''};
    });
    await fetch(`/api/rooms/${roomCode}/stories`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({stories,hostToken})});
    setNewText('');setAddOpen(false);setToast(`Added ${stories.length} stor${stories.length===1?'y':'ies'}! 🎉`);
  };

  if(!room) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',fontWeight:600}}>Joining room {roomCode}…</div>;

  const current=room.stories[room.currentStoryIndex];
  const total=room.stories.length;
  const scv=SCALES[room.scale];
  const prog=total>0?((room.currentStoryIndex+1)/total)*100:0;
  const playersWithVote=room.players.map(p=>({...p,hasVoted:!!(current?.votes?.[p.id])}));
  const allVoted=room.players.filter(p=>!p.isHost).every(p=>current?.votes?.[p.id]);

  return(<>
    <div className="header">
      <div className="logo-small">Sprint Poker 🃏</div>
      <div className="header-right">
        <span className={`phase-pill phase-${room.phase}`}>{room.phase==='waiting'?'⏸ Waiting':room.phase==='voting'?'● Voting':'✨ Revealed'}</span>
        <div className="room-chip" onClick={()=>copy(room.code,'Code copied!')}>{room.code}</div>
        <button className="btn btn-secondary btn-sm" onClick={()=>copy(`${window.location.origin}?join=${room.code}`,'Invite link copied! 🎉')}>📋 Invite</button>
        {isHost&&<span style={{fontSize:11,fontWeight:800,color:'var(--accent2)'}}>★ HOST</span>}
        <button className="dark-toggle" onClick={toggleDark} title="Toggle dark mode">{darkMode?'☀️':'🌙'}</button>
        <button className="btn btn-ghost btn-sm" onClick={()=>{store.del('session');window.location.replace('/');}}>Leave</button>
      </div>
    </div>
    <div className="game-layout">
      <div className="game-main" ref={mainRef}>
        <PokerTable players={playersWithVote} currentStory={current} phase={room.phase} myId={playerId}/>

        {current?(
          <div className="panel">
            <div className="prog-row">
              <span className="prog-lbl">Story {room.currentStoryIndex+1} of {total}</span>
              <div className="prog-bar"><div className="prog-fill" style={{width:`${prog}%`}}/></div>
              <span className="prog-lbl">{Math.round(prog)}%</span>
            </div>
            {current.storyId&&<div className="story-tag">{current.storyId}</div>}
            <div className="story-h">{current.title}</div>
            {current.link&&<div className="story-link"><a href={current.link} target="_blank" rel="noreferrer">↗ Open ticket</a></div>}
            <div className="nav-row">
              {isHost&&<>
                <button className="btn btn-secondary btn-sm" onClick={()=>emit('navigate_story',{index:room.currentStoryIndex-1})} disabled={room.currentStoryIndex===0}>← Prev</button>
                {room.phase==='waiting'&&<button className="btn btn-green btn-sm" onClick={()=>emit('start_round')}>▶ Start Round</button>}
                {room.phase==='voting'&&(
                  <button className="btn btn-sm" onClick={()=>emit('reveal_votes')}
                    style={{background:allVoted?'linear-gradient(135deg,#e8603c,#f0a830)':'var(--cream2)',color:allVoted?'#fff':'var(--brown)',border:allVoted?'none':'2px solid var(--border)',borderRadius:40,fontWeight:700,padding:'6px 14px',fontSize:12,cursor:'pointer',fontFamily:'var(--font)',boxShadow:allVoted?'0 3px 12px rgba(232,96,60,.35)':'none'}}>
                    👁 Reveal{allVoted?' ✨':''}
                  </button>
                )}
                {room.phase==='revealed'&&<>
                  <button className="btn btn-secondary btn-sm" onClick={()=>emit('revote')}>↩ Revote</button>
                  <button className="btn btn-green btn-sm" onClick={()=>emit('navigate_story',{index:room.currentStoryIndex+1})} disabled={room.currentStoryIndex===total-1}>Next →</button>
                </>}
              </>}
              {!isHost&&<span className="status-note">
                {room.phase==='voting'&&!myVote&&'Pick a card 👇'}
                {room.phase==='voting'&&myVote&&'✓ Voted — waiting for reveal!'}
                {room.phase==='waiting'&&'Waiting for the host…'}
                {room.phase==='revealed'&&'Votes revealed! ✨'}
              </span>}
            </div>
          </div>
        ):(
          <div className="panel"><div className="empty-state">
            <div className="big-code">{room.code}</div>
            <p className="empty-p">{isHost?'Add some stories to get started!':'Waiting for the host to add stories…'}</p>
            {isHost&&<button className="btn btn-primary" onClick={()=>setAddOpen(true)}>+ Add Stories</button>}
          </div></div>
        )}

        {room.phase==='voting'&&current&&(
          <div className="cards-panel fade-in">
            <div className="sec-lbl">Your vote</div>
            <div className="cards-grid">
              {scv.map(v=>{
                const meta=CARD_META[v]||{effortIcon:'',effort:'',timeIcon:'',time:''};
                const isCoffee=v==='☕';
                return(
                  <div key={v} className={`pcard ${myVote===v?'sel':''}`} onClick={()=>castVote(v)}>
                    <span className="pcard-num">{v}</span>
                    {meta.effort&&<div className="pcard-row">
                      {meta.effortIcon&&<span className="pcard-icon">{meta.effortIcon}</span>}
                      <span className="pcard-effort">{meta.effort}</span>
                    </div>}
                    {!isCoffee&&meta.time&&<div className="pcard-row">
                      {meta.timeIcon&&<span className="pcard-icon">{meta.timeIcon}</span>}
                      <span className="pcard-time">{meta.time}</span>
                    </div>}
                    {isCoffee&&<div className="pcard-row">
                      <span className="pcard-time">break!</span>
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {room.phase==='revealed'&&stats&&(
          <StatsPanel stats={stats} story={current} isHost={isHost}
            onSetFinal={val=>emit('set_final_point',{storyIndex:room.currentStoryIndex,value:val})}
            scaleValues={scv}/>
        )}

        {isHost&&addOpen&&(
          <div className="panel fade-in" ref={addPanelRef}>
            <div className="sec-lbl" style={{marginBottom:10}}>Add Stories</div>
            <textarea className="input" style={{marginBottom:8}} placeholder={'Fix nav bug\n[UX-142] Onboarding redesign'} value={newText} onChange={e=>setNewText(e.target.value)} autoFocus/>
            <div className="hint" style={{marginBottom:10}}>Format: [ID] Title https://link</div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" onClick={addStories}>Add!</button>
              <button className="btn btn-secondary" onClick={()=>setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
        {isHost&&!addOpen&&total>0&&(
          <button className="btn btn-secondary" style={{alignSelf:'flex-start'}} onClick={()=>setAddOpen(true)}>+ Add More Stories</button>
        )}
      </div>

      <div className="game-sidebar">
        <div className="sb">
          <div className="sb-t">Room</div>
          <div className="code-box" onClick={()=>copy(room.code,'Code copied!')}>{room.code}</div>
          <div className="code-hint">Tap to copy · <span style={{cursor:'pointer',color:'var(--teal)'}} onClick={()=>copy(`${window.location.origin}?join=${room.code}`,'Link copied!')}>copy invite link</span></div>
        </div>
        <div className="sb">
          <div className="sb-t">At the table ({room.players.length})</div>
          {playersWithVote.map(p=>(
            <div key={p.id} className="p-row">
              <div className="p-emo">{p.avatar||'🃏'}</div>
              <div className="p-info">
                <div className="p-name">{p.name}{p.id===playerId?' (you)':''}</div>
                <div className="p-status">{p.connected?'Online':'Away'}</div>
              </div>
              {p.isHost&&<span className="p-badge b-host">host</span>}
              {!p.isHost&&room.phase==='voting'&&p.hasVoted&&<span className="p-badge b-voted">voted ✓</span>}
            </div>
          ))}
        </div>
        {total>0&&(
          <div className="sb" style={{flex:1,overflowY:'auto'}}>
            <div className="sb-t">Stories ({total})</div>
            {room.stories.map((s,i)=>(
              <div key={s.id} className={`st-row ${i===room.currentStoryIndex?'s-cur':''}`}
                onClick={()=>isHost&&emit('navigate_story',{index:i})} style={{cursor:isHost?'pointer':'default'}}>
                <span className="st-num">#{i+1}</span>
                <span className="st-ttl">{s.title.length>30?s.title.slice(0,29)+'…':s.title}</span>
                {s.finalPoint&&<span className="st-pt">{s.finalPoint}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
  </>);
}

export default function App(){
  const [view,setView]=useState('loading');
  const [roomInfo,setRoomInfo]=useState(null);
  const [darkMode,setDarkMode]=useState(()=>store.get('darkMode')||false);

  useEffect(()=>{
    document.body.classList.toggle('dark',darkMode);
  },[darkMode]);

  const toggleDark=()=>{
    setDarkMode(v=>{
      store.set('darkMode',!v);
      document.body.classList.toggle('dark',!v);
      return !v;
    });
  };

  useEffect(()=>{
    // Check for ?join=CODE in URL — invite link support
    const params=new URLSearchParams(window.location.search);
    const joinCode=params.get('join');
    if(joinCode){
      // Pre-fill join tab with the code, clear URL, show home
      store.set('pendingJoin',joinCode.toUpperCase());
      window.history.replaceState({},'','/');
    }

    const session=store.get('session');
    if(session){
      fetch(`/api/rooms/${session.roomCode}`).then(r=>r.json()).then(data=>{
        if(data.code&&data.players?.find(p=>p.id===session.playerId)){
          setRoomInfo(session);setView('room');
        }else{store.del('session');setView('home');}
      }).catch(()=>{store.del('session');setView('home');});
    }else{
      setView('home');
    }
  },[]);

  const enterRoom=(roomCode,playerId,hostToken,avatar)=>{
    store.del('pendingJoin');
    setRoomInfo({roomCode,playerId,hostToken,avatar});
    setView('room');
    window.history.replaceState({},'','/');
  };

  if(view==='loading') return(
    <>
      <style>{css}</style>
      <div className="app" style={{alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:40,animation:'float 1.5s ease-in-out infinite'}}>🃏</div>
      </div>
    </>
  );

  return(
    <>
      <style>{css}</style>
      <div className="app">
        {view==='home'&&<HomePage onEnterRoom={enterRoom} darkMode={darkMode} toggleDark={toggleDark}/>}
        {view==='room'&&roomInfo&&(
          <GameRoom roomCode={roomInfo.roomCode} playerId={roomInfo.playerId}
            hostToken={roomInfo.hostToken} myAvatar={roomInfo.avatar}
            darkMode={darkMode} toggleDark={toggleDark}/>
        )}
      </div>
    </>
  );
}
