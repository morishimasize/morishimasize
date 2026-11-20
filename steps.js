/* 入力した非負整数から、筆算の盤面と操作ごとのスナップショットを作る。 */
const LESSON_PLACES = ['いち','じゅう','ひゃく','せん','まん','じゅうまん','ひゃくまん','せんまん','おく','じゅうおく'];
const LESSON_SIGNS = {'+':'＋','-':'−','*':'×','/':'÷'};
let activeLesson = null;
let lessonIndex = 0;
let lessonOverview = false;

function buildLesson(op, a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 99999 || b > 99999 || !LESSON_SIGNS[op]) throw new Error('入力の範囲が正しくありません');
  if ((op === '/' && b === 0) || (op === '-' && a < b)) throw new Error('この計算はできません');
  const value = op === '+' ? a+b : op === '-' ? a-b : op === '*' ? a*b : Math.floor(a/b);
  const remainder = op === '/' ? a%b : 0;
  const answer = String(value) + (remainder ? ` あまり ${remainder}` : '');
  const width = Math.max(String(a).length, String(b).length, String(value).length);
  const model = {op,a,b,value,remainder,answer,equation:`${a} ${LESSON_SIGNS[op]} ${b}`,steps:[],columns:[52,...Array(width).fill(58)],resultRow:2};
  const cells = {}, lines = {};
  const id = (row,col) => `${row}:${col}`;
  const put = (row,col,text,extra={}) => {cells[id(row,col)]={row,col,text:String(text),...extra};return id(row,col);};
  const note = (row,col,text) => {const key=id(row,col);cells[key]={row,col,text:'',...cells[key],note:String(text)};return key;};
  const rule = (key,row,start,end) => {lines[key]={row,start,end};};
  const writeNumber = (n,row,end,extra={}) => String(n).split('').map((d,i,ds)=>put(row,end-ds.length+1+i,d,extra));
  const push = (title,place,math,description,focus=[],arrow=null) => {
    const previous = model.steps.length ? model.steps[model.steps.length-1].cells : {};
    const fresh = Object.keys(cells).filter(key=>!previous[key] || JSON.stringify(previous[key])!==JSON.stringify(cells[key]));
    model.steps.push({title,place,math,description,focus,arrow,fresh,cells:JSON.parse(JSON.stringify(cells)),lines:JSON.parse(JSON.stringify(lines))});
  };
  const place = k => `${LESSON_PLACES[k]}のくらい`;
  const digits = n => String(n).split('').reverse().map(Number);
  const col = k => width-k;
  const finish = () => {
    const last=model.steps[model.steps.length-1];last.done=true;
    last.description += ` こたえは ${answer}。できたね！`;
    model.finalCells=last.cells;
    return model;
  };

  if (op !== '/') {
    writeNumber(a,0,width);
    put(1,0,LESSON_SIGNS[op],{kind:'operator'});
    writeNumber(b,1,width);
    rule('operands',2,0,width);
  }

  if (op === '+') {
    const da=digits(a),db=digits(b),length=Math.max(da.length,db.length);let carry=0;
    for(let k=0;k<length;k++) {
      const x=da[k]||0,y=db[k]||0,sum=x+y+carry,out=Math.floor(sum/10);
      const equation=`${x} ＋ ${y}${carry?` ＋ ${carry}`:''} ＝ ${sum}`;
      push('たす',place(k),equation,carry?'くりあがりの 1も、いっしょに たすよ。':'この くらいの すうじを たすよ。',[id(0,col(k)),id(1,col(k))]);
      put(2,col(k),sum%10,{kind:'result'});
      if(out)note(0,col(k+1),out);
      push(out?'かく・くりあげる':'かく',place(k),out?`${sum} は ${out*10} と ${sum%10}`:`${equation}`,out?`「${sum%10}」を かいて、1を ${place(k+1)}へ くりあげるよ。`:`「${sum%10}」を したに かくよ。`,[id(2,col(k))]);
      carry=out;
    }
    if(carry){put(2,col(length),carry,{kind:'result'});push('さいごの 1を かく',place(length),`くりあがりの ${carry}`,`のこった「${carry}」を ひだりに かくよ。`,[id(2,col(length))]);}
    return finish();
  }

  if (op === '-') {
    const da=digits(a),db=digits(b),values=Array.from({length:width},(_,k)=>da[k]||0);
    const annotate=k=>{const cell=cells[id(0,col(k))];note(0,col(k),values[k]);cell.crossed=true;cells[id(0,col(k))].crossed=true;};
    for(let k=0;k<width;k++) {
      const lower=db[k]||0;
      if(values[k]<lower) {
        push('くらべる',place(k),`${values[k]} から ${lower} は ひけない`,'ひだりの くらいから、10を かりよう。',[id(0,col(k)),id(1,col(k))]);
        let donor=k+1;while(values[donor]===0)donor++;
        for(let j=donor;j>k;j--) {
          const old=values[j],oldLower=values[j-1];values[j]--;values[j-1]+=10;annotate(j);annotate(j-1);
          push('くりさげる',`${LESSON_PLACES[j]} → ${LESSON_PLACES[j-1]}`,`${old} は ${values[j]} に、${oldLower} は ${values[j-1]} に`,'ひとつ となりへ、10を わたすよ。',[id(0,col(j)),id(0,col(j-1))]);
        }
      }
      const diff=values[k]-lower,show=k<String(value).length;
      if(show)put(2,col(k),diff,{kind:'result'});
      push('ひく',place(k),`${values[k]} − ${lower} ＝ ${diff}`,show?`「${diff}」を したに かくよ。`:'こたえの あたまの 0は、かかなくて いいよ。',[id(0,col(k)),id(1,col(k))]);
    }
    return finish();
  }

  if (op === '*') {
    const da=digits(a),db=digits(b),partial=[];model.resultRow=db.length===1?2:2+db.length;
    for(let j=0;j<db.length;j++) {
      const row=2+j,d=db[j];partial.push(a*d*10**j);
      put(row,0,`${j+1}のだん`,{kind:'label'});
      if(j>0)push('つぎの だん',place(j),`${a} × ${d*10**j}`,`${place(j)}から、ひとつ ひだりへ ずらして かくよ。`,[id(1,col(j))]);
      if(d===0||a===0) {
        put(row,col(j),0,{kind:db.length===1?'result':'partial'});
        push('かける',place(j),`${a} × ${d} ＝ 0`,'この だんは「0」に なるよ。',[id(1,col(j))]);
        continue;
      }
      let carry=0;
      for(let k=0;k<da.length;k++) {
        const oldCarry=carry,total=da[k]*d+oldCarry;carry=Math.floor(total/10);
        put(row,col(j+k),total%10,{kind:db.length===1?'result':'partial'});
        if(carry)note(row,col(j+k+1),carry);
        push('かける',place(j+k),`${da[k]} × ${d}${oldCarry?` ＋ ${oldCarry}`:''} ＝ ${total}`,carry?`「${total%10}」を かいて、${carry}を くりあげるよ。`:`「${total%10}」を かくよ。`,[id(0,col(k)),id(1,col(j))]);
      }
      if(carry){put(row,col(j+da.length),carry,{kind:db.length===1?'result':'partial'});push('くりあがりを かく',place(j+da.length),`のこった ${carry}`,`ひだりに「${carry}」を かくよ。`,[id(row,col(j+da.length))]);}
    }
    if(db.length>1) {
      rule('total',model.resultRow,0,width);let carry=0;
      for(let k=0;k<String(value).length;k++) {
        const terms=partial.map(n=>Math.floor(n/10**k)%10),oldCarry=carry,total=terms.reduce((x,y)=>x+y,0)+oldCarry;carry=Math.floor(total/10);
        put(model.resultRow,col(k),total%10,{kind:'result'});
        if(carry)note(model.resultRow,col(k+1),carry);
        push('たす',place(k),`${terms.join(' ＋ ')}${oldCarry?` ＋ ${oldCarry}`:''} ＝ ${total}`,carry?`「${total%10}」を かいて、${carry}を くりあげるよ。`:`たてに たして、「${total%10}」を かくよ。`,terms.map((_,j)=>id(2+j,col(k))));
      }
    }
    return finish();
  }

  // 割り算は各桁について「たてる・かける・ひく・おろす」を分ける。
  const dividend=String(a),N=dividend.length;
  model.columns=[52,Math.max(58,String(b).length*25+18),...Array(N).fill(58)];
  model.resultRow=0;model.dividendEnd=N+1;
  put(1,1,b,{kind:'divisor'});writeNumber(a,1,N+1);
  let start=N-1,prefix=0;
  for(let i=0;i<N;i++){prefix=prefix*10+Number(dividend[i]);if(prefix>=b){start=i;break;}}
  let current=Number(dividend.slice(0,start+1)),productRow=2;
  for(let i=start;i<N;i++) {
    const q=Math.floor(current/b),p=q*b,r=current-p,at=2+i;
    put(0,at,q,{kind:'result'});
    push('たてる',place(N-1-i),`${current} ÷ ${b} ＝ ${q}${r?` あまり ${r}`:''}`,`「${q}」を うえに かくよ。`,[id(1,1),id(i===start?1:productRow-1,at)]);
    put(productRow,0,'かける',{kind:'label'});writeNumber(p,productRow,at);
    push('かける',place(N-1-i),`${b} × ${q} ＝ ${p}`,`「${p}」を したに かくよ。`,[id(1,1),id(0,at)]);
    const remainderRow=productRow+1;
    rule(`subtract${i}`,remainderRow,at-Math.max(String(current).length,String(p).length)+1,at);
    put(remainderRow,0,'ひく',{kind:'label'});writeNumber(r,remainderRow,at,{kind:'remainder'});
    push('ひく',place(N-1-i),`${current} − ${p} ＝ ${r}`,`せんを ひいて、のこりの「${r}」を かくよ。`,[id(remainderRow,at)]);
    if(i<N-1){const nextDigit=Number(dividend[i+1]);put(remainderRow,at+1,nextDigit);const next=r*10+nextDigit;
      push('おろす',place(N-2-i),`${r} と ${nextDigit} で ${next}`,`つぎの「${nextDigit}」を おろすよ。`,[id(1,at+1)],{col:at+1,from:1,to:remainderRow});current=next;}
    productRow+=2;
  }
  return finish();
}

