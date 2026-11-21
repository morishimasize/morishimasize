/* A blank grid worksheet: recognition never receives the expected answer. */
(function(root){
'use strict';
const CELL=72,COLS=6;
const key=(r,c)=>`${r}:${c}`;
const bounds=strokes=>{const p=strokes.flat();return {x0:Math.min(...p.map(p=>p[0])),x1:Math.max(...p.map(p=>p[0])),y0:Math.min(...p.map(p=>p[1])),y1:Math.max(...p.map(p=>p[1]))};};
function normalizeSymbol(s){return DigitReader.normalize(s)?.cloud;}
function distance(a,b){let sum=0;for(const p of a){let d=Infinity;for(const q of b)d=Math.min(d,Math.hypot(p[0]-q[0],p[1]-q[1]));sum+=d;}return sum/a.length;}
const symbols={'+':[[[50,12],[50,88]],[[12,50],[88,50]]],'−':[[[12,50],[88,50]]],'×':[[[15,15],[85,85]],[[85,15],[15,85]]]};
const symbolCloud=Object.entries(symbols).map(([text,strokes])=>({text,cloud:normalizeSymbol(strokes)}));
function readGlyph(strokes){const digit=DigitReader.recognize(strokes);const cloud=normalizeSymbol(strokes);if(!cloud)return '?';const candidates=digit.map(d=>({text:d.digit,score:d.distance}));for(const s of symbolCloud)candidates.push({text:s.text,score:(distance(cloud,s.cloud)+distance(s.cloud,cloud))/2});candidates.sort((a,b)=>a.score-b.score);return candidates[0]?.score<.2?candidates[0].text:'?';}
function readNote(strokes){if(!strokes.length)return '';const ordered=strokes.map(s=>({s,b:bounds([s])})).sort((a,b)=>a.b.x0-b.b.x0);const groups=[];for(const o of ordered){const last=groups[groups.length-1];if(last&&o.b.x0<=last.x1+3){last.strokes.push(o.s);last.x1=Math.max(last.x1,o.b.x1);}else groups.push({strokes:[o.s],x1:o.b.x1});}return groups.map(g=>DigitReader.recognize(g.strokes)[0]?.digit||'?').join('');}
function read(strokes,rows,cols=COLS){const main={},notes={},lines=[],brackets=[],groups={};
for(const stroke of strokes){if(stroke.length<2)continue;const b=bounds([stroke]),w=b.x1-b.x0,h=b.y1-b.y0;const cy=(b.y0+b.y1)/2/CELL,cx=(b.x0+b.x1)/2/CELL;const gridY=Math.round(cy);if(w>CELL*.55&&h<CELL*.16&&(w>CELL*1.25||Math.abs(cy-gridY)<.18)){lines.push({row:gridY,start:b.x0/CELL,end:b.x1/CELL});continue;}
const first=stroke[0],last=stroke[stroke.length-1];const nearBoundary=Math.abs(cx-Math.round(cx))<.22;
if(h>CELL*.48&&w>CELL*.06&&w<CELL*.36&&Math.abs(last[1]-first[1])>h*.7&&nearBoundary&&first[0]<b.x1-w*.5&&last[0]<b.x1-w*.5){brackets.push({row:Math.floor(cy),col:Math.round(cx)});continue;}
const r=Math.floor(cy),c=Math.floor(cx);if(r<0||r>=rows||c<0||c>=cols)continue;const small=h<CELL*.33&&(b.y1/CELL-r)<.37;const k=key(r,c);const g=groups[k]||(groups[k]={main:[],note:[]});g[small?'note':'main'].push(stroke);
}
for(const [k,g]of Object.entries(groups)){if(g.main.length)main[k]=readGlyph(g.main);if(g.note.length)notes[k]=readNote(g.note);}
return {main,notes,lines,brackets};}
function divisionShift(model){return model.op==='/'?Math.max(0,String(model.b).length-2):0;}
function expected(model){const main={},notes={},shift=divisionShift(model);for(const cell of Object.values(model.finalCells)){if(cell.kind==='label')continue;const k=key(cell.row+1,cell.col+1+shift);if(cell.kind==='divisor'){String(cell.text).split('').forEach((v,i,ds)=>main[key(cell.row+1,cell.col+1+shift-ds.length+1+i)]=v);continue;}if(cell.text!=='')main[k]=cell.text.replace(/＋/g,'+');if(cell.note!==undefined)notes[k]=String(cell.note);}
const last=model.steps[model.steps.length-1];const lines=Object.values(last.lines).map(l=>({row:l.row+1,start:l.start+1+shift,end:l.end+2+shift}));const brackets=[];if(model.op==='/'){brackets.push({row:2,col:3+shift});lines.push({row:2,start:3+shift,end:model.dividendEnd+2+shift});}
return {main,notes,lines,brackets};}
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
 return {main,notes,lines,brackets};
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
function columns(model){const e=expected(model),g=given(model);return Math.max(COLS,...Object.keys({...e.main,...e.notes,...g.main}).map(k=>Number(k.split(':')[1])+1),...e.lines.map(l=>Math.ceil(l.end)),...g.lines.map(l=>Math.ceil(l.end)));}
function grade(model,recognized,rows,anchored=false){const e=expected(model),cols=columns(model);let best=null;
for(let dr=-1;dr<rows;dr++)for(let dc=-3;dc<cols;dc++){if(anchored&&(dr!==0||dc!==0))continue;const t=shifted(e,dr,dc);if(Object.keys(t.main).some(k=>{const [r,c]=k.split(':').map(Number);return r<0||r>=rows||c<0||c>=cols;}))continue;let good=0,bad=0,missing=0;for(const [k,v]of Object.entries(t.main)){if(recognized.main[k]===v)good++;else if(!recognized.main[k])missing++;else bad++;}const score=good*3-bad*2-missing;if(!best||score>best.score)best={...t,score,dr,dc};}
if(!best)return {ok:false,issues:[{kind:'layout',message:'かく ばしょを もういちど たしかめよう。'}],checks:[]};
const issues=[],checks=[];for(const type of ['main','notes'])for(const [k,v]of Object.entries(best[type])){const actual=recognized[type][k]||'';const ok=actual===v;checks.push({kind:type,key:k,ok});if(!ok)issues.push({kind:type,key:k,actual,missing:actual==='',message:type==='notes'?'ちいさく かく すうじを たしかめよう。':'この マスの すうじ・しるしを たしかめよう。'});}
for(const type of ['main','notes'])for(const k of Object.keys(recognized[type]))if(!best[type][k]&&recognized[type][k])issues.push({kind:type,key:k,message:'この マスにも すうじが あるよ。よみとりを たしかめよう。'});
for(const l of best.lines){const segments=recognized.lines.filter(a=>a.row===l.row).sort((a,b)=>a.start-b.start);let reach=l.start;for(const a of segments)if(a.start<=reach+.5&&a.end>=reach-.5)reach=Math.max(reach,a.end);const ok=reach>=l.end-.5;checks.push({kind:'line',row:l.row,ok});if(!ok)issues.push({kind:'line',row:l.row,message:'けいさんの せんを たしかめよう。'});}
for(const b of best.brackets){const ok=recognized.brackets.some(x=>x.row===b.row&&x.col===b.col);checks.push({kind:'bracket',...b,ok});if(!ok)issues.push({kind:'bracket',...b,message:'わりざんの かたちを たしかめよう。'});}
return {ok:issues.length===0,issues,checks,offset:{row:best.dr,col:best.dc}};
}
root.NotebookEngine={CELL,COLS,columns,read,readGlyph,expected,given,gradeWork,grade,bounds,key};
})(globalThis);
