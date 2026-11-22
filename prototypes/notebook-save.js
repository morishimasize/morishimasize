/* One atomic record keeps earned picture progress and the unfinished notebook together. */
(function(root){
'use strict';
const KEY='hissan-full-notebook-v2',LEGACY='hissan-full-notebook-v1';
const count=v=>Number.isSafeInteger(v)&&v>=0;
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=10000;
function validWork(w){
 if(!w||typeof w!=='object')return false;
 for(const name of ['main','notes']){
  if(!w[name]||typeof w[name]!=='object'||Array.isArray(w[name]))return false;
  if(!Object.entries(w[name]).every(([k,v])=>/^\d{1,2}:\d{1,2}$/.test(k)&&typeof v==='string'&&/^[0-9+−×?]{1,2}$/.test(v)))return false;
 }
 return Array.isArray(w.lines)&&w.lines.length<=300&&w.lines.every(l=>l&&[l.row,l.start,l.end].every(finite))&&Array.isArray(w.brackets)&&w.brackets.length<=100&&w.brackets.every(b=>b&&[b.row,b.col].every(finite));
}
function validCorrections(c){
 if(!c||typeof c!=='object')return false;
 for(const name of ['main','notes']){
  const cells=c[name];
  if(!cells||typeof cells!=='object'||Array.isArray(cells))return false;
  const length=name==='main'?1:2;
  if(!Object.entries(cells).every(([key,edit])=>/^\d{1,2}:\d{1,2}$/.test(key)&&edit&&
   typeof edit.value==='string'&&edit.value.length<=length&&/^[0-9+−×?]*$/.test(edit.value)&&
   typeof edit.source==='string'&&edit.source.length<=100000&&/^[a-z0-9.]*$/.test(edit.source)))return false;
 }
 for(const name of ['lines','brackets']){
  const edit=c[name];
  if(edit===undefined)continue;
  if(!edit||typeof edit.source!=='string'||edit.source.length>100000||
   !validWork({main:{},notes:{},lines:[],brackets:[],[name]:edit.value}))return false;
 }
 return true;
}
function validIssueTargets(targets){
 return Array.isArray(targets)&&targets.length<=10000&&targets.every(id=>typeof id==='string'&&/^(?:main:\d{1,2}:\d{1,2}|line:\d{1,2}:\d{1,2}:\d{1,2}|bracket:\d{1,2}:\d{1,2}|layout)$/.test(id));
}
function validProblem(c){
 if(!c||!['+','-','*','/'].includes(c.op)||!Number.isInteger(c.example)||c.example< -1||c.example>2)return false;
 if(c.a===undefined&&c.b===undefined)return c.example>=0;
 if(![c.a,c.b].every(n=>Number.isInteger(n)&&n>=0&&n<=99999))return false;
 return !(c.op==='/'&&c.b===0||c.op==='-'&&c.a<c.b);
}
function validSession(s){return s&&s.version===1&&validProblem(s.config)&&['write','review','reward'].includes(s.phase)&&typeof s.credited==='boolean'&&typeof s.graded==='boolean'&&(s.issueTargets===undefined||validIssueTargets(s.issueTargets))&&(s.readingCorrections===undefined||validCorrections(s.readingCorrections))&&(s.rightAligned===undefined||typeof s.rightAligned==='boolean')&&(s.compactPaper===undefined||typeof s.compactPaper==='boolean')&&(s.rules===undefined||Array.isArray(s.rules)&&s.rules.length<=100&&s.rules.every(l=>l&&[l.row,l.start,l.end].every(finite)))&&(s.editRow===undefined||Number.isInteger(s.editRow)&&s.editRow>=0&&s.editRow<100)&&Array.isArray(s.strokes)&&s.strokes.length<=10000&&s.strokes.every(stroke=>Array.isArray(stroke)&&stroke.length<=20000&&stroke.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite)))&&(s.recognized===null||validWork(s.recognized))&&(s.phase==='write'||s.recognized!==null);}
function read(storage){
 const raw=storage.getItem(KEY);
 if(raw!==null){
  try{const v=JSON.parse(raw);if(v?.version===2&&count(v.progress))return {progress:v.progress,session:validSession(v.session)?v.session:null};}catch{}
 }
 const legacy=Number(storage.getItem(LEGACY));
 return {progress:count(legacy)?legacy:0,session:null};
}
function write(storage,progress,session){
 if(!count(progress)||(session!==null&&!validSession(session)))throw Error('invalid notebook save');
 storage.setItem(KEY,JSON.stringify({version:2,progress,session}));
}
root.NotebookSave={KEY,LEGACY,read,write,validSession};
})(globalThis);
