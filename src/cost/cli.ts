import {freeProviderSmoke} from './smoke';
freeProviderSmoke().catch(e=>{console.error(JSON.stringify({event:'free_provider_smoke_failed',message:e.message}));process.exitCode=1;});
