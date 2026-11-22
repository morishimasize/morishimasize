/* Refresh the resume hint after returning from the game, including browser back. */
'use strict';
function refreshResumeHint(){
 let available=false;
 try{available=!!NotebookSave.read(localStorage).session;}catch{}
 document.getElementById('resume-hint').hidden=!available;
}
window.addEventListener('pageshow',refreshResumeHint);
window.addEventListener('storage',refreshResumeHint);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshResumeHint();});
refreshResumeHint();

const feedbackDialog=document.getElementById('feedback-dialog');
const feedbackStatus=document.getElementById('feedback-status');
const feedbackCode=document.getElementById('feedback-code');
const feedbackButton=document.querySelector('#feedback-code-form button');
document.getElementById('feedback-setup').href=NotebookFeedback.site;
document.getElementById('feedback-manage').href=NotebookFeedback.site;
function showFeedbackState(message){
 const enabled=NotebookFeedback.enabled();
 document.getElementById('feedback-enroll').hidden=enabled;
 document.getElementById('feedback-active').hidden=!enabled;
 const waiting=enabled?NotebookFeedback.pending():0;
 feedbackStatus.textContent=message||(!enabled?'この たんまつは オフです。':
  waiting?'この たんまつは オンです。おくるのを まっている すうじ '+waiting+'けん。':'この たんまつは オンです。');
}
document.getElementById('feedback-settings').onclick=()=>{
 showFeedbackState();
 feedbackDialog.showModal();
};
async function enableFeedback(code){
 feedbackButton.disabled=true;
 showFeedbackState('とうろくを たしかめています。');
 const enabled=await NotebookFeedback.enable(code);
 feedbackButton.disabled=false;
 if(enabled)feedbackCode.value='';
 showFeedbackState(enabled?undefined:'とうろく できませんでした。コードと つうしんを たしかめてね。');
}
document.getElementById('feedback-code-form').onsubmit=event=>{
 event.preventDefault();
 void enableFeedback(feedbackCode.value);
};
document.getElementById('feedback-disable').onclick=()=>{
 NotebookFeedback.disable();
 showFeedbackState();
};
const arrived=location.hash.match(/^#ink-feedback=([a-f0-9]{64})$/);
if(arrived){
 history.replaceState(history.state,'',location.pathname+location.search);
 feedbackDialog.showModal();
 void enableFeedback(arrived[1]);
}
