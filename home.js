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
const enableFeedback=document.getElementById('feedback-enable');
const disableFeedback=document.getElementById('feedback-disable');
document.getElementById('feedback-manage').href=NotebookFeedback.site;
function showFeedbackState(message){
 const enabled=NotebookFeedback.enabled();
 enableFeedback.hidden=enabled;
 disableFeedback.hidden=!enabled;
 const waiting=enabled?NotebookFeedback.pending():0;
 feedbackStatus.textContent=message||(!enabled?'この たんまつは オフです。':
  waiting?'この たんまつは オンです。おくるのを まっている すうじ '+waiting+'けん。':'この たんまつは オンです。');
}
document.getElementById('feedback-settings').onclick=()=>{
 showFeedbackState();
 feedbackDialog.showModal();
};
enableFeedback.onclick=()=>{
 showFeedbackState(NotebookFeedback.enable()?undefined:'この たんまつに せっていを ほぞん できませんでした。');
 if(!disableFeedback.hidden)disableFeedback.focus();
};
disableFeedback.onclick=()=>{
 showFeedbackState(NotebookFeedback.disable()?undefined:'この たんまつに せっていを ほぞん できませんでした。');
 if(!enableFeedback.hidden)enableFeedback.focus();
};
if(/^#ink-feedback=[a-f0-9]{64}$/.test(location.hash)){
 history.replaceState(history.state,'',location.pathname+location.search);
}
