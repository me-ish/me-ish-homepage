/** Narrow repository-owned fixture exception. Does not grant any database permission. */
export function maintenancePurgeAllowed({maintenanceOnly,normal,payment,method,suffix,query,apiKey,authorization,serviceKey}){
 return maintenanceOnly===true&&normal===true&&payment===true&&method==='POST'
  &&suffix==='/rpc/natori_delivery_purge_payloads_v1'&&query===''
  &&typeof serviceKey==='string'&&serviceKey.length>0&&apiKey===serviceKey&&authorization==='Bearer '+serviceKey;
}
