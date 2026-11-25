// @ts-nocheck
// Original animation script, wrapped so three comes from the npm package.
export function initPortfolio(THREE){
(function(){
var root=document.documentElement,reduce=false;
var pieces=[].slice.call(document.querySelectorAll('[data-p]'));
var $=function(s){return document.querySelector(s)};
var rnd=function(a,b){return a+Math.random()*(b-a)};
var wait=function(ms){return new Promise(function(r){setTimeout(r,ms)})};

try{var t=localStorage.getItem('theme');if(t)root.setAttribute('data-theme',t)}catch(e){}
$('#theme').addEventListener('click',function(){var next=root.getAttribute('data-theme')==='dark'?'light':'dark';root.setAttribute('data-theme',next);try{localStorage.setItem('theme',next)}catch(e){}});

/* scroll progress */
var prog=$('#prog'),tick=false;
addEventListener('scroll',function(){if(tick)return;tick=true;requestAnimationFrame(function(){var m=document.documentElement.scrollHeight-innerHeight;prog.style.transform='scaleX('+(m>0?scrollY/m:0)+')';tick=false})},{passive:true});

/* eased scroll */
var scrollId=0;
function scrollToY(y,dur){var id=++scrollId;y=Math.max(0,y);return new Promise(function(res){
  var s=scrollY,c=y-s,t0=performance.now();
  (function f(t){if(id!==scrollId)return res();var p=Math.min((t-t0)/dur,1),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    scrollTo(0,s+c*e);p<1?requestAnimationFrame(f):res()})(t0)})}
document.addEventListener('click',function(e){var a=e.target.closest('a[href^="#"]');if(!a)return;
  var el=$(a.getAttribute('href'));if(!el)return;e.preventDefault();if(touring){var hid=a.getAttribute('href').slice(1);var k=stops.findIndex(function(s){var n=$(s.sel),an=n&&n.closest('section,header');return an&&an.id===hid});stopTour();startTour(k<0?0:k);return}scrollToY(el.getBoundingClientRect().top+scrollY-70,650)});

/* assembly */
function scatter(el){
 /* keep the scattered start position inside the page, otherwise a piece (like the nav bar at the very top)
    can be thrown where scrolling can never reach it and would never assemble */
 el.style.setProperty('--x','0px');el.style.setProperty('--y','0px');el.style.setProperty('--r','0deg');
 var r=el.getBoundingClientRect(),top=r.top+scrollY,docH=document.documentElement.scrollHeight;
 var y=rnd(-innerHeight*.7,innerHeight*.7);y=Math.max(y,-top);y=Math.min(y,docH-(top+r.height));
 var x=rnd(-innerWidth*.5,innerWidth*.5);x=Math.max(x,-r.left);x=Math.min(x,innerWidth-r.right);
 el.style.setProperty('--x',x+'px');el.style.setProperty('--y',y+'px');el.style.setProperty('--r',rnd(-30,30)+'deg')}
function assemble(el,d){if(el.dataset.done)return;el.dataset.done='1';
  setTimeout(function(){el.classList.add('in');
    setTimeout(function(){el.classList.add('solid');if(el.id==='editor')typeCode()},750);
    setTimeout(function(){el.classList.add('done')},1450)},d)}
var io='IntersectionObserver' in window?new IntersectionObserver(function(es){var n=0;es.forEach(function(e){if(e.isIntersecting){assemble(e.target,n++*100);io.unobserve(e.target)}})},{threshold:.12}):null;
function typeCode(){[].slice.call(document.querySelectorAll('.ln')).forEach(function(l,i){setTimeout(function(){l.classList.add('show')},i*220)})}
var started=false;
function reset(){started=false;pieces.forEach(function(el){el.classList.remove('in','solid','done');delete el.dataset.done;scatter(el)});
  [].forEach.call(document.querySelectorAll('.ln'),function(l){l.classList.remove('show')})}
function run(){reset();pieces.forEach(function(el,i){if(io)io.observe(el);else assemble(el,i*100)});started=true}
/* safety net: assemble any piece whose real (unscattered) place is on screen, even if its scattered position never intersected */
function sweep(){if(!started)return;pieces.forEach(function(el){if(el.dataset.done)return;var r=el.getBoundingClientRect(),y=parseFloat(el.style.getPropertyValue('--y'))||0,x=parseFloat(el.style.getPropertyValue('--x'))||0,t=r.top-y,l=r.left-x;
  if(t<innerHeight*.9&&t+r.height>0&&l<innerWidth&&l+r.width>0){if(io)io.unobserve(el);assemble(el,0)}})}
addEventListener('scroll',sweep,{passive:true});setInterval(sweep,700);

var lines=['git init arhan.pk','scaffolding pieces ...','build <span class="ok">ok</span>'];
function boot(cb){var box=$('#bootText'),b=$('#boot'),i=0;
  (function next(){if(i<lines.length){box.innerHTML=lines.slice(0,i+1).map(function(l){return '$ '+l}).join('\n')+'<span class="caret"></span>';i++;setTimeout(next,360)}
  else setTimeout(function(){b.classList.add('done');cb()},280)})()}

/* guide tour */
var guide=$('#guide'),gtext=$('#gtext'),tourBtn=$('#tour'),tourId=0,touring=false;
var stops=[
 {sel:'.hero h1',text:'Hi, I’m Arhan. Welcome!'},
 {sel:'#editor',text:'My profile, written as code.'},
 {sel:'#skills .card',text:'The tools I use every day.'},
 {sel:'#learning',text:'Always learning something new.'},
 {sel:'#stage',text:'Spin my stack in 3D. Try it!'},
 {sel:'#work .card',text:'Real projects, like this live store.'},
 {sel:'#services .card',text:'What I can build for you.'},
 {sel:'#plans .plan',text:'Simple, fixed prices.'},
 {sel:'#contact .btn',text:'Say hello here!'}];
function point(el,text){var r=el.getBoundingClientRect();
  var x=Math.min(Math.max(r.left+Math.min(r.width*.3,100),8),innerWidth-70),y=Math.min(Math.max(r.top+r.height/2,60),innerHeight-90);
  gtext.textContent=text;guide.style.transform='translate3d('+x+'px,'+y+'px,0)';guide.classList.add('on')}
function stopTour(){tourId++;scrollId++;touring=false;guide.classList.remove('on');tourBtn.textContent='Auto tour';tourBtn.setAttribute('aria-pressed','false')}
function ready(el){var t=Date.now();return new Promise(function(r){(function c(){el.classList.contains('solid')||Date.now()-t>3000?r():requestAnimationFrame(c)})()})}
async function startTour(from){var id=++tourId;touring=true;tourBtn.textContent='Stop tour';tourBtn.setAttribute('aria-pressed','true');
  for(var i=from||0;i<stops.length;i++){
    var el=$(stops[i].sel);if(!el)continue;
    var anc=el.closest('section,header')||el;
    [].slice.call(anc.querySelectorAll('[data-p]')).forEach(function(p,j){assemble(p,j*50)});
    await scrollToY(anc.getBoundingClientRect().top+scrollY-70,600);if(id!==tourId)return;
    await ready(el);if(id!==tourId)return;
    point(el,stops[i].text);await wait(1200);if(id!==tourId)return}
  if(id===tourId)stopTour()}
var ask=$('#tourask');
function closeAsk(){ask.classList.remove('on');try{localStorage.setItem('tourAsked','1')}catch(e){}}
function offerTour(){var seen=false;try{seen=localStorage.getItem('tourAsked')==='1'}catch(e){}if(seen)return;setTimeout(function(){if(!touring)ask.classList.add('on')},1400)}
$('#tourYes').addEventListener('click',function(){closeAsk();startTour()});
$('#tourNo').addEventListener('click',closeAsk);
addEventListener('keydown',function(e){if(e.key==='Escape'&&ask.classList.contains('on'))closeAsk()});
tourBtn.addEventListener('click',function(){closeAsk();if(touring)stopTour();else startTour()});
addEventListener('wheel',function(e){if(touring)e.preventDefault()},{passive:false});
addEventListener('touchmove',function(e){if(touring&&e.cancelable)e.preventDefault()},{passive:false});
addEventListener('keydown',function(e){if(touring&&['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].indexOf(e.key)>-1)e.preventDefault()});
$('#again').addEventListener('click',function(){stopTour();pieces.forEach(function(el){if(io)io.unobserve(el)});scrollTo(0,0);reset();setTimeout(run,300)});

var dot=$('#dot');
if(matchMedia('(pointer:fine)').matches&&!reduce){
  addEventListener('mousemove',function(e){dot.style.opacity=1;dot.style.transform='translate3d('+e.clientX+'px,'+e.clientY+'px,0)';dot.classList.toggle('big',!!e.target.closest('a,button'))},{passive:true})}

function initGL(){
 if(!THREE)return;
 var cv=$('#gl'),st=$('#stage'),hint=$('#hint'),ren;
 try{ren=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){hint.textContent='3D needs WebGL, which is turned off in this browser.';return}
 ren.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(48,1,.1,100),grp=new THREE.Group();cam.position.z=10;scene.add(grp);
 var core=new THREE.Mesh(new THREE.IcosahedronGeometry(1.7,1),new THREE.MeshBasicMaterial({color:0x4cc9ff,wireframe:true}));
 var inner=new THREE.Mesh(new THREE.IcosahedronGeometry(1.15,0),new THREE.MeshBasicMaterial({color:0x2b8fc4,transparent:true,opacity:.6}));
 grp.add(core,inner);
 var N=320,pa=new Float32Array(N*3);
 for(var i=0;i<N;i++){var r=3+Math.random()*4,a=Math.random()*6.283,b=Math.acos(2*Math.random()-1);pa[i*3]=r*Math.sin(b)*Math.cos(a);pa[i*3+1]=r*Math.cos(b);pa[i*3+2]=r*Math.sin(b)*Math.sin(a)}
 var pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pa,3));
 grp.add(new THREE.Points(pg,new THREE.PointsMaterial({color:0x9fe4ff,size:.06})));
 var techs=[['Next.js','web apps and full stack'],['Go','fast backend services'],['Flutter','mobile apps'],['Three.js','3D on the web'],['PostgreSQL','relational database'],['Prisma','database toolkit'],['React','user interfaces'],['Laravel','PHP backend, newly learned'],['Linux','server administration']];
 var sprites=techs.map(function(t,i){
  var c=document.createElement('canvas');c.width=300;c.height=110;var g=c.getContext('2d');
  g.fillStyle='rgba(76,201,255,.96)';g.beginPath();if(g.roundRect)g.roundRect(4,4,292,102,28);else g.rect(4,4,292,102);g.fill();
  g.fillStyle='#04202f';g.font='700 46px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t[0],150,58);
  var s=new THREE.Sprite(new THREE.SpriteMaterial({map:(function(){var tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return tx})(),transparent:true}));
  var an=i/techs.length*6.283;s.position.set(Math.cos(an)*4.4,Math.sin(i*1.7)*1.8,Math.sin(an)*4.4);s.scale.set(2.3,.84,1);s.userData={i:i,base:2.3};grp.add(s);return s});
 var vel=0,ry=0,rx=0,tx=0,drag=false,lx=0,moved=0,sel=-1,ray=new THREE.Raycaster(),m=new THREE.Vector2(),vis=false;
 function pick(e){var r=cv.getBoundingClientRect();m.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(m,cam);var h=ray.intersectObjects(sprites);
  if(h.length){sel=h[0].object.userData.i;hint.textContent=techs[sel][0]+': '+techs[sel][1]}else{sel=-1;hint.textContent='Drag to spin. Tap a tech to focus it.'}}
 cv.addEventListener('pointerdown',function(e){drag=true;lx=e.clientX;moved=0;try{cv.setPointerCapture(e.pointerId)}catch(x){}});
 cv.addEventListener('pointermove',function(e){var r=cv.getBoundingClientRect();tx=((e.clientY-r.top)/r.height-.5)*.6;if(drag){var d=e.clientX-lx;lx=e.clientX;moved+=Math.abs(d);vel+=d*.0006}});
 cv.addEventListener('pointerup',function(e){drag=false;if(moved<6)pick(e)});
 function size(){var w=st.clientWidth,h=st.clientHeight;if(!w||!h)return;ren.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();if(reduce)ren.render(scene,cam)}
 if('ResizeObserver' in window)new ResizeObserver(size).observe(st);else addEventListener('resize',size);
 size();
 function frame(t){if(!vis)return;requestAnimationFrame(frame);
  vel*=.94;ry+=.0035+vel;rx+=(tx-rx)*.06;grp.rotation.y=ry;grp.rotation.x=rx;
  core.rotation.y-=.006;inner.rotation.x+=.008;core.scale.setScalar(1+Math.sin(t*.002)*.05);
  sprites.forEach(function(sp){var k=sp.userData.i===sel?1.35:1,c=sp.scale.x/sp.userData.base;c+=(k-c)*.12;sp.scale.set(sp.userData.base*c,.84*c,1)});
  ren.render(scene,cam)}
 if(reduce)return;
 new IntersectionObserver(function(es){var v=es[0].isIntersecting;if(v&&!vis){vis=true;requestAnimationFrame(frame)}else if(!v)vis=false}).observe(st);
}
var pgIn=$('#pages');if(!pgIn){pgIn={value:0,dataset:{},addEventListener:function(){}};}
function calc(){var n=+pgIn.value,su=+pgIn.dataset.setup||0,pp=+pgIn.dataset.per||0;$('#pcount').textContent=n;$('#cprice').textContent='$'+(su+pp*n)}
pgIn.addEventListener('input',calc);calc();
initGL();

if(reduce){pieces.forEach(function(el){el.classList.add('in','solid','done')});$('#boot').classList.add('done')}
else{pieces.forEach(scatter);boot(function(){run();offerTour()})}
var navEl=$('nav'),mb=$('#menuBtn');
if(mb){var setMenu=function(o){navEl.classList.toggle('open',o);mb.setAttribute('aria-expanded',o?'true':'false');mb.textContent=o?'✕':'☰';if(o)$('#tourask').classList.remove('on')};
 mb.addEventListener('click',function(e){e.stopPropagation();setMenu(!navEl.classList.contains('open'))});
 document.addEventListener('click',function(e){if(navEl.classList.contains('open')&&(!navEl.contains(e.target)||e.target.closest('#menuPanel a')))setMenu(false)});
 addEventListener('keydown',function(e){if(e.key==='Escape')setMenu(false)});
 matchMedia('(min-width:641px)').addEventListener('change',function(m){if(m.matches)setMenu(false)})}
try{navigator.sendBeacon('/api/track',new Blob([JSON.stringify({path:location.pathname,referrer:document.referrer})],{type:'application/json'}))}catch(e){}
})();

}
