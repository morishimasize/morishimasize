/* The standard finger notebook keeps coordinates in notebook units. */
'use strict';
const touchViewState={scale:1,x:0,y:0};
let touchView=null;
function touchPaperHTML(){return `<div id="touch-notebook" class="touch-notebook"><div class="touch-heading"><strong>${lesson.equation} ＝ ？</strong><button id="touch-reset">ぜんぶ みる</button></div><p class="touch-help">☝ 1ぽんで かく<br>✌ 2ほんで おおきく・うごかす<br><small>ページは はいいろの はしで うごかしてね。</small></p><div class="touch-paper-frame"><div id="page-rail-left" class="touch-page-rail" role="region" aria-label="ページを うごかす ひだりの はし"><span aria-hidden="true">↕</span></div><div id="touch-viewport" class="touch-viewport" role="region" aria-label="2ほんの ゆびで おおきくできる ノート"><div id="touch-stage" class="touch-stage paper-grid" style="--rows:${rowCount()};--cols:${columnCount()};width:${columnCount()*72}px;height:${rowCount()*72}px"><canvas id="paper" width="${columnCount()*72}" height="${rowCount()*72}" aria-label="ひっさんノート。1ぽんの ゆびで かく"></canvas></div></div><div id="page-rail-right" class="touch-page-rail" role="region" aria-label="ページを うごかす みぎの はし"><span aria-hidden="true">↕</span></div></div><p class="touch-status"><span id="touch-scale" aria-live="polite">ぜんたい</span> ｜ <span id="touch-status" role="status">${tool==='line'?'せんを いれる だんの したを おしてね。':tool==='erase'?'けしたい すうじや せんを おしてね。':'すうじは ひとマスに ひとつ かこう。'}</span></p></div>`;}

/* DOM-independent gesture controller; all one-finger edits commit on release. */
function createNotebookGesture({state,width,height,bounds,paint,preview,commit,busy}){
 const pointers=new Map();let ink=null,blocked=false,gesture=null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function fit(){const b=bounds();return Math.min(b.width/width,b.height/height);}
 function constrain(){const b=bounds(),s=fit()*state.scale;
  state.x=width*s<=b.width?(b.width-width*s)/2:clamp(state.x,b.width-width*s,0);
  state.y=height*s<=b.height?(b.height-height*s)/2:clamp(state.y,b.height-height*s,0);
 }
 function draw(){constrain();paint({...state,factor:fit()*state.scale});}
 function local(p){const s=fit()*state.scale;return [clamp((p.x-state.x)/s,0,width),clamp((p.y-state.y)/s,0,height)];}
 function pair(){const p=[...pointers.values()];return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2,d:Math.max(1,Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y))};}
 function anchor(){const p=pair(),s=fit()*state.scale;gesture={...p,scale:state.scale,ax:(p.x-state.x)/s,ay:(p.y-state.y)/s};}
 return {
  down(id,p){pointers.set(id,p);busy(true);
   if(pointers.size===1&&!blocked){const s=fit()*state.scale;const inside=p.x>=state.x&&p.x<=state.x+width*s&&p.y>=state.y&&p.y<=state.y+height*s;ink=inside?[local(p)]:null;preview(ink);}
   else{ink=null;blocked=true;preview(null);if(pointers.size>=2)anchor();}
  },
  move(id,p){if(!pointers.has(id))return;pointers.set(id,p);
   if(pointers.size>=2){const v=pair();state.scale=clamp(gesture.scale*v.d/gesture.d,1,4);const s=fit()*state.scale;state.x=v.x-gesture.ax*s;state.y=v.y-gesture.ay*s;draw();}
   else if(ink&&!blocked){const v=local(p),last=ink[ink.length-1];if(Math.hypot(v[0]-last[0],v[1]-last[1])>.4)ink.push(v);preview(ink);}
  },
  up(id,cancel=false){if(!pointers.has(id))return;const completed=!cancel&&!blocked?ink:null;pointers.delete(id);ink=null;preview(null);
   if(pointers.size>=2)anchor();
   if(!pointers.size){blocked=false;gesture=null;busy(false);if(completed)commit(completed);}
   else blocked=true;
  },
  cancel(){pointers.clear();ink=null;gesture=null;blocked=false;busy(false);preview(null);},
  reset(){this.cancel();state.scale=1;state.x=0;state.y=0;draw();},
  resize(){this.cancel();draw();},
  draw
 };
}
/* Touch scroll stays native on the rails; mouse dragging scrolls the page too.
   Rails are siblings of the ink viewport, so its touch-action:none never blocks them. */
