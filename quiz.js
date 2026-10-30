import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
import {TrackballControls} from './trackball.js';

const here=new URL(import.meta.url);
const REGIONS=[['skull','Skull'],['arms','Arms & trunk'],['legs','Pelvis & legs']];
let REGION=here.searchParams.get('r')||'skull';
const BASE=new URL('./',here).href;

const css=`
:root{--bg:#141519;--line:#33363f;--text:#eceef2;--dim:#9aa0ab;--acc:#ff5a3c;--ok:#3ecf8e;--bad:#ff6b6b}
*{box-sizing:border-box}
html,body{margin:0;background:transparent;color:var(--text);font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#app{position:relative;height:560px;overflow:hidden;border-radius:12px;background:var(--bg)}
#c{position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block}
.bar{position:absolute;left:0;right:0;top:0;display:flex;gap:8px;align-items:center;padding:10px;pointer-events:none}
.bar>*{pointer-events:auto}
.count{font-weight:600;font-variant-numeric:tabular-nums;background:rgba(31,33,39,.85);padding:6px 10px;border-radius:999px}
.count:empty{display:none}
.sp{flex:1}
button,select{font:inherit;color:var(--text);background:rgba(31,33,39,.9);border:1px solid var(--line);border-radius:10px;padding:7px 11px;cursor:pointer}
button.on{border-color:var(--acc);color:var(--acc)}
button.primary{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600}
#cutrow{position:absolute;top:54px;right:10px;left:10px;display:none;justify-content:flex-end}
#cutrow input{width:min(320px,100%);accent-color:var(--acc)}
.sheet{position:absolute;left:0;right:0;bottom:0;padding:10px;display:flex;justify-content:center;pointer-events:none}
.card{pointer-events:auto;width:min(560px,100%);background:rgba(31,33,39,.94);border:1px solid var(--line);border-radius:14px;padding:12px}
.row{display:flex;gap:8px}
#ans{flex:1;min-width:0;font:inherit;font-size:16px;color:var(--text);background:#15161a;border:1px solid var(--line);border-radius:10px;padding:9px 11px}
#ans:focus{outline:none;border-color:var(--acc)}
#fb{margin-top:10px;display:none}
#fb .res{font-weight:600}
#fb .res.ok{color:var(--ok)}#fb .res.bad{color:var(--bad)}
#fb .n{color:var(--dim);margin-top:4px;font-size:14px}
#fb .row{margin-top:10px;justify-content:flex-end}
.credit{color:var(--dim);font-size:11px;margin-top:8px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.credit a{color:var(--dim)}
#load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dim);padding:20px;text-align:center}
#done{display:none;text-align:center}
#done .big{font-size:22px;font-weight:700;margin:4px 0 10px}
#tabs{display:flex;gap:4px;padding:4px;margin-bottom:8px;background:#1f2127;border:1px solid var(--line);border-radius:12px}
#tabs button{flex:1;border:0;background:transparent;color:var(--dim);border-radius:9px;padding:9px 6px}
#tabs button.cur{background:#33363f;color:var(--text);font-weight:600}
#ov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
let app=document.getElementById('app');
if(!app){app=document.createElement('div');app.id='app';document.body.append(app)}
const tabs=document.createElement('div');tabs.id='tabs';app.before(tabs);
for(const [k,l] of REGIONS){const b=document.createElement('button');b.type='button';b.textContent=l;b.dataset.r=k;b.onclick=()=>switchRegion(k);tabs.append(b)}
app.innerHTML=`<canvas id="c"></canvas>
<svg id="ov"><g id="pin" style="display:none"><circle id="ring" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="6"/><circle id="ring2" fill="none" stroke="#2ad4ff" stroke-width="3"/><line id="shaft" stroke="#000" stroke-opacity=".55" stroke-width="8" stroke-linecap="round"/><line id="shaft2" stroke="#2ad4ff" stroke-width="4" stroke-linecap="round"/><path id="head" fill="#2ad4ff" stroke="#000" stroke-opacity=".55" stroke-width="2"/></g></svg>
<div id="load">Loading…</div>
<div class="bar">
  <span class="count" id="count"></span><span class="sp"></span>
  <button id="reset">Reset</button>
  <button id="xray">X-ray</button>
  <select id="cut" aria-label="Cut"><option value="none">No cut</option><option value="sag">Sagittal</option><option value="cor">Coronal</option><option value="tra">Transverse</option></select>
