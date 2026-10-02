/** Attachment existence is independent of temporary signed-link acquisition. */
export type ConsultationFile={id:string;name:string;sizeBytes:number;url:string|null;exists?:true;acquisitionState?:"ready"|"unavailable"};
export type ConsultationMessage={id:string;sender:"staff"|"client";body:string;notificationStatus:string;createdAt:string;files:ConsultationFile[];filesState?:"ready"|"unavailable";attachmentsExist?:boolean|null};
export type ConsultationInitialFile={id:string;name:string;url:string|null;exists:true;acquisitionState:"ready"|"unavailable"};
export type ConsultationOverview={latestMessageId:string|null;latestSender:"staff"|"client"|null;latestMessageAt:string|null;notificationFailed:number;notificationPending:number};
