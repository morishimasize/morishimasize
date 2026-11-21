#!/usr/bin/env python3
"""Exercise finger gestures using the same controller as the browser prototype."""
from pathlib import Path
import shutil,subprocess,tempfile
root=Path(__file__).resolve().parents[1]
runtime=shutil.which('node') or '/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc'
tests=r'''
let checks=0;function ok(v,m){checks++;if(!v)throw Error(m);}
function near(a,b){return Math.abs(a-b)<.001;}
const state={scale:1,x:0,y:0},commits=[];let pending=null,working=false,view;
let size={width:432,height:576};
const c=createNotebookGesture({state,width:432,height:576,bounds:()=>size,paint:v=>view=v,preview:v=>pending=v,commit:v=>commits.push(v),busy:v=>working=v});
c.draw();ok(near(view.factor,1),'initial fit');
c.down(1,{x:250,y:250});c.move(1,{x:250,y:280});c.up(1);
ok(commits.length===1&&near(commits[0][1][1],280),'one finger ink');
c.down(1,{x:100,y:200});c.move(1,{x:110,y:205});c.down(2,{x:300,y:200});
ok(pending===null&&working,'second finger discards pending ink');
c.move(1,{x:0,y:200});c.move(2,{x:400,y:200});
ok(state.scale>1.9&&state.scale<2.2,'pinch zoom');
const pivot=[(200-state.x)/view.factor,(200-state.y)/view.factor];
ok(near(pivot[0],205)&&near(pivot[1],202.5),'zoom pivot follows fingers');
const beforeX=state.x,beforeY=state.y;
c.move(1,{x:20,y:240});c.move(2,{x:420,y:240});
ok(near(state.x,beforeX+20)&&near(state.y,beforeY+40),'two finger pan');
c.up(2);c.move(1,{x:100,y:300});c.up(1);
ok(commits.length===1&&!working,'remaining finger does not write');
const expected=[(200-state.x)/view.factor,(300-state.y)/view.factor];
c.down(3,{x:200,y:300});c.move(3,{x:200,y:340});c.up(3);
ok(near(commits[1][0][0],expected[0])&&near(commits[1][0][1],expected[1]),'zoom ink original coordinates');
c.down(4,{x:100,y:100});c.move(4,{x:200,y:200});c.up(4,true);
ok(commits.length===2,'cancel does not commit');
c.down(5,{x:100,y:100});c.down(6,{x:200,y:100});c.move(6,{x:2000,y:100});ok(state.scale===4,'max zoom');
c.move(6,{x:101,y:100});ok(state.scale===1,'min zoom');c.up(5);c.up(6);
c.down(7,{x:100,y:100});c.move(7,{x:200,y:100});c.reset();
ok(state.scale===1&&near(state.x,0)&&near(state.y,0)&&commits.length===2&&!working,'reset cancels ink and fits');
size={width:300,height:400};c.resize();ok(near(view.factor,300/432),'phone fit');
c.down(8,{x:150,y:200});c.move(8,{x:150,y:250});c.up(8);ok(near(commits[2][0][0],216)&&near(commits[2][0][1],288),'phone coordinates');
size={width:700,height:620};c.resize();ok(near(view.factor,620/576)&&state.x>0,'tablet fit centered');
c.down(9,{x:200,y:200});c.down(10,{x:300,y:200});c.down(11,{x:400,y:200});c.up(9);c.move(10,{x:250,y:250});c.up(10);c.up(11);ok(commits.length===3,'third finger never writes');
c.down(12,{x:200,y:200});c.move(12,{x:210,y:210});c.resize();c.up(12);ok(commits.length===3,'resize cancels unfinished ink');
(typeof print==='function'?print:console.log)('PASS: '+checks+' finger gesture checks.');
'''
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'touch.js';p.write_text((root/'prototypes/notebook-touch.js').read_text()+tests)
 subprocess.run([runtime,str(p)],check=True)
