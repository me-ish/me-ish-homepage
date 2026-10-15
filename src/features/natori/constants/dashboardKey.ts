// natori 管理画面の合言葉キー方式で共有する定数。
// middleware（edge）と server 双方から import するため server-only を付けない。
export const NATORI_KEY_COOKIE = "natori_dashboard_key";
export const NATORI_KEY_PARAM = "natori-key";
/** 合言葉キー Cookie の有効期間。ブラウザの maxAge とサーバー側の期限検証で同じ値を使う。 */
export const NATORI_KEY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 8;
