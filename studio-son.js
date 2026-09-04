'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const families = [
    {name:'Dérive',color:'#91e2c1',bpm:64,scale:[0,3,7,10,14,19],names:['Sillage de verre','La nuit des dormeurs','Océan sans rive','Poussière lente','Lumière fossile','Au-delà du hublot'],desc:'Nappes aériennes, notes espacées et rythme discret.'},
    {name:'Arpèges',color:'#87bdf2',bpm:94,scale:[0,3,7,12,14,19],names:['Orbite de cuivre','Balise 07','Cartographie','Relais lointain','Les anneaux','Lignes de transit'],desc:'Motifs en mouvement, échos et basse ronde.'},
    {name:'Machines',color:'#e5ba7c',bpm:106,scale:[0,2,7,10,12,17],names:['Quart de nuit','Hangar pressurisé','Pompes primaires','Sous la coque','Assemblage orbital','Réacteur froid'],desc:'Percussions mécaniques, séquence sèche et basse pulsée.'},
    {name:'Mystère',color:'#bfa0eb',bpm:76,scale:[0,1,5,7,8,12],names:['Signal dans la brume','L’épave écoute','Chambre scellée','Mémoire d’Amer','Les voix du vide','Fréquence inconnue'],desc:'Intervalles troubles, textures profondes et signaux isolés.'},
    {name:'Expédition',color:'#7fd3df',bpm:112,scale:[0,2,5,7,9,12],names:['Fenêtre de départ','Première descente','Sol étranger','Cap au levant','Au terminator','Retour au Ludion'],desc:'Mélodie claire, pulsation régulière et horizon ouvert.'},
    {name:'Tension',color:'#ec928f',bpm:120,scale:[0,1,3,6,7,12],names:['Cote critique','Oxygène compté','Course au sas','Débris en approche','Dernier transfert','Tenir jusqu’à l’aube'],desc:'Basse insistante, accents métalliques et batterie soutenue.'}
  ];
  const tracks = families.flatMap((f,fi) => f.names.map((name,i) => ({id:fi*6+i,name,family:f.name,color:f.color,desc:f.desc,bpm:f.bpm+i*3-6,root:45+[5,0,7,2,3,9][i],scale:f.scale,variant:i,fi,complexity:i%3+1})));
  const defaults = () => ({master:80,melody:80,bass:75,pads:60,drums:85,low:0,mid:0,high:0});
  let saved={}; try{saved=JSON.parse(localStorage.getItem('lest.studio-son')||'{}')}catch{}
  let settings={...defaults(),...saved.settings}, current=tracks.find(t=>t.id===saved.track)||tracks[0], favorites=new Set(Array.isArray(saved.favorites)?saved.favorites:[]), filter='Tout', muted=new Set(), solo=new Set();
  let ctx, bus, compressor, analyser, timer, next=0, step=0, playing=false, noise, epoch=0;
  const channels={},eq={}, labels={melody:'Mélodie / arpège',bass:'Basse',pads:'Nappes',drums:'Percussions'};
  const persist=()=>{try{localStorage.setItem('lest.studio-son',JSON.stringify({settings,track:current.id,favorites:[...favorites]}))}catch{}};
  function initialize(){
    if(ctx)return;
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Audio non pris en charge par ce navigateur.');
    ctx=new AC();bus=ctx.createGain();compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-12;compressor.knee.value=12;compressor.ratio.value=8;compressor.attack.value=.003;compressor.release.value=.18;
    let tail=bus;
    [['low','lowshelf',180],['mid','peaking',1100],['high','highshelf',4200]].forEach(([id,type,hz])=>{const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=hz;f.Q.value=.7;tail.connect(f);tail=f;eq[id]=f});
    tail.connect(compressor);analyser=ctx.createAnalyser();analyser.fftSize=256;compressor.connect(analyser);analyser.connect(ctx.destination);
    for(const id of Object.keys(labels)){channels[id]=ctx.createGain();channels[id].connect(bus)}
    noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const data=noise.getChannelData(0);let seed=187;for(let i=0;i<data.length;i++){seed=(seed*16807)%2147483647;data[i]=seed/1073741824-1}
    apply();
  }
  function apply(){if(!ctx)return;const t=ctx.currentTime;bus.gain.setTargetAtTime(settings.master/100,t,.025);for(const id of Object.keys(labels))channels[id].gain.setTargetAtTime(muted.has(id)||(solo.size&&!solo.has(id))?0:settings[id]/100,t,.025);for(const id of ['low','mid','high'])eq[id].gain.setTargetAtTime(settings[id],t,.025)}
  const hz=m=>440*2**((m-69)/12);
  function note(channel,midi,t,duration,volume,type='triangle',cutoff=2400){
    const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain();o.type=type;o.frequency.value=hz(midi);f.type='lowpass';f.frequency.value=cutoff;
    const attack=channel==='pads'?.35:.012;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+Math.min(attack,duration*.3));g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    o.connect(f);f.connect(g);g.connect(channels[channel]);o.start(t);o.stop(t+duration+.03);o.onended=()=>{o.disconnect();f.disconnect();g.disconnect()};
  }
  function kick(t){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(44,t+.16);g.gain.setValueAtTime(.65,t);g.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(g);g.connect(channels.drums);o.start(t);o.stop(t+.34);o.onended=()=>{o.disconnect();g.disconnect()}}
  function hit(t,snare){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noise;f.type=snare?'bandpass':'highpass';f.frequency.value=snare?1800:6500;f.Q.value=.7;const d=snare?.17:.045;g.gain.setValueAtTime(snare?.48:.2,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f);f.connect(g);g.connect(channels.drums);s.start(t);s.stop(t+d);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect()}}
  function schedule(t,s){
    const a=current,beat=60/a.bpm,bar=Math.floor(s/16),pos=s%16,shift=[0,0,-5,-2][Math.floor(bar/2)%4],root=a.root+shift;
    const patterns=[[0,2,1,4,2,3,1,5],[0,1,2,4,3,2,5,4],[0,2,0,3,1,4,2,5],[0,4,2,1,5,3,2,4],[0,1,3,2,4,5,3,2],[5,3,4,2,3,1,2,0]];
    const pace=a.fi===0?4:a.fi===3?3:a.complexity===1?2:1;
    if(s%pace===0){const index=patterns[a.variant][Math.floor(s/pace)%8];note('melody',root+12+a.scale[index],t,beat*(a.fi===0?3:a.fi===3?1.6:.65),a.fi===2?.17:.22,a.fi===2||a.fi===5?'sawtooth':a.variant%2?'sine':'triangle',a.fi===2?1600:3200);if(a.complexity===3)note('melody',root+12+a.scale[index],t+beat*.75,beat*.65,.06,'sine')}
    if(pos%(a.fi===0?8:4)===0)note('bass',root-12+(pos===12?7:0),t,beat*(a.fi===0?2.8:.8),.32,'triangle',650);
    if(pos===0){[0,a.scale[1],7].forEach((n,i)=>note('pads',root+n,t+i*.035,beat*4.5,.075,a.variant%2?'triangle':'sine',900))}
    const sparse=a.fi===0||a.fi===3;
    if(pos===0||(!sparse&&pos===8)||(a.complexity>1&&!sparse&&pos===11))kick(t);
    if((!sparse&&(pos===4||pos===12))||(sparse&&a.complexity===3&&pos===12))hit(t,true);
    if(pos%(sparse?8:a.complexity===3?1:2)===(sparse?4:0))hit(t,false);
  }
  async function start(track=current){const ticket=++epoch;try{clearInterval(timer);if(ctx){const old=ctx;ctx=null;old.close()}initialize();const active=ctx;await active.resume();if(ticket!==epoch)return;if(active.state!=='running')throw new Error('Cliquez à nouveau sur Écouter pour activer le son.');current=track;playing=true;step=0;next=ctx.currentTime+.06;const pump=()=>{while(next<ctx.currentTime+.12){schedule(next,step++);next+=60/current.bpm/4}};pump();timer=setInterval(pump,25);update();persist()}catch(e){if(ticket===epoch){playing=false;update();$('status').textContent=e.message}}}
  async function stop(){++epoch;playing=false;clearInterval(timer);if(ctx){const old=ctx;ctx=null;await old.close()}update()}
  function update(){$('title').textContent=current.name;$('description').textContent=current.desc;$('category').textContent=`${current.family.toUpperCase()} / ${current.bpm} BPM`;$('play').textContent=playing?'↻ Recommencer':'▶ Écouter';$('status').textContent=playing?'● Lecture en boucle · pistes indépendantes':'■ À l’arrêt';render()}
  function render(){const query=$('search').value.toLocaleLowerCase('fr');const list=tracks.filter(t=>(filter==='Tout'||filter==='Favoris'&&favorites.has(t.id)||t.family===filter)&&`${t.name} ${t.family}`.toLocaleLowerCase('fr').includes(query));$('count').textContent=list.length;$('tracks').replaceChildren();for(const t of list){const card=document.createElement('article');card.className='track'+(t.id===current.id?' selected':'');card.style.setProperty('--stripe',t.color);card.innerHTML=`<div class="stripe"></div><button class="listen" aria-label="Écouter ${t.name}"><span class="eyebrow">${t.family} / ${String(t.id+1).padStart(2,'0')}</span><h3>${t.name}</h3><p>${t.desc}</p><span class="meta"><span>${t.bpm} BPM</span><span>${['Minimal','Intermédiaire','Élaboré'][t.complexity-1]}</span><span>↻ Boucle</span></span></button><button class="favorite" aria-label="Favori : ${t.name}" aria-pressed="${favorites.has(t.id)}">${favorites.has(t.id)?'★':'☆'}</button>`;card.querySelector('.listen').onclick=()=>start(t);card.querySelector('.favorite').onclick=()=>{favorites.has(t.id)?favorites.delete(t.id):favorites.add(t.id);persist();render()};$('tracks').append(card)}if(!list.length)$('tracks').textContent='Aucune ambiance trouvée.'}
  for(const name of ['Tout',...families.map(f=>f.name),'Favoris']){const b=document.createElement('button');b.textContent=name;b.setAttribute('aria-pressed',name===filter);b.onclick=()=>{filter=name;for(const x of $('filters').children)x.setAttribute('aria-pressed',x===b);render()};$('filters').append(b)}
  for(const [id,label] of Object.entries(labels)){const panel=document.createElement('div');panel.className='channel';panel.innerHTML=`<h3>${label}</h3><output id="${id}-value">${settings[id]} %</output><label for="${id}">Niveau</label><input id="${id}" aria-label="Volume ${label}" type="range" min="0" max="100" value="${settings[id]}"><div class="buttons"><button data-mode="mute" aria-label="Couper ${label}" aria-pressed="false">Muet</button><button data-mode="solo" aria-label="Écouter uniquement ${label}" aria-pressed="false">Solo</button></div>`;panel.querySelectorAll('button').forEach(b=>b.onclick=()=>{const set=b.dataset.mode==='solo'?solo:muted;set.has(id)?set.delete(id):set.add(id);b.setAttribute('aria-pressed',set.has(id));apply()});$('channels').append(panel)}
  for(const id of Object.keys(settings)){const input=$(id);if(!input)continue;input.value=settings[id];input.oninput=()=>{settings[id]=Number(input.value);const output=$(id+'-value')||input.nextElementSibling;if(output)output.textContent=settings[id]+(['low','mid','high'].includes(id)?' dB':' %');apply();persist()};input.oninput()}
  $('play').onclick=()=>start();$('stop').onclick=stop;$('search').oninput=render;
  $('reset').onclick=()=>{settings=defaults();muted.clear();solo.clear();document.querySelectorAll('.channel button').forEach(b=>b.setAttribute('aria-pressed',false));for(const id of Object.keys(settings)){$(id).value=settings[id];$(id).oninput()}apply()};
  $('export').onclick=()=>{const blob=new Blob([JSON.stringify({ambiance:current.name,id:current.id,bpm:current.bpm,settings,muted:[...muted],solo:[...solo]},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lest-ambiance.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  function draw(){const canvas=$('scope'),g=canvas.getContext('2d');const width=canvas.clientWidth;if(canvas.width!==width)canvas.width=width;g.clearRect(0,0,width,90);const data=new Uint8Array(128);if(analyser&&playing)analyser.getByteFrequencyData(data);const n=64;for(let i=0;i<n;i++){const h=playing?Math.max(2,data[i]/255*82):2;g.fillStyle=i<12?'#e5ba7c':'#91e2c1';g.globalAlpha=playing?.8:.25;g.fillRect(i*width/n,90-h,width/n-3,h)}requestAnimationFrame(draw)}
  update();draw();window.addEventListener('pagehide',()=>{clearInterval(timer);if(ctx)ctx.close()});
})();
