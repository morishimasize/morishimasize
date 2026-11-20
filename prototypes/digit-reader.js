/* Local, template-based digit recognition. Original implementation using
   normalized stroke point clouds and symmetric nearest-neighbour distances.
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
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1]);}
function normalize(strokes){
 const segments=[];let total=0;const points=strokes.flat();if(points.length<2)return null;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const p of points){minX=Math.min(minX,p[0]);minY=Math.min(minY,p[1]);maxX=Math.max(maxX,p[0]);maxY=Math.max(maxY,p[1]);}
 const w=maxX-minX,h=maxY-minY,scale=Math.max(w,h);if(scale<8)return null;
 for(const s of strokes)for(let i=1;i<s.length;i++){const len=dist(s[i-1],s[i]);if(len>0){segments.push({a:s[i-1],b:s[i],start:total,len});total+=len;}}
 if(!total||total/scale>12)return null;
 const cloud=[];for(let i=0;i<64;i++){const pos=(i+.5)*total/64;const seg=segments.find(s=>pos<=s.start+s.len)||segments[segments.length-1];const t=Math.max(0,Math.min(1,(pos-seg.start)/seg.len));cloud.push([(seg.a[0]+(seg.b[0]-seg.a[0])*t-(minX+maxX)/2)/scale,(seg.a[1]+(seg.b[1]-seg.a[1])*t-(minY+maxY)/2)/scale]);}
 return {cloud,ratio:w/Math.max(h,1),length:total/scale};
}
function cloudDistance(a,b){let sum=0;for(const p of a){let nearest=Infinity;for(const q of b)nearest=Math.min(nearest,dist(p,q));sum+=nearest;}return sum/a.length;}
const templates=[];
for(const [digit,strokes] of Object.entries(shapes)){for(const ss of [strokes,...(variants[digit]||[])]){for(const slant of [-.13,0,.13])templates.push({digit,...normalize(ss.map(s=>s.map(([x,y])=>[x+slant*(y-50),y])))});}}
function recognize(strokes){const input=normalize(strokes);if(!input)return [];
 const scores=new Map();for(const t of templates){const shape=(cloudDistance(input.cloud,t.cloud)+cloudDistance(t.cloud,input.cloud))/2;const ratio=Math.abs(Math.min(input.ratio,1.5)-Math.min(t.ratio,1.5));const score=shape+ratio*.025+Math.abs(input.length-t.length)*.008;scores.set(t.digit,Math.min(scores.get(t.digit)??Infinity,score));}
 return [...scores].map(([digit,distance])=>({digit,distance})).sort((a,b)=>a.distance-b.distance).slice(0,3);
}
root.DigitReader={recognize,shapes,normalize};
})(typeof globalThis==='object'?globalThis:this);
