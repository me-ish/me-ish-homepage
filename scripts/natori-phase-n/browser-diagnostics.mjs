// Emit fixed classifications only. Never serialize an error, request or response.
const connectionCodes=['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EPIPE','ENOTFOUND','EAI_AGAIN','UND_ERR_SOCKET','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT'];
const markers=[['timeout','Timeout'],['socket_hang_up','socket hang up'],['context_closed','Target page, context or browser has been closed'],['request_context_disposed','Request context disposed.'],['response_disposed','Response has been disposed'],['protocol_error','Protocol error'],['resource_missing','No resource with given identifier found']];
const bounded=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max?value:null;
export function privacyReadFailureLine(error,input={}){
 const value=input&&typeof input==='object'?input:{};
 const message=typeof error?.message==='string'?error.message:'';
 const codes=connectionCodes.filter(code=>error?.code===code||error?.cause?.code===code||message.includes(code));
 const kind=['TimeoutError','TypeError','Error','AssertionError'].includes(error?.name)?error.name:'other';
 return '[phasen-diagnostic] '+JSON.stringify({event:'shared_home_privacy_read_failure',checkpoint:['privacy_get','privacy_body','privacy_assert'].includes(value.checkpoint)?value.checkpoint:'other',kind,codes,markers:markers.filter(([,text])=>message.includes(text)).map(([code])=>code),status:bounded(value.status,100,599),privateDataAbsent:typeof value.privateDataAbsent==='boolean'?value.privateDataAbsent:null,elapsedMs:bounded(value.elapsedMs,0,120000)});
}
