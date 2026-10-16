import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const W=96,H=54;

/** Detail-weighted centroid of a grayscale thumbnail: where the drawing's linework concentrates. No inference. */
export function detailCentroid(gray:Uint8Array,width=W,height=H):[number,number]{
 let sx=0,sy=0,total=0;
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x;const gx=gray[i+1]-gray[i-1],gy=gray[i+width]-gray[i-width];
  // A mild centre prior keeps busy borders (foliage, crowds) from dragging the frame to an edge.
  const prior=1-.5*Math.hypot((x/width-.5)*1.4,(y/height-.5)*1.4);
  const weight=Math.hypot(gx,gy)*Math.max(.15,prior);sx+=weight*x;sy+=weight*y;total+=weight;
 }
 if(!total)return [.5,.45];
 return [Number((sx/total/width).toFixed(4)),Number((sy/total/height).toFixed(4))];
}

export type LabelZone='top'|'left'|'right';
/** The emptiest strip along the top edge, so a pop label does not sit on a face. */
export function quietZone(gray:Uint8Array,width=W,height=H):LabelZone{
 const energy={left:0,top:0,right:0};const rows=Math.round(height*.3);
 for(let y=1;y<rows;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x,e=Math.hypot(gray[i+1]-gray[i-1],gray[i+width]-gray[i-width]),u=x/width;
  if(u<.45)energy.left+=e;if(u>.25&&u<.75)energy.top+=e;if(u>.55)energy.right+=e;
 }
 // The centre strip is a little wider; normalize by area before comparing.
 energy.top*=.45/.5;
 return (Object.entries(energy).sort((a,b)=>a[1]-b[1])[0][0]) as LabelZone;
}

export async function imageLayout(path:string):Promise<{focus:[number,number];zone:LabelZone}>{
 const {stdout}=await run('ffmpeg',['-v','error','-i',path,'-vf',`scale=${W}:${H}:flags=area,format=gray`,'-f','rawvideo','-'],{encoding:'buffer',maxBuffer:W*H*4});
 const gray=new Uint8Array(stdout as Buffer);
 return {focus:detailCentroid(gray,W,H),zone:quietZone(gray,W,H)};
}
