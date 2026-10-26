import { CSRF_HEADERS } from "@/lib/auth/csrf";
import { caseWorkView } from "../lib/caseWork";
export async function fetchCaseWork(projectId:string,operationId?:string){
 const response=await fetch(`/api/natori/admin/case-work?projectId=${encodeURIComponent(projectId)}${operationId?`&operationId=${encodeURIComponent(operationId)}`:""}`,{cache:"no-store"});
 if(!response.ok)throw Error(response.status===401?"認証を確認できません。再ログインしてください。":"案件の操作情報を取得できません。");
 const data:unknown=await response.json();return caseWorkView.parse((data as {view:unknown}).view);
}
export async function mutateCaseWork(input:unknown):Promise<{result?:string;kind?:string;notificationStatus?:string}>{
 let response:Response;
 try{response=await fetch("/api/natori/admin/case-work",{method:"POST",headers:{...CSRF_HEADERS,"Content-Type":"application/json"},body:JSON.stringify(input)});}
 catch{throw Error("結果を確認できません。同じ操作の記録を照会してください。");}
 if(!response.ok)throw Error(response.status===401?"認証が失効しました。再ログイン後に結果を照会してください。":"結果を確認できません。同じ操作の記録を照会してください。");
 try{return await response.json();}catch{throw Error("結果を確認できません。同じ操作の記録を照会してください。");}
}
