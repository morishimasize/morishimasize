/* The handwriting screen keeps recognition, corrections and grading on one page. */
'use strict';
const emptyReadingCorrections=()=>({main:{},notes:{}});
let readingCorrections=emptyReadingCorrections(),automaticReading=null,inkSources=null;
const strokeSignatures=new WeakMap();
function inkSignature(stroke){
 if(!strokeSignatures.has(stroke)){
  // A compact signature for comparing committed ink across a save and reload.
  let hash=0x811c9dc5;
  for(const value of JSON.stringify(stroke))hash=Math.imul(hash^value.charCodeAt(0),0x01000193);
  strokeSignatures.set(stroke,(hash>>>0).toString(36));
 }
 return strokeSignatures.get(stroke);
}
function cellSource(type,key){return (inkSources[type][key]||[]).map(inkSignature).join('.');}
function automaticWork(){
 inkSources={main:{},notes:{}};
 automaticReading=readNotebookInk(inkSources);
 automaticReading.lines.push(...extraLines);
 return automaticReading;
}
function hasReadingCorrections(){
 return !!(Object.keys(readingCorrections.main).length||Object.keys(readingCorrections.notes).length||readingCorrections.lines||readingCorrections.brackets);
}
function correctedWork(){
 const work={main:{...automaticReading.main},notes:{...automaticReading.notes},lines:automaticReading.lines.slice(),brackets:automaticReading.brackets.slice()};
 const kept=emptyReadingCorrections(),fixed=E.given(lesson);
 for(const type of ['main','notes'])for(const [key,edit] of Object.entries(readingCorrections[type])){
  const [row,col]=key.split(':').map(Number);
  if(row>=rowCount()||col>=columnCount()||(type==='main'&&fixed.main[key]!==undefined)||edit.source!==cellSource(type,key))continue;
  kept[type][key]=edit;
  if(edit.value)work[type][key]=edit.value;else delete work[type][key];
 }
 for(const type of ['lines','brackets']){
  const edit=readingCorrections[type];
  if(edit&&edit.source===JSON.stringify(automaticReading[type])){
   kept[type]=edit;
   work[type]=edit.value.slice();
  }
 }
 readingCorrections=kept;
 return work;
}
function resumeLiveReading(game){
 automaticWork();
 readingCorrections=game.readingCorrections||emptyReadingCorrections();
 if(!game.readingCorrections&&game.phase!=='write'&&game.recognized){
  for(const type of ['main','notes'])for(const key of new Set([...Object.keys(automaticReading[type]),...Object.keys(game.recognized[type])])){
   const value=game.recognized[type][key]||'';
   if(value!==(automaticReading[type][key]||''))readingCorrections[type][key]={value,source:cellSource(type,key)};
  }
  for(const type of ['lines','brackets'])if(JSON.stringify(game.recognized[type])!==JSON.stringify(automaticReading[type])){
   readingCorrections[type]={value:game.recognized[type],source:JSON.stringify(automaticReading[type])};
  }
 }
 recognized=correctedWork();
}
function unresolvedCells(work){
 return ['main'].flatMap(type=>Object.keys(work[type]).filter(key=>work[type][key].includes('?')).map(key=>({type,key})));
}
function renderInkQuestions(){
 const questions=unresolvedCells(recognized);
 $('ink-questions').innerHTML=questions.map(({type,key})=>{
  const [row,col]=key.split(':').map(Number);
  return `<span class="ink-question ${type}" data-cell="${key}" style="--row:${row};--col:${col}">?</span>`;
 }).join('');
 const message=questions.length?'よみにくい マスに「？」が あるよ。':'';
 if($('ink-feedback').textContent!==message)$('ink-feedback').textContent=message;
}
function svgWorkLines(work){
 const fixed=E.given(lesson);
 const lines=[...fixed.lines,...work.lines].map(l=>`<line x1="${l.start*72}" x2="${l.end*72}" y1="${l.row*72}" y2="${l.row*72}"/>`);
 const brackets=[...fixed.brackets,...work.brackets].map(b=>`<path d="M${b.col*72-14} ${b.row*72+3} Q${b.col*72+6} ${b.row*72+36} ${b.col*72-14} ${(b.row+1)*72-3}"/>`);
 return [...lines,...brackets].join('');
}
// Teaching annotations are separate from the child's ink, recognition and saved work.
function gradeNoteCells(){
 if(!result?.ok)return {};
 return Object.fromEntries(Object.entries(E.expected(lesson).notes).filter(([key])=>!recognized?.notes[key]));
}
function gradeNotesSVG(){
 return Object.entries(gradeNoteCells()).map(([key,value])=>{
  const [row,col]=key.split(':').map(Number);
  return `<text class="grade-note" data-cell="${key}" x="${col*72+36}" y="${row*72+22}" text-anchor="middle">${escapeAttr(value)}</text>`;
 }).join('');
}
function miniReadingHTML(work){
 const cols=columnCount(),rows=rowCount(),fixed=E.given(lesson);
 const grid=`<pattern id="mini-square" width="72" height="72" patternUnits="userSpaceOnUse"><path d="M72 0H0V72" fill="none" stroke="#b5d1df" stroke-width="2"/></pattern>`;
 const issueCells=new Set(result?.issues.filter(issue=>issue.key).map(issue=>issue.key));
 const questionCells=new Set(unresolvedCells(work).map(item=>item.key));
 const rect=(key,fill)=>{
  const [r,c]=key.split(':').map(Number);
  return `<rect class="mini-cell-${fill}" x="${c*72}" y="${r*72}" width="72" height="72"/>`;
 };
 const highlights=[...[...issueCells].map(key=>rect(key,'check')),...[...questionCells].map(key=>rect(key,'question'))].join('');
 const numbers=(cells,small)=>Object.entries(cells).map(([key,value])=>{
  const [r,c]=key.split(':').map(Number);
  return `<text class="${small?'mini-note':'mini-digit'}" x="${c*72+36}" y="${r*72+(small?24:61)}">${escapeAttr(value)}</text>`;
 }).join('');
 return `<svg class="mini-paper" viewBox="0 0 ${cols*72} ${rows*72}" style="--mini-cols:${cols};--mini-rows:${rows}" aria-hidden="true">${grid}${highlights}<rect width="100%" height="100%" fill="url(#mini-square)"/>${numbers({...work.main,...fixed.main},false)}${numbers(work.notes,true)}${gradeNotesSVG()}<g class="mini-lines">${svgWorkLines(work)}</g></svg>`;
}
function refreshLiveReading(){
 automaticWork();
 recognized=correctedWork();
 renderMiniReading();
}
function renderMiniReading(){
 renderInkQuestions();
 $('mini-reading').innerHTML=miniReadingHTML(recognized);
}
function worksheetIssueMark(issue){
 const cell=E.CELL;
 if(issue.key){
  const [row,col]=issue.key.split(':').map(Number);
  const x=col*cell,y=row*cell;
  const note=issue.kind==='notes',top=y+(note?3:24),height=note?22:44;
  const shape=issue.missing?'grade-missing':'grade-wrong';
  const cross=issue.missing?'':`<path class="grade-cross" d="M${x+57} ${top+6}l8 8m0-8l-8 8"/>`;
  return `<rect class="${shape}" data-cell="${issue.key}" data-kind="${issue.kind}" x="${x+3}" y="${top}" width="66" height="${height}" rx="6"/>${cross}`;
 }
 if(issue.kind==='line'){
  return `<line class="grade-rule" data-row="${issue.row}" x1="${issue.start*cell+4}" x2="${issue.end*cell-4}" y1="${issue.row*cell}" y2="${issue.row*cell}"/>`;
 }
 if(issue.kind==='bracket'){
  const x=issue.col*cell,y=issue.row*cell;
  return `<path class="grade-rule" d="M${x-14} ${y+3} Q${x+6} ${y+36} ${x-14} ${y+69}"/>`;
 }
 return '';
}
function renderWorksheetGrade(){
 $('grade-circle').hidden=!result?.ok;
 $('grade-issues').innerHTML=(result?.issues.map(worksheetIssueMark).join('')||'')+gradeNotesSVG();
}
function renderLiveGrade(){
 renderWorksheetGrade();
 const target=$('live-grade');
 target.classList.toggle('live-correct',Boolean(result?.ok));
 target.innerHTML=result?.ok?`<strong>ぜんぶ できたね！</strong><button id="live-next">${calculatorMode?'べつの けいさんへ':'ごほうびの えへ'} →</button>`:
  result?'<strong>もういちど たしかめよう</strong><span>ノートの あかい ところを みてね。</span>':'';
 const next=$('live-next');
 if(next)next.onclick=()=>{
  if(calculatorMode){returnToCalculator();return;}
  phase='reward';refresh();
 };
}
function markLiveWork(){
 if(drawing){$('read-status').textContent='ペンを はなしてから おしてね。';return;}
 clearTimeout(inkFeedbackTimer);
 refreshLiveReading();
 if(unresolvedCells(recognized).length){
  $('read-status').textContent='「？」の すうじを たしかめよう。';
  openLiveEditor();return;
 }
 if(!Object.keys(recognized.main).length&&!Object.keys(recognized.notes).length){
  $('read-status').textContent='とちゅうの けいさんや こたえを かいてね。';return;
 }
 $('read-status').textContent='';
 gradeRecognizedWork();
 if(!result.ok&&touchViewState.scale>1)touchView.reset();
 renderLiveGrade();renderMiniReading();save();
}
function liveEditorHTML(){
 return `<dialog id="reading-dialog" class="row-dialog live-reading-dialog" aria-labelledby="reading-title">
  <div class="row-top"><h2 id="reading-title">よみとりを たしかめる</h2><button id="reading-close">とじる</button></div>
  <div class="row-ink-tools" role="group" aria-label="なおす もの">
   <button id="live-edit-number">すうじ</button><button id="live-edit-note">ちいさい すうじ</button><button id="live-edit-line">せん</button>
  </div>
  <p class="sub" id="live-edit-help"></p>
  <div id="live-edit-grid" class="live-edit-grid"></div>
  <button id="live-remove-line" hidden>せんを ひとつ けす</button>
 </dialog>`;
}
function saveLiveCell(input,type){
 const key=input.dataset[type==='main'?'main':'note'];
 if(type==='main'&&E.given(lesson).main[key]!==undefined)return;
 const value=normalizeText(input.value).replace(/[^0-9?]/g,'').slice(0,type==='main'?1:2);
 input.value=value;
 input.classList.toggle('is-unclear',value.includes('?'));
 if(value===(recognized[type][key]||''))return;
 const edits={...readingCorrections[type]};
 if(value===(automaticReading[type][key]||''))delete edits[key];
 else edits[key]={value,source:cellSource(type,key)};
 rememberWork();
 readingCorrections={...readingCorrections,[type]:edits};
 finishLiveEdit();
}
function finishLiveEdit(){
 result=null;
 recognized=correctedWork();
 $('read-status').textContent='';
 syncWritingTools();renderLiveGrade();renderMiniReading();save();
}
function saveLiveLines(lines){
 rememberWork();
 const source=JSON.stringify(automaticReading.lines);
 readingCorrections={...readingCorrections,lines:source===JSON.stringify(lines)?undefined:{source,value:lines}};
 finishLiveEdit();
}
function renderLiveEditor(){
 for(const kind of ['number','note','line'])$('live-edit-'+kind).setAttribute('aria-pressed',String(reviewTool===kind));
 $('live-edit-help').textContent=reviewTool==='line'?'せんを いれたい マスの さかいめに ひいてね。':'「？」や ちがう すうじの マスを おしてね。';
 $('live-edit-grid').innerHTML=reviewGrid();
 $('live-remove-line').hidden=reviewTool!=='line';
 $('live-remove-line').disabled=!recognized.lines.length;
 for(const type of ['main','notes'])document.querySelectorAll(type==='main'?'[data-main]':'[data-note]').forEach(input=>{
  input.onfocus=()=>input.select();
  input.oninput=()=>saveLiveCell(input,type);
 });
 attachLineEditor(()=>{
  saveLiveLines(recognized.lines.slice());
  renderLiveEditor();
 });
}
function openLiveEditor(){
 if(drawing)return;
 clearTimeout(inkFeedbackTimer);
 refreshLiveReading();
 const questions=unresolvedCells(recognized);
 reviewTool=questions.some(item=>item.type==='notes')&&!questions.some(item=>item.type==='main')?'note':'number';
 renderLiveEditor();
 $('reading-dialog').showModal();
}
function bindLiveReading(){
 $('open-reading').onclick=openLiveEditor;
 $('mark-work').onclick=markLiveWork;
 $('reading-close').onclick=()=>$('reading-dialog').close();
 $('reading-dialog').onclose=()=>$('open-reading').focus({preventScroll:true});
 for(const kind of ['number','note','line'])$('live-edit-'+kind).onclick=()=>{
  reviewTool=kind;renderLiveEditor();
 };
 $('live-remove-line').onclick=()=>{
  if(!recognized.lines.length)return;
  saveLiveLines(recognized.lines.slice(0,-1));renderLiveEditor();$('live-edit-line').focus();
 };
}