</div>
<div id="cutrow"><input id="cutpos" type="range" min="-1" max="1" step="0.0005" aria-label="Cut position"></div>
<div class="sheet"><div class="card">
  <div id="quiz">
    <form class="row" id="form" autocomplete="off">
      <input id="ans" placeholder="Name the highlighted part" autocapitalize="off" spellcheck="false">
      <button type="submit" class="primary" id="check">Check</button>
      <button type="button" id="show">Show</button>
    </form>
    <div id="fb"><div class="res" id="res"></div><div class="n" id="notes"></div><div class="row"><button class="primary" id="next">Next</button></div></div>
  </div>
  <div id="done"><div class="big" id="score"></div>
    <div class="row" style="justify-content:center"><button class="primary" id="again">Redo missed</button><button id="restart">Start over</button></div>
  </div>
  <div class="credit">Model: <a href="https://www.z-anatomy.com" target="_blank" rel="noopener">Z-Anatomy</a>, BodyParts3D © DBCLS · CC BY-SA</div>
</div></div>`;

const $=id=>document.getElementById(id);
function sizeApp(){
  const w=app.clientWidth||innerWidth,sh=(screen&&screen.availHeight)||900;
  app.style.height=Math.round(Math.max(480,Math.min(w*1.35,sh-200)))+'px';
}
sizeApp();

const canvas=$('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.localClippingEnabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x141519);
const camera=new THREE.PerspectiveCamera(30,1,0.002,20);
scene.add(new THREE.HemisphereLight(0xffffff,0x444450,1.6));
const head=new THREE.DirectionalLight(0xffffff,1.8);camera.add(head);head.position.set(0.3,0.5,1);scene.add(camera);
const controls=new TrackballControls(camera,canvas);
controls.rotateSpeed=3;controls.zoomSpeed=1.4;controls.panSpeed=0.6;controls.dynamicDampingFactor=0.18;
controls.minDistance=0.01;controls.maxDistance=4;

const MAXP=200;
const ptsData=new Float32Array(MAXP*4);
const ptsTex=new THREE.DataTexture(ptsData,MAXP,1,THREE.RGBAFormat,THREE.FloatType);
ptsTex.minFilter=ptsTex.magFilter=THREE.NearestFilter;ptsTex.needsUpdate=true;
const plane=new THREE.Plane(new THREE.Vector3(1,0,0),0);
const U={uPts:{value:ptsTex},uN:{value:0},uR:{value:.004},uNz:{value:-2},uBmin:{value:new THREE.Vector3()},uBmax:{value:new THREE.Vector3()},
  uAlpha:{value:1},uClip:{value:0},uHL:{value:new THREE.Color(0xff4a2a)}};
let meshes={};const mats=[];
function makeMat(){
  const m=new THREE.MeshStandardMaterial({color:0xe6dfd0,roughness:.75,metalness:0,side:THREE.DoubleSide});
  m.userData.on={value:1};m.userData.whole={value:0};
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,U,{uOn:m.userData.on,uWhole:m.userData.whole});
    sh.vertexShader='attribute float aHL;varying float vHL;varying vec3 vW;varying vec3 vNW;\n'+sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvHL=aHL;vW=(modelMatrix*vec4(transformed,1.0)).xyz;vNW=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=`varying float vHL;varying vec3 vW;varying vec3 vNW;uniform sampler2D uPts;uniform int uN;uniform float uR,uNz,uAlpha,uClip,uOn,uWhole;uniform vec3 uBmin,uBmax,uHL;\n`+
    sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float w=uWhole,rim=0.0;
      if(uOn>.5&&uN>0&&all(greaterThan(vW,uBmin))&&all(lessThan(vW,uBmax))){
        float d=1e3;
        for(int i=0;i<${MAXP};i++){if(i>=uN)break;d=min(d,distance(vW,texelFetch(uPts,ivec2(i,0),0).xyz));}
        float k=1.0-smoothstep(uR*.9,uR,d);
        if(uNz>-1.5&&vNW.y<uNz)k=0.0;
        w=max(w,k);
        rim=k*smoothstep(uR*.72,uR*.86,d);
      }
      w=max(w,smoothstep(.3,.5,vHL));rim=max(rim,smoothstep(.3,.45,vHL)*(1.0-smoothstep(.55,.75,vHL)));
      diffuseColor.rgb=mix(diffuseColor.rgb,uHL,w*.95);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.35,.04,0.),rim);
      if(uClip>.5&&!gl_FrontFacing)diffuseColor.rgb=mix(vec3(.55,.42,.36),uHL,w);
      diffuseColor.a=mix(uAlpha,1.0,w);`);
  };
  m.customProgramCacheKey=()=>'hl3';
  mats.push(m);return m;
}

