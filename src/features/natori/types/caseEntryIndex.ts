export type CasePersonalEvent={id:string;title:string;date:string;note?:string};
export type CaseNoticeIndexItem={id:string;projectId:string;projectTitle:string;purpose:string;status:string;attemptNo:number;sentAt:string|null;recordedAt:string;targetId:string|null;targetRevision:string|null};
export type CaseNoticeIndex={revision:string;items:readonly CaseNoticeIndexItem[]};
/** The first line of the latest talk message, shortened, for the トーク list. */
/** Sender and time come along so very long talks, which the case snapshot cannot list, still show who wrote and when. */
export type CaseTalkPreview={projectId:string;messageId:string;excerpt:string;latestSender:"staff"|"client";latestAt:string};
