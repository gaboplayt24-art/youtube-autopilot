declare module '@echogarden/espeak-ng-emscripten' {
 interface Worker {set_voice(name:string):void;set_rate(rate:number):void;get_samplerate():number;synthesize(text:string,callback:(samples:Int16Array,events:{type:string;text_position:number;audio_position:number}[])=>void):void}
 export default function factory():Promise<{eSpeakNGWorker:new()=>Worker;destroy(worker:Worker):void}>;
}