async function gunzip(res){return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}
function buildMeshes(buf){const meshes={};
  const dv=new DataView(buf),hl=dv.getUint32(0,true);
  const metas=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl)));
  let off=4+hl;const root=new THREE.Group();
  for(const m of metas){
    const q=new Uint16Array(buf,off,m.nv*3);off+=Math.ceil(m.nv*6/4)*4;
    const pos=new Float32Array(m.nv*3);
    for(let i=0;i<m.nv;i++)for(let k=0;k<3;k++)pos[i*3+k]=m.min[k]+q[i*3+k]/65535*(m.max[k]-m.min[k]);
    const isz=m.big?4:2,idx=m.big?new Uint32Array(buf,off,m.ni):new Uint16Array(buf,off,m.ni);off+=Math.ceil(m.ni*isz/4)*4;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(idx.slice(),1));
    g.computeVertexNormals();g.setAttribute('aHL',new THREE.BufferAttribute(new Float32Array(m.nv),1));
    const o=new THREE.Mesh(g,makeMat());o.name=m.name;meshes[m.name]=o;root.add(o);
  }
  return {root,meshes};
}
let D,O,R={};
const ST=(()=>{
  let a=null;
  try{if(window.name.startsWith('bones3d:'))a=JSON.parse(window.name.slice(8))}catch(e){}
  try{const l=JSON.parse(localStorage.getItem('bones3d-v2'));if(l&&(!a||l.ts>a.ts))a=l}catch(e){}
  return a&&a.r?a:{ts:0,r:{}};
})();
function save(){
  ST.ts=Date.now();ST.cur=REGION;const j=JSON.stringify(ST);
  window.name='bones3d:'+j;
  try{localStorage.setItem('bones3d-v2',j)}catch(e){}
  const msg={type:'muster:html-state',key:'bones3d',state:ST};
  try{parent.postMessage(msg,'*')}catch(e){}
  try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(msg))}catch(e){}
}
addEventListener('message',e=>{
  let m=e.data;if(typeof m==='string')try{m=JSON.parse(m)}catch(x){return}
  if(!m||m.type!=='muster:html-state'||!m.state||!m.state.r||m.state.ts<=ST.ts)return;
  Object.assign(ST,m.state);
  for(const k in R)if(R[k].D)R[k].S=valid(ST.r[k],R[k]);
  if(ST.cur&&ST.cur!==REGION)switchRegion(ST.cur);else if(R[REGION]&&R[REGION].D){S=R[REGION].S;show()}
});
function valid(s,g){return s&&s.q&&!s.q.some(id=>!g.byId[id])?s:null}
function loadRegion(k){
  if(R[k])return R[k].p;
  const g=R[k]={};
  g.p=Promise.all([fetch(BASE+k+'.bin.gz').then(r=>{if(!r.ok)throw r.status;return gunzip(r)}),fetch(BASE+k+'.json').then(r=>{if(!r.ok)throw r.status;return r.json()})])
    .then(([buf,data])=>{g.D=data;g.O=data.o||[0,1.6,0];Object.assign(g,buildMeshes(buf));g.byId=Object.fromEntries(data.cards.map(c=>[c.id,c]));scene.add(g.root);g.root.visible=false;g.S=valid(ST.r[k],g);return g});
  g.p.catch(()=>{delete R[k]});
  return g.p;
}
function switchRegion(k){
  REGION=k;for(const b of tabs.children)b.classList.toggle('cur',b.dataset.r===k);
  const ld=$('load');ld.textContent='Loading…';ld.style.display='flex';$('pin').style.display='none';card=null;
  loadRegion(k).then(g=>{
    if(REGION!==k)return;
    for(const x of Object.values(R))if(x.root)x.root.visible=x===g;
    D=g.D;O=g.O;meshes=g.meshes;byId=g.byId;
    if(!g.S)g.S=fresh(D.cards.map(c=>c.id));
    S=g.S;ST.r[k]=S;ld.style.display='none';
    resize();show();save();
  }).catch(e=>{if(REGION===k)ld.textContent='The model didn\'t load. Check your connection and tap the tab again.';console.error(e)});
}

