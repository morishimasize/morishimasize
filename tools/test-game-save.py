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
source = '\n'.join((root / name).read_text() for name in ['steps.js','prototypes/digit-reader.js','prototypes/notebook-engine.js','prototypes/notebook-save.js','prototypes/notebook-tools.js','prototypes/notebook-touch.js','prototypes/notebook-feedback.js','prototypes/notebook-live.js','prototypes/full-notebook.js'])
harness = r'''
const testQuery={touch:'0'};
class URLSearchParams{get(k){return testQuery[k]??null;}}
class ResizeObserver{constructor(fn){} observe(){} disconnect(){}}
const context=new Proxy({}, {get(){return ()=>{};}});
const nodes=new Map();let appHTML='',timerId=0;
const timers=new Map();
function setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;}
function clearTimeout(id){timers.delete(id);}
function flushTimers(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();}
function node(id){if(!nodes.has(id)){let nestedHTML='';const v={id,clientWidth:432,clientHeight:576,value:'',textContent:'',disabled:false,hidden:false,style:{},dataset:{},attributes:{},classList:{add(){},toggle(){}},setAttribute(name,value){this.attributes[name]=value;},focus(){},select(){},scrollIntoView(){},insertAdjacentHTML(){},showModal(){this.open=true;},close(){this.open=false;},getContext(){return context;},width:432,height:id==='row-paper'?72:576,getBoundingClientRect(){return {left:0,top:0,width:id==='row-paper'?672:432,height:id==='row-paper'?112:576};},setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}};Object.defineProperty(v,'innerHTML',{get(){return id==='app'?appHTML:nestedHTML;},set(html){if(id==='app'){appHTML=html;nodes.clear();nodes.set('app',v);}else nestedHTML=html;}});if(id==='row-paper')v.dataset.row=appHTML.match(/id="row-paper" data-row="(\d+)"/)?.[1]||'0';nodes.set(id,v);}return nodes.get(id);}
const markup=()=>appHTML+(nodes.get('live-edit-grid')?.innerHTML||'');
const document={visibilityState:'visible',addEventListener(){},body:node('body'),getElementById(id){if(['app','notice'].includes(id)||markup().includes('id="'+id+'"'))return node(id);return null;},querySelector(selector){return node(selector);},querySelectorAll(selector){const type=selector==='[data-main]'?'main':selector==='[data-note]'?'note':null;if(!type)return [];const found=[];for(const match of markup().matchAll(/<input\b[^>]*>/g)){const key=match[0].match(new RegExp('data-'+type+'="([^"]+)"'));if(key){const el=node(type+':'+key[1]);el.dataset[type]=key[1];el.value=match[0].match(/value="([^"]*)"/)?.[1]||'';el.parentElement=node('cell:'+key[1]);found.push(el);}}return found;}};
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
run(`
 $('resume').onclick();toggleWorkRule(4);check(NotebookSave.read(storage).session.rules[0].row===4,'button rule not saved');
 toggleWorkRule(3);check(extraLines.length===1,'printed rule was replaced');
 undoWork();check(extraLines.length===0,'rule undo failed');toggleWorkRule(4);editRow=5;save();
`);
run(`
 $('resume').onclick();check(extraLines.length===1&&editRow===5,'rule or enlarged row not restored');
 $('rule-tool').onclick();$('paper').onpointerdown({pointerId:9,button:0,clientX:120,clientY:360,preventDefault(){}});
 check(extraLines.some(l=>l.row===5)&&tool==='pen','whole notebook line button failed');
 undoWork();check(extraLines.length===1,'whole notebook line undo failed');
 $('zoom-row').onclick();check(rowEditorOpen,'row editor not opened');
 const canvas=$('row-paper');const event=(x,y)=>({pointerId:2,button:0,clientX:x,clientY:y,preventDefault(){}});
 canvas.onpointerdown(event(250,48));canvas.onpointermove(event(250,99));canvas.onpointerup(event(250,99));
 check(strokes.at(-1)[0][1]>5*72&&strokes.at(-1)[0][1]<6*72,'enlarged ink saved into wrong row');
 $('row-close').onclick();check(!rowEditorOpen,'row editor did not close');
 readAll();check(recognized.lines.some(l=>l.row===4),'button rule lost during reading');
 check(recognized.main['5:2']==='1','enlarged row ink not recognized');
`);

run(`
 $('resume').onclick();$('back-write').onclick();$('erase').onclick();
 const beforeInk=JSON.stringify(strokes),event=(x,y)=>({pointerId:17,button:0,clientX:x,clientY:y,preventDefault(){}});
 $('paper').onpointerdown(event(200,288));
 check(extraLines.length===0&&JSON.stringify(strokes)===beforeInk,'rule erase removed ink or failed');
 check(NotebookSave.read(storage).session.rules.length===0,'erased rule not saved');
 undoWork();check(extraLines.some(l=>l.row===4),'erased rule undo failed');
 const count=history.length;$('paper').onpointerdown(event(5,288));check(extraLines.length===1&&history.length===count,'eraser outside rule span removed it');
 $('paper').onpointerdown(event(200,216));check(E.given(lesson).lines.some(l=>l.row===3),'eraser removed printed rule');
 editRow=3;$('zoom-row').onclick();$('row-erase').onclick();
 $('row-paper').onpointerdown(event(250,111));check(extraLines.length===0,'row editor eraser missed lower boundary');
 check(!$('row-undo').disabled,'row undo button not updated');
 $('row-undo').onclick();check(extraLines.some(l=>l.row===4),'row eraser undo failed');
 $('row-close').onclick();
`);
run(`$('resume').onclick();check(extraLines.some(l=>l.row===4),'restored erased-rule undo lost after reload');`);
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
const calculatorHarness=HARNESS.replace("const testQuery={touch:'0'};","const testQuery={mode:'calculator',op:'+',a:'27',b:'15'};");
new Function('storage','check',calculatorHarness+SOURCE+`\nsave();check(calculatorMode&&phase==='write','calculator initialization');`)(storage,check);
check(JSON.stringify([...values])===before,'calculator modified game saves');

const fingerHarness=HARNESS.replace("const testQuery={touch:'0'};","const testQuery={mode:'calculator',op:'*',a:'23',b:'45'};");
new Function('storage','check',fingerHarness+SOURCE+`\n
 check(fingerNotebook&&phase==='write'&&$('touch-reset'),'finger trial initialization');
 const paper=$('paper');
 $('erase-bottom').onclick();check(tool==='erase'&&$('erase').attributes['aria-pressed']==='true','bottom eraser did not update top');
 $('guide-bottom').onclick();check(guide&&$('guide').attributes['aria-pressed']==='true','bottom hint did not update top');
 $('guide').onclick();check(!guide&&$('guide-bottom').attributes['aria-pressed']==='false','top hint did not update bottom');
 $('pen').onclick();check(tool==='pen'&&$('pen-bottom').attributes['aria-pressed']==='true'&&$('paper')===paper,'tool switch recreated canvas or left bottom state stale');
 const down=(id,x,y)=>$('touch-viewport').onpointerdown({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});
 const move=(id,x,y)=>$('touch-viewport').onpointermove({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 const up=(id,x,y)=>$('touch-viewport').onpointerup({pointerId:id,clientX:x,clientY:y,preventDefault(){}});
 down(1,300,240);move(1,300,270);down(2,400,240);move(2,430,240);up(2);up(1);
 check(strokes.length===0&&history.length===0,'pinch left accidental ink');
 $('touch-reset-bottom').onclick();check(touchViewState.scale===1,'bottom fit did not reset zoom');
 down(3,300,240);move(3,300,275);up(3);check(strokes.length===1,'finger ink not committed');
 check(!$('undo').disabled&&!$('undo-bottom').disabled,'undo availability differs between toolbars');
 $('rule-tool-bottom').onclick();down(4,200,360);check(extraLines.length===0,'rule changed before release');down(5,300,360);up(5);up(4);check(extraLines.length===0,'pinch in rule mode added rule');
 down(6,200,360);up(6);check(extraLines[0].row===5&&tool==='pen'&&$('rule-tool-bottom').attributes['aria-pressed']==='false','finger rule not committed or selected state was stuck');
 $('erase').onclick();down(7,300,250);down(8,400,250);up(8);up(7);check(strokes.length===1,'pinch erased completed ink');
 down(9,200,360);down(10,300,360);up(10);up(9);check(extraLines.length===1,'pinch erased placed rule');
 touchViewState.scale=2;touchViewState.x=-216;touchViewState.y=-288;touchView.draw();
 down(11,216,432);up(11);check(extraLines.length===0&&strokes.length===1,'zoomed eraser missed rule or removed digit');
 $('undo-bottom').onclick();check(extraLines[0].row===5&&touchViewState.scale===2&&$('paper')===paper,'bottom undo lost zoom or failed to restore the rule');
 $('touch-reset').onclick();
 $('pen').onclick();$('open-reading').onclick();
 check(phase==='write'&&$('reading-dialog').open&&recognized.lines[0].row===5&&$('mini-reading').innerHTML.includes('<line'),'finger trial did not preview the rule');
 $('reading-close').onclick();check(!$('reading-dialog').open&&$('paper')===paper&&strokes.length===1,'return from editor lost ink or canvas');
 const incomplete=E.expected(lesson),printed=E.given(lesson);
 const finalRule=incomplete.lines.find(line=>line.row!==printed.lines[0].row);
 incomplete.lines=incomplete.lines.filter(line=>line!==finalRule);
 result=E.gradeWork(lesson,incomplete,rowCount());renderLiveGrade();
 const marks=$('grade-issues').innerHTML;
 check(marks.includes('class="grade-rule" data-row="'+finalRule.row+'" x1="'+(finalRule.start*72+4)+'" x2="'+(finalRule.end*72-4)+'"'),'missing rule was not marked across its actual span');
 const addition=buildLesson('+',45,45),withoutCarry=E.expected(addition);
 const missingNote=Object.keys(withoutCarry.notes)[0];
 delete withoutCarry.notes[missingNote];
 result=E.gradeWork(addition,withoutCarry,E.rows(addition));renderLiveGrade();
 check(result.ok&&!$('grade-issues').innerHTML.includes('data-kind="notes"'),'missing carry affected grading');
 lesson=addition;recognized=withoutCarry;
 renderLiveGrade();
 check(!$('grade-circle').hidden&&$('grade-issues').innerHTML.includes('class="grade-note" data-cell="'+missingNote+'"'),'correct submission missing red annotation or circle');
 check(gradeNoteCells()[missingNote]===E.expected(addition).notes[missingNote],'red annotation used wrong value');
 check(!recognized.notes[missingNote],'annotation changed recognized work');
 check(miniReadingHTML(recognized).includes('class="grade-note"'),'mini notebook missing red annotation');
 recognized.notes[missingNote]='1';
 check(!gradeNotesSVG().includes('data-cell="'+missingNote+'"'),'annotation overlapped a handwritten note');
 delete recognized.notes[missingNote];result=null;renderLiveGrade();
 check(!$('grade-issues').innerHTML&&$('grade-circle').hidden,'ungraded notebook revealed annotations');
 result={ok:false,issues:[]};
 check(!gradeNotesSVG(),'incorrect submission revealed annotations');
 check(unresolvedCells({main:{},notes:{'1:1':'?'}}).length===0,'unclear optional note blocked grading');
 check(unresolvedCells({main:{'3:2':'?'},notes:{}}).length===1,'unclear main digit ignored');
`)(storage,check);
check(JSON.stringify([...values])===before,'finger calculator trial modified game saves');
const easyHarness=HARNESS.replace("const testQuery={touch:'0'};","const testQuery={mode:'calculator',op:'+',a:'1',b:'2'};");
new Function('storage','check',easyHarness+SOURCE+`
 check(columnCount()===4&&rowCount()===5,'easy worksheet did not get a compact grid');
 check($('open-reading')&&$('mark-work')&&$('clear')&&!$('read'),'old reading button is on the normal notebook');
 const canvas=$('touch-viewport');
 const event=(id,x,y)=>({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});
 const state=touchViewState,factor=Math.min(canvas.clientWidth/$('paper').width,canvas.clientHeight/$('paper').height);
 const inkEvent=(id,x,y)=>event(id,state.x+x*factor,state.y+y*factor);
 canvas.onpointerdown(inkEvent(1,153,250));canvas.onpointermove(inkEvent(1,181,264));canvas.onpointerup(inkEvent(1,206,269));
 check(phase==='write'&&timers.size===1,'live reading was not scheduled on release');
 flushTimers();
 check($('ink-questions').innerHTML.includes('data-cell="3:2"')&&$('mini-reading').innerHTML.includes('mini-cell-question')&&recognized.main['3:2']==='?'&&result===null,'ambiguous ink not shown on both boards or was graded');
 $('mark-work').onclick();check($('reading-dialog').open&&result===null,'grading guessed an unresolved value');
 const cell=document.querySelectorAll('[data-main]').find(input=>input.dataset.main==='3:2');
 const reports=[];NotebookFeedback.enqueue=(...args)=>reports.push(args);
 cell.value='3';cell.oninput();
 check(recognized.main['3:2']==='3'&&!$('ink-questions').innerHTML&&strokes.length===1,'correction did not clear both markers or replaced the ink');
 cell.value='4';cell.oninput();
 check(reports.length===0,'a draft digit was sent while being edited');
 $('reading-close').onclick();$('reading-dialog').onclose();
 check(reports.length===1&&reports[0][0]==='main'&&reports[0][1]==='?'&&reports[0][2]==='4'&&reports[0][3].length===1,'closing review did not queue only the final corrected cell');
 $('mark-work').onclick();
 check(!result.ok&&$('grade-circle').hidden&&$('grade-issues').innerHTML.includes('data-cell="3:2"')&&$('grade-issues').innerHTML.includes('grade-cross'),'incorrect digit was not marked in the main notebook');
 $('open-reading').onclick();
 const answer=document.querySelectorAll('[data-main]').find(input=>input.dataset.main==='3:2');
 answer.value='3';answer.oninput();
 check(!$('grade-issues').innerHTML,'editing left the previous grade visible');
 $('reading-close').onclick();$('reading-dialog').onclose();$('mark-work').onclick();
 check(phase==='write'&&result.ok&&$('live-grade').innerHTML.includes('ぜんぶ できたね')&&!$('grade-circle').hidden,'successful grade did not put a red circle on the main notebook');
 canvas.onpointerdown(inkEvent(2,98,252));canvas.onpointerup(inkEvent(2,98,272));flushTimers();
 check(recognized.main['3:2']==='3'&&recognized.main['3:1']==='1'&&result===null&&$('grade-circle').hidden,'new ink elsewhere erased the correction or kept the old grade');
 canvas.onpointerdown(inkEvent(3,180,248));canvas.onpointerup(inkEvent(3,180,275));flushTimers();
 check(!readingCorrections.main['3:2'],'old correction survived handwriting in the same cell');
 $('undo-bottom').onclick();flushTimers();
 check(recognized.main['3:2']==='3','undo did not recover the correction');
 $('clear').onclick();flushTimers();
 check(!Object.keys(recognized.main).length&&!$('ink-questions').innerHTML,'clear left recognized digits');
`)(storage,check);


// Use the normal game URL with no opt-in parameter; exercise saves across reloads.
const normalHarness=HARNESS.replace("const testQuery={touch:'0'};",'const testQuery={};');
function runNormal(code){new Function('storage','check',normalHarness+SOURCE+'\n'+code)(storage,check);}
values.set('hissan-full-notebook-v2',previous);
runNormal(`
 const oldInk=JSON.stringify(savedGame.strokes);
 $('resume').onclick();
 const original=buildLesson(lesson.op,lesson.a,lesson.b);
 check(!lesson.rightAligned&&JSON.stringify(E.given(lesson))===JSON.stringify(E.given(original)),'old save equation moved when opened in the new UI');
 check(JSON.stringify(strokes)===oldInk,'old save ink shifted after resume');
`);
runNormal(`
 check(fingerNotebook,'normal game did not enable finger notebook');
 touchViewState.scale=3;touchViewState.x=-50;$('start').onclick();
 check($('touch-viewport')&&!$('zoom-row')&&!$('row-dialog'),'old row dialog is still the normal entry');
 check(touchViewState.scale===1,'new problem inherited old zoom');
 check(savedGame.rightAligned&&savedGame.compactPaper&&E.given(lesson).main['1:3']==='7'&&columnCount()===5&&rowCount()===5,'new game did not store right-aligned placement');
 const event=(id,x,y)=>({pointerId:id,button:0,clientX:x,clientY:y,preventDefault(){}});
 $('touch-viewport').onpointerdown(event(21,300,245));$('touch-viewport').onpointermove(event(21,300,280));$('touch-viewport').onpointerup(event(21,300,280));
 toggleWorkRule(5);save();check(savedGame.strokes.length===1&&savedGame.rules[0].row===5,'normal game ink/rule not saved');
`);
runNormal(`
 $('resume').onclick();check(fingerNotebook&&strokes.length===1&&extraLines[0].row===5&&lesson.rightAligned&&lesson.compactPaper,'normal game did not restore right-aligned ink and rules');
 $('erase').onclick();const e={pointerId:22,button:0,clientX:200,clientY:360,preventDefault(){}};
 $('touch-viewport').onpointerdown(e);$('touch-viewport').onpointerup(e);
 check(savedGame.rules.length===0,'normal game eraser not saved');
 $('undo').onclick();check(savedGame.rules[0].row===5,'normal game undo not saved');
 extraLines=[];$('open-reading').onclick();
 const expected=E.expected(lesson),fixed=E.given(lesson);
 for(const type of ['main']){
  const nodes=document.querySelectorAll(type==='main'?'[data-main]':'[data-note]');
  for(const el of nodes){
   const key=el.dataset[type==='main'?'main':'note'];
   if(type==='main'&&fixed.main[key]!==undefined)continue;
   const value=expected[type][key]||'';
   if(value!==(recognized[type][key]||'')){el.value=value;el.oninput();}
  }
 }
 check(Object.keys(savedGame.readingCorrections.main).length>0,'live edits were not saved before grading');
 $('reading-close').onclick();
 const count=progress;$('mark-work').onclick();
 check(result.ok&&credited&&progress===count+1&&phase==='write','normal game reward credit failed');
 check($('grade-issues').innerHTML.includes('class="grade-note"')&&Object.keys(savedGame.recognized.notes).length===0,'red notes missing or saved as child work');
`);
runNormal(`
 $('resume').onclick();const count=progress;check(result.ok&&phase==='write'&&hasReadingCorrections(),'normal live corrections and grade not restored');
 check($('grade-issues').innerHTML.includes('class="grade-note"'),'red notes not restored after reload');
 $('mark-work').onclick();check(progress===count,'normal game regrade duplicated credit');
 $('open-reading').onclick();$('reading-close').onclick();check($('touch-viewport')&&strokes.length===1,'normal editor return lost handwriting');
`);
runNormal(`
 config={op:'*',example:1};$('start').onclick();
 const viewport=$('touch-viewport'),paper=$('paper');
 const factor=Math.min(viewport.clientWidth/paper.width,viewport.clientHeight/paper.height);
 const event=(x,y)=>({pointerId:1,button:0,clientX:touchViewState.x+x*factor,clientY:touchViewState.y+y*factor,preventDefault(){}});
 function ink(points){
  viewport.onpointerdown(event(...points[0]));
  for(const point of points.slice(1,-1))viewport.onpointermove(event(...point));
  viewport.onpointerup(event(...points[points.length-1]));
 }
 const one=[[36,28],[36,41],[36,54],[36,65]];
 const zero=[[36,26],[26,29],[21,39],[20,50],[22,62],[29,67],[39,65],[47,56],[50,44],[47,32],[39,26],[36,26]];
 const atAnswer=points=>points.map(([x,y])=>[x+3*72,y+5*72]);
 ink(atAnswer(one));flushTimers();
 $('open-reading').onclick();
 const fixed=E.given(lesson),expected=E.expected(lesson).main;
 for(const el of document.querySelectorAll('[data-main]')){
  const key=el.dataset.main;
  if(key==='5:3'||fixed.main[key]!==undefined)continue;
  el.value=key==='4:2'?'8':key==='5:1'?'1':expected[key]||'';el.oninput();
 }
 $('reading-close').onclick();$('mark-work').onclick();
 const marked=(key,style)=>$('grade-issues').innerHTML.includes('class="grade-'+style+'" data-cell="'+key+'"');
 check(marked('4:2','wrong')&&marked('5:1','wrong')&&marked('5:3','wrong'),'initial multiplication errors not marked');
 $('erase').onclick();ink(atAnswer([[36,41]]));flushTimers();
 check(marked('5:3','missing')&&marked('4:2','wrong')&&marked('5:1','wrong'),'erasing one digit removed its mark or another mark');
 $('pen').onclick();ink(atAnswer(one));flushTimers();
 check(marked('5:3','wrong'),'writing another wrong digit removed its mark');
 $('erase').onclick();ink(atAnswer([[36,41]]));flushTimers();
 $('pen').onclick();ink(atAnswer(zero));flushTimers();
 check(recognized.main['5:3']==='0'&&!marked('5:3','wrong')&&marked('4:2','wrong')&&marked('5:1','wrong'),'handwriting did not clear only the corrected digit');
 check([...$('mini-reading').innerHTML.matchAll(/mini-cell-check/g)].length===2,'mini notebook did not match the remaining digit marks');
 $('undo').onclick();flushTimers();
 check(marked('5:3','missing'),'undoing the correct stroke did not restore its mark');
 ink(atAnswer(zero));flushTimers();
`);
runNormal(`
 $('resume').onclick();
 const marks=()=>$('grade-issues').innerHTML;
 check(marks().includes('data-cell="4:2"')&&marks().includes('data-cell="5:1"')&&!marks().includes('data-cell="5:3"'),'resuming lost the remaining marks');
 $('open-reading').onclick();
 const cells=document.querySelectorAll('[data-main]');
 function correct(key,value){const input=cells.find(el=>el.dataset.main===key);input.value=value;input.oninput();}
 correct('4:2','7');
 check(!marks().includes('data-cell="4:2"')&&marks().includes('data-cell="5:1"'),'editing the reading removed multiple marks');
 correct('5:1','');$('reading-close').onclick();
 check(!marks().includes('data-cell="5:1"')&&marks().includes('class="grade-rule" data-row="5"'),'removing an extra digit hid an unrelated line mark');
 $('clear').onclick();flushTimers();check(!marks(),'clearing the whole notebook left old marks');
 $('undo').onclick();flushTimers();check(marks().includes('class="grade-rule" data-row="5"'),'undoing clear did not restore the remaining mark');
 toggleWorkRule(5);updateWritingPaper(true);flushTimers();
 check(!marks()&&$('grade-circle').hidden&&$('live-grade').innerHTML.includes('もういちど まるつけ'),'the last fix did not clear the line or prematurely showed a correct grade');
 const count=progress;$('mark-work').onclick();
 check(result.ok&&!$('grade-circle').hidden&&progress===count+1,'explicit grading after corrections did not award credit');
`);
log('PASS: '+assertions+' game persistence/controller checks, including reloads, ink, review edits, auto credit, duplicate prevention, migration and failures.');
'''
script = 'const SOURCE='+json.dumps(source)+';\nconst HARNESS='+json.dumps(harness)+';\n'+tests
with tempfile.TemporaryDirectory(prefix='hissan-game-save-') as directory:
    path = Path(directory) / 'test.js'
    path.write_text(script)
    subprocess.run([runtime,str(path)],check=True,cwd=root)
