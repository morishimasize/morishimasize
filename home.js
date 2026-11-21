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
