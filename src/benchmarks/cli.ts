import {runBenchmarks} from './index';
runBenchmarks().catch(e=>{console.error(JSON.stringify({event:'benchmark_failed',message:e.message}));process.exitCode=1;});
