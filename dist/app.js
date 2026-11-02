/* Independently implemented from recorded behavior. See evidence/REVISION.md. */
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const nav = document.querySelector('.navigation');
  const menu = document.querySelector('#menu-toggle');
  const links = document.querySelector('#nav-links');
  const hero = document.querySelector('#home');
  let introDone = reduce.matches || !!location.hash;
  function finishIntro() { introDone = true; document.body.classList.remove('intro-running'); }
  if (!introDone) { document.body.classList.add('intro-running'); setTimeout(finishIntro, 2600); }
  const closeMenu = () => { menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');links.classList.remove('open'); };
  menu.addEventListener('click', () => { const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');links.classList.toggle('open',open); });
  links.addEventListener('click',e=>{if(e.target.closest('a')){closeMenu();finishIntro();}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&links.classList.contains('open')){closeMenu();menu.focus();}});
  document.addEventListener('click',e=>{if(!nav.contains(e.target))closeMenu();});
  matchMedia('(min-width:768px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
  document.querySelector('.skip-link').addEventListener('click',finishIntro);
  const rows=[...document.querySelectorAll('.service-row')];
  rows.forEach(row=>row.addEventListener('toggle',()=>{if(row.open)rows.forEach(other=>{if(other!==row)other.open=false;});}));
  rows.forEach(row=>{
    const summary=row.querySelector('summary');
    summary.addEventListener('click',event=>{event.preventDefault();const pin=row.dataset.pinned!=='true';rows.forEach(other=>{other.dataset.pinned='false';other.open=false;});row.dataset.pinned=String(pin);row.open=pin;});
    row.addEventListener('pointerenter',()=>{if(fine.matches){rows.forEach(other=>{if(other!==row&&other.dataset.pinned!=='true')other.open=false;});row.open=true;}});
    row.addEventListener('pointerleave',()=>{if(fine.matches&&row.dataset.pinned!=='true')row.open=false;});
  });
  if ('IntersectionObserver' in window) {
    document.body.classList.add('js-motion');
    const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.08});
    document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
    new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)links.querySelectorAll('a').forEach(a=>{if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}),{rootMargin:'-35% 0px -45% 0px'}).observe(hero);
    const sectionObserver=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting)links.querySelectorAll('a').forEach(a=>{if(a.hash==='#'+e.target.id)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});}),{rootMargin:'-25% 0px -45% 0px'});
    document.querySelectorAll('main>section').forEach(el=>sectionObserver.observe(el));
  }
  document.querySelectorAll('.magnetic').forEach(el=>{
    el.addEventListener('pointermove',e=>{if(!fine.matches||reduce.matches)return;const r=el.getBoundingClientRect();el.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.22}px,${(e.clientY-r.top-r.height/2)*.22}px)`;});
    ['pointerleave','blur'].forEach(name=>el.addEventListener(name,()=>{el.style.transform='';}));
  });
  const video=document.querySelector('#contact-video');
  if(reduce.matches)video.pause();
  if('IntersectionObserver'in window)new IntersectionObserver(([e])=>{if(e.isIntersecting&&!reduce.matches)video.play().catch(()=>{});else video.pause();}).observe(document.querySelector('#contact'));

  // Custom WebGL2 point sprites. The original photo is sampled without altering its pixels.
  const canvas=document.querySelector('#portrait-canvas');
  const fallback=document.querySelector('#hero-fallback');
  const gl=canvas.getContext('webgl2',{alpha:true,antialias:false,premultipliedAlpha:false});
  let requestPortrait=()=>{};
  function useFallback(){canvas.style.display='none';fallback.style.display='block';finishIntro();}
  if(!gl)useFallback();
  else {
    try {
      const vertex=`#version 300 es
      precision highp float;
      in vec2 aHome; in vec3 aColor; in float aSeed;
      uniform vec2 uScreen; uniform vec4 uPhoto; uniform vec2 uPointer;
      uniform float uTime; uniform float uScatter; uniform float uDpr; uniform float uStep;
      out vec3 vColor; out float vSeed; out float vAlpha;
      void main(){
        float delay=aSeed*.65;
        float progress=clamp((uTime-delay)/1.9,0.,1.);
        progress=1.-pow(1.-progress,3.);
        vec2 shape=aHome; float torso=max(0.,shape.y-.65); shape.x=.5+(shape.x-.5)*(1.+torso*1.7); shape.y+=torso*1.15;
        vec2 home=uPhoto.xy+shape*uPhoto.zw;
        float dispersal=(1.-progress)+uScatter;
        vec2 offset=vec2(sin(aSeed*127.1),cos(aSeed*311.7))*vec2(uScreen.x*.85,uScreen.y*.8)*dispersal;
        vec2 delta=home-uPointer;float distance=length(delta);
        float push=max(0.,1.-distance/130.);
        vec2 pos=home+offset+normalize(delta+vec2(.001))*push*push*42.;
        gl_Position=vec4(pos.x/uScreen.x*2.-1.,1.-pos.y/uScreen.y*2.,0.,1.);
        float lum=dot(aColor,vec3(.299,.587,.114));
        gl_PointSize=max(1.,uStep*(.28+lum*.76)*uDpr*(1.+push*.3));
        vColor=aColor;vSeed=aSeed;vAlpha=progress*(1.-uScatter*.85);
      }`;
      const fragment=`#version 300 es
      precision highp float;
      uniform sampler2D uAtlas;uniform float uTexture;
      in vec3 vColor;in float vSeed;in float vAlpha;out vec4 frag;
      void main(){
        if(gl_PointCoord.x<.05||gl_PointCoord.y<.05)discard;
        float idx=floor(vSeed*3.999);vec2 cell=vec2(mod(idx,2.),floor(idx/2.));
        vec3 tex=texture(uAtlas,(cell+vec2(gl_PointCoord.x,1.-gl_PointCoord.y))*.5).rgb;
        float lum=dot(vColor,vec3(.299,.587,.114));
        vec3 photo=mix(vec3(lum),vColor,.2);
        vec3 color=mix(photo,photo*(.45+tex*1.3),uTexture*.52);
        frag=vec4(color*1.30,vAlpha*clamp((lum-.08)*2.2,.08,1.));
      }`;
      const program=gl.createProgram();
      for(const[type,src]of[[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(type);gl.shaderSource(shader,src);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));gl.attachShader(program,shader);}
      gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
      const uniforms=Object.fromEntries(['uScreen','uPhoto','uPointer','uTime','uScatter','uDpr','uStep','uAtlas','uTexture'].map(k=>[k,gl.getUniformLocation(program,k)]));
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.uniform1f(uniforms.uTexture,0);gl.uniform1i(uniforms.uAtlas,0);
      const loadImage=src=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=src;});
      let count=0,width=0,height=0,photoRect=[0,0,0,0],step=4,raf=0,visible=true;
      const pointer={x:-10000,y:-10000,tx:-10000,ty:-10000};
      let start=performance.now()+2300;
      function resize(){width=hero.clientWidth;height=hero.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);gl.viewport(0,0,canvas.width,canvas.height);const mobile=width<768;const ph=height*(mobile?.70:.72),pw=ph*1206/1396;photoRect=[(width-pw)/2,height*(mobile?.37:.10),pw,ph];step=pw/150;gl.uniform2f(uniforms.uScreen,width,height);gl.uniform4fv(uniforms.uPhoto,photoRect);gl.uniform1f(uniforms.uDpr,dpr);gl.uniform1f(uniforms.uStep,step);requestPortrait();}
      function render(now){raf=0;if(!count||!visible||document.hidden)return;gl.useProgram(program);pointer.x+=(pointer.tx-pointer.x)*.18;pointer.y+=(pointer.ty-pointer.y)*.18;const scatter=reduce.matches?0:Math.min(1,scrollY/(height*.7));const time=reduce.matches||location.hash?10:Math.max(0,(now-start)/1000);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(uniforms.uTime,time);gl.uniform1f(uniforms.uScatter,scatter);gl.uniform2f(uniforms.uPointer,pointer.x,pointer.y);gl.drawArrays(gl.POINTS,0,count);canvas.dataset.state=scatter>=1?'gone':scatter>0?'scattering':time<2.55?'gathering':'formed';if(time<2.6||Math.abs(pointer.tx-pointer.x)>.1||Math.abs(pointer.ty-pointer.y)>.1)requestPortrait();}
      requestPortrait=()=>{if(!raf&&visible&&!document.hidden)raf=requestAnimationFrame(render);};
      loadImage('assets/naim-noamane.jpeg').then(image=>{
        const sample=document.createElement('canvas');sample.width=150;sample.height=Math.round(150*image.height/image.width);const ctx=sample.getContext('2d',{willReadFrequently:true});
        // Silhouette follows the supplied photo; the mask is a rendering boundary, not a replacement portrait.
        ctx.save();ctx.scale(sample.width,sample.height);ctx.beginPath();ctx.moveTo(.49,.052);ctx.bezierCurveTo(.70,.035,.78,.17,.775,.32);ctx.bezierCurveTo(.817,.326,.803,.425,.775,.448);ctx.bezierCurveTo(.75,.57,.65,.65,.61,.678);ctx.lineTo(.63,.705);ctx.bezierCurveTo(.73,.75,.92,.79,1,.86);ctx.lineTo(1,1);ctx.lineTo(0,1);ctx.lineTo(0,.85);ctx.bezierCurveTo(.08,.79,.28,.75,.37,.70);ctx.lineTo(.385,.675);ctx.bezierCurveTo(.28,.61,.23,.51,.222,.43);ctx.bezierCurveTo(.18,.41,.17,.33,.22,.325);ctx.bezierCurveTo(.215,.20,.27,.065,.49,.052);ctx.closePath();ctx.restore();ctx.clip();ctx.drawImage(image,0,0,sample.width,sample.height);const pixels=ctx.getImageData(0,0,sample.width,sample.height).data;const home=[],colors=[],seeds=[];
        for(let y=0;y<sample.height;y++)for(let x=0;x<sample.width;x++){const i=(y*sample.width+x)*4;if(pixels[i+3]<128)continue;home.push(x/sample.width,y/sample.height);colors.push(pixels[i]/255,pixels[i+1]/255,pixels[i+2]/255);const n=Math.sin(x*12.9898+y*78.233)*43758.5453;seeds.push(n-Math.floor(n));}
        for(const[name,size,data]of[['aHome',2,home],['aColor',3,colors],['aSeed',1,seeds]]){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,0,0);}count=seeds.length;canvas.dataset.points=String(count);resize();requestPortrait();
      }).catch(useFallback);
      Promise.all(['habitflow-BhEplUHh.jpg','expense-sbI4i9tg.jpg','mindpixel-Bx0qpjdU.jpg','ecommerce-DVISmkX7.jpg'].map(name=>loadImage('assets/reference/'+name))).then(images=>{const atlas=document.createElement('canvas');atlas.width=512;atlas.height=512;const ctx=atlas.getContext('2d');images.forEach((im,i)=>ctx.drawImage(im,(i%2)*256,Math.floor(i/2)*256,256,256));gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,atlas);gl.uniform1f(uniforms.uTexture,1);requestPortrait();}).catch(()=>{});
      hero.addEventListener('pointermove',e=>{if(!fine.matches||reduce.matches)return;const rect=hero.getBoundingClientRect();pointer.tx=e.clientX;pointer.ty=e.clientY-rect.top;if(pointer.x<-999) {pointer.x=pointer.tx;pointer.y=pointer.ty;}requestPortrait();});
      hero.addEventListener('pointerleave',()=>{pointer.x=pointer.y=pointer.tx=pointer.ty=-10000;requestPortrait();});
      new ResizeObserver(resize).observe(hero);
      new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)requestPortrait();else{cancelAnimationFrame(raf);raf=0;}}).observe(hero);
      document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else requestPortrait();});
      canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();useFallback();});
    } catch(error) { console.warn('Portrait fallback:',error.message);useFallback(); }
  }
  let scrollFrame=0;
  function scrollUpdate(){scrollFrame=0;nav.classList.toggle('scrolled',scrollY>24);const max=document.documentElement.scrollHeight-innerHeight;document.querySelector('#scroll-progress').style.transform=`scaleX(${max>0?scrollY/max:0})`;requestPortrait();}
  addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(scrollUpdate);},{passive:true});scrollUpdate();
  reduce.addEventListener('change',()=>{finishIntro();if(reduce.matches)video.pause();requestPortrait();});
})();
