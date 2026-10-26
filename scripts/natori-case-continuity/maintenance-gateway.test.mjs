import {test} from 'node:test';
import assert from 'node:assert/strict';
import {maintenancePurgeAllowed} from './maintenance-gateway.mjs';
const permitted={maintenanceOnly:true,normal:true,payment:true,method:'POST',suffix:'/rpc/natori_delivery_purge_payloads_v1',query:'',apiKey:'synthetic-service',authorization:'Bearer synthetic-service',serviceKey:'synthetic-service'};
test('only the dedicated synthetic POST with service identity is allowed',()=>assert.equal(maintenancePurgeAllowed(permitted),true));
for(const [name,patch] of Object.entries({ordinary:{maintenanceOnly:false},reducedSchema:{normal:false},noPayment:{payment:false},readMethod:{method:'GET'},anotherRpc:{suffix:'/rpc/natori_notification_retry_v1'},pathPrefix:{suffix:'/rpc/natori_delivery_purge_payloads_v1/other'},query:{query:'?p_owner_id=other'},anon:{apiKey:'synthetic-anon'},wrongBearer:{authorization:'Bearer synthetic-anon'},noService:{apiKey:'',authorization:'Bearer ',serviceKey:''}})){
 test('keeps '+name+' outside the exception',()=>assert.equal(maintenancePurgeAllowed({...permitted,...patch}),false));
}
