#!/usr/bin/env python3
"""Run calculator worksheet regressions with Node.js or macOS JavaScriptCore."""
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
JSC = Path('/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc')
runtime = shutil.which('node') or (str(JSC) if JSC.exists() else None)
if not runtime:
    raise SystemExit('Node.js または macOS JavaScriptCore が必要です。')
source = '\n'.join((ROOT / name).read_text() for name in ['steps.js', 'prototypes/digit-reader.js', 'prototypes/notebook-engine.js'])
tests = r'''
const log=typeof print==='function'?print:console.log;
let checks=0,worksheets=0;
function assert(ok,message){checks++;if(!ok)throw Error(message);}
const pairs=[[27,15],[52,28],[302,178],[23,14],[36,25],[72,3],[83,4],[125,8],[0,0],[0,99999],[99999,0],[99999,1],[99999,99999],[10005,5],[99999,12345],[12,12345],[99999,999],[12345,100],[10000,9999]];
let seed=721;for(let i=0;i<35;i++){seed=(seed*1664525+1013904223)>>>0;const a=seed%100000;seed=(seed*1664525+1013904223)>>>0;pairs.push([a,seed%100000]);}
const E=NotebookEngine;
for(const op of ['+','-','*','/'])for(const [a,b]of pairs){
 if(op==='-'&&a<b||op==='/'&&b===0)continue;
 for(const [rightAligned,compactPaper] of [[false,false],[true,false],[true,true]]){
 const m=Object.assign(buildLesson(op,a,b),{rightAligned,compactPaper}),e=E.expected(m),g=E.given(m),cols=E.columns(m),rows=E.rows(m);
 const work=JSON.parse(JSON.stringify(e));for(const k of Object.keys(g.main))delete work.main[k];
 work.lines=work.lines.filter(l=>!g.lines.some(x=>x.row===l.row&&x.start===l.start&&x.end===l.end));work.brackets=[];
 assert(E.gradeWork(m,work,rows).ok,'correct work rejected '+a+op+b);
 assert(!E.gradeWork(m,{main:{},notes:{},lines:[],brackets:[]},rows).ok,'empty worksheet accepted');
 for(const k of Object.keys({...e.main,...e.notes,...g.main})){const [r,c]=k.split(':').map(Number);assert(r>=0&&r<rows&&c>=0&&c<cols,'out of bounds '+a+op+b+' '+k);}
 assert(Object.keys(g.notes).length===0,'printed carries');
 assert(Object.keys(g.main).every(k=>g.main[k]===e.main[k]),'printed operands differ from grading');
 const bad=JSON.parse(JSON.stringify(work)),key=Object.keys(work.main)[0];bad.main[key]=work.main[key]==='9'?'8':'9';
 assert(!E.gradeWork(m,bad,rows).ok,'incorrect answer accepted');
 if(Object.keys(work.notes).length)assert(!E.gradeWork(m,{...work,notes:{}},rows).ok,'missing carries accepted');
 if(work.lines.length)assert(!E.gradeWork(m,{...work,lines:[]},rows).ok,'missing intermediate rules accepted');
 if(op==='/')assert(Object.values(g.main).every(x=>/^\d$/.test(x)),'divisor not split into cells');
 if(rightAligned)assert(Math.max(...Object.keys(g.main).map(k=>Number(k.split(':')[1])))===cols-2,'printed equation has no single right margin '+a+op+b);
 worksheets++;
 }
}
// Recognition must reach columns beyond the old six-column notebook.
const farInk=[[[10*72+34,3*72+30],[10*72+34,3*72+62]]];
assert(Object.keys(E.read(farInk,8,12).main).includes('3:10'),'far-right ink not recognized');
assert(Object.keys(E.read(farInk,8).main).length===0,'default six-column behavior changed');
assert(E.columns(buildLesson('*',99999,99999))>=12,'ten-digit product clipped');
let rejected=0;for(const args of [['/',1,0],['-',1,2],['+',100000,1],['*',-1,1]])try{buildLesson(...args);}catch{rejected++;}
assert(rejected===4,'invalid equations allowed');
log('PASS: '+worksheets+' worksheets, '+checks+' checks (all operations, five-digit operands, intermediate work, carries, wide recognition, all grid placements).');
'''
with tempfile.TemporaryDirectory(prefix='hissan-calculator-') as directory:
    path = Path(directory) / 'test.js'
    path.write_text(source + tests)
    subprocess.run([runtime, str(path)], check=True, cwd=ROOT)
