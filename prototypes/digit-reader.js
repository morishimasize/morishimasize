/* Local, template-based digit recognition. Original implementation using
   normalized ink position and local stroke direction.
   No network requests, trained service, or access to the exercise answer. */
(function(root){
'use strict';
const shapes={
0:[[[50,8],[28,10],[15,32],[12,65],[25,89],[51,94],[73,82],[81,53],[76,25],[60,10],[50,8]]],
1:[[[35,26],[51,9],[51,94]]],
2:[[[15,28],[27,12],[51,8],[73,19],[77,37],[61,57],[15,93],[80,93]]],
3:[[[17,16],[44,8],[69,15],[77,30],[65,43],[44,49],[66,51],[79,68],[73,86],[50,95],[23,87],[15,77]]],
4:[[[64,8],[17,65],[84,65]],[[65,8],[65,95]]],
5:[[[78,10],[24,10],[20,47],[48,43],[71,52],[79,70],[69,88],[47,94],[20,84]]],
6:[[[70,10],[47,14],[25,36],[15,65],[22,86],[42,94],[65,88],[77,70],[68,53],[46,48],[21,60]]],
7:[[[14,12],[81,12],[42,95]]],
8:[[[47,48],[23,33],[24,16],[46,8],[69,17],[71,32],[47,48],[22,65],[18,82],[43,95],[69,88],[78,72],[66,57],[47,48]]],
9:[[[76,47],[56,53],[31,48],[18,31],[25,13],[49,8],[72,19],[77,42],[69,68],[53,94]]]
};
const variants={
0:[[[[51,7],[24,18],[16,54],[26,87],[52,95],[75,76],[81,43],[70,15],[51,7]]]],
1:[[[[50,8],[50,95]]],[[[28,29],[49,10],[49,93]],[[23,94],[75,94]]]],
2:[[[[16,24],[35,8],[62,10],[78,30],[67,48],[42,66],[17,91],[81,91]]]],
3:[[[[18,12],[75,12],[44,46],[67,49],[79,65],[74,84],[52,94],[25,88]]]],
4:[[[[23,8],[20,61],[80,61]],[[64,8],[64,95]]]],
5:[[[[78,10],[24,10]],[[24,10],[22,48],[49,43],[73,53],[78,76],[60,94],[32,92],[16,81]]]],
6:[[[[72,8],[46,22],[22,50],[16,74],[30,92],[57,94],[77,76],[72,56],[50,48],[22,60]]]],
7:[[[[15,11],[80,11],[42,95]],[[29,50],[70,50]]],[[[14,10],[14,28]],[[14,10],[80,10],[42,95]]]],
8:[[[[49,48],[25,37],[22,19],[42,8],[65,12],[76,28],[63,43],[49,48]],[[49,48],[25,61],[19,80],[35,94],[60,94],[77,78],[68,59],[49,48]]]],
9:[[[[75,40],[57,50],[32,47],[18,29],[30,10],[56,9],[74,22],[75,40],[73,94]]]]
};
// Additional handwritten forms: a separate cap, a narrow/angular lower bowl,
// and an angular or slightly open loop. These are glyph shapes, not answers.
variants[1].push(
 [[[50,7],[48,34],[49,61],[52,82],[57,95]]],
 [[[45,8],[44,37],[44,66],[48,88],[52,95]]]
);
variants[5].push(
 [[[38,7],[30,26],[29,46],[32,58],[41,75],[41,87],[29,94],[6,96],[0,93],[0,84]],[[20,24],[48,22],[76,22],[98,18]]],
 [[[43,5],[29,21],[20,42],[19,60],[30,79],[43,94],[39,99],[0,100]],[[28,18],[50,26],[98,26]]],
 [[[76,9],[24,9]],[[25,8],[22,43],[48,42],[66,57],[69,77],[52,94],[20,92]]]
);
variants[9].push(
 [[[91,22],[67,7],[30,8],[20,21],[20,40],[39,43],[63,34],[75,29],[68,51],[58,74],[48,98]]],
 [[[86,26],[66,11],[34,8],[18,23],[20,41],[40,45],[63,33],[74,25],[64,58],[48,95]]]
);
// Common forms with different starting points, separate strokes, or open loops.
variants[0].push([[[67,15],[45,9],[23,22],[18,48],[24,79],[40,94],[63,89],[79,65],[81,42],[72,26]]]);
variants[2].push([[[15,28],[29,11],[56,10],[74,23],[73,39],[59,53],[40,67],[17,87],[43,87],[77,94]]]);
variants[3].push(
 [[[18,15],[42,9],[67,13],[79,27],[68,44],[46,48]],[[47,48],[69,51],[81,67],[74,86],[55,94],[31,94],[15,81]]],
 [[[20,10],[43,9],[61,14],[68,24],[64,37],[42,51],[53,59],[60,71],[57,82],[43,92],[25,94]]]
);
variants[4].push(
 [[[61,10],[18,60],[65,60],[65,94]]],
 [[[46,9],[19,62],[79,62]],[[69,7],[67,94]]],
 [[[65,9],[21,61],[65,62],[65,10],[66,94]]]
);
variants[6].push([[[67,9],[45,19],[26,43],[18,67],[26,88],[43,94],[61,88],[69,73],[60,55],[44,52],[25,62]]]);
variants[7].push([[[17,14],[53,11],[79,13],[65,41],[49,71],[35,95]]]);
variants[8].push([[[47,49],[35,40],[30,26],[36,14],[48,9],[62,14],[69,27],[63,41],[47,49],[32,60],[24,76],[32,90],[47,96],[67,90],[76,76],[67,62],[47,49]]]);
variants[9].push([[[73,39],[58,50],[36,48],[22,36],[22,21],[38,10],[58,10],[73,21],[78,42],[72,68],[57,88],[43,94]]]);

function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function normalize(strokes){
 const segments=[];
 let total=0,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const stroke of strokes){
  // A tap does not belong to a digit's outline.
  if(stroke.length<2)continue;
  for(let i=1;i<stroke.length;i++){
   const a=stroke[i-1],b=stroke[i],len=dist(a,b);
   if(!len)continue;
   minX=Math.min(minX,a[0],b[0]);maxX=Math.max(maxX,a[0],b[0]);
   minY=Math.min(minY,a[1],b[1]);maxY=Math.max(maxY,a[1],b[1]);
   segments.push({a,b,start:total,len});
   total+=len;
  }
 }
 const w=maxX-minX,h=maxY-minY,scale=Math.max(w,h);
 if(!total||scale<8||total/scale>12)return null;
 const sx=Math.max(w,scale*.15),sy=Math.max(h,scale*.15);
 const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
 const cloud=[];
 let segmentIndex=0;
 for(let i=0;i<64;i++){
  const position=(i+.5)*total/64;
  while(position>segments[segmentIndex].start+segments[segmentIndex].len)segmentIndex++;
  const {a,b,start,len}=segments[segmentIndex],t=(position-start)/len;
  const dx=(b[0]-a[0])/sx,dy=(b[1]-a[1])/sy,directionLength=Math.hypot(dx,dy);
  cloud.push([(a[0]-centerX)/sx+t*dx,(a[1]-centerY)/sy+t*dy,dx/directionLength,dy/directionLength]);
 }
 return {cloud,ratio:w/Math.max(h,1),length:total/scale};
}
function cloudDistance(a,b){
 let sum=0;
 for(const [x,y,ux,uy] of a){
  let nearest=Infinity;
  for(const [otherX,otherY,vx,vy] of b){
   const dx=x-otherX,dy=y-otherY;
   // Unsigned direction so a digit can be drawn in either direction or stroke order.
   const direction=1-Math.min(1,Math.abs(ux*vx+uy*vy));
   nearest=Math.min(nearest,dx*dx+dy*dy+.008*direction);
  }
  sum+=Math.sqrt(nearest);
 }
 return sum/a.length;
}
const templates=[];
for(const [digit,strokes] of Object.entries(shapes)){for(const ss of [strokes,...(variants[digit]||[])]){for(const slant of [-.13,0,.13])templates.push({digit,...normalize(ss.map(s=>s.map(([x,y])=>[x+slant*(y-50),y])))});}}
function compare(input,template){
 const shape=(cloudDistance(input.cloud,template.cloud)+cloudDistance(template.cloud,input.cloud))/2;
 const ratio=Math.abs(Math.min(input.ratio,1.5)-Math.min(template.ratio,1.5));
 return shape+ratio*.07+Math.abs(input.length-template.length)*.015;
}
function rank(input){if(!input)return [];
 const scores=new Map();for(const t of templates){const score=compare(input,t);scores.set(t.digit,Math.min(scores.get(t.digit)??Infinity,score));}
 return [...scores].map(([digit,distance])=>({digit,distance})).sort((a,b)=>a.distance-b.distance).slice(0,3);
}
function recognize(strokes){return rank(normalize(strokes));}
root.DigitReader={recognize,rank,shapes,normalize,compare};
})(typeof globalThis==='object'?globalThis:this);
