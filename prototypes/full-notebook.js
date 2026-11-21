'use strict';
const $=id=>document.getElementById(id),E=NotebookEngine;
const OPS={'+':['＋','たしざん'],'-':['−','ひきざん'],'*':['×','かけざん'],'/':['÷','わりざん']};
const SAMPLES={'+':[[27,15],[46,28],[268,157]],'-':[[52,28],[302,178],[73,46]],'*':[[23,14],[36,25],[23,4]],'/':[[72,3],[83,4],[125,8]]};
const params=new URLSearchParams(window.location.search),calculatorMode=params.get('mode')==='calculator',fingerNotebook=params.get('touch')!=='0';
let storageOK=true,progress=0,savedGame=null;
if(!calculatorMode)try{const saved=NotebookSave.read(localStorage);progress=saved.progress;savedGame=saved.session;}catch{storageOK=false;}
let config={op:'+',example:0},lesson=null,strokes=[],recognized=null,result=null,phase='setup',guide=false,tool='pen',reviewTool='number',credited=false,version=0,history=[];
function picture(count){const stage=Math.min(4,Math.floor(count/3));return `<div class="progress-picture"><img class="reward-image" src="../assets/reward-island.jpg" alt="ふしぎな しまの ピクニック">${[0,1,2,3].map(i=>`<div class="mask" ${i<stage?'hidden':''}>？</div>`).join('')}</div>`;}
function status(s){$('notice').textContent=s;}
function save(){
 if(calculatorMode)return;
 if(lesson&&['write','review','reward'].includes(phase))savedGame={version:1,config:{op:lesson.op,example:SAMPLES[lesson.op].findIndex(([a,b])=>a===lesson.a&&b===lesson.b)},phase,rightAligned:lesson.rightAligned,compactPaper:lesson.compactPaper,strokes,rules:extraLines,editRow,recognized,graded:result!==null,credited,guide,tool,reviewTool};
 try{NotebookSave.write(localStorage,progress,savedGame);storageOK=true;}catch{storageOK=false;}
 const message=$('save-status');if(message){message.classList.toggle('save-failed',!storageOK);message.textContent=storageOK?(savedGame?'ここまで ほぞんしたよ。あとで つづきから あそべるよ。':'えの すすみぐあいは、じどうで ほぞんするよ。'):'つづきを ほぞんできなかったよ。この ページを とじると きえてしまうよ。';}
}
function resumeGame(){
 if(!savedGame)return;
 Object.assign(touchViewState,{scale:1,x:0,y:0});
 const game=savedGame;config={...game.config};const [a,b]=SAMPLES[config.op][config.example];lesson=buildLesson(config.op,a,b);lesson.rightAligned=game.rightAligned===true;lesson.compactPaper=game.compactPaper===true;
 strokes=game.strokes;extraLines=game.rules||[];editRow=Math.min(rowCount()-1,Math.max(0,game.editRow??(lesson.op==='/'?1:3)));recognized=game.recognized;credited=game.credited;guide=!!game.guide;tool=game.tool==='erase'?'erase':'pen';reviewTool=['number','note','line','bracket'].includes(game.reviewTool)?game.reviewTool:'number';history=[];
 result=game.graded&&recognized?E.gradeWork(lesson,recognized,rowCount()):null;
 phase=game.phase==='reward'&&(!credited||!result?.ok)?'review':game.phase;refresh();
}
function refresh(focus=true){version++;drawing=false;clearTimeout(inkFeedbackTimer);document.body.classList.toggle('notebook-writing',fingerNotebook&&phase==='write');document.body.classList.toggle('notebook-review',phase==='review');$('notice').textContent='';if(phase==='setup')setup();else if(phase==='write')writing();else if(phase==='review')review();else finished();if(focus){window.scrollTo(0,0);$('app').setAttribute('tabindex','-1');$('app').focus({preventScroll:true});}document.querySelectorAll('[data-paper-direction]').forEach(button=>button.onclick=()=>{const paper=button.closest('.paper-area').querySelector('.paper-scroll');paper.scrollBy({left:Number(button.dataset.paperDirection)*paper.clientWidth*.7,behavior:'smooth'});});if(!calculatorMode){$('app').insertAdjacentHTML('beforeend','<p id="save-status" class="save-status" role="status"></p>');save();}}
function setup(){$('app').innerHTML=`<section class="card game-setup">${savedGame?'<div class="resume-card"><p>まえの つづきが あるよ</p><button class="primary" id="resume">つづきから あそぶ →</button></div>':''}<h1>けいさんゲーム</h1><p class="sub">ノートの しきの つづきに、とちゅうの けいさんと こたえを かいてね。</p><div class="op-tabs">${Object.entries(OPS).map(([op,v])=>`<button data-op="${op}" aria-pressed="${op===config.op}"><b>${v[0]}</b><span>${v[1]}</span></button>`).join('')}</div><div class="example-row"><label for="sample">もんだい</label><select id="sample">${SAMPLES[config.op].map(([x,y],i)=>`<option value="${i}" ${i===config.example?'selected':''}>${x} ${OPS[config.op][0]} ${y}</option>`).join('')}</select></div><button class="primary start" id="start">ノートに かく →</button><div class="bottom-nav"><button id="book">📖 できたえほん（${Math.min(progress,12)} / 12もん）</button></div></section>`;
document.querySelectorAll('[data-op]').forEach(b=>b.onclick=()=>{config={op:b.dataset.op,example:0};refresh(false);});$('sample').onchange=()=>config.example=Number($('sample').value);if($('resume'))$('resume').onclick=resumeGame;$('start').onclick=()=>{Object.assign(touchViewState,{scale:1,x:0,y:0});const [a,b]=SAMPLES[config.op][config.example];lesson=buildLesson(config.op,a,b);lesson.rightAligned=fingerNotebook;lesson.compactPaper=fingerNotebook;strokes=[];extraLines=[];editRow=lesson.op==='/'?1:3;rowEditorOpen=false;history=[];recognized=null;result=null;credited=false;guide=false;tool='pen';phase='write';refresh();};$('book').onclick=()=>{phase='book';refresh();};}
function returnToCalculator(){window.location.href='../calculator.html?'+new URLSearchParams({mode:'practice',op:lesson?.op||'+',a:String(lesson?.a??0),b:String(lesson?.b??0)});}
function columnCount(){return E.columns(lesson);}
function rowCount(){return E.rows(lesson);}
function legacyToolbar(){return `<div class="toolbar"><button id="pen" aria-pressed="${tool==='pen'}">ペンで かく</button><button id="erase" aria-pressed="${tool==='erase'}">けしゴム</button><button id="undo" ${history.length?'':'disabled'}>ひとつ もどす</button><button id="guide" aria-pressed="${guide}">かく ばしょの ヒント</button><button id="zoom-row" class="zoom-row">1だんを おおきく かく</button><button id="rule-tool" aria-pressed="${tool==='line'}">せんを いれる</button></div>`;}
function paperFrame(content,label){return `<div class="paper-area">${phase!=='review'&&columnCount()>6?'<div class="paper-navigation"><button data-paper-direction="-1" aria-label="ノートの ひだりを みる">← ひだり</button><span>ノートを うごかす</span><button data-paper-direction="1" aria-label="ノートの みぎを みる">みぎ →</button></div>':''}<div class="paper-scroll" tabindex="0" role="region" aria-label="${label}">${content}</div></div>`;}
function canvasHTML(id='paper'){const rows=rowCount();if(fingerNotebook&&id==='paper')return touchPaperHTML();return paperFrame(`<div class="canvas-wrap paper-grid" style="--rows:${rows};--cols:${columnCount()}"><canvas id="${id}" width="${columnCount()*72}" height="${rows*72}" aria-label="しきが かいてある ひっさんノート。すうじは ひとマスに ひとつ、だんは マスに そろえてね"></canvas></div>`,'ひっさんノート。よこに うごかせるよ');}
function legacyWriting(){$('app').innerHTML=`<section class="card writing-card"><div class="top-row"><h1 class="equation">${lesson.equation} ＝ ？</h1><button id="back">← ${calculatorMode?'すうじに もどる':'もんだいを えらぶ'}</button></div><p class="help"><strong>① しきの つづきを ノートに かこう。</strong><br>すうじは ひとマスに ひとつ。だんは マスに そろえてね。</p>${legacyToolbar()}${columnCount()>6?'<p class="sub">「ひだり」「みぎ」で ノートを うごかせるよ。</p>':''}<div class="work-layout"><div class="write-panel">${canvasHTML()}</div><aside class="side-note"><h2>じぶんで かくもの</h2><p>・とちゅうの すうじ<br>・さいごの こたえ</p><p>もんだいの かずと しるしは、かいてあるよ。せんは「せんを いれる」で いれられるよ。</p><p>くりあがり・くりさがりは、マスの うえに ちいさく かいてね。</p><p>ばしょに まよったら「かく ばしょの ヒント」を みてね。</p><button id="read" class="primary">ぜんぶ よみとる →</button><p class="muted">ここでは まだ さいてん しないよ。</p></aside></div><div class="status" id="read-status" role="status"></div><div class="actions"><button id="clear">ぜんぶ かきなおす</button><button id="read-bottom" class="primary">ぜんぶ よみとる →</button></div>${rowDialogHTML()}</section>`;
attachDrawing($('paper'));$('back').onclick=()=>{if(calculatorMode){returnToCalculator();return;}phase='setup';refresh();};$('pen').onclick=()=>{tool='pen';refresh(false);};$('erase').onclick=()=>{tool='erase';refresh(false);};$('undo').onclick=undoWork;$('guide').onclick=()=>{guide=!guide;refresh(false);};$('clear').onclick=()=>{rememberWork();strokes=[];extraLines=[];refresh(false);};$('read').onclick=readAll;$('read-bottom').onclick=readAll;bindRowTools();}
const writingTools=[
 {id:'pen',label:'ペン',name:'ペンで かく',mode:'pen',icon:'M4 20l4.5-1L20 7.5 16.5 4 5 15.5 4 20z M13.5 7l3.5 3.5 M5 15.5l3.5 3.5'},
 {id:'erase',label:'けしゴム',name:'けしゴム',mode:'erase',icon:'M13 4l7 7a2 2 0 0 1 0 2.8l-5.2 5.2H9l-5-5a2 2 0 0 1 0-2.8L10.2 4a2 2 0 0 1 2.8 0z M7.5 8.5l8 8'},
 {id:'undo',label:'もどす',name:'ひとつ もどす',icon:'M8 4l-5 5 5 5 M3 9h11a6 6 0 0 1 0 12h-3'},
 {id:'rule-tool',label:'せん',name:'せんを いれる',mode:'line',icon:'M5 3h14v18H5z M5 12h14'},
 {id:'guide',label:'ヒント',name:'かく ばしょの ヒント',icon:'M9 18v-1c0-1-1-2-1.6-2.6a6 6 0 1 1 9.2 0c-.6.7-1.6 1.6-1.6 2.6v1z M10 21h4'},
 {id:'touch-reset',label:'ぜんたい',name:'ノートを ぜんぶ みる',icon:'M9 4H4v5 M15 4h5v5 M4 15v5h5 M20 15v5h-5'}
];
function toolIsPressed(button){return button.mode?tool===button.mode:button.id==='guide'?guide:null;}
function writingToolbar(label,suffix=''){
 return `<div class="ink-toolbar" role="group" aria-label="${label}">${writingTools.map(button=>{
  const pressed=toolIsPressed(button);
  return `<button type="button" id="${button.id}${suffix}" aria-label="${button.name}" ${pressed===null?'':`aria-pressed="${pressed}"`} ${button.id==='undo'&&!history.length?'disabled':''}>
   <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${button.icon}"/></svg><span>${button.label}</span>
  </button>`;
 }).join('')}</div>`;
}
function syncWritingTools(){
 for(const button of writingTools)for(const suffix of ['','-bottom']){
  const control=$(button.id+suffix),pressed=toolIsPressed(button);
  if(pressed!==null)control.setAttribute('aria-pressed',String(pressed));
  if(button.id==='undo')control.disabled=!history.length;
 }
}
const readInk=E.createInkReader();
let inkFeedbackTimer;
function readNotebookInk(){
 const work=readInk(strokes,rowCount(),columnCount());
 for(const key of Object.keys(E.given(lesson).main))delete work.main[key];
 return work;
}
function showInkQuestions(){
 const {main,notes}=readNotebookInk(),marks=[];
 for(const [type,cells] of Object.entries({main,notes}))for(const [key,value] of Object.entries(cells)){
  if(!value.includes('?'))continue;
  const [row,col]=key.split(':').map(Number);
  marks.push(`<span class="ink-question ${type}" data-cell="${key}" style="--row:${row};--col:${col}">?</span>`);
 }
 $('ink-questions').innerHTML=marks.join('');
 $('ink-feedback').textContent=marks.length?'よみにくい マスに「？」が あるよ。':'';
}
function updateWritingPaper(inkChanged=false){
 renderStrokes($('paper'));
 syncWritingTools();
 if(inkChanged){
  clearTimeout(inkFeedbackTimer);
  $('read-status').textContent='';
  if(strokes.length)inkFeedbackTimer=setTimeout(showInkQuestions,180);
  else showInkQuestions();
 }
 save();
}
function writing(){
 if(!fingerNotebook){legacyWriting();return;}
 $('app').innerHTML=`<section class="card writing-card notebook-workspace" aria-label="ひっさんノート">
  <div class="notebook-head">
   <button id="back" class="notebook-back">← ${calculatorMode?'すうじに もどる':'もんだいを えらぶ'}</button>
   ${writingToolbar('うえの どうぐ')}
  </div>
  ${touchPaperHTML()}
  <div class="notebook-dock">
   ${writingToolbar('したの どうぐ','-bottom')}
   <div class="notebook-actions">
    <button id="clear">ぜんぶ かきなおす</button>
    <button id="read" class="primary">よみとる →</button>
   </div>
   <p class="status" id="read-status" role="status"></p>
  </div>
 </section>`;
 attachDrawing($('paper'));
 showInkQuestions();
 $('back').onclick=()=>{if(calculatorMode){returnToCalculator();return;}phase='setup';refresh();};
 for(const button of writingTools)for(const suffix of ['','-bottom'])$(button.id+suffix).onclick=()=>{
  if(drawing)return;
  if(button.id==='undo'){undoWork();return;}
  if(button.id==='touch-reset'){touchView.reset();return;}
  if(button.id==='guide')guide=!guide;
  else tool=button.mode==='line'&&tool==='line'?'pen':button.mode;
  updateWritingPaper();
 };
 $('clear').onclick=()=>{
  if(drawing||(!strokes.length&&!extraLines.length))return;
  rememberWork();strokes=[];extraLines=[];updateWritingPaper(true);
 };
 $('read').onclick=readAll;
}
function renderStrokes(canvas,pending=null){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(0,-Number(canvas.dataset.row||0)*72);drawGiven(ctx);for(const l of extraLines){ctx.strokeStyle='#4d4c4b';ctx.lineWidth=2.8;ctx.beginPath();ctx.moveTo(l.start*72+3,l.row*72);ctx.lineTo(l.end*72-3,l.row*72);ctx.stroke();}if(guide&&phase==='write'){const expected=E.expected(lesson);ctx.strokeStyle='#d4aac0';ctx.fillStyle='#f6e7f080';ctx.setLineDash([3,5]);for(const k of Object.keys(expected.main)){if(E.given(lesson).main[k]!==undefined)continue;const [r,c]=k.split(':').map(Number);ctx.fillRect(c*72+7,r*72+24,58,44);ctx.strokeRect(c*72+7,r*72+24,58,44);}for(const k of Object.keys(expected.notes)){const [r,c]=k.split(':').map(Number);ctx.strokeRect(c*72+12,r*72+2,48,18);}ctx.setLineDash([]);}ctx.strokeStyle='#4d4c4b';ctx.lineWidth=2.8;ctx.lineCap='round';ctx.lineJoin='round';for(const s of [...strokes,...(pending?[pending]:[])]){if(!s.length)continue;ctx.beginPath();ctx.moveTo(...s[0]);for(const p of s.slice(1))ctx.lineTo(...p);ctx.stroke();}ctx.restore();}
function drawGiven(ctx){
 const fixed=E.given(lesson);ctx.save();ctx.fillStyle='#5b6972';ctx.strokeStyle='#5b6972';ctx.lineWidth=2.2;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='40px "Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';
 for(const [k,v]of Object.entries(fixed.main)){const [r,c]=k.split(':').map(Number);ctx.fillText(v==='+'?'＋':v,(c+.5)*72,(r+.88)*72);}
 for(const l of fixed.lines){ctx.beginPath();ctx.moveTo(l.start*72+3,l.row*72);ctx.lineTo(l.end*72-3,l.row*72);ctx.stroke();}
 for(const b of fixed.brackets){ctx.beginPath();ctx.moveTo(b.col*72-14,b.row*72+3);ctx.quadraticCurveTo(b.col*72+6,b.row*72+36,b.col*72-14,(b.row+1)*72-3);ctx.stroke();}ctx.restore();
}
let drawing=false;
function attachDrawing(canvas){if(fingerNotebook&&canvas.id==='paper'){attachTouchDrawing(canvas);return;}renderStrokes(canvas);let pending=null,id=null;const epoch=version;
const point=e=>{const b=canvas.getBoundingClientRect();return [Math.max(0,Math.min(canvas.width,(e.clientX-b.left)*canvas.width/b.width)),Math.max(0,Math.min(canvas.height,(e.clientY-b.top)*canvas.height/b.height))+Number(canvas.dataset.row||0)*72];};
canvas.onpointerdown=e=>{if(id!==null||e.button>0)return;e.preventDefault();if(tool==='line'){toggleWorkRule(Math.round(point(e)[1]/72));tool='pen';refresh(false);return;}if(tool==='erase'){eraseWorkAt(point(e));renderStrokes(canvas);$('undo')&&($('undo').disabled=!history.length);$('row-undo')&&($('row-undo').disabled=!history.length);save();return;}id=e.pointerId;drawing=true;pending=[point(e)];canvas.setPointerCapture(id);};
canvas.onpointermove=e=>{if(id!==e.pointerId||!pending||epoch!==version)return;e.preventDefault();for(const v of (e.getCoalescedEvents?.()||[e])){const p=point(v);if(Math.hypot(p[0]-pending[pending.length-1][0],p[1]-pending[pending.length-1][1])>.4)pending.push(p);}renderStrokes(canvas,pending);};
const end=(e,cancel)=>{if(e.pointerId!==id)return;const s=pending;pending=null;id=null;drawing=false;if(!cancel&&s?.length>1&&epoch===version){rememberWork();strokes.push(s);}if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);renderStrokes(canvas);if($('undo'))$('undo').disabled=!history.length;if($('row-undo'))$('row-undo').disabled=!history.length;save();};canvas.onpointerup=e=>end(e,false);canvas.onpointercancel=e=>end(e,true);canvas.onlostpointercapture=e=>{if(e.pointerId===id)end(e,true);};canvas.oncontextmenu=e=>e.preventDefault();}
function readAll(){if(drawing){$('read-status').textContent='ペンを はなしてから おしてね。';return;}if(!strokes.length){$('read-status').textContent='とちゅうの けいさんや こたえを かいてね。';return;}recognized=readNotebookInk();recognized.lines.push(...extraLines);if(!Object.keys(recognized.main).length&&!recognized.lines.length){$('read-status').textContent='うまく よめなかったよ。すうじを おおきく、マスに そろえて かいてみてね。';return;}result=null;phase='review';reviewTool='number';refresh();}
function normalizeText(v){return v.replace(/－|-/g,'−').replace(/[xX*ｘ]/g,'×').replace(/＋/g,'+').replace(/[０-９]/g,x=>String(x.charCodeAt(0)-0xff10));}
function reviewGrid(){const rows=rowCount(),fixed=E.given(lesson);let html=`<div class="review-grid ${reviewTool==='number'?'':reviewTool==='note'?'edit-notes':'edit-lines'}" id="review-grid" style="--rows:${rows};--cols:${columnCount()}">`;for(let r=0;r<rows;r++)for(let c=0;c<columnCount();c++){const k=E.key(r,c),issue=result?.issues.some(x=>x.key===k),note=recognized.notes[k]||'',number=fixed.main[k]??recognized.main[k]??'';html+=`<div class="review-cell ${issue?'is-issue':''} ${fixed.main[k]!==undefined?'is-given':''}"><input class="note${note.includes('?')?' is-unclear':''}" tabindex="${reviewTool==='note'?0:-1}" data-note="${k}" maxlength="2" inputmode="numeric" value="${escapeAttr(note)}" aria-label="うえから ${r+1}だんめ、ひだりから ${c+1}マスめの ちいさいすうじ"><input class="main${number==='?'?' is-unclear':''}" ${fixed.main[k]!==undefined?'readonly aria-readonly="true"':''} tabindex="${reviewTool==='number'&&fixed.main[k]===undefined?0:-1}" data-main="${k}" maxlength="1" value="${escapeAttr(number)}" aria-label="うえから ${r+1}だんめ、ひだりから ${c+1}マスめの すうじ・しるし"></div>`;}html+=`<svg class="review-lines" viewBox="0 0 ${columnCount()*72} ${rows*72}" aria-hidden="true">${[...fixed.lines,...recognized.lines].map(l=>`<line x1="${l.start*72}" x2="${l.end*72}" y1="${l.row*72}" y2="${l.row*72}"></line>`).join('')}${[...fixed.brackets,...recognized.brackets].map(b=>`<path d="M${b.col*72-14} ${b.row*72+3} Q${b.col*72+6} ${b.row*72+36} ${b.col*72-14} ${(b.row+1)*72-3}"></path>`).join('')}</svg><canvas class="line-canvas" id="line-canvas" width="${columnCount()*72}" height="${rows*72}" aria-label="よみとった せんを なおす ノート"></canvas></div>`;return html;}
function escapeAttr(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function review(){const issues=result?.issues||[];$('app').innerHTML=`<section class="card review-card"><h1 class="equation">${lesson.equation} ＝ ？</h1><p class="help">ちがう すうじや「？」は、マスを おして なおしてね。</p><div class="toolbar"><button id="edit-number" aria-pressed="${reviewTool==='number'}">すうじを なおす</button><button id="edit-note" aria-pressed="${reviewTool==='note'}">ちいさい すうじ</button><button id="edit-line" aria-pressed="${reviewTool==='line'}">せんを なおす</button><button id="edit-bracket" hidden aria-pressed="${reviewTool==='bracket'}">わりざんの かたち</button><button id="remove-line">せんを けす</button></div><p class="sub">${reviewTool==='line'?'よみとった ノートの マスの さかいめに、せんを ひいてね。':reviewTool==='bracket'?'わられる かずの ひだりの さかいめを おしてね。' :''}</p><div class="review-view-switch" role="group" aria-label="ノートを きりかえる"><button id="show-original" aria-pressed="false">かいた ノート</button><button id="show-reading" aria-pressed="true">よみとった ノート</button></div><div id="review-columns" class="review-columns" data-view="reading"><div class="original-view"><h2 class="review-heading">じぶんで かいた ノート</h2>${canvasHTML('original')}</div><div class="reading-view"><h2 class="review-heading">よみとった ノート（なおせるよ）</h2>${paperFrame(reviewGrid(),'よみとった ノート。よこに うごかせるよ')}</div></div><div id="grade-status" class="status ${result?.ok?'good':''}" role="status">${result?.ok?'<h2>ぜんぶ できたね！ 🌸</h2><p>とちゅうの すうじも たしかめたよ。</p>':result?'<h2>もういちど たしかめよう</h2><p>よみとりが ちがうときは、すうじや せんを なおしてね。<br>けいさんを やりなおすときは「てがきに もどる」を おしてね。</p><ul class="issue-list">'+[...new Set(issues.map(x=>x.message))].map(m=>'<li>'+m+'</li>').join('')+'</ul><p class="muted">この ノートでは、だんを マスに そろえた かきかたで たしかめるよ。</p>':''}</div><div class="grade-controls"><button id="back-write">← てがきに もどる</button><button id="grade" class="primary">この ノートで さいてん</button>${result?.ok?(calculatorMode?'<button id="new-calculation" class="primary">べつの けいさんへ →</button>':'<button id="reward" class="primary">ごほうびの え →</button>'):''}</div><p class="sub">${calculatorMode?'よみとりは なんどでも なおせるよ。':'よみとりを なおしても、ごほうびは へらないよ。'}</p></section>`;renderStrokes($('original'));
for(const view of ['original','reading'])$('show-'+view).onclick=()=>{
 $('review-columns').dataset.view=view;
 $('show-original').setAttribute('aria-pressed',String(view==='original'));
 $('show-reading').setAttribute('aria-pressed',String(view==='reading'));
};
for(const type of ['main','note'])document.querySelectorAll(`[data-${type}]`).forEach(input=>input.oninput=()=>{const map=type==='main'?'main':'notes',k=input.dataset[type];if(type==='main'&&E.given(lesson).main[k]!==undefined)return;const v=normalizeText(input.value).replace(type==='note'?/[^0-9?]/g:/[^0-9+−×?]/g,'');input.value=v;input.classList.toggle('is-unclear',v.includes('?'));if(v)recognized[map][k]=v;else delete recognized[map][k];result=null;$('grade-status').textContent='なおした ノートで、もういちど さいてんできるよ。';if($('reward'))$('reward').disabled=true;if($('new-calculation'))$('new-calculation').hidden=true;save();});
$('edit-number').onclick=()=>{reviewTool='number';refresh(false);};$('edit-note').onclick=()=>{reviewTool='note';refresh(false);};$('edit-line').onclick=()=>{reviewTool='line';refresh(false);};$('edit-bracket').onclick=()=>{reviewTool='bracket';refresh(false);};$('remove-line').onclick=()=>{if(reviewTool==='bracket')recognized.brackets.pop();else recognized.lines.pop();result=null;refresh(false);};$('back-write').onclick=()=>{phase='write';result=null;refresh();};$('grade').onclick=()=>{result=E.gradeWork(lesson,recognized,rowCount());if(result.ok&&!calculatorMode&&!credited){progress++;credited=true;}refresh(false);$('grade-status').scrollIntoView({block:'nearest',behavior:'smooth'});};if($('reward'))$('reward').onclick=()=>{if(!result?.ok)return;phase='reward';refresh();};if($('new-calculation'))$('new-calculation').onclick=returnToCalculator;attachLineEditor();}
function attachLineEditor(){const canvas=$('line-canvas');let start=null,id=null;const pos=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};canvas.onpointerdown=e=>{if(id!==null)return;e.preventDefault();id=e.pointerId;start=pos(e);canvas.setPointerCapture(id);};canvas.onpointerup=e=>{if(e.pointerId!==id)return;const end=pos(e);id=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(reviewTool==='bracket')recognized.brackets.push({row:Math.max(0,Math.min(rowCount()-1,Math.floor(end.y/72))),col:Math.max(1,Math.min(columnCount()-1,Math.round(end.x/72)))});else{const left=Math.max(0,Math.floor(Math.min(start.x,end.x)/72)),right=Math.min(columnCount(),Math.ceil(Math.max(start.x,end.x)/72));if(right>left)recognized.lines.push({row:Math.max(0,Math.min(rowCount(),Math.round((start.y+end.y)/144))),start:left,end:right});}start=null;result=null;refresh(false);};canvas.onpointercancel=()=>{id=null;start=null;};}
window.addEventListener('pagehide',save);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save();});
function finished(){const count=progress%12===0&&progress>0?12:progress%12;$('app').innerHTML=`<section class="card reward-card"><h1>${phase==='reward'?'ひっさんを ぜんぶ がんばったね！':'わたしの できたえほん'}</h1><p class="sub">3もんで ひとつ、12もんで えが かんせいするよ。</p>${picture(count)}<p>${count} / 12もん ・ かんせい ${Math.floor(progress/12)}かい</p><div class="actions"><button id="setup" class="primary">べつの もんだいへ →</button>${lesson?'<button id="return">ノートに もどる</button>':''}</div></section>`;$('setup').onclick=()=>{phase='setup';refresh();};if($('return'))$('return').onclick=()=>{phase=recognized?'review':'write';refresh();};}
if(calculatorMode){
 document.title='じぶんで とく | ひっさんノート';
 document.body.classList.add('calculator-notebook');
 document.querySelector('header span').textContent='じぶんで とく ・ かいて、まるつけ';
 document.querySelector('footer').innerHTML='じぶんの ペースで だいじょうぶ。';
 try{
  const a=params.get('a'),b=params.get('b'),op=params.get('op');
  if(!/^\d{1,5}$/.test(a||'')||!/^\d{1,5}$/.test(b||''))throw Error('invalid input');
  lesson=buildLesson(op,Number(a),Number(b));lesson.rightAligned=fingerNotebook;lesson.compactPaper=fingerNotebook;editRow=op==='/'?1:3;phase='write';
  refresh(false);
 }catch{
  $('app').innerHTML='<section class="card"><h1>すうじを いれなおしてね</h1><p>けいさんの しきを もういちど えらぼう。</p><a href="../calculator.html?mode=practice">← すうじに もどる</a></section>';
 }
}else refresh(false);
