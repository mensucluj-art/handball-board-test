(()=>{"use strict";

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

const positions={
  attack:{ES:[15,24],IS:[29,20],C:[43,17],P:[50,34],ID:[71,20],ED:[85,24]},
  defence:{ES:[16,75],IS:[30,80],C:[42,84],P:[50,70],ID:[70,80],ED:[84,75],GK:[50,94]}
};

const fresh=()=>({
  running:false, phase:'attack', match:0, last:Date.now(), history:[],
  attack:{ES:'ghivil',IS:'calin',C:'bizau',ID:'coman',ED:'paul',P:'ali'},
  defence:{ES:'ghivil',IS:'ciripoiu',C:'bizau',ID:'coman',ED:'paul',P:'ali',GK:'merla'},
  players:Object.fromEntries(base.map(x=>[x[0],{
    id:x[0],name:x[1],posts:x[2],
    fatigue:{green:x[3],yellow:x[4],red:x[5]},
    recovery:x[6],minRest:x[7],load:0,total:0,
    attackTime:0,defenceTime:0,benchTime:0,suspension:0,manual:null
  }]))
});

let state;
try{ state=JSON.parse(localStorage.getItem('hbrb-v2')) || fresh(); }
catch(e){ state=fresh(); }

// migrate an old V1 state if needed
if(!state.attack || !state.defence || !state.players) state=fresh();
if(state.attack.GK) delete state.attack.GK;
if(!state.defence.GK) state.defence.GK='merla';

const $=s=>document.querySelector(s);
const fmt=s=>{s=Math.max(0,Math.floor(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const p=id=>state.players[id];
const phaseIds=ph=>Object.values(state[ph]);
const activeGK=()=>state.defence.GK;
const save=()=>{try{localStorage.setItem('hbrb-v2',JSON.stringify(state))}catch(e){}};

const snap=()=>{
  state.history.push(JSON.parse(JSON.stringify({
    attack:state.attack,defence:state.defence,players:state.players,
    phase:state.phase,match:state.match
  })));
  if(state.history.length>30) state.history.shift();
};

function level(x){
  if(x.manual) return x.manual;
  let g=x.fatigue.green*60,y=x.fatigue.yellow*60,r=x.fatigue.red*60;
  return x.load<g?'green':x.load<g+y?'yellow':x.load<g+y+r?'red':'purple';
}

function ready(x){
  let safe=(x.fatigue.green+x.fatigue.yellow)*60-60;
  let excess=Math.max(0,x.load-safe);
  let recoveryWait=excess/Math.max(.1,x.recovery);
  let minimumWait=Math.max(0,x.minRest*60-x.benchTime);
  let s=Math.max(recoveryWait,minimumWait);
  return {ok:s<1,s};
}

function token(id,pos,ph){
  const x=p(id),l=level(x),xy=positions[ph][pos];
  if(!xy) return '';
  return `<button class="token ${l}${x.suspension>0?' suspended':''}" data-id="${id}" data-pos="${pos}" data-phase="${ph}" style="left:${xy[0]}%;top:${xy[1]}%">
    <span class="n">${x.name}</span>
    <span class="t">${fmt(x.total)}</span>
    <span class="p">${pos}${x.suspension>0?' · '+fmt(x.suspension):''}</span>
  </button>`;
}

function render(){
  $('#clock').textContent=fmt(state.match);
  $('#attackMode').classList.toggle('active',state.phase==='attack');
  $('#defenceMode').classList.toggle('active',state.phase==='defence');

  // Attack = only the six field players
  $('#attackLayer').innerHTML=Object.entries(state.attack).map(([k,v])=>token(v,k,'attack')).join('');

  // Defence = six field players + goalkeeper in the bottom goal
  $('#defenceLayer').innerHTML=Object.entries(state.defence).map(([k,v])=>token(v,k,'defence')).join('');

  document.querySelectorAll('.token').forEach(el=>{
    el.onclick=()=>openPlayer(el.dataset.id,el.dataset.phase,el.dataset.pos);
  });

  // Bench excludes everybody currently used in either visible formation.
  const visible=new Set([...phaseIds('attack'),...phaseIds('defence')]);
  const list=Object.values(state.players)
    .filter(x=>!visible.has(x.id))
    .sort((a,b)=>a.posts[0].localeCompare(b.posts[0])||a.name.localeCompare(b.name));

  $('#bench').innerHTML=list.map(x=>{
    let r=ready(x),l=level(x);
    return `<div class="benchCard" data-id="${x.id}">
      <div class="dot ${l}"></div>
      <div>
        <div class="name">${x.name}</div>
        <div class="meta">${x.posts.join('/')} · total ${fmt(x.total)} · load ${fmt(x.load)}</div>
      </div>
      <div class="ready ${r.ok?'ok':'wait'}">${x.suspension>0?'2’ '+fmt(x.suspension):r.ok?'READY':fmt(r.s)}</div>
    </div>`;
  }).join('');

  document.querySelectorAll('.benchCard').forEach(el=>{
    el.onclick=()=>openPlayer(el.dataset.id,null,null);
  });
}

function openPlayer(id,selectedPhase=null,selectedPos=null){
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
      ${selectedPhase?'<button id="subBtn">SCHIMBĂ</button>':''}
      <button id="two" class="danger">ELIMINARE 2’</button>
      <button id="clear2">ANULEAZĂ 2’</button>
    </div>

    <h3>Stare fizică</h3>
    <div class="fatigue">
      <button data-f="green" class="green">VERDE</button>
      <button data-f="yellow" class="yellow">GALBEN</button>
      <button data-f="red" class="red">ROȘU</button>
      <button data-f="purple" class="purple">MOV</button>
      <button id="auto">AUTO</button>
    </div>

    <h3>Profil</h3>
    <div class="fieldGrid">
      <label class="field">Verde<input id="g" type="number" step=".5" value="${x.fatigue.green}"></label>
      <label class="field">Galben<input id="y" type="number" step=".5" value="${x.fatigue.yellow}"></label>
      <label class="field">Roșu<input id="r" type="number" step=".5" value="${x.fatigue.red}"></label>
      <label class="field">Recovery ×<input id="rec" type="number" step=".1" value="${x.recovery}"></label>
      <label class="field">Pauză minimă<input id="rest" type="number" step=".5" value="${x.minRest}"></label>
    </div>
    <div class="actions"><button id="saveProfile">SALVEAZĂ PROFIL</button></div>
    <div class="meta">Atac: ${ap} · Apărare: ${dp}</div>
    <div id="subs"></div>
  `;

  $('#backdrop').classList.remove('hidden');

  $('#two').onclick=()=>{snap();x.suspension=120;save();openPlayer(id,selectedPhase,selectedPos)};
  $('#clear2').onclick=()=>{snap();x.suspension=0;save();openPlayer(id,selectedPhase,selectedPos)};

  document.querySelectorAll('[data-f]').forEach(b=>{
    b.onclick=()=>{snap();x.manual=b.dataset.f;save();openPlayer(id,selectedPhase,selectedPos)};
  });
  $('#auto').onclick=()=>{snap();x.manual=null;save();openPlayer(id,selectedPhase,selectedPos)};

  $('#saveProfile').onclick=()=>{
    snap();
    x.fatigue.green=+$('#g').value||0;
    x.fatigue.yellow=+$('#y').value||0;
    x.fatigue.red=+$('#r').value||0;
    x.recovery=Math.max(.1,+$('#rec').value||1);
    x.minRest=Math.max(0,+$('#rest').value||0);
    save();
    openPlayer(id,selectedPhase,selectedPos);
  };

  if(selectedPhase){
    $('#subBtn').onclick=()=>showSubs(id,selectedPhase,selectedPos);
  }
}

function showSubs(outId,phase,pos){
  const out=p(outId);

  // replacement is filtered by the exact position tapped
  const candidates=Object.values(state.players).filter(x=>{
    if(x.id===outId || x.suspension>0) return false;
    if(!x.posts.includes(pos)) return false;

    // do not offer someone who is already in that same formation
    if(phaseIds(phase).includes(x.id)) return false;
    return true;
  });

  $('#subs').innerHTML=`
    <h3>Schimbă ${out.name} · ${pos}</h3>
    ${candidates.length?candidates.map(x=>{
      const rr=ready(x),l=level(x);
      return `<button class="sub" data-sub="${x.id}">
        <span><b>${x.name}</b> · ${x.posts.join('/')}</span>
        <span>${rr.ok?'READY':fmt(rr.s)} · ${l.toUpperCase()}</span>
      </button>`;
    }).join(''):'<div class="meta">Nu există înlocuitor eligibil pe acest post.</div>'}
  `;

  document.querySelectorAll('[data-sub]').forEach(el=>{
    el.onclick=()=>{
      const inId=el.dataset.sub;
      snap();

      // Replace only in the formation/position that was tapped.
      state[phase][pos]=inId;

      // Goalkeeper is only a defence-side role/visual.
      if(pos==='GK' && phase!=='defence') return;

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

    // Field players: only active formation accumulates playing/load time.
    const activeField=new Set(phaseIds(state.phase).filter(id=>id!==activeGK()));

    // Goalkeeper: always counts as playing while he is the active GK,
    // independent of attack/defence selector.
    const goalkeeper=activeGK();

    Object.values(state.players).forEach(x=>{
      if(x.suspension>0) x.suspension=Math.max(0,x.suspension-dt);

      const onField=(activeField.has(x.id) || x.id===goalkeeper) && x.suspension<=0;

      if(onField){
        x.total+=dt;
        x.load+=dt;
        x.benchTime=0;

        if(x.id===goalkeeper){
          // GK time is counted as defence/goalkeeping time for now.
          x.defenceTime+=dt;
        }else if(state.phase==='attack'){
          x.attackTime+=dt;
        }else{
          x.defenceTime+=dt;
        }
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
$('#attackMode').onclick=()=>{state.phase='attack';render();save()};
$('#defenceMode').onclick=()=>{state.phase='defence';render();save()};
$('#undo').onclick=()=>{
  const h=state.history.pop();
  if(h){
    state.attack=h.attack; state.defence=h.defence; state.players=h.players;
    state.phase=h.phase; state.match=h.match;
    save(); render();
  }
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