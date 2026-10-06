import {spawn} from 'node:child_process';
process.on('message',job=>{
 const child=spawn(process.env.LOCAL_AI_PYTHON||'.venv-ai/bin/python',['scripts/local-ai.py'],{stdio:['pipe','inherit','inherit'],env:{...process.env,HF_HOME:process.env.HF_HOME||'.cache/huggingface',HF_HUB_DISABLE_XET:'1',TOKENIZERS_PARALLELISM:'false',OMP_NUM_THREADS:'2',MKL_NUM_THREADS:'2'}});
 child.stdin.end(JSON.stringify(job));child.once('error',e=>process.send?.({ok:false,error:e.message}));child.once('exit',code=>process.send?.({ok:code===0,error:code===0?undefined:`CPU model worker exited ${code}; see logs`}));
});
