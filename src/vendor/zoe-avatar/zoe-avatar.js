/* Zoe — isolated arm rig, original raster art.
 * Body is a fixed PNG, with only the originally occluded attachment reconstructed.
 * Full-color arm PNG rotates around its shoulder; no mask is drawn as a texture.
 * Gaze is unchanged: black eyes fixed, white dots original size, movement .25.
 * No floating, full-body deformation or third-party dependencies.
 */
(function(global){
'use strict';
const STATES=Object.freeze(['idle','listening','thinking','speaking','happy','wave']);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
const image=src=>new Promise((resolve,reject)=>{
 const im=new Image();im.onload=()=>resolve(im);
 im.onerror=()=>reject(new Error('Não foi possível carregar uma camada da Zoe.'));
 im.src=src;
});
function blinkPhase(age){
 if(age<0||age>.245)return 1;
 if(age<.085)return 1-.94*smooth(age/.085);
 if(age<.12)return .06;
 return .06+.94*smooth((age-.12)/.125);
}

class ZoeAvatar{
 static async create(canvas,options={}){
  let assets=options.assets;
  if(!assets){
   const url=new URL(options.assetsUrl||'assets/manifest.json',location.href);
   const response=await fetch(url);if(!response.ok)throw new Error('Arquivos da Zoe indisponíveis.');
   assets=await response.json();const root=new URL('.',url);
   for(const pose of Object.values(assets.poses))for(const l of pose.layers){
    l.src=new URL(l.src,root).href;
    if(l.gaze)l.gaze.src=new URL(l.gaze.src,root).href;
   }
  }
  const avatar=new ZoeAvatar(canvas,options);
  for(const [name,pose]of Object.entries(assets.poses)){
   const layers=await Promise.all(pose.layers.map(async(l)=>{
    const layer={...l,image:await image(l.src)};
    if(l.gaze&&!pose.closedEyes){
     layer.gaze={...l.gaze,image:await image(l.gaze.src)};
     layer.dotPosition=l.gaze.rest.slice();
     layer.surface=document.createElement('canvas');
     [layer.surface.width,layer.surface.height]=l.gaze.sourceSize;
     layer.surfaceContext=layer.surface.getContext('2d',{alpha:true});
     layer.gaze.moveScale=.25;
     layer.gaze.dotScale=1;
    }
    return layer;
   }));
   avatar.poses[name]={...pose,layers};
  }
  avatar.setState(options.state||'idle');avatar.renderAt(0);
  if(options.autoplay!==false)avatar.play();
  return avatar;
 }
 constructor(canvas,options={}){
  if(!(canvas instanceof HTMLCanvasElement))throw new TypeError('Informe um elemento canvas.');
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:true});
  if(!this.ctx)throw new Error('Canvas 2D indisponível.');
  this.options=options;this.poses={};this.state='idle';this.time=0;this.waveStart=0;
  this.running=false;this.destroyed=false;this.onscreen=true;
  this.gazeMode='rest';this.look=[0,0];this.pointer=[.5,.4];
  this.autoBlink=true;this.eyesClosed=false;this.manualBlink=-Infinity;
  this.audioLevel=null;this.motion=!matchMedia('(prefers-reduced-motion: reduce)').matches;
  this._resizeObserver=new ResizeObserver(()=>{if(!options.fixedSize)this.resize();});
  this._resizeObserver.observe(canvas);
  if(global.IntersectionObserver){
   this._intersectionObserver=new IntersectionObserver(e=>{this.onscreen=e[0].isIntersecting;});
   this._intersectionObserver.observe(canvas);
  }
  this.resize();
 }
 resize(w,h){
  const r=this.canvas.getBoundingClientRect(),dpr=Math.min(global.devicePixelRatio||1,2);
  this.canvas.width=w||Math.max(1,Math.round((r.width||512)*dpr));
  this.canvas.height=h||Math.max(1,Math.round((r.height||512)*dpr));
  this.size=Math.min(this.canvas.width,this.canvas.height);
  this.offset=[(this.canvas.width-this.size)/2,(this.canvas.height-this.size)/2];
  if(this.poses[this.state])this.renderAt(this.time);
  return this;
 }
 setState(state){
  if(!STATES.includes(state))throw new RangeError('Estado inválido: '+state);
  this.state=state;
  if(state==='wave')this.waveStart=this.time;
  // A closed-eye pose has no white-dot layer and never receives tracking.
  this.renderAt(this.time);
  this.canvas.dispatchEvent(new CustomEvent('zoe-statechange',{detail:{state,staticWave:false,articulatedArm:state==='wave'}}));
  return this;
 }
 setLookAt(x,y){
  this.gazeMode='direction';this.look=[clamp(Number(x)||0,-1,1),clamp(Number(y)||0,-1,1)];
  if(!this.running)this.renderAt(this.time,{look:this.look});
  return this;
 }
 lookAtClient(x,y){
  if(!Number.isFinite(x)||!Number.isFinite(y))return this;
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return this;
  this.gazeMode='pointer';
  this.pointer=[((x-r.left)/r.width*this.canvas.width-this.offset[0])/this.size,
                ((y-r.top)/r.height*this.canvas.height-this.offset[1])/this.size];
  if(!this.running){this._updateDots(.2);this.renderAt(this.time);}
  return this;
 }
 resetLook(){this.gazeMode='rest';return this;}
 setEyesClosed(value){this.eyesClosed=!!value;this.renderAt(this.time);return this;}
 setAutoBlink(value){this.autoBlink=!!value;return this;}
 blink(){this.manualBlink=this.time;return this;}
 setAudioLevel(value){this.audioLevel=value==null?null:clamp(Number(value)||0,0,1);return this;}
 setMotionEnabled(enabled){this.motion=!!enabled;this.renderAt(this.time);return this;}
 _openness(t,pose,options={}){
  if(pose.closedEyes||this.eyesClosed)return 0;
  if(Number.isFinite(options.blink))return clamp(options.blink,0,1);
  if(!this.motion)return 1;
  const manual=blinkPhase(t-this.manualBlink);
  const automatic=this.autoBlink?blinkPhase(((t%5.3)+5.3)%5.3-3.6):1;
  return Math.min(manual,automatic);
 }
 _targetDot(layer,direction){
  const g=layer.gaze;
  if(!direction&&this.gazeMode==='rest')return g.rest.slice();
  const c=Math.cos(g.rotation),s=Math.sin(g.rotation);
  let dx,dy,strength;
  if(direction||this.gazeMode==='direction'){
   const v=direction||this.look;[dx,dy]=v;
   strength=Math.min(1,Math.hypot(dx,dy));
  }else{
   const [x0,y0,x1,y1]=layer.bbox;
   const [sw,sh]=g.sourceSize;
   const cx=x0+(x1-x0)*g.eyeCenter[0]/sw,cy=y0+(y1-y0)*g.eyeCenter[1]/sh;
   dx=this.pointer[0]-cx;dy=this.pointer[1]-cy;
   strength=Math.min(1,Math.hypot(dx,dy)/.23);
  }
  // Convert the screen direction to the eye's local axes. Safe elliptical bounds
  // keep the whole white dot inside the original black eye in every direction.
  const lx=c*dx+s*dy,ly=-s*dx+c*dy,len=Math.hypot(lx,ly);
  if(len<1e-9)return g.eyeCenter.slice();
  const ex=lx/len*g.radii[0]*(g.moveScale||1)*strength,ey=ly/len*g.radii[1]*(g.moveScale||1)*strength;
  return[g.eyeCenter[0]+c*ex-s*ey,g.eyeCenter[1]+s*ex+c*ey];
 }
 _updateDots(dt){
  const pose=this.poses[this.state];if(!pose||pose.closedEyes||this.eyesClosed)return;
  if(this._openness(this.time,pose)<.18)return;
  const response=1-Math.exp(-dt/0.065);
  for(const l of pose.layers)if(l.gaze){
   const target=this._targetDot(l);
   l.dotPosition[0]+=(target[0]-l.dotPosition[0])*response;
   l.dotPosition[1]+=(target[1]-l.dotPosition[1])*response;
  }
 }
 play(){
  if(this.running||this.destroyed)return this;
  this.running=true;let last=performance.now();
  const tick=now=>{
   if(!this.running||this.destroyed)return;
   const dt=Math.min(.05,(now-last)/1000);last=now;
   if(!document.hidden&&this.onscreen){this.time+=dt;this._updateDots(dt);this.renderAt(this.time);}
   this.frameId=requestAnimationFrame(tick);
  };
  this.frameId=requestAnimationFrame(tick);return this;
 }
 pause(){this.running=false;cancelAnimationFrame(this.frameId);return this;}
 renderAt(t,options={}){
  if(this.destroyed)return;if(!Number.isFinite(t))throw new TypeError('Tempo inválido.');
  const state=options.state||this.state,pose=this.poses[state];if(!pose)return;
  const c=this.ctx,s=this.size,[ox,oy]=this.offset;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,this.canvas.width,this.canvas.height);
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const openness=this._openness(t,pose,options);
  for(const l of pose.layers){
   const [x0,y0,x1,y1]=l.bbox;
   const x=ox+x0*s,y=oy+y0*s,w=(x1-x0)*s,h=(y1-y0)*s;
   const isEye=l.part==='leftEye'||l.part==='rightEye';
   if(isEye){
    if(pose.closedEyes){
     // Exact closed-eye artwork: no translations, tracking, scaling or dot.
     c.drawImage(l.image,x,y,w,h);continue;
    }
    if(openness<=.09){
     // A fully closed eyelid stays anchored at the same eye center.
     c.save();c.strokeStyle='#090909';c.lineWidth=Math.max(2,h*.07);c.lineCap='round';
     c.beginPath();c.moveTo(x+w*.16,y+h*.53);c.quadraticCurveTo(x+w*.5,y+h*.62,x+w*.84,y+h*.53);c.stroke();c.restore();
     continue;
    }
    let rendered=l.image;
    if(l.gaze){
     const e=l.surfaceContext,g=l.gaze;const [ew,eh]=g.sourceSize;
     e.setTransform(1,0,0,1,0,0);e.clearRect(0,0,ew,eh);
     // The black-eye base always uses its original position and original size.
     e.drawImage(l.image,0,0);
     if(openness>.18){
      const p=options.look?this._targetDot(l,options.look):l.dotPosition;
      const [dw0,dh0]=g.dotSize; const dotScale=g.dotScale||1; const dw=dw0*dotScale, dh=dh0*dotScale;
      e.save();e.globalCompositeOperation='source-atop';
      e.drawImage(g.image,p[0]-dw/2,p[1]-dh/2,dw,dh);e.restore();
     }
     rendered=l.surface;
    }
    // Blink only; gaze never moves or transforms the eye outline.
    const bh=h*openness;
    c.drawImage(rendered,x,y+(h-bh)/2,w,bh);
   }else if(l.part==='mouth'&&state==='speaking'&&this.motion){
    const level=options.audio??this.audioLevel??(.45+.24*Math.sin(t*11)+.12*Math.sin(t*17));
    const scale=.76+.30*clamp(level,0,1),mh=h*scale;
    c.drawImage(l.image,x,y+(h-mh)/2,w,mh);
   }else if(l.part==='arm'&&state==='wave'){
    // Transform the arm texture only, around the shoulder in original image space.
    const angle=Number.isFinite(options.waveAngle)?options.waveAngle:this._waveAngle(t);
    const px=ox+l.pivot[0]*s,py=oy+l.pivot[1]*s;
    c.save();c.translate(px,py);c.rotate(angle);
    c.drawImage(l.image,x-px,y-py,w,h);c.restore();
   }else{
    // Torso and all non-animated parts are copied unchanged at every frame.
    c.drawImage(l.image,x,y,w,h);
   }
  }
 }
 _waveAngle(t){
  if(!this.motion)return 0;
  const elapsed=Math.max(0,t-this.waveStart);
  const local=elapsed%3.6;
  if(local>=2.4)return 0;
  // Three gentle waves, easing in and out; then rest. The body never moves.
  const envelope=smooth(local/.22)*smooth((2.4-local)/.34);
  return Math.sin(local*Math.PI*2*1.25)*(Math.PI/15)*envelope;
 }
 replayWave(){this.waveStart=this.time;this.setState('wave');return this;}
 capturePNG(){return this.canvas.toDataURL('image/png');}
 destroy(){this.pause();this.destroyed=true;this._resizeObserver.disconnect();this._intersectionObserver?.disconnect();this.poses={};}
}
ZoeAvatar.states=STATES;global.ZoeAvatar=ZoeAvatar;
})(window);
