/** Attachment existence is independent of temporary signed-link acquisition. */
export type ConsultationFile={id:string;name:string;sizeBytes:number;url:string|null;exists?:true;acquisitionState?:"ready"|"unavailable"};
/** A staff message marked as a rough; okAt is the client's recorded "このラフでOK". */
export type ConsultationRough={id:string;beforeQuote:boolean;okAt:string|null};
export type ConsultationMessage={id:string;sender:"staff"|"client";body:string;notificationStatus:string;createdAt:string;files:ConsultationFile[];filesState?:"ready"|"unavailable";attachmentsExist?:boolean|null;rough?:ConsultationRough};
export type ConsultationInitialFile={id:string;name:string;url:string|null;exists:true;acquisitionState:"ready"|"unavailable"};
export type ConsultationOverview={latestMessageId:string|null;latestSender:"staff"|"client"|null;latestMessageAt:string|null;notificationFailed:number;notificationPending:number;roughOkPending:number;latestRoughOkId:string|null;latestRoughOkAt:string|null};
/** Owner-only business acknowledgement, separate from the immutable client OK and mail outcome. */
export type StaffRoughOk={id:string;messageId:string;beforeQuote:boolean;okAt:string;acknowledgedAt:string|null;notificationId:string|null;notificationStatus:"pending"|"sending"|"sent"|"failed"|"unknown"|null;notificationAttemptNo:number|null;notificationSentAt:string|null;retryAvailable:boolean;reviewRequired:boolean};
