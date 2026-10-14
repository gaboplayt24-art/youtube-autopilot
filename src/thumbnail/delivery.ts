import {z} from 'zod';

/** Owner artwork is a delivery dependency, never a reason to generate paid substitutes. */
export function thumbnailDelivery(ownerSupplied:string|undefined){
 const owner=z.enum(['true','false']).default('false').parse(ownerSupplied)==='true';
 return {ownerSupplied:owner,generate:!owner,state:owner?'awaiting_owner_thumbnail':'ready_for_private_upload'};
}
