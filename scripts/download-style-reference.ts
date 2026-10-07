import {mkdir,writeFile} from 'node:fs/promises';
import {exec} from '../src/orchestration/io';
const allowed=new Set(['raw.githubusercontent.com','github.com','user-images.githubusercontent.com','private-user-images.githubusercontent.com','objects.githubusercontent.com','release-assets.githubusercontent.com','i.ytimg.com']);
async function main(){
 let url=new URL(process.env.REFERENCE_URL??'');let response:Response|undefined;
 for(let redirects=0;redirects<=3;redirects++){
  if(url.protocol!=='https:'||!allowed.has(url.hostname)||url.username||url.password||url.port)throw new Error('Reference must be an HTTPS image on an allowed public image host');
  if(url.hostname==='github.com'&&!url.pathname.startsWith('/user-attachments/assets/'))throw new Error('GitHub URL must be a user attachment, not an HTML page');
  response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});
  if([301,302,303,307,308].includes(response.status)){url=new URL(response.headers.get('location')??'',url);continue;}break;
 }
 if(!response?.ok||!response.headers.get('content-type')?.startsWith('image/'))throw new Error('Positive reference URL did not return an actual image');
 const chunks:Uint8Array[]=[];let size=0;for await(const chunk of response.body!){size+=chunk.length;if(size>20*1024*1024)throw new Error('Reference exceeds 20 MiB');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks);if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'&&bytes.subarray(0,2).toString('hex')!=='ffd8')throw new Error('Positive reference must be actual PNG/JPEG bytes, never SVG or an HTML substitute');
 await mkdir('.cache',{recursive:true});const downloaded='.cache/style-reference-v4.jpg';await writeFile(downloaded,bytes);
 // Preserve exact reference bytes/hash across retries; do not re-encode it.
 await exec('ffmpeg',['-v','error','-i',downloaded,'-frames:v','1','-f','null','-'],{timeout:20000});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
