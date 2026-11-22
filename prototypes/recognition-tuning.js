/* Small decision rules shared by the notebook and the feedback trainer. */
(function(root){
'use strict';
const baseline='ink6';
let activeRules={};

function baselineDigit(input,choices){
 const [best,second]=choices;
 if(!input||!best||!second)return '?';
 return best.distance<.18&&second.distance-best.distance>=.012&&!(best.digit==='1'&&input.ratio>1.05)?best.digit:'?';
}
function bucket(input,choices){
 const [best,second]=choices;
 if(!input||!best||!second||best.distance>=.135)return '';
 const gap=second.distance-best.distance;
 if(gap>=.028||(input.ratio>1.05&&[best.digit,second.digit].includes('1')))return '';
 const certainty=gap<.012?'u':'c';
 const width=input.ratio<.48?'n':input.ratio<.78?'m':'w';
 const length=input.length<2.1?'s':'l';
 return best.digit+second.digit+certainty+width+length;
}
function validRule(key,digit){
 return /^[0-9]{2}[uc][nmw][sl]$/.test(key)&&key[0]!==key[1]&&
  (digit===key[1]||(key[2]==='u'&&digit===key[0]));
}
function validate(model){
 if(model?.schema!==1||model.baseline!==baseline||!Number.isSafeInteger(model.revision)||model.revision<0||!model.rules||
    typeof model.rules!=='object'||Array.isArray(model.rules))return null;
 const entries=Object.entries(model.rules);
 if(entries.length>1080||!entries.every(([key,digit])=>validRule(key,digit)))return null;
 return {schema:1,baseline,revision:model.revision,rules:Object.fromEntries(entries)};
}
function read(input,choices){
 return activeRules[bucket(input,choices)]??baselineDigit(input,choices);
}
function install(model){
 const checked=validate(model);
 if(checked)activeRules=checked.rules;
}
root.RecognitionTuning={baseline,baselineDigit,bucket,validRule,validate,install,read};
})(globalThis);
