/* Magnify one selected grid row and place rules without recognizing handwriting. */
'use strict';
let rowEditorOpen=false,editRow=3,extraLines=[];
function rememberWork(issueTargets){history.push({strokes:strokes.slice(),rules:extraLines.slice(),corrections:readingCorrections,issueTargets});}
function undoWork(){
 if(history.length){
  const previous=history.pop();
  strokes=previous.strokes;extraLines=previous.rules;readingCorrections=previous.corrections;
  if(previous.issueTargets)liveIssueTargets=previous.issueTargets;
 }
 if(fingerNotebook&&phase==='write')updateWritingPaper(true);
 else refresh(false);
}
// Prefer a nearby placed rule so erasing it does not also remove adjacent digits.
function eraseWorkAt(p){
 let nearest=-1,distance=18;
 extraLines.forEach((line,i)=>{
  const x=Math.max(line.start*72+3,Math.min(line.end*72-3,p[0]));
  const d=Math.hypot(p[0]-x,p[1]-line.row*72);
  if(d<distance){nearest=i;distance=d;}
 });
 if(nearest>=0){rememberWork();extraLines=extraLines.filter((_,i)=>i!==nearest);result=null;return;}
 const kept=strokes.filter(s=>!s.some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<18));
 if(kept.length!==strokes.length){rememberWork();strokes=kept;result=null;}
}
function toggleWorkRule(row){
 const fixed=E.given(lesson);
 if(row<1||row>rowCount()||fixed.lines.some(l=>l.row===row))return;
 rememberWork();const exists=extraLines.some(l=>l.row===row);
 if(exists)extraLines=extraLines.filter(l=>l.row!==row);
 else{const span=fixed.lines[0];extraLines.push({row,start:span.start,end:span.end});}
 result=null;save();
}
function rowDialogHTML(){return `<dialog id="row-dialog" class="row-dialog" aria-labelledby="row-title"><div class="row-top"><h2 id="row-title">${editRow+1}だんめを かこう</h2><button id="row-close">ノートに もどる</button></div><p class="sub">すうじは ひとマスに ひとつ。ちいさい すうじは、うえの きいろい ところに かこう。</p><div class="row-ink-tools"><button id="row-pen" aria-pressed="${tool==='pen'}">ペンで かく</button><button id="row-erase" aria-pressed="${tool==='erase'}">けしゴム</button><button id="row-undo" ${history.length?'':'disabled'}>ひとつ もどす</button></div><div class="paper-navigation"><button id="row-left">← ひだり</button><span>ノートを うごかす</span><button id="row-right">みぎ →</button></div><div id="row-scroll" class="row-scroll"><div class="row-paper" style="--cols:${columnCount()}"><canvas id="row-paper" data-row="${editRow}" width="${columnCount()*72}" height="72" aria-label="うえから ${editRow+1}だんめを おおきく かく ノート"></canvas></div></div><button id="row-rule" class="row-rule" ${E.given(lesson).lines.some(l=>l.row===editRow+1)?'disabled':''}>${extraLines.some(l=>l.row===editRow+1)?'この だんの したの せんを けす':'この だんの したに せんを いれる'}</button><div class="row-navigation"><button id="row-prev" ${editRow===0?'disabled':''}>← まえの だん</button><span>${editRow+1} / ${rowCount()}</span><button id="row-next" class="primary" ${editRow===rowCount()-1?'disabled':''}>つぎの だん →</button></div><p class="muted">かいたものは、もとの ノートにも のこるよ。</p></dialog>`;}
function bindRowTools(){
 $('zoom-row').onclick=()=>{rowEditorOpen=true;tool='pen';refresh(false);};
 $('rule-tool').onclick=()=>{tool=tool==='line'?'pen':'line';refresh(false);if(tool==='line')$('read-status').textContent='せんを いれる だんの したを おしてね。';};
 if(!rowEditorOpen)return;
 const dialog=$('row-dialog');dialog.showModal();attachDrawing($('row-paper'));
 const close=()=>{rowEditorOpen=false;dialog.close();refresh(false);$('zoom-row').focus();};
 $('row-close').onclick=close;dialog.oncancel=e=>{e.preventDefault();close();};
 $('row-prev').onclick=()=>{editRow=Math.max(0,editRow-1);refresh(false);};
 $('row-next').onclick=()=>{editRow=Math.min(rowCount()-1,editRow+1);refresh(false);};
 $('row-pen').onclick=()=>{tool='pen';refresh(false);};$('row-erase').onclick=()=>{tool='erase';refresh(false);};$('row-undo').onclick=undoWork;
 $('row-rule').onclick=()=>{toggleWorkRule(editRow+1);refresh(false);};
 $('row-left').onclick=()=>$('row-scroll').scrollBy({left:-288,behavior:'smooth'});$('row-right').onclick=()=>$('row-scroll').scrollBy({left:288,behavior:'smooth'});
}