const SH=96;
function resize(){sizeApp();const w=app.clientWidth,h=app.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/(h+SH);camera.setViewOffset(w,h+SH,0,SH,w,h);camera.updateProjectionMatrix();controls.handleResize()}
addEventListener('resize',()=>{resize();if(card)frame(card.v)});

let byId,S;
function fresh(ids){
  const first=(D.first||[]).filter(i=>ids.includes(i)),rest=ids.filter(i=>!first.includes(i));
  for(let i=rest.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rest[i],rest[j]]=[rest[j],rest[i]]}
  return {q:[...first,...rest],i:0,right:[],missed:[],total:ids.length};
}
let card,xray=false,answered=false;
function b64buf(s){const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer}
function decode(c){
  if(!c.p){c._p=[];return}
  const dv=new DataView(b64buf(c.p)),n=dv.byteLength/6,a=[];
  for(let i=0;i<n;i++)a.push([dv.getInt16(i*6,true)/1e4+O[0],dv.getInt16(i*6+2,true)/1e4+O[1],dv.getInt16(i*6+4,true)/1e4+O[2]]);
  c._p=a;
}
let masked=[];
function applyHighlight(c){
  if(!c._p)decode(c);
  for(const a of masked){a.array.fill(0);a.needsUpdate=true}masked=[];c._mv=[];
  for(const [name,b64] of Object.entries(c.m||{})){
    const o=meshes[name];if(!o)continue;const a=o.geometry.attributes.aHL,bits=new Uint8Array(b64buf(b64)),pos=o.geometry.attributes.position;
    for(let i=0;i<a.count;i++)if(bits[i>>3]>>(i&7)&1){a.array[i]=1;c._mv.push([pos.getX(i),pos.getY(i),pos.getZ(i)])}
    a.needsUpdate=true;masked.push(a);
  }
  const p=c._p,n=Math.min(p.length,MAXP);U.uN.value=n;
  const mn=new THREE.Vector3(1e3,1e3,1e3),mx=new THREE.Vector3(-1e3,-1e3,-1e3);
  for(let i=0;i<n;i++){ptsData.set([p[i][0],p[i][1],p[i][2],0],i*4);mn.min(new THREE.Vector3(...p[i]));mx.max(new THREE.Vector3(...p[i]))}
  ptsTex.needsUpdate=true;
  const r=c.r||.004;U.uR.value=r;U.uBmin.value.copy(mn).subScalar(r);U.uBmax.value.copy(mx).addScalar(r);
  U.uNz.value=c.nz??-2;
  for(const [name,m] of Object.entries(meshes)){
    m.material.userData.on.value=!c.on||c.on.includes(name)?1:0;
    m.material.userData.whole.value=c.whole&&c.whole.includes(name)?1:0;
  }
}
function setXray(on){
  xray=on;$('xray').classList.toggle('on',on);
  U.uAlpha.value=on?.14:1;
  for(const m of mats){m.transparent=on;m.depthWrite=!on;m.needsUpdate=true}
  for(const o of Object.values(meshes)){const w=o.material.userData.whole.value>0;o.renderOrder=w?1:0;if(w&&on){o.material.transparent=false;o.material.depthWrite=true}}
}
function setVisible(v){for(const [name,o] of Object.entries(meshes))o.visible=v.show?v.show.includes(name):v.only?name===v.only:!(v.hide||[]).includes(name)}
const AX={sag:[1,0,0],cor:[0,0,1],tra:[0,1,0]};
function setCut(mode,n,s){
  $('cut').value=mode;
  if(mode==='none'){for(const m of mats)m.clippingPlanes=[];U.uClip.value=0;$('cutrow').style.display='none';return}
  plane.normal.set(...n).normalize();
  const box=new THREE.Box3();for(const o of Object.values(meshes))if(o.visible)box.expandByObject(o);
  let lo=1e9,hi=-1e9;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const d=plane.normal.dot(new THREE.Vector3(x,y,z));lo=Math.min(lo,d);hi=Math.max(hi,d)}
  const sl=$('cutpos');sl.min=lo;sl.max=hi;sl.value=s;plane.constant=-s;
  for(const m of mats)m.clippingPlanes=[plane];U.uClip.value=1;$('cutrow').style.display='flex';
}
$('cutpos').addEventListener('input',e=>{plane.constant=-parseFloat(e.target.value)});
$('cut').addEventListener('change',e=>{
  const mode=e.target.value;if(mode==='none')return setCut('none');
  const a=new THREE.Vector3(...AX[mode]),look=controls.target.clone().sub(camera.position);
  if(a.dot(look)<0)a.negate();
  setCut(mode,a.toArray(),a.dot(controls.target));
});
function guessMode(n){const a=n.map(Math.abs);return a[0]>.9?'sag':a[2]>.9?'cor':a[1]>.9?'tra':'sag'}
function frame(v){
  const t=new THREE.Vector3(...v.t),d=new THREE.Vector3(...v.d).normalize();
  const h=app.clientHeight,fit=Math.min(1,camera.aspect,(h-SH)/(h+SH)),dist=v.s*0.5/Math.tan(THREE.MathUtils.degToRad(15))/fit*1.08;
  camera.up.set(...v.up);camera.position.copy(t).addScaledVector(d,-dist);controls.target.copy(t);camera.lookAt(t);controls.update();
}
function resetView(){
  const v=card.v;setVisible(v);frame(v);
  if(v.clip)setCut(guessMode(v.clip.n),v.clip.n,-v.clip.w);else setCut('none');
  setXray(!!card.x);
}
$('reset').onclick=()=>{if(card){resetView();setAnchor(card)}};
$('xray').onclick=()=>setXray(!xray);

