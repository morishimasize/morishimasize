/* A blank grid worksheet: recognition never receives the expected answer. */
(function(root){
'use strict';
const CELL=72,COLS=6;
const key=(r,c)=>`${r}:${c}`;
const bounds=strokes=>{const p=strokes.flat();return {x0:Math.min(...p.map(p=>p[0])),x1:Math.max(...p.map(p=>p[0])),y0:Math.min(...p.map(p=>p[1])),y1:Math.max(...p.map(p=>p[1]))};};
const symbols={'+':[[[50,12],[50,88]],[[12,50],[88,50]]],'−':[[[12,50],[88,50]]],'×':[[[15,15],[85,85]],[[85,15],[15,85]]]};
const symbolTemplates=Object.entries(symbols).map(([text,strokes])=>({text,...DigitReader.normalize(strokes)}));
function readGlyph(strokes,digitsOnly=false){
 const input=DigitReader.normalize(strokes);
 if(!input)return '?';
 const candidates=DigitReader.rank(input).map(d=>({text:d.digit,score:d.distance}));
 if(!digitsOnly)for(const s of symbolTemplates)candidates.push({text:s.text,score:DigitReader.compare(input,s)});
 candidates.sort((a,b)=>a.score-b.score);
 const [best,second]=candidates;
 // Keep close calls editable in the review instead of guessing from the exercise.
 return best.score<.18&&second.score-best.score>=.012&&!(best.text==='1'&&input.ratio>1.05)?best.text:'?';
}
// Committed strokes are immutable. Reuse scores for untouched glyphs on each live scan.
function createInkReader(){
 const scores=new WeakMap();
 function readCached(strokes,digitsOnly){
  const first=strokes[0],previous=scores.get(first);
  if(previous&&previous.digitsOnly===digitsOnly&&previous.strokes.length===strokes.length&&
    strokes.every((stroke,index)=>stroke===previous.strokes[index]))return previous.text;
  const text=readGlyph(strokes,digitsOnly);
  scores.set(first,{strokes,digitsOnly,text});
  return text;
 }
 return (strokes,rows,cols,sources)=>read(strokes,rows,cols,{digitsOnly:true,sources},readCached);
}
function readNote(strokes,readDigit){if(!strokes.length)return '';const ordered=strokes.map(s=>({s,b:bounds([s])})).sort((a,b)=>a.b.x0-b.b.x0);const groups=[];for(const o of ordered){const last=groups[groups.length-1];if(last&&o.b.x0<=last.x1+3){last.strokes.push(o.s);last.x1=Math.max(last.x1,o.b.x1);}else groups.push({strokes:[o.s],x1:o.b.x1});}return groups.map(g=>readDigit(g.strokes,true)).join('');}
function read(strokes,rows,cols=COLS,{digitsOnly=false,sources}={},readDigit=readGlyph){const main={},notes={},lines=[],brackets=[],groups={};
 const items=strokes.filter(s=>s.length>=2).map(stroke=>{const b=bounds([stroke]),w=b.x1-b.x0,h=b.y1-b.y0;return {stroke,b,w,h,cx:(b.x0+b.x1)/2/CELL,cy:(b.y0+b.y1)/2/CELL};});
 // A short horizontal cap can belong to a large digit (notably a two-stroke 5).
 // Attach it before deciding that it is a rule or a tiny carry/borrow digit.
 // Long rules remain independent, and a real note above a digit is not merged.
 const caps=new Map();
 for(const item of items){
  if(item.w<CELL*.28||item.w>CELL*1.15||item.h>CELL*.2)continue;
  const aligned=v=>Math.abs(v-Math.round(v))<.15;
  if(item.w>CELL*.7&&Math.abs(item.cy-Math.round(item.cy))<.18&&aligned(item.b.x0/CELL)&&aligned(item.b.x1/CELL))continue;
  const y=(item.b.y0+item.b.y1)/2;
  const anchors=items.filter(a=>a!==item&&a.h>CELL*.36&&a.w<CELL*1.15&&Math.floor(a.cx)>=0&&Math.floor(a.cx)<cols&&y>=a.b.y0-CELL*.18&&y<=a.b.y0+CELL*.25&&Math.min(a.b.x1,item.b.x1)>=Math.max(a.b.x0,item.b.x0)-CELL*.08&&y/CELL>=Math.floor(a.cy)-.15&&y/CELL<Math.floor(a.cy)+.55);
  anchors.sort((a,b)=>Math.abs(y-a.b.y0)-Math.abs(y-b.b.y0));
  if(anchors.length)caps.set(item,anchors[0]);
 }
 for(const item of items){
  const {stroke,b,w,h,cx,cy}=item,anchor=caps.get(item);
  let r=Math.floor(anchor?.cy??cy),c=Math.floor(anchor?.cx??cx);
  if(!anchor){
   const gridY=Math.round(cy);
   if(w>CELL*.55&&h<CELL*.16&&(w>CELL*1.25||Math.abs(cy-gridY)<.18)){lines.push({row:gridY,start:b.x0/CELL,end:b.x1/CELL});continue;}
   const first=stroke[0],last=stroke[stroke.length-1],nearBoundary=Math.abs(cx-Math.round(cx))<.22;
   if(!digitsOnly&&h>CELL*.48&&w>CELL*.06&&w<CELL*.36&&Math.abs(last[1]-first[1])>h*.7&&nearBoundary&&first[0]<b.x1-w*.5&&last[0]<b.x1-w*.5){brackets.push({row:Math.floor(cy),col:Math.round(cx)});continue;}
  }
  if(r<0||r>=rows||c<0||c>=cols)continue;
  const small=!anchor&&h<CELL*.33&&(b.y1/CELL-r)<.37;
  const k=key(r,c),g=groups[k]||(groups[k]={main:[],note:[]});g[small?'note':'main'].push(stroke);
 }
 for(const [k,g]of Object.entries(groups)){
  if(g.main.length){main[k]=readDigit(g.main,digitsOnly);if(sources)sources.main[k]=g.main;}
  if(g.note.length){notes[k]=readNote(g.note,readDigit);if(sources)sources.notes[k]=g.note;}
 }
 return {main,notes,lines,brackets};
}
function divisionShift(model){return model.op==='/'?Math.max(0,String(model.b).length-2):0;}
function placement(model,work){
 if(!model.rightAligned||model.compactPaper)return work;
 const rightEdge=model.op==='/'?String(model.a).length+3+divisionShift(model):model.columns.length+1;
 const shift=Math.max(0,COLS-1-rightEdge);
 return shift?shifted(work,0,shift):work;
}

function expected(model){const main={},notes={},shift=divisionShift(model);for(const cell of Object.values(model.finalCells)){if(cell.kind==='label')continue;const k=key(cell.row+1,cell.col+1+shift);if(cell.kind==='divisor'){String(cell.text).split('').forEach((v,i,ds)=>main[key(cell.row+1,cell.col+1+shift-ds.length+1+i)]=v);continue;}if(cell.text!=='')main[k]=cell.text.replace(/＋/g,'+');if(cell.note!==undefined)notes[k]=String(cell.note);}
const last=model.steps[model.steps.length-1];const lines=Object.values(last.lines).map(l=>({row:l.row+1,start:l.start+1+shift,end:l.end+2+shift}));const brackets=[];if(model.op==='/'){brackets.push({row:2,col:3+shift});lines.push({row:2,start:3+shift,end:model.dividendEnd+2+shift});}
return placement(model,{main,notes,lines,brackets});}
// Only the question operands and its initial rule/bracket are printed.
// No result, partial product, carry, borrow, or quotient is provided here.
function given(model){
 const main={},notes={},lines=[],brackets=[];
 const number=(n,row,end)=>String(n).split('').forEach((v,i,ds)=>main[key(row,end-ds.length+1+i)]=v);
 if(model.op==='/'){
  const count=String(model.a).length,shift=divisionShift(model);number(model.b,2,2+shift);number(model.a,2,count+2+shift);
  brackets.push({row:2,col:3+shift});lines.push({row:2,start:3+shift,end:count+3+shift});
 }else{
  const end=model.columns.length;number(model.a,1,end);number(model.b,2,end);
  main[key(2,1)]=model.op==='+'?'+':model.op==='-'?'−':'×';
  lines.push({row:3,start:1,end:end+1});
 }
 return placement(model,{main,notes,lines,brackets});
}
function gradeWork(model,work,rows){
 const fixed=given(model);
 // Printed operands win over strokes drawn across them; notes remain editable.
 const full={main:{...work.main,...fixed.main},notes:{...work.notes},lines:[...fixed.lines,...work.lines],brackets:[...fixed.brackets,...work.brackets]};
 return grade(model,full,rows,true);
}
function translateKey(k,dr,dc){const [r,c]=k.split(':').map(Number);return key(r+dr,c+dc);}
function shifted(e,dr,dc){return {main:Object.fromEntries(Object.entries(e.main).map(([k,v])=>[translateKey(k,dr,dc),v])),notes:Object.fromEntries(Object.entries(e.notes).map(([k,v])=>[translateKey(k,dr,dc),v])),lines:e.lines.map(l=>({...l,row:l.row+dr,start:l.start+dc,end:l.end+dc})),brackets:e.brackets.map(b=>({row:b.row+dr,col:b.col+dc}))};}
// Grow the worksheet to fit arbitrary calculator inputs, including ten-digit products.
function columns(model){const e=expected(model),g=given(model);return Math.max(model.compactPaper?4:COLS,...Object.keys({...e.main,...e.notes,...g.main}).map(k=>Number(k.split(':')[1])+1),...e.lines.map(l=>Math.ceil(l.end)),...g.lines.map(l=>Math.ceil(l.end)+(model.rightAligned?1:0)));}
function rows(model){
 const lastCell=Math.max(...Object.values(model.finalCells).map(cell=>cell.row));
 if(!model.compactPaper)return Math.max(8,lastCell+4);
 return Math.max(5,lastCell+3,...expected(model).lines.map(line=>line.row+1));
}
function grade(model,recognized,rows,anchored=false){const e=expected(model),cols=columns(model);let best=null;
for(let dr=-1;dr<rows;dr++)for(let dc=-3;dc<cols;dc++){if(anchored&&(dr!==0||dc!==0))continue;const t=shifted(e,dr,dc);if(Object.keys(t.main).some(k=>{const [r,c]=k.split(':').map(Number);return r<0||r>=rows||c<0||c>=cols;}))continue;let good=0,bad=0,missing=0;for(const [k,v]of Object.entries(t.main)){if(recognized.main[k]===v)good++;else if(!recognized.main[k])missing++;else bad++;}const score=good*3-bad*2-missing;if(!best||score>best.score)best={...t,score,dr,dc};}
if(!best)return {ok:false,issues:[{kind:'layout',message:'かく ばしょを もういちど たしかめよう。'}],checks:[]};
const issues=[],checks=[];for(const type of ['main','notes'])for(const [k,v]of Object.entries(best[type])){const actual=recognized[type][k]||'';const ok=actual===v;checks.push({kind:type,key:k,ok});if(!ok)issues.push({kind:type,key:k,actual,missing:actual==='',message:type==='notes'?'ちいさく かく すうじを たしかめよう。':'この マスの すうじ・しるしを たしかめよう。'});}
for(const type of ['main','notes'])for(const k of Object.keys(recognized[type]))if(!best[type][k]&&recognized[type][k])issues.push({kind:type,key:k,message:'この マスにも すうじが あるよ。よみとりを たしかめよう。'});
for(const l of best.lines){const segments=recognized.lines.filter(a=>a.row===l.row).sort((a,b)=>a.start-b.start);let reach=l.start;for(const a of segments)if(a.start<=reach+.5&&a.end>=reach-.5)reach=Math.max(reach,a.end);const ok=reach>=l.end-.5;checks.push({kind:'line',row:l.row,ok});if(!ok)issues.push({kind:'line',row:l.row,message:'けいさんの せんを たしかめよう。'});}
for(const b of best.brackets){const ok=recognized.brackets.some(x=>x.row===b.row&&x.col===b.col);checks.push({kind:'bracket',...b,ok});if(!ok)issues.push({kind:'bracket',...b,message:'わりざんの かたちを たしかめよう。'});}
return {ok:issues.length===0,issues,checks,offset:{row:best.dr,col:best.dc}};
}
root.NotebookEngine={CELL,COLS,columns,rows,read,createInkReader,readGlyph,expected,given,gradeWork,grade,bounds,key};
})(globalThis);
