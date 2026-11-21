#!/usr/bin/env python3
"""Regression cases for photo-inspired glyphs, grid grouping and independent recognition."""
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
source = '\n'.join((root / name).read_text() for name in ['steps.js','prototypes/digit-reader.js','prototypes/notebook-engine.js'])
fixtures = json.loads((root / 'tests/handwriting-fixtures.json').read_text())
tests = r'''
const log=typeof print==='function'?print:console.log;
let checks=0,photoGlyphs=0;function assert(ok,message){checks++;if(!ok)throw Error(message);}
const E=NotebookEngine,photo=fixture.photoWorksheet;
const photoInk=photo.strokes.map(s=>s.map(([x,y])=>[(x-photo.origin[0])*72/photo.cell,(y-photo.origin[1])*72/photo.cell]));
for(let seed=0;seed<16;seed++){
 const ink=photoInk.map((s,j)=>s.map(([x,y],i)=>[x+Math.sin(i+j+seed)*.6+(seed%3-1)*.8,y+Math.cos(i+j+seed)*.6+(seed%5-2)*.5]));
 const read=E.read(ink,photo.rows,photo.cols);
 for(const [key,value]of Object.entries(photo.main)){assert(read.main[key]===value,'photo-style '+key+' '+value+' read as '+read.main[key]);photoGlyphs++;}
 assert(Object.keys(read.main).length===9,'extra digit invented');
 assert(Object.keys(read.notes).length===0,'digit cap split into a small note');
 assert(read.lines.length===1&&read.lines[0].row===5,'digit cap mistaken for a rule');
}
for(const [digit,shapes]of [['5',fixture.heldOutFives],['9',fixture.heldOutNines]])for(const strokes of shapes)for(let seed=0;seed<8;seed++){
 const ink=strokes.map(s=>s.map(([x,y],i)=>[x*(.75+seed*.08)+12+Math.sin(i+seed)*.5,y*(1.1-seed*.04)+18+Math.cos(i+seed)*.5]));
 assert(DigitReader.recognize(ink)[0]?.digit===digit,'unseen '+digit+' variation '+seed);
}
for(const [digit,strokes]of Object.entries(DigitReader.shapes))for(let seed=0;seed<8;seed++){
 const ink=strokes.map(s=>s.map(([x,y],i)=>[x*1.3+20+Math.sin(i+seed)*2,y*.9+10+Math.cos(i+seed)*2]));
 assert(DigitReader.recognize(ink)[0]?.digit===digit,'existing digit regressed '+digit+' '+seed);
}
assert(DigitReader.recognize([]).length===0,'blank recognized');
assert(DigitReader.recognize([[[1,1],[2,2]]]).length===0,'tiny tap recognized');
const place=(shape,row,col,scaleX=.4,scaleY=.6,top=.32)=>shape.map(s=>s.map(([x,y])=>[(col+.2)*72+x*scaleX,(row+top)*72+y*scaleY]));
// True carry/borrow numbers remain independent of the large digit below them.
for(const note of ['1','9']){
 const ink=[...place(DigitReader.shapes[note],2,3,.14,.15,0),...place(DigitReader.shapes['5'],2,3)];
 const r=E.read(ink,8,6);assert(r.main['2:3']==='5'&&r.notes['2:3']===note,'true small note merged into main digit '+note);
}
// A one-cell rule must survive even with a tall digit just below it.
const shortRule=[[[2*72+3,3*72],[3*72-3,3*72]],[[2.5*72,3*72+7],[2.5*72,3*72+60]]];
const ruleRead=E.read(shortRule,8,6);assert(ruleRead.lines.length===1&&ruleRead.main['3:2']==='1','one-cell rule joined to digit');
// Stroke order and direction do not require a particular writing sequence.
const reordered=E.read(photoInk.slice().reverse().map(s=>s.slice().reverse()),8,6);
for(const [key,value]of Object.entries(photo.main))assert(reordered.main[key]===value,'stroke direction/order '+key);
// In an already printed worksheet, a bent 1 near a grid line is still a digit.
const bentOne=[[[203,246],[210,258],[213,270],[208,287],[203,295]]];
const edgeDigit=E.read(bentOne,8,6,{digitsOnly:true});
assert(edgeDigit.main['3:2']==='1'&&edgeDigit.brackets.length===0,'bent 1 at grid edge read as bracket');
assert(E.read(bentOne,8,6).brackets.length===1,'free-form division bracket regressed');
const unclear=[
 [[[153,250],[181,264],[206,269]]],
 [[[153,270],[166,258],[181,268],[194,254],[208,267],[193,284],[180,270],[167,288],[154,280]]]
];
for(const ink of unclear)assert(E.read(ink,8,6,{digitsOnly:true}).main['3:2']==='?','unclear mark guessed as a digit');
const closedFour=[[[189,242],[166,267],[189,268],[188,242],[189,286]]];
const crossedSeven=[[[169,244],[171,251],[166,266],[159,286]],[[153,244],[166,243],[193,242]],[[162,260],[183,261]]];
for(const [expected,strokes] of [['4',closedFour],['7',crossedSeven]]){
 for(const ink of [strokes,strokes.slice().reverse().map(s=>s.slice().reverse())]){
  assert(E.read(ink,8,6,{digitsOnly:true}).main['3:2']===expected,'stroke direction or order changed '+expected);
 }
}
assert(DigitReader.recognize([...closedFour,[[70,71]]])[0]?.digit==='4','isolated tap distorted outline');
const digitsOnly=E.read(photoInk,8,6,{digitsOnly:true});
for(const [key,value]of Object.entries(photo.main))assert(digitsOnly.main[key]===value,'digits-only worksheet '+key);
// Changing the exercise or grading model must never change the recognition output.
const before=JSON.stringify(E.read(photoInk,8,6));
for(const [a,b]of [[23,45],[23,46],[99,99]])E.gradeWork(buildLesson('*',a,b),E.read(photoInk,8,6),8);
assert(JSON.stringify(E.read(photoInk,8,6))===before,'recognition depends on arithmetic answer');

assert(DigitReader.recognize([[[197,585],[171,606],[153,646],[153,683],[170,710],[194,701],[201,677],[187,654],[159,659]]])[0]?.digit==='6','slender six regression');
const symbolInk={'+':[[[50,12],[50,88]],[[12,50],[88,50]]],'−':[[[12,50],[88,50]]],'×':[[[15,15],[85,85]],[[85,15],[15,85]]]};
for(const [op,pairs]of Object.entries({'+':[[27,15],[46,28],[268,157]],'-':[[52,28],[302,178],[73,46]],'*':[[23,14],[36,25],[23,4]],'/':[[72,3],[83,4],[125,8]]}))for(const [a,b]of pairs){
 const model=buildLesson(op,a,b),e=E.expected(model),ink=[],rows=Math.max(8,...Object.values(model.finalCells).map(c=>c.row+4));
 for(const [k,v]of Object.entries(e.main)){const [r,c]=k.split(':').map(Number);ink.push(...place(DigitReader.shapes[v]||symbolInk[v],r,c,.3456,.4248,.33));}
 for(const [k,v]of Object.entries(e.notes)){const [r,c]=k.split(':').map(Number);for(let i=0;i<v.length;i++)for(const stroke of DigitReader.shapes[v[i]])ink.push(stroke.map(([x,y])=>[(c+.16+i*.3)*72+x*.1296,(r+.01)*72+y*.144]));}
 for(const l of e.lines)ink.push([[l.start*72+3,l.row*72],[l.end*72-3,l.row*72]]);
 for(const b of e.brackets)ink.push([[b.col*72-12,b.row*72+7],[b.col*72-1,b.row*72+20],[b.col*72+1,b.row*72+36],[b.col*72-2,b.row*72+52],[b.col*72-12,b.row*72+65]]);
 assert(E.grade(model,E.read(ink,rows,E.columns(model)),rows).ok,'complete handwritten worksheet regression '+op+a);
}
log('PASS: '+checks+' recognition checks; '+photoGlyphs+' photo-inspired glyph variations, held-out 5/9 shapes, existing 0–9, grouping, unclear glyphs, rules and notes.');
'''
script = source + '\nconst fixture=' + json.dumps(fixtures) + ';\n' + tests
with tempfile.TemporaryDirectory(prefix='hissan-recognition-') as directory:
    path = Path(directory) / 'test.js'
    path.write_text(script)
    subprocess.run([runtime,str(path)],check=True,cwd=root)