function stem(w){if(w==='foramina')return 'foramen';if(w.length<4)return w;if(/ae$/.test(w))return w.slice(0,-1);if(/(s|x|ch|sh)es$/.test(w))return w.slice(0,-2);if(/s$/.test(w)&&!/(ss|us)$/.test(w))return w.slice(0,-1);return w}
function norm(s){return s.toLowerCase().replace(/[’']/g,'').replace(/\b(the|of|bone|bones)\b/g,' ').replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).map(stem).join(' ')}
function lev(a,b){const m=a.length,n=b.length,d=Array.from({length:m+1},(_,i)=>[i]);for(let j=1;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function grade(input,c){
  const x=norm(input);if(!x)return 0;
  const all=[c.a,...c.alts].map(norm);
  if(all.includes(x))return 2;
  if(all.some(a=>lev(a,x)<=Math.max(1,Math.floor(a.length/7))))return 1;
  return 0;
}
function show(){
  if(S.i>=S.q.length){
    $('quiz').style.display='none';$('done').style.display='block';
    $('score').textContent=`${S.right.length} of ${S.total} right first try`;
    $('again').style.display=S.missed.length?'':'none';$('count').textContent='Done';return;
  }
  $('quiz').style.display='';$('done').style.display='none';
  card=byId[S.q[S.i]];answered=false;
  $('count').textContent=`${Math.min(S.right.length+S.missed.length+1,S.total)} / ${S.total}`;
  $('ans').value='';$('ans').disabled=false;$('fb').style.display='none';$('check').style.display='';$('show').style.display='';
  applyHighlight(card);resetView();setAnchor(card);
}
function finish(kind,input){
  answered=true;
  const first=!S.right.includes(card.id)&&!S.missed.includes(card.id);
  if(kind>0){if(first)S.right.push(card.id)}
  else{if(first)S.missed.push(card.id);S.q.splice(Math.min(S.i+4,S.q.length),0,card.id)}
  const res=$('res');
  res.className='res '+(kind>0?'ok':'bad');
  res.textContent=kind===2?`✓ ${card.a}`:kind===1?`✓ ${card.a} (check the spelling)`:input?`✗ ${card.a}`:card.a;
  const notes=[...card.n];if(card.alts.length)notes.unshift('Also: '+card.alts.join(', '));
  $('notes').innerHTML='';for(const t of notes){const d=document.createElement('div');d.textContent=t;$('notes').append(d)}
  $('fb').style.display='block';$('check').style.display='none';$('show').style.display='none';$('ans').disabled=true;
  S.i++;save();$('next').focus();
}
$('form').addEventListener('submit',e=>{e.preventDefault();if(!card)return;if(answered)return show();const v=$('ans').value;if(!v.trim())return;finish(grade(v,card),v)});
$('show').onclick=()=>card&&!answered&&finish(0,'');
$('next').onclick=show;
$('again').onclick=()=>{S=R[REGION].S=ST.r[REGION]=fresh(S.missed);save();show()};
$('restart').onclick=()=>{S=R[REGION].S=ST.r[REGION]=fresh(D.cards.map(c=>c.id));save();show()};

const V3=new THREE.Vector3(),V4=new THREE.Vector3();let anchor=null,anchorR=0,ring=false;
function setAnchor(c){
  anchor=null;ring=false;
  if(c._mv&&c._mv.length){
    let v=c._mv;if(v.some(q=>q[0]>.005)&&v.some(q=>q[0]<-.005))v=v.filter(q=>q[0]>0);
    const ctr=new THREE.Vector3();for(const q of v)ctr.add(V4.set(...q));ctr.divideScalar(v.length);
    let sz=0;for(const q of v)sz=Math.max(sz,V4.set(...q).distanceTo(ctr));
    const aim=ctr.clone().addScaledVector(camera.position.clone().sub(ctr).normalize(),sz*2);
    let bi=0,bd=1e9;for(let i=0;i<v.length;i++){V4.set(...v[i]);const d=V4.distanceTo(ctr)+V4.distanceTo(aim);if(d<bd){bd=d;bi=i}}
    anchor=new THREE.Vector3(...v[bi]);anchorR=.004;
  }else if(c._p&&c._p.length){
    const p=c._p;let best=0,bd=1e9;
    if(p.length>2)for(let i=0;i<p.length;i++){let t=0;for(let j=0;j<p.length;j+=Math.ceil(p.length/40))t+=Math.hypot(p[i][0]-p[j][0],p[i][1]-p[j][1],p[i][2]-p[j][2]);if(t<bd){bd=t;best=i}}
    anchor=new THREE.Vector3(...p[best]);anchorR=c.r||.004;ring=p.length<=2&&(c.r||.004)<=.0045;
  }else if(c.whole){
    const ms=c.whole.map(n=>meshes[n]).filter(o=>o&&o.visible);if(!ms.length)return;
    let o=ms[0],dn=1e9;
    for(const m of ms){m.geometry.computeBoundingBox();m.geometry.boundingBox.getCenter(V3);const d=V3.distanceTo(camera.position);if(d<dn){dn=d;o=m}}
    const box=o.geometry.boundingBox,ctr=box.getCenter(new THREE.Vector3()),pos=o.geometry.attributes.position;
    let bi=0,bd=1e9;
    const toCam=camera.position.clone().sub(ctr).normalize(),aim=ctr.clone().addScaledVector(toCam,box.getSize(V4).length());
    for(let i=0;i<pos.count;i+=Math.max(1,Math.floor(pos.count/4000))){V3.fromBufferAttribute(pos,i);const d=V3.distanceTo(ctr)*.4+V3.distanceTo(aim);if(d<bd){bd=d;bi=i}}
    anchor=V3.fromBufferAttribute(pos,bi).clone();anchorR=box.getSize(V4).length()/2;
  }
}
function drawPin(){
  const g=$('pin');
  if(!anchor||!card){g.style.display='none';return}
  const w=app.clientWidth,h=app.clientHeight;
  const ndc=anchor.clone().project(camera);
  if(ndc.z>1||ndc.z<-1){g.style.display='none';return}
  const x=(ndc.x+1)/2*w,y=(1-ndc.y)/2*h;
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const e=anchor.clone().addScaledVector(right,anchorR).project(camera),rp=Math.hypot((e.x-ndc.x)/2*w,(e.y-ndc.y)/2*h);
  if(card.whole&&rp>Math.min(w,h)*.12){g.style.display='none';return}
  g.style.display='';
  const rr=ring?Math.max(12,rp*1.25+4):0;
  for(const id of ['ring','ring2']){const c=$(id);c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',rr);c.style.display=ring?'':'none'}
  let dx=x-w/2,dy=y-(h-SH)/2,dl=Math.hypot(dx,dy);
  if(dl<20){dx=-1;dy=-1;dl=Math.SQRT2}
  dx/=dl;dy/=dl;
  const gap=ring?rr+3:3,L=Math.min(110,Math.max(60,Math.min(w,h)*.14));
  let tx=x+dx*gap,ty=y+dy*gap,sx=x+dx*(gap+L),sy=y+dy*(gap+L);
  const top=60,bot=h-SH-20;
  if(sy<top||sy>bot||sx<12||sx>w-12){dx=-dx;dy=-dy;tx=x+dx*gap;ty=y+dy*gap;sx=x+dx*(gap+L);sy=y+dy*(gap+L)}
  const hx=tx+dx*14,hy=ty+dy*14,px=-dy*8,py=dx*8;
  for(const id of ['shaft','shaft2']){const l=$(id);l.setAttribute('x1',sx);l.setAttribute('y1',sy);l.setAttribute('x2',hx);l.setAttribute('y2',hy)}
  $('head').setAttribute('d',`M${tx},${ty}L${hx+px},${hy+py}L${hx-px},${hy-py}Z`);
}
let started=false;
function start(){
  if(started)return;started=true;
  window.__go=id=>{card=byId[id];applyHighlight(card);resetView();setAnchor(card)};
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);drawPin()});
}
switchRegion(ST.cur&&REGIONS.some(r=>r[0]===ST.cur)&&!here.searchParams.get('r')?ST.cur:REGION);
start();
