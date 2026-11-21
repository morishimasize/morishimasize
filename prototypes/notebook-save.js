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
function validSession(s){return s&&s.version===1&&s.config&&['+','-','*','/'].includes(s.config.op)&&Number.isInteger(s.config.example)&&s.config.example>=0&&s.config.example<3&&['write','review','reward'].includes(s.phase)&&typeof s.credited==='boolean'&&typeof s.graded==='boolean'&&(s.rules===undefined||Array.isArray(s.rules)&&s.rules.length<=100&&s.rules.every(l=>l&&[l.row,l.start,l.end].every(finite)))&&(s.editRow===undefined||Number.isInteger(s.editRow)&&s.editRow>=0&&s.editRow<100)&&Array.isArray(s.strokes)&&s.strokes.length<=10000&&s.strokes.every(stroke=>Array.isArray(stroke)&&stroke.length<=20000&&stroke.every(p=>Array.isArray(p)&&p.length===2&&p.every(finite)))&&(s.recognized===null||validWork(s.recognized))&&(s.phase==='write'||s.recognized!==null);}
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
