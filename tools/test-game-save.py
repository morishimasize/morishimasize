#!/usr/bin/env python3
"""Exercise actual game controllers across reloads with an in-memory DOM and storage."""
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
source = '\n'.join((root / name).read_text() for name in ['steps.js','prototypes/digit-reader.js','prototypes/notebook-engine.js','prototypes/notebook-save.js','prototypes/full-notebook.js'])
harness = r'''
const testQuery={};
class URLSearchParams{get(k){return testQuery[k]??null;}}
const context=new Proxy({}, {get(){return ()=>{};}});
const nodes=new Map();let appHTML='';
function node(id){if(!nodes.has(id)){const v={value:'',textContent:'',disabled:false,hidden:false,style:{},dataset:{},classList:{add(){},toggle(){}},setAttribute(){},focus(){},scrollIntoView(){},insertAdjacentHTML(){},getContext(){return context;},width:432,height:576,getBoundingClientRect(){return {left:0,top:0,width:432,height:576};},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}};Object.defineProperty(v,'innerHTML',{get(){return id==='app'?appHTML:'';},set(html){if(id==='app'){appHTML=html;nodes.clear();nodes.set('app',v);}}});nodes.set(id,v);}return nodes.get(id);}
const document={visibilityState:'visible',addEventListener(){},body:node('body'),getElementById(id){if(['app','notice'].includes(id)||appHTML.includes('id="'+id+'"'))return node(id);return null;},querySelector(selector){return node(selector);},querySelectorAll(selector){const type=selector==='[data-main]'?'main':selector==='[data-note]'?'note':null;if(!type)return [];const found=[];for(const match of appHTML.matchAll(/<input\b[^>]*>/g)){const key=match[0].match(new RegExp('data-'+type+'="([^"]+)"'));if(key){const el=node(type+':'+key[1]);el.dataset[type]=key[1];el.value=match[0].match(/value="([^"]*)"/)?.[1]||'';found.push(el);}}return found;}};
const window={location:{search:'',href:''},scrollTo(){},addEventListener(){}};
const localStorage=storage;
'''
tests = r'''
const log=typeof print==='function'?print:console.log;
let assertions=0;function check(v,m){assertions++;if(!v)throw Error(m);}
let failWrite=false;const values=new Map([['hissan-full-notebook-v1','5']]);
const storage={getItem(k){return values.has(k)?values.get(k):null;},setItem(k,v){if(failWrite)throw Error('quota');values.set(k,v);}};
function run(code){new Function('storage','check',HARNESS+SOURCE+'\n'+code)(storage,check);}
run(`
 check(progress===5,'legacy progress not migrated');
 check(phase==='setup','initial setup');
 $('start').onclick();check(savedGame.phase==='write','new notebook not saved');
 const canvas=$('paper');const event=(x,y)=>({pointerId:1,button:0,clientX:x,clientY:y,preventDefault(){}});
 canvas.onpointerdown(event(250,250));canvas.onpointermove(event(250,280));canvas.onpointerup(event(250,280));
 check(NotebookSave.read(storage).session.strokes.length===1,'stroke end not saved');
`);
run(`
 check(savedGame.strokes.length===1,'stroke lost on reload');
 $('resume').onclick();check(phase==='write'&&strokes.length===1,'resume failed');
 readAll();check(phase==='review'&&result===null,'recognition graded before confirmation');
 recognized=E.expected(lesson);for(const k of Object.keys(E.given(lesson).main))delete recognized.main[k];
 review();$('grade').onclick();
 check(result.ok&&progress===6&&credited,'correct grading not credited immediately');
 const v=NotebookSave.read(storage);check(v.progress===6&&v.session.credited&&v.session.graded,'correct result not atomically saved');
`);
run(`
 $('resume').onclick();check(phase==='review'&&result.ok&&credited,'graded review not restored');
 $('grade').onclick();check(progress===6,'regrade earned reward twice');
 $('reward').onclick();check(phase==='reward'&&NotebookSave.read(storage).progress===6,'viewing picture earned twice');
`);
run(`
 $('resume').onclick();check(phase==='reward'&&progress===6,'reward screen not restored');
 $('return').onclick();check(phase==='review','return to notebook');
 const input=document.querySelectorAll('[data-main]').find(el=>el.dataset.main==='3:3');input.value='9';input.oninput();
 check(result===null&&!NotebookSave.read(storage).session.graded,'review edit not saved');
 check(NotebookSave.read(storage).session.recognized.main['3:3']==='9','corrected reading lost');
 $('grade').onclick();check(!result.ok&&progress===6,'wrong regrade added progress');
`);
run(`
 $('resume').onclick();check(phase==='review'&&!result.ok&&progress===6,'incorrect result restore');
 $('back-write').onclick();$('clear').onclick();check(NotebookSave.read(storage).session.strokes.length===0,'clear not saved');
 $('undo').onclick();check(NotebookSave.read(storage).session.strokes.length===1,'undo not saved');
 $('back').onclick();check(phase==='setup'&&savedGame.strokes.length===1,'setup lost saved notebook');
 config={op:'*',example:1};$('book').onclick();$('return').onclick();check(NotebookSave.read(storage).session.config.op==='+','new selection corrupted saved equation');
 $('back-write').onclick();$('back').onclick();
 $('start').onclick();check(!credited&&strokes.length===0&&progress===6,'new attempt did not reset only notebook');
`);
const previous=values.get('hissan-full-notebook-v2');failWrite=true;
run(`$('resume').onclick();check(!storageOK,'save failure hidden');`);
check(values.get('hissan-full-notebook-v2')===previous,'failed write destroyed previous save');failWrite=false;
// Corrupt a session while retaining valid earned progress.
values.set('hissan-full-notebook-v2',JSON.stringify({version:2,progress:6,session:{version:1,phase:'review',strokes:'bad'}}));
run(`check(progress===6&&savedGame===null,'invalid session erased earned progress');`);
values.set('hissan-full-notebook-v2','broken JSON');
run(`check(progress===5&&savedGame===null,'corrupt record did not fall back safely');`);
// Calculator mode must leave game progress and the notebook untouched.
const before=JSON.stringify([...values]);
const calculatorHarness=HARNESS.replace('const testQuery={};',"const testQuery={mode:'calculator',op:'+',a:'27',b:'15'};");
new Function('storage','check',calculatorHarness+SOURCE+`\nsave();check(calculatorMode&&phase==='write','calculator initialization');`)(storage,check);
check(JSON.stringify([...values])===before,'calculator modified game saves');
log('PASS: '+assertions+' game persistence/controller checks, including reloads, ink, review edits, auto credit, duplicate prevention, migration and failures.');
'''
script = 'const SOURCE='+json.dumps(source)+';\nconst HARNESS='+json.dumps(harness)+';\n'+tests
with tempfile.TemporaryDirectory(prefix='hissan-game-save-') as directory:
    path = Path(directory) / 'test.js'
    path.write_text(script)
    subprocess.run([runtime,str(path)],check=True,cwd=root)
