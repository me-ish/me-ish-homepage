export type CasePersonalEvent={id:string;title:string;date:string;note?:string};
export type CaseNoticeIndexItem={id:string;projectId:string;projectTitle:string;purpose:string;status:string;attemptNo:number;sentAt:string|null;recordedAt:string;targetId:string|null;targetRevision:string|null};
export type CaseNoticeIndex={revision:string;items:readonly CaseNoticeIndexItem[]};
