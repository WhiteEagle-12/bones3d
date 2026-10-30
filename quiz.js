import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
import {TrackballControls} from './trackball.js';

const here=new URL(import.meta.url);
const REGION=here.searchParams.get('r')||'skull';
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
#done .big{font-size:22px;font-weight:700;margin:4px 0 10px}`;
const st=document.createElement('style');st.textContent=css;document.head.append(st);
let app=document.getElementById('app');
if(!app){app=document.createElement('div');app.id='app';document.body.append(app)}
app.innerHTML=`<canvas id="c"></canvas>
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
const meshes={},mats=[];
function makeMat(){
  const m=new THREE.MeshStandardMaterial({color:0xe6dfd0,roughness:.75,metalness:0,side:THREE.DoubleSide});
  m.userData.on={value:1};m.userData.whole={value:0};
  m.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,U,{uOn:m.userData.on,uWhole:m.userData.whole});
    sh.vertexShader='varying vec3 vW;varying vec3 vNW;\n'+sh.vertexShader.replace('#include <project_vertex>',
      '#include <project_vertex>\nvW=(modelMatrix*vec4(transformed,1.0)).xyz;vNW=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader=`varying vec3 vW;varying vec3 vNW;uniform sampler2D uPts;uniform int uN;uniform float uR,uNz,uAlpha,uClip,uOn,uWhole;uniform vec3 uBmin,uBmax,uHL;\n`+
    sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float w=uWhole;
      if(uOn>.5&&uN>0&&all(greaterThan(vW,uBmin))&&all(lessThan(vW,uBmax))){
        float d=1e3;
        for(int i=0;i<${MAXP};i++){if(i>=uN)break;d=min(d,distance(vW,texelFetch(uPts,ivec2(i,0),0).xyz));}
        float k=1.0-smoothstep(uR*.55,uR,d);
        if(uNz>-1.5&&vNW.y<uNz)k=0.0;
        w=max(w,k);
      }
      diffuseColor.rgb=mix(diffuseColor.rgb,uHL,w*.92);
      if(uClip>.5&&!gl_FrontFacing)diffuseColor.rgb=mix(vec3(.55,.42,.36),uHL,w);
      diffuseColor.a=mix(uAlpha,1.0,w);`);
  };
  m.customProgramCacheKey=()=>'hl1';
  mats.push(m);return m;
}

async function gunzip(res){return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}
function buildMeshes(buf){
  const dv=new DataView(buf),hl=dv.getUint32(0,true);
  const metas=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,4,hl)));
  let off=4+hl;const root=new THREE.Group();
  for(const m of metas){
    const q=new Uint16Array(buf,off,m.nv*3);off+=Math.ceil(m.nv*6/4)*4;
    const pos=new Float32Array(m.nv*3);
    for(let i=0;i<m.nv;i++)for(let k=0;k<3;k++)pos[i*3+k]=m.min[k]+q[i*3+k]/65535*(m.max[k]-m.min[k]);
    const isz=m.big?4:2,idx=m.big?new Uint32Array(buf,off,m.ni):new Uint16Array(buf,off,m.ni);off+=Math.ceil(m.ni*isz/4)*4;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setIndex(new THREE.BufferAttribute(idx.slice(),1));
    g.computeVertexNormals();
    const o=new THREE.Mesh(g,makeMat());o.name=m.name;meshes[m.name]=o;root.add(o);
  }
  return root;
}
let D,O;
Promise.all([fetch(BASE+REGION+'.bin.gz').then(r=>{if(!r.ok)throw r.status;return gunzip(r)}),fetch(BASE+REGION+'.json').then(r=>{if(!r.ok)throw r.status;return r.json()})])
  .then(([buf,data])=>{D=data;O=D.o||[0,1.6,0];scene.add(buildMeshes(buf));$('load').remove();start()})
  .catch(e=>{$('load').textContent='The model didn\'t load. Check your connection and reload.';console.error(e)});

const SH=96;
function resize(){sizeApp();const w=app.clientWidth,h=app.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/(h+SH);camera.setViewOffset(w,h+SH,0,SH,w,h);camera.updateProjectionMatrix();controls.handleResize()}
addEventListener('resize',()=>{resize();if(card)frame(card.v)});

let byId,S;
const KEY='bones3d-'+REGION+'-v1';
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
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
function applyHighlight(c){
  if(!c._p)decode(c);
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
$('reset').onclick=()=>card&&resetView();
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
  applyHighlight(card);resetView();
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
$('again').onclick=()=>{S=fresh(S.missed);save();show()};
$('restart').onclick=()=>{S=fresh(D.cards.map(c=>c.id));save();show()};

function start(){
  byId=Object.fromEntries(D.cards.map(c=>[c.id,c]));
  resize();
  try{S=JSON.parse(localStorage.getItem(KEY))}catch(e){}
  if(!S||!S.q||S.q.some(id=>!byId[id]))S=fresh(D.cards.map(c=>c.id));
  show();
  window.__go=id=>{card=byId[id];applyHighlight(card);resetView()};
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera)});
}
