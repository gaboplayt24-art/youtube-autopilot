import {z} from 'zod';
import {exec} from '../orchestration/io';
import type {densityReview} from './density-qa';

const component=z.object({x:z.number().int().nonnegative(),y:z.number().int().nonnegative(),width:z.number().int().positive(),height:z.number().int().positive(),area:z.number().int().positive()});
export const requiresWingCount=(idea:{depictionScope?:string;historicalContext:string})=>idea.depictionScope==='wing-study'&&/source-bound vision/i.test(idea.historicalContext)&&/Isaiah 6:2/i.test(idea.historicalContext);
export function isolatedWingStudyPass(value:{components:{width:number;height:number}[];backgroundUniformity:number;foregroundRatio:number}){
 // This is deliberately restricted to isolated, upright wing STUDIES, not anatomy
 // detection in arbitrary scenes. Wide/merged shapes require another take/review.
 return value.components.length===6&&value.backgroundUniformity>=.9&&value.foregroundRatio>.03&&value.foregroundRatio<.75&&value.components.every(c=>c.height>=c.width*1.05);
}
export const wingStudyMeasurement=z.object({algorithm:z.literal('isolated-wing-silhouettes-v1'),width:z.literal(512),height:z.literal(288),backgroundRgb:z.tuple([z.number(),z.number(),z.number()]),backgroundUniformity:z.number().min(0).max(1),foregroundRatio:z.number().min(0).max(1),components:z.array(component),detectedCount:z.number().int().nonnegative(),expectedCount:z.literal(6),passed:z.boolean()}).refine(v=>v.detectedCount===v.components.length&&v.passed===isolatedWingStudyPass(v),'Inconsistent quantitative wing evidence');
export const wingCountEvidence=z.object({sourceSha256:z.string().length(64),measurement:wingStudyMeasurement});
export const wingCountStage=(id:string,sha:string)=>'native-'+id+'-isolated-wing-count-v1-'+sha.slice(0,12);
export function applyWingCount(review:z.infer<typeof densityReview>,measurement:z.infer<typeof wingStudyMeasurement>){
 if(measurement.passed)return review;
 return {...review,passed:false,conceptMatches:false,objectiveFailures:[...new Set([...(review.objectiveFailures??[]),'factualWingCount'])],issues:[...review.issues,`Quantitative isolated-wing study failed: ${measurement.detectedCount} large components; six separate upright wing silhouettes required. Source image and original AI verdict preserved.`]};
}

export function measureIsolatedWings(rgb:Uint8Array){
 const width=512 as const,height=288 as const,total=width*height;
 if(rgb.length!==total*3)throw Error('Unexpected RGB study frame size');
 const border:number[]=[];for(let x=0;x<width;x++)border.push(x,(height-1)*width+x);for(let y=1;y<height-1;y++)border.push(y*width,y*width+width-1);
 const backgroundRgb=[0,1,2].map(c=>border.map(i=>rgb[i*3+c]).sort((a,b)=>a-b)[Math.floor(border.length/2)]) as [number,number,number];
 const distance=(i:number)=>backgroundRgb.reduce((sum,c,k)=>sum+(rgb[i*3+k]-c)**2,0),threshold=65**2;
 const mask=new Uint8Array(total),queue=new Int32Array(total);let foreground=0;
 for(let i=0;i<total;i++)if(distance(i)>threshold){mask[i]=1;foreground++;}
 const components:z.infer<typeof component>[]=[];
 for(let start=0;start<total;start++){
  if(mask[start]!==1)continue;let head=0,tail=1,minX:number=width,minY:number=height,maxX=0,maxY=0;queue[0]=start;mask[start]=2;
  while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const n=ny*width+nx;if(mask[n]===1){mask[n]=2;queue[tail++]=n;}}
  }
  const w=maxX-minX+1,h=maxY-minY+1;if(tail>=total*.0007&&w>=5&&h>=8)components.push({x:minX,y:minY,width:w,height:h,area:tail});
 }
 components.sort((a,b)=>a.y-b.y||a.x-b.x);
 const values={components,backgroundUniformity:border.filter(i=>distance(i)<=threshold).length/border.length,foregroundRatio:foreground/total};
 return wingStudyMeasurement.parse({algorithm:'isolated-wing-silhouettes-v1',width,height,backgroundRgb,...values,detectedCount:components.length,expectedCount:6,passed:isolatedWingStudyPass(values)});
}
export async function inspectWingStudy(path:string){
 const {stdout}=await exec('ffmpeg',['-v','error','-i',path,'-vf','scale=512:288','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],{encoding:'buffer',timeout:20000,maxBuffer:2*1024*1024});
 return measureIsolatedWings(stdout);
}
