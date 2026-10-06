import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
process.once('message',({mode,pidFile})=>{
 const descendant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});
 writeFileSync(pidFile,String(descendant.pid));
 setInterval(()=>{},1000); // Deliberately leak handles, reproducing the hung Actions command.
 if(mode!=='timeout')process.send({ok:mode==='success',error:'Timed out while trying to connect to the browser'});
});
