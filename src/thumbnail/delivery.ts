import {z} from 'zod';

/** Owner artwork is a delivery dependency, never a reason to generate paid substitutes. */
export function thumbnailDelivery(ownerSupplied:string|undefined){
 const owner=z.enum(['true','false']).default('false').parse(ownerSupplied)==='true';
 return {ownerSupplied:owner,generate:!owner,state:owner?'awaiting_owner_thumbnail':'ready_for_private_upload'};
}

/** Owner may apply the final cover in Studio after private upload; scheduling waits for that confirmation. */
export function ownerCoverHandoff(ownerApplies:string|undefined,confirmed:string|undefined){
 const flag=z.enum(['true','false']).default('false');
 const owner=flag.parse(ownerApplies)==='true',ready=flag.parse(confirmed)==='true';
 if(ready&&!owner)throw new Error('Owner-cover confirmation requires owner-cover mode');
 return {ownerApplies:owner,maySchedule:!owner||ready};
}