function lessonEscape(text){return String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function lessonBoardHTML(model,snapshot,overview){
  const pitch=70,columns=model.columns;
  const x=columns.map((_,i)=>columns.slice(0,i).reduce((a,b)=>a+b,0)+12*i);
  const width=x[x.length-1]+columns[columns.length-1];
  const maxRow=Math.max(...Object.values(snapshot.cells).map(c=>c.row));
  const height=(maxRow+1)*pitch-12;
  let html=`<div class="lesson-board" style="width:${width}px;height:${height}px" role="img" aria-label="${lessonEscape(model.equation)} の ひっさん${overview?'、できあがり':`、てじゅん${lessonIndex+1}`}" >`;
  // 罫線と数字は独立させ、角丸が割り算の記号に影響しないようにする。
  if(model.op==='/'){
    html+=`<svg class="lesson-bracket" aria-hidden="true" style="left:${x[2]-16}px;top:${pitch}px" width="18" height="58" viewBox="0 0 18 58"><path d="M2 1.5 C18 9 18 49 2 56.5" fill="none" stroke="#624b32" stroke-width="3" stroke-linecap="round"/></svg>`;
    html+=`<span class="lesson-board-line" style="left:${x[2]-14}px;top:${pitch}px;width:${width-x[2]+14}px"></span>`;
  }
  for(const line of Object.values(snapshot.lines))html+=`<span class="lesson-board-line" style="left:${x[line.start]}px;top:${line.row*pitch-6}px;width:${x[line.end]+columns[line.end]-x[line.start]}px"></span>`;
  for(const [key,c]of Object.entries(snapshot.cells)){
    const fresh=!overview&&snapshot.fresh.includes(key),focus=!overview&&snapshot.focus.includes(key);
    html+=`<span aria-hidden="true" data-row="${c.row}" data-current="${fresh&&c.kind!=='label'?'true':'false'}" class="lesson-cell ${c.kind||''} ${fresh?'is-fresh':''} ${focus?'is-focus':''} ${c.note!==undefined?'has-note':''}" style="left:${x[c.col]}px;top:${c.row*pitch}px;width:${columns[c.col]}px">`+
      (c.note!==undefined?`<small class="lesson-carry">${lessonEscape(c.note)}</small>`:'')+`<span class="${c.crossed?'is-crossed':''}">${lessonEscape(c.text)}</span></span>`;
  }
  if(!overview&&snapshot.arrow){const a=snapshot.arrow,top=(a.from+1)*pitch-8,bottom=a.to*pitch+8;html+=`<span aria-hidden="true" class="lesson-drop-arrow" style="left:${x[a.col]+columns[a.col]-5}px;top:${top}px;height:${Math.max(12,bottom-top)}px"></span>`;}
  return html+'</div>';
}

function showLesson(model){
  activeLesson=model;lessonIndex=0;lessonOverview=false;
  document.getElementById('hp').innerHTML=`<div class="hdr" id="lesson-equation"></div>`+
    `<section class="answer-book notebook" aria-label="けいさんの ノート"><div class="answer-layout">`+
    `<section class="hp-grid-wrap"><h2 class="panel-title">ひっさん</h2><div class="lesson-board-viewport" id="lesson-board-viewport" tabindex="0" role="region" aria-label="ひっさん。はみでるときは うごかせるよ"><div id="lesson-board-content"></div></div></section>`+
    `<section class="steps-wrap"><div id="lesson-explanation" aria-live="polite" aria-atomic="true"></div></section></div>`+
    `<div class="lesson-progress" aria-hidden="true"><span id="lesson-progress-fill"></span></div>`+
    `<div class="lesson-options"><button id="lesson-overview" onclick="toggleLessonOverview()">ぜんぶ みる</button><button onclick="restartLesson()">さいしょから</button></div>`+
    `<div id="lesson-answer"></div></section>`+
    `<nav class="lesson-controls" aria-label="てじゅんを すすめる"><button class="lesson-prev" id="lesson-prev" onclick="previousLesson()">まえへ</button><span id="lesson-count"></span><button class="lesson-next" id="lesson-next" onclick="nextLesson()">つぎへ</button></nav>`;
  renderLesson();
}
function renderLesson(){
  if(!activeLesson)return;
  const model=activeLesson,last=lessonIndex===model.steps.length-1;
  const snapshot=model.steps[lessonOverview?model.steps.length-1:lessonIndex];
  document.getElementById('lesson-equation').textContent=model.equation+' ＝ '+(lessonOverview||last?model.answer:'？');
  document.getElementById('lesson-board-content').innerHTML=lessonBoardHTML(model,snapshot,lessonOverview);
  const title=lessonOverview?'できあがり':snapshot.title;
  const math=lessonOverview?model.equation+' ＝ '+model.answer:snapshot.math;
  const description=lessonOverview?'ぜんぶの ひっさんだよ。「ひとつずつ みる」で つづきに もどれるよ。':snapshot.description;
  document.getElementById('lesson-explanation').innerHTML=`<article class="lesson-explanation ${lessonOverview?'is-overview':''}"><div class="lesson-heading"><span class="lesson-badge">${lessonOverview?'✓':lessonIndex+1}</span><div><h2>${lessonEscape(title)}</h2><p>${lessonOverview?'けいさんの まとめ':lessonEscape(snapshot.place)}</p></div></div><div class="lesson-math">${lessonEscape(math)}</div><p class="lesson-description">${lessonEscape(description)}</p></article>`;
  document.getElementById('lesson-count').textContent=lessonOverview?'まとめ':`${lessonIndex+1} / ${model.steps.length}`;
  document.getElementById('lesson-prev').disabled=lessonOverview||lessonIndex===0;
  document.getElementById('lesson-next').disabled=lessonOverview;
  document.getElementById('lesson-next').textContent=last?'もういちど':'つぎへ';
  document.getElementById('lesson-overview').textContent=lessonOverview?'ひとつずつ みる':'ぜんぶ みる';
  document.getElementById('lesson-progress-fill').style.width=`${lessonOverview?100:100*(lessonIndex+1)/model.steps.length}%`;
  document.getElementById('lesson-answer').innerHTML=lessonOverview||last?`<div class="answer-ribbon"><span>こたえは</span><strong class="answer-value">${lessonEscape(model.answer)}</strong><span class="answer-star" aria-hidden="true">★</span></div>`:'';
  if(typeof requestAnimationFrame==='function')requestAnimationFrame(keepLessonWorkVisible);
}
function keepLessonWorkVisible(){
  const viewport=document.getElementById('lesson-board-viewport');if(!viewport)return;
  const written=[...viewport.querySelectorAll('[data-current="true"]')];
  const targets=written.length?written:[...viewport.querySelectorAll('.lesson-cell.is-focus')];
  const current=targets.sort((a,b)=>Number(b.dataset.row)-Number(a.dataset.row))[0];
  if(current){viewport.scrollTo({top:Math.max(0,current.offsetTop-viewport.clientHeight/2+29),left:Math.max(0,current.offsetLeft-viewport.clientWidth/2+current.clientWidth/2),behavior:'auto'});}
}
function previousLesson(){if(activeLesson&&!lessonOverview&&lessonIndex>0){lessonIndex--;renderLesson();}}
function nextLesson(){if(activeLesson&&!lessonOverview){lessonIndex=lessonIndex===activeLesson.steps.length-1?0:lessonIndex+1;renderLesson();}}
function restartLesson(){if(activeLesson){lessonIndex=0;lessonOverview=false;renderLesson();}}
function toggleLessonOverview(){if(activeLesson){lessonOverview=!lessonOverview;renderLesson();}}
function rAdd(a,b){showLesson(buildLesson('+',a,b));}
function rSub(a,b){showLesson(buildLesson('-',a,b));}
function rMul(a,b){showLesson(buildLesson('*',a,b));}
function rDiv(a,b){showLesson(buildLesson('/',a,b));}
