// Static parts of the public site, copied from the original design.
export const PRE = `<div id="prog"></div>
<div id="boot" aria-hidden="true"><pre id="bootText"></pre></div>
<div id="dot" aria-hidden="true"></div>
<div id="tourask" role="dialog" aria-label="Guided tour"><p><strong>New here?</strong> Want a quick guided tour of the site?</p><div><button id="tourYes" type="button">Start tour</button><button id="tourNo" type="button">No thanks</button></div></div>
<div id="guide" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 2l7.5 19 2.7-8 8-2.7z" fill="#fff" stroke="#0b1b2b" stroke-width="1.6" stroke-linejoin="round"/></svg><span id="gtext"></span></div>`;
export const TOP = `<nav aria-label="Main"><div class="piece bar" data-p>
  <a class="logo" href="#top">Arhan<b>.pk</b></a>
  <span class="links"><a href="#skills">Skills</a><a href="#work">Work</a><a href="#services">Services</a><a href="#plans">Plans</a><a href="#contact">Contact</a><a href="/login">Log in</a>
  <button class="icon" id="menuBtn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menuPanel">☰</button><button class="icon" id="theme" type="button" aria-label="Switch light or dark theme">◐</button></span>
 </div><div id="menuPanel"><a href="#skills">Skills</a><a href="#work">Work</a><a href="#services">Services</a><a href="#plans">Plans</a><a href="#contact">Contact</a><a href="/login">Log in</a></div></nav>

 <header class="hero" id="top">
  <div>
   <span class="piece status" data-p><i></i>Open to work</span>
   <h1 class="piece plain" data-p>Syed Arhan Zeeshan</h1>
   <p class="piece plain sub" data-p>Full stack and mobile engineer. I build fast web apps, 3D sites and Flutter apps, and run the servers under them.</p>
   <div class="cta">
    <a class="piece btn primary" data-p href="#work">See my work</a>
    <a class="piece btn" data-p href="https://www.linkedin.com/in/syedarhanzeeshan" target="_blank" rel="noopener">LinkedIn</a>
   </div>
  </div>
  <div class="piece editor" data-p id="editor">
   <div class="dots"><i></i><i></i><i></i><em>arhan.pk/profile.ts</em></div>
<pre><span class="ln"><span class="k">const</span> arhan = {</span>
<span class="ln">  name: <span class="s">"Syed Arhan Zeeshan"</span>,</span>
<span class="ln">  role: <span class="s">"Full Stack &amp; Mobile"</span>,</span>
<span class="ln">  age: <span class="n">17</span>, years: <span class="n">7</span>,</span>
<span class="ln">  stack: [<span class="s">"Next.js"</span>, <span class="s">"Go"</span>,</span>
<span class="ln">    <span class="s">"Flutter"</span>, <span class="s">"Three.js"</span>],</span>
<span class="ln">  db: [<span class="s">"PostgreSQL"</span>, <span class="s">"Prisma"</span>],</span>
<span class="ln">  openToWork: <span class="n">true</span></span>
<span class="ln">};<span class="caret"></span></span></pre>
  </div>
 </header>

 <section id="skills">
  <h2 class="piece plain" data-p style="display:inline-block;padding:2px 10px">Skills</h2>
  <div class="bento">
   <article class="piece card lift c7" data-p><h3>Stack</h3>
    <p class="group">Frontend and 3D</p><ul class="chips"><li>React</li><li>Next.js</li><li>Three.js</li><li>JavaScript</li></ul>
    <p class="group">Backend and data</p><ul class="chips"><li>Node.js</li><li>Express</li><li>Go</li><li>PostgreSQL</li><li>Prisma</li><li>MongoDB</li></ul>
    <p class="group">Mobile</p><ul class="chips" style="margin:0"><li>Flutter</li></ul></article>
   <article class="piece card lift c5" data-p><span class="big">7+</span><h3>Years of code</h3><p class="muted" style="margin:0">Building since I was a kid, now shipping real products for real clients.</p></article>
   <article class="piece card lift c5" id="learning" data-p><h3>Always learning</h3><p class="muted">Recently learned and used:</p><ul class="chips hot" style="margin:0"><li>Three.js</li><li>Flutter</li><li>Go</li><li>Laravel</li></ul></article>
   <article class="piece card lift c7" data-p><h3>Systems</h3><p class="muted">I administer Linux servers, handle hosting and licensing, and connect APIs between systems, so what I build runs reliably in production.</p><ul class="chips" style="margin:0"><li>Linux admin</li><li>Hosting</li><li>Licensing</li><li>API integration</li></ul></article>
  </div>
 </section>

 <section id="lab">
  <h2 class="piece plain" data-p style="display:inline-block;padding:2px 10px">My stack in 3D</h2>
  <div class="piece" id="stage" data-p><canvas id="gl" aria-label="Interactive 3D model of my tech stack"></canvas><p id="hint">Drag to spin. Tap a tech to focus it.</p></div>
 </section>

 <section id="work">
  <h2 class="piece plain" data-p style="display:inline-block;padding:2px 10px">Projects</h2>
  <div class="bento">
   <article class="piece card lift c7" data-p><span class="pill live">Live</span><h3>cctvpits.store</h3>
    <div class="mock"><div class="tb"><i></i><i></i><i></i><span>cctvpits.store</span></div><div class="bd"><b></b><b></b><b></b><b></b></div></div>
    <p class="muted">A CCTV online store with a full checkout flow and an admin dashboard for managing products and orders.</p>
    <ul class="chips" style="margin:0"><li>Checkout</li><li>Admin dashboard</li></ul></article>
   <article class="piece card lift c5" data-p><span class="pill">In progress</span><h3>Builder website</h3>
    <div class="mock builder"><div class="tb"><i></i><i></i><i></i><span>builder</span></div><div class="bd"><b></b><b></b><b></b></div></div>
    <p class="muted">A website builder I’m creating from scratch. Not launched yet.</p>
    <ul class="chips" style="margin:0"><li>Next.js</li><li>Go</li><li>PostgreSQL</li><li>Prisma</li></ul></article>
  </div>
 </section>`;
export const POST = `<section id="contact" class="contact"><div class="piece box" data-p>
  <h2>Let’s build something</h2>
  <p>Got a store, an app or a product idea? Message me on LinkedIn and tell me what you need.</p>
  <a class="piece btn primary" data-p href="https://www.linkedin.com/in/syedarhanzeeshan" target="_blank" rel="noopener">Message me on LinkedIn</a>
 </div></section>
 <footer>Syed Arhan Zeeshan, Punjab, Pakistan. Arhan.pk</footer>`;
export const CTL = `<div id="ctl"><button id="tour" type="button" aria-pressed="false">Auto tour</button><button id="again" type="button">Replay build</button></div>`;
