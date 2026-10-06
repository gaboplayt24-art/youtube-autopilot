// These compositions use 2D CSS/SVG. Let Chromium choose its CPU raster backend;
// forcing SwiftShader routes every large blended layer through software OpenGL.
export function browserOptions(browserExecutable?:string){return {browserExecutable,chromeMode:browserExecutable?'chrome-for-testing' as const:'headless-shell' as const,chromiumOptions:{headless:true,enableMultiProcessOnLinux:true,gl:null}};}
export async function withBrowser<T extends {close(options:{silent:boolean}):Promise<void>}>(open:()=>Promise<T>,run:(browser:T)=>Promise<void>){
 const browser=await open();let failure:unknown;
 try{await run(browser);}catch(error){failure=error;throw error;}
 finally{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([browser.close({silent:true}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Browser cleanup exceeded 2 seconds')),2000);})]);}
  catch(error){if(!failure)throw error;console.error(JSON.stringify({event:'browser_cleanup_failed',message:error instanceof Error?error.message:'Unknown cleanup error'}));}
  finally{clearTimeout(timer);}
 }
}
