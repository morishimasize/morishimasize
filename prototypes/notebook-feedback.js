/* Uploads only confirmed reading corrections from a registered browser. */
(function(root){
'use strict';
const site='https://hissan-note-feedback.artfulcookie1.chatgpt.site';
const tokenKey='hissan-feedback-device-v1';
const pendingPrefix='hissan-feedback-pending-v1:';
const modelKey='hissan-recognition-tuning-v1';
const tokenPattern=/^[a-f0-9]{64}$/;
let active=null,retryTimer,delay=1000;

function get(key){try{return localStorage.getItem(key);}catch{return null;}}
function put(key,value){try{localStorage.setItem(key,value);return true;}catch{return false;}}
function remove(key){try{localStorage.removeItem(key);}catch{}}
function pending(){
 const keys=[];
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i);
   if(key?.startsWith(pendingPrefix))keys.push(key);
  }
 }catch{}
 return keys;
}
function device(){const value=get(tokenKey);return tokenPattern.test(value||'')?value:null;}
function request(token,method,body,signal){
 return fetch(site+'/api/feedback',{
  method,body,signal,keepalive:true,credentials:'omit',referrerPolicy:'no-referrer',
  headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})}
 });
}
function clearDevice(){
 remove(tokenKey);
 for(const key of pending())remove(key);
 active?.abort();
 clearTimeout(retryTimer);
 delay=1000;
}
async function enable(value){
 const token=value.trim();
 if(!tokenPattern.test(token))return false;
 try{
  const response=await request(token,'HEAD');
  if(!response.ok)return false;
  const old=device();
  if(old===token)return true;
  if(!put(tokenKey,token))return false;
  if(old){
   for(const key of pending())remove(key);
   active?.abort();
   request(old,'DELETE').catch(()=>{});
  }
  clearTimeout(retryTimer);
  delay=1000;
  return true;
 }catch{return false;}
}
function disable(){
 const token=device();
 clearDevice();
 if(token)request(token,'DELETE').catch(()=>{});
}
async function flush(){
 if(active)return;
 const token=device();
 if(!token||!pending().length)return;
 clearTimeout(retryTimer);
 active=new AbortController();
 try{
  while(device()===token){
   const key=pending()[0];
   if(!key)break;
   const body=get(key);
   if(!body)break;
   const response=await request(token,'POST',body,active.signal);
   if(response.status===401){if(device()===token)clearDevice();break;}
   if(!response.ok&&response.status!==400)throw Error('Unable to submit handwriting correction');
   if(device()===token&&get(key)===body)remove(key);
   delay=1000;
  }
 }catch{
  if(device()===token){
   retryTimer=setTimeout(flush,delay);
   delay=Math.min(delay*2,60000);
  }
 }finally{active=null;}
}
function normalizedInk(strokes){
 const lines=(strokes||[]).filter(stroke=>stroke.length>1);
 if(!lines.length||lines.length>8)return null;
 const perStroke=Math.floor(160/lines.length);
 const sampled=lines.map(stroke=>{
  if(stroke.length<=perStroke)return stroke;
  return Array.from({length:perStroke},(_,i)=>stroke[Math.round(i*(stroke.length-1)/(perStroke-1))]);
 });
 const points=sampled.flat();
 const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
 const left=Math.min(...xs),top=Math.min(...ys);
 const span=Math.max(Math.max(...xs)-left,Math.max(...ys)-top);
 if(!Number.isFinite(span)||span<=0)return null;
 return sampled.map(stroke=>stroke.map(([x,y])=>[
  Math.round((x-left)*1000/span),Math.round((y-top)*1000/span)
 ]));
}
function enqueue(kind,before,after,strokes){
 if(!device()||before===after||!/^\d$/.test(after)||!(/^[0-9?]$/.test(before)))return;
 const source=document.querySelector('script[src^="digit-reader.js?v="]')?.getAttribute('src');
 const reader=source?.match(/[?&]v=(ink\d{1,5})(?:&|$)/)?.[1];
 if(!reader||!['main','notes'].includes(kind)||pending().length>=200)return;
 const ink=normalizedInk(strokes);
 if(!ink)return;
 const id=crypto.randomUUID();
 if(put(pendingPrefix+id,JSON.stringify({id,before,after,reader,kind,strokes:ink})))void flush();
}

function loadRecognitionRules(){
 const tuning=root.RecognitionTuning;
 if(!tuning)return;
 const cached=()=>{try{return tuning.validate(JSON.parse(get(modelKey)));}catch{return null;}};
 tuning.install(cached());
 // Keep a notebook's decisions consistent while it is open. The next page load uses the update.
 fetch(site+'/api/recognition-model',{
  credentials:'omit',referrerPolicy:'no-referrer',cache:'no-cache'
 }).then(response=>response.ok?response.json():null).then(value=>{
  const model=tuning.validate(value);
  if(model&&model.revision>=(cached()?.revision??0))put(modelKey,JSON.stringify(model));
 }).catch(()=>{});
}

window.addEventListener('online',flush);
window.addEventListener('pageshow',flush);
window.addEventListener('storage',event=>{
 if(event.key===tokenKey||event.key===null)active?.abort();
});
root.NotebookFeedback={site,enabled:()=>Boolean(device()),enable,disable,enqueue,pending:()=>pending().length,flush};
loadRecognitionRules();
})(globalThis);