function attachPageDragRail(rail,scrollPage){
 let drag=null;
 rail.onpointerdown=e=>{
  if(e.pointerType!=='mouse'||e.button!==0)return;
  e.preventDefault();drag={id:e.pointerId,y:e.clientY};rail.setPointerCapture(e.pointerId);
 };
 rail.onpointermove=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  e.preventDefault();const delta=drag.y-e.clientY;drag.y=e.clientY;scrollPage(delta);
 };
 const end=e=>{if(drag?.id!==e.pointerId)return;drag=null;if(rail.hasPointerCapture(e.pointerId))rail.releasePointerCapture(e.pointerId);};
 rail.onpointerup=end;rail.onpointercancel=end;rail.onlostpointercapture=end;
 rail.ondragstart=e=>e.preventDefault();
}
function attachTouchDrawing(canvas){
 const viewport=$('touch-viewport'),stage=$('touch-stage'),epoch=version;
 const controller=createNotebookGesture({state:touchViewState,width:canvas.width,height:canvas.height,
  bounds:()=>({width:viewport.clientWidth,height:viewport.clientHeight}),
  paint:v=>{stage.style.transform=`translate(${v.x}px,${v.y}px) scale(${v.factor})`;$('touch-scale').textContent=v.scale<1.01?'ぜんたい':`${Math.round(v.scale*100)}%`;},
  preview:s=>renderStrokes(canvas,tool==='pen'?s:null),busy:v=>{drawing=v;},
  commit:s=>{if(epoch!==version)return;
   if(tool==='line'){toggleWorkRule(Math.round(s[s.length-1][1]/72));tool='pen';refresh(false);return;}
   if(tool==='erase'){eraseWorkAt(s[s.length-1]);}
   else if(s.length>1){rememberWork();strokes.push(s);}
   renderStrokes(canvas);$('undo').disabled=!history.length;save();
  }
 });
 for(const id of ['page-rail-left','page-rail-right'])attachPageDragRail($(id),delta=>window.scrollBy(0,delta));
 $('touch-notebook').onselectstart=e=>e.preventDefault();
 touchView=controller;$('touch-reset').onclick=()=>controller.reset();
 const point=e=>{const b=viewport.getBoundingClientRect();return {x:e.clientX-b.left,y:e.clientY-b.top};};
 viewport.onpointerdown=e=>{if(e.button>0)return;e.preventDefault();viewport.setPointerCapture(e.pointerId);controller.down(e.pointerId,point(e));};
 viewport.onpointermove=e=>{e.preventDefault();for(const v of (e.getCoalescedEvents?.()||[e]))controller.move(e.pointerId,point(v));};
 viewport.onpointerup=e=>{e.preventDefault();controller.up(e.pointerId);if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);};
 viewport.onpointercancel=e=>controller.up(e.pointerId,true);
 viewport.onlostpointercapture=e=>controller.up(e.pointerId,true);
 viewport.oncontextmenu=e=>e.preventDefault();
 controller.draw();renderStrokes(canvas);
 if(window.notebookTouchResize)window.notebookTouchResize.disconnect();
 const observer=new ResizeObserver(()=>{if(epoch===version)controller.resize();else observer.disconnect();});observer.observe(viewport);window.notebookTouchResize=observer;
}
