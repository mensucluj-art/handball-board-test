(()=>{"use strict";

const VERSION="3.1";

const base=[
['ghivil','Ghivil',['ES'],7,3,2,1.5,1.5],
['calin','Călin',['IS'],7,3,2,2,1.5],
['bizau','Bizău',['C'],7,3,2,1.5,2],
['coman','Coman',['ID'],7,3,2,1.5,2],
['paul','Paul',['ED'],7,3,2,1.5,2],
['ali','Ali',['P'],3,5,3,1,3],
['iliescu','Iliescu',['ES'],7,3,2,1.5,2],
['ciripoiu','Ciripoiu',['IS','ID'],7,3,2,1.8,2],
['vujic','Vujic',['C'],7,3,2,1.4,2],
['burzo','Burzo',['ID'],7,3,2,1.4,2],
['ostace','Ostace',['ID'],7,3,2,1.4,2],
['tomas','Tomas',['ED'],7,3,2,1.5,2],
['bobo','Bobo',['ED'],7,3,2,1.5,2],
['duta','Duta',['P'],7,3,2,1.3,2],
['costea','Costea',['P'],7,3,2,1.3,2],
['merla','Merla',['GK'],12,8,5,1,2],
['tenghea','Tenghea',['GK'],12,8,5,1,2]
];

/*
  Court orientation:
  - ATTACK attacks the TOP goal.
  - DEFENCE protects the BOTTOM goal.
  Attack:
    Wings close to 6m arc/corners
    Pivot close to 6m
    Backs deeper
  Defence:
    Six field players distributed along the 6m arc.
*/
const positions={
  attack:{
    ES:[14,14],
    IS:[31,25],
    C:[50,28],
    ID:[69,25],
    ED:[86,14],
    P:[50,12]
  },
  defence:{
    ES:[17,88],
    IS:[31,84],
    C:[43,81],
    P:[57,81],
    ID:[69,84],
    ED:[83,88],
    GK:[50,96]
  }
};

const fresh=()=>({
  version:VERSION,
  running:false,
  phase:'attack',
  match:0,
  last:Date.now(),
  history:[],
  attack:{ES:'ghivil',IS:'calin',C:'bizau',ID:'coman',ED:'paul',P:'ali'},
  defence:{ES:'ghivil',IS:'ciripoiu',C:'bizau',ID:'coman',ED:'paul',P:'ali',GK:'merla'},
  players:Object.fromEntries(base.map(x=>[x[0],{
    id:x[0],name:x[1],posts:x[2],
    fatigue:{green:x[3],yellow:x[4],red:x[5]},
    recovery:x[6],minRest:x[7],
    load:0,total:0,attackTime:0,defenceTime:0,
    benchTime:0,suspension:0,manual:null
  }]))
});

let state;
try{
  const stored=JSON.parse(localStorage.getItem('hbrb-v3'));
  state=stored || fresh();
}catch(e){ state=fresh(); }

const $=s=>document.querySelector(s);
const fmt=s=>{
  s=Math.max(0,Math.floor(s));
  return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
};
const p=id=>state.players[id];
const ids=ph=>Object.values(state[ph]);
const goalkeeper=()=>state.defence.GK;
const save=()=>{try{localStorage.setItem('hbrb-v3',JSON.stringify(state))}catch(e){}};

const snapshot=()=>{
  state.history.push(JSON.parse(JSON.stringify({
    attack:state.attack,
    defence:state.defence,
    players:state.players,
    phase:state.phase,
    match:state.match
  })));
  if(state.history.length>40) state.history.shift();
};

function fatigueLevel(x){
  if(x.manual) return x.manual;
  const g=x.fatigue.green*60;
  const y=x.fatigue.yellow*60;
  const r=x.fatigue.red*60;
  if(x.load<g) return 'green';
  if(x.load<g+y) return 'yellow';
  if(x.load<g+y+r) return 'red';
  return 'purple';
}

function readiness(x){
  const preferredMax=(x.fatigue.green+x.fatigue.yellow)*60;
  const safe=Math.max(0,preferredMax-60);
  const loadWait=Math.max(0,x.load-safe)/Math.max(.1,x.recovery);
  const restWait=Math.max(0,x.minRest*60-x.benchTime);
  const s=Math.max(loadWait,restWait);
  return {ok:s<1,s};
}

function token(id,pos,phase){
  const x=p(id);
  const xy=positions[phase][pos];
  if(!xy) return '';
  const l=fatigueLevel(x);
  return `<button type="button"
    class="token ${l}${x.suspension>0?' suspended':''}"
    data-player="${id}" data-phase="${phase}" data-pos="${pos}"
    style="left:${xy[0]}%;top:${xy[1]}%">
      <span class="n">${x.name}</span>
      <span class="t">${fmt(x.total)}</span>
      <span class="p">${pos}${x.suspension>0?' · '+fmt(x.suspension):''}</span>
    </button>`;
}

function render(){
  $('#clock').textContent=fmt(state.match);
  $('#attackMode').classList.toggle('active',state.phase==='attack');
  $('#defenceMode').classList.toggle('active',state.phase==='defence');

  $('#attackLayer').innerHTML=Object.entries(state.attack)
    .map(([pos,id])=>token(id,pos,'attack')).join('');

  $('#defenceLayer').innerHTML=Object.entries(state.defence)
    .map(([pos,id])=>token(id,pos,'defence')).join('');

  const visible=new Set([...ids('attack'),...ids('defence')]);
  const bench=Object.values(state.players)
    .filter(x=>!visible.has(x.id))
    .sort((a,b)=>a.posts[0].localeCompare(b.posts[0])||a.name.localeCompare(b.name));

  $('#bench').innerHTML=bench.map(x=>{
    const r=readiness(x),l=fatigueLevel(x);
    return `<button type="button" class="benchCard" data-bench="${x.id}">
      <div class="dot ${l}"></div>
      <div>
        <div class="name">${x.name}</div>
        <div class="meta">${x.posts.join('/')} · total ${fmt(x.total)} · load ${fmt(x.load)}</div>
      </div>
      <div class="ready ${r.ok?'ok':'wait'}">${x.suspension>0?'2’ '+fmt(x.suspension):r.ok?'READY':fmt(r.s)}</div>
    </button>`;
  }).join('');
}

// Event delegation: robust even though the board re-renders every animation frame.
document.addEventListener('click',e=>{
  const tokenEl=e.target.closest('[data-player]');
  if(tokenEl){
    openPlayer(tokenEl.dataset.player,tokenEl.dataset.phase,tokenEl.dataset.pos);
    return;
  }
  const benchEl=e.target.closest('[data-bench]');
  if(benchEl){
    openPlayer(benchEl.dataset.bench,null,null);
    return;
  }
});

function openPlayer(id,phase,pos){
  const x=p(id);
  const ap=Object.entries(state.attack).find(([,v])=>v===id)?.[0]||'-';
  const dp=Object.entries(state.defence).find(([,v])=>v===id)?.[0]||'-';

  $('#modal').innerHTML=`
    <h2>${x.name}</h2>
    <div class="stats">
      <div class="stat"><small>TOTAL</small><b>${fmt(x.total)}</b></div>
      <div class="stat"><small>LOAD</small><b>${fmt(x.load)}</b></div>
      <div class="stat"><small>ATAC</small><b>${fmt(x.attackTime)}</b></div>
      <div class="stat"><small>APĂRARE</small><b>${fmt(x.defenceTime)}</b></div>
    </div>

    <div class="actions">
      ${phase?'<button id="subBtn" class="primaryAction">SCHIMBĂ '+pos+'</button>':''}
      <button id="two" class="danger">ELIMINARE 2’</button>
      <button id="clear2">ANULEAZĂ 2’</button>
    </div>

    <h3>Stare fizică</h3>
    <div class="fatigue">
      <button data-fatigue="green" class="green">VERDE</button>
      <button data-fatigue="yellow" class="yellow">GALBEN</button>
      <button data-fatigue="red" class="red">ROȘU</button>
      <button data-fatigue="purple" class="purple">MOV</button>
      <button id="auto">AUTO</button>
    </div>

    <h3>Profil individual</h3>
    <div class="fieldGrid">
      <label class="field">Verde (min)<input id="g" type="number" step=".5" value="${x.fatigue.green}"></label>
      <label class="field">Galben (min)<input id="y" type="number" step=".5" value="${x.fatigue.yellow}"></label>
      <label class="field">Roșu (min)<input id="r" type="number" step=".5" value="${x.fatigue.red}"></label>
      <label class="field">Recovery ×<input id="rec" type="number" step=".1" value="${x.recovery}"></label>
      <label class="field">Pauză minimă<input id="rest" type="number" step=".5" value="${x.minRest}"></label>
    </div>
    <div class="actions"><button id="saveProfile">SALVEAZĂ PROFIL</button></div>
    <div class="meta">Atac: ${ap} · Apărare: ${dp}</div>
    <div id="subs"></div>
  `;

  $('#backdrop').classList.remove('hidden');

  if(phase){
    $('#subBtn').onclick=()=>showSubstitutes(id,phase,pos);
  }

  $('#two').onclick=()=>{
    snapshot(); x.suspension=120; save(); openPlayer(id,phase,pos);
  };
  $('#clear2').onclick=()=>{
    snapshot(); x.suspension=0; save(); openPlayer(id,phase,pos);
  };

  document.querySelectorAll('[data-fatigue]').forEach(b=>{
    b.onclick=()=>{
      snapshot(); x.manual=b.dataset.fatigue; save(); openPlayer(id,phase,pos);
    };
  });
  $('#auto').onclick=()=>{
    snapshot(); x.manual=null; save(); openPlayer(id,phase,pos);
  };

  $('#saveProfile').onclick=()=>{
    snapshot();
    x.fatigue.green=+$('#g').value||0;
    x.fatigue.yellow=+$('#y').value||0;
    x.fatigue.red=+$('#r').value||0;
    x.recovery=Math.max(.1,+$('#rec').value||1);
    x.minRest=Math.max(0,+$('#rest').value||0);
    save(); openPlayer(id,phase,pos);
  };
}

function showSubstitutes(outId,phase,pos){
  const out=p(outId);
  const sameFormation=new Set(ids(phase));

  const candidates=Object.values(state.players).filter(x=>{
    if(x.id===outId) return false;
    if(x.suspension>0) return false;
    if(sameFormation.has(x.id)) return false;
    // GK can only replace GK; field players replace by eligible post.
    if(pos==='GK') return x.posts.includes('GK');
    return x.posts.includes(pos);
  });

  $('#subs').innerHTML=`
    <h3>Înlocuiește ${out.name} pe ${pos}</h3>
    <div class="sub-list">
      ${candidates.length?candidates.map(x=>{
        const rr=readiness(x);
        return `<button type="button" class="sub" data-sub="${x.id}">
          <span><b>${x.name}</b> · ${x.posts.join('/')}</span>
          <span>${rr.ok?'READY':fmt(rr.s)}</span>
        </button>`;
      }).join(''):'<div class="meta">Nu există înlocuitor eligibil pentru acest post.</div>'}
    </div>
  `;

  document.querySelectorAll('[data-sub]').forEach(el=>{
    el.onclick=()=>{
      snapshot();
      state[phase][pos]=el.dataset.sub;
      save();
      $('#backdrop').classList.add('hidden');
      render();
    };
  });
}

function tick(){
  const now=Date.now();
  const dt=Math.min(2,(now-state.last)/1000);
  state.last=now;

  if(state.running){
    state.match+=dt;

    const active=new Set(ids(state.phase));
    // GK is always physically on court, regardless of active phase selector.
    active.add(goalkeeper());

    Object.values(state.players).forEach(x=>{
      if(x.suspension>0) x.suspension=Math.max(0,x.suspension-dt);

      const onCourt=active.has(x.id) && x.suspension<=0;

      if(onCourt){
        x.total+=dt;
        x.load+=dt;
        x.benchTime=0;

        if(x.id===goalkeeper()) x.defenceTime+=dt;
        else if(state.phase==='attack') x.attackTime+=dt;
        else x.defenceTime+=dt;
      }else{
        x.benchTime+=dt;
        x.load=Math.max(0,x.load-dt*x.recovery);
      }
    });
  }

  render();
  save();
  requestAnimationFrame(tick);
}

$('#start').onclick=()=>{state.running=true;state.last=Date.now()};
$('#pause').onclick=()=>state.running=false;
$('#attackMode').onclick=()=>{state.phase='attack';save();render()};
$('#defenceMode').onclick=()=>{state.phase='defence';save();render()};
$('#undo').onclick=()=>{
  const h=state.history.pop();
  if(!h) return;
  state.attack=h.attack; state.defence=h.defence; state.players=h.players;
  state.phase=h.phase; state.match=h.match;
  save(); render();
};
$('#reset').onclick=()=>{
  if(confirm('Resetezi meciul?')){
    state=fresh();
    save();
    render();
  }
};
$('#close').onclick=()=>$('#backdrop').classList.add('hidden');
$('#backdrop').onclick=e=>{if(e.target.id==='backdrop')$('#backdrop').classList.add('hidden')};

render();
requestAnimationFrame(tick);
})();