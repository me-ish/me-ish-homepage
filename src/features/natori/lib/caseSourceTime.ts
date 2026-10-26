import {isPaymentTimestamp} from "./clientPayment";
function parts(value:string){
 const match=/^(.{19})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
 return isPaymentTimestamp(value)&&match?{second:Date.parse(match[1]+match[3]),fraction:(match[2]??"").replace(/0+$/,"")}:null;
}
/** Same instant, including PostgreSQL microseconds; different UTC offsets remain comparable. */
export function sameCaseSourceTime(a:string,b:string):boolean{
 const left=parts(a),right=parts(b);return !!left&&!!right&&left.second===right.second&&left.fraction===right.fraction;
}
