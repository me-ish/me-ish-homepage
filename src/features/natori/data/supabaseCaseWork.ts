import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { caseWorkView } from "../lib/caseWork";
export async function fetchCaseWork(projectId:string,operationId?:string){
 const response=await fetch(`/api/natori/admin/case-work?projectId=${encodeURIComponent(projectId)}${operationId?`&operationId=${encodeURIComponent(operationId)}`:""}`,{cache:"no-store"});
 if(!response.ok)throw Error(response.status===401?"ログインが切れました。もう一度ログインしてください。":"読み込めませんでした。");
 const data:unknown=await response.json();return caseWorkView.parse((data as {view:unknown}).view);
}
export async function mutateCaseWork(input:unknown):Promise<{result?:string;kind?:string;notificationStatus?:string}>{
 let response:Response;
 try{response=await fetch("/api/natori/admin/case-work",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},body:JSON.stringify(input)});}
 catch{throw Error("うまくいったか分かりません。「結果を見る」を押してください。");}
 if(!response.ok)throw Error(response.status===401?"ログインが切れました。ログインしてから「結果を見る」を押してください。":"うまくいったか分かりません。「結果を見る」を押してください。");
 try{return await response.json();}catch{throw Error("うまくいったか分かりません。「結果を見る」を押してください。");}
}
