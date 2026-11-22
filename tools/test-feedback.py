#!/usr/bin/env python3
"""Check the feedback queue, consent, payload minimization, and retry behavior."""
from pathlib import Path
import json
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
jsc = Path('/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc')
runtime = shutil.which('node') or (str(jsc) if jsc.exists() else None)
if not runtime:
    raise SystemExit('Node.js または macOS JavaScriptCore が必要です。')

test = r'''
const events = {};
const window = {addEventListener: (key, fn) => events[key] = fn};
const document = {querySelector: () => ({getAttribute: () => 'digit-reader.js?v=ink6'})};
const values = new Map();
const localStorage = {
 get length(){return values.size;}, key: i => [...values.keys()][i],
 getItem: key => values.get(key)??null, setItem: (key,value) => values.set(key,value),
 removeItem: key => values.delete(key)
};
let counter=0;
const crypto={randomUUID:()=>String(++counter)};
class AbortController{constructor(){this.signal={};}abort(){this.signal.aborted=true;}}
const requests=[];
let offline=false;
async function fetch(url,request){
 requests.push({url,request});
 if(offline)throw Error('offline');
 return {ok:true,status:204};
}
let retry;
function setTimeout(fn){retry=fn;return 1;}
function clearTimeout(){retry=null;}
const tick=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

async function test(){
 const app=NotebookFeedback;
 const check=(value,message)=>{if(!value)throw Error(message);};
 const ink=[[[155,240],[180,260],[190,280]],[[180,280],[148,297]]];
 app.enqueue('main','?','3',ink);
 await tick();
 check(!requests.length&&!app.enabled(),'an unregistered device sent or enabled feedback');
 check(!(await app.enable('incorrect'))&&!requests.length,'invalid activation sent a request');
 check(await app.enable('a'.repeat(64))&&app.enabled(),'registration did not enable automatic sending');
 app.enqueue('main','3','3',ink);
 app.enqueue('main','?','',ink);
 app.enqueue('main','?','3',[]);
 check(requests.length===1,'an unchanged, empty, or unlabelled glyph was sent');
 offline=true;
 app.enqueue('main','?','3',ink);
 await tick();
 check(app.pending()===1&&retry,'a failed upload was not retained');
 const first=JSON.parse(requests[1].request.body);
 check(first.before==='?'&&first.after==='3'&&first.reader==='ink6'&&first.kind==='main','missing feedback fields');
 check(Object.keys(first).sort().join(',')==='after,before,id,kind,reader,strokes','payload includes unrelated data');
 check(JSON.stringify(first.strokes)==='[[[123,0],[561,351],[737,702]],[[561,702],[0,1000]]]','ink coordinates were not normalized');
 offline=false;
 await events.online();
 check(app.pending()===0&&JSON.parse(requests[2].request.body).id===first.id,'retry invented a duplicate or did not clear the queue');
 offline=true;
 app.enqueue('notes','8','3',ink);
 await tick();
 app.disable();
 check(!app.enabled()&&app.pending()===0&&!retry,'disabling did not erase queued reports');
 check(requests.at(-1).request.method==='DELETE','disabling did not ask to revoke the device token');
 await events.pageshow();
 check(requests.at(-1).request.method==='DELETE','disabled device retried an old report');

 const key='hissan-recognition-tuning-v1';
 const v1={schema:1,baseline:'ink6',revision:1,rules:{'93uwl':'9'}};
 const v2={schema:1,baseline:'ink6',revision:2,rules:{}};
 localStorage.setItem(key,JSON.stringify(v1));
 const getModel=async(url,request)=>{
  check(url.endsWith('/api/recognition-model')&&!request.body&&request.credentials==='omit','model lookup sent notebook data');
  return {ok:true,json:async()=>v2};
 };
 const openNotebook=new Function('localStorage','window','fetch',tuningSource+'\n'+feedbackSource);
 openNotebook(localStorage,window,getModel);
 const input={ratio:.82,length:2.5};
 const choices=[{digit:'9',distance:.08},{digit:'3',distance:.087}];
 check(RecognitionTuning.read(input,choices)==='9','cached rule was not used at startup');
 await tick();
 check(JSON.parse(localStorage.getItem(key)).revision===2,'new model did not reach the cache');
 check(RecognitionTuning.read(input,choices)==='9','model changed under an open notebook');
 openNotebook(localStorage,window,getModel);
 check(RecognitionTuning.read(input,choices)==='?','next notebook kept a withdrawn rule');
 check(!RecognitionTuning.validate({...v1,baseline:'ink5'})&&
       !RecognitionTuning.validate({...v1,rules:{'93uwl':'6'}}),'incompatible model was accepted');
 (typeof print==='function'?print:console.log)('PASS: feedback queue, automatic upload, retry, opt-out, and versioned model download');
}
'''

source = (root / 'prototypes/notebook-feedback.js').read_text()
tuning = (root / 'prototypes/recognition-tuning.js').read_text()
handle_error = 'error => { print(error); quit(1); }' if runtime == str(jsc) else 'error => { console.error(error); process.exitCode=1; }'
with tempfile.TemporaryDirectory(prefix='hissan-feedback-') as directory:
    path = Path(directory) / 'test.js'
    path.write_text('const tuningSource=' + json.dumps(tuning) + ';\nconst feedbackSource=' + json.dumps(source) + ';\n'
                    + test + '\n' + source + '\ntest().catch(' + handle_error + ');\n')
    subprocess.run([runtime, str(path)], check=True, cwd=root)
