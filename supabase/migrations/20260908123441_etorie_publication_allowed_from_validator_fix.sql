-- RequestData V1 の publicationAllowedFrom を DB validator に追加する。
-- 既存 validator を互換関数として保持し、公開可能日の検証だけを薄い wrapper で追加する。
-- 旧データ（publicationAllowedFrom キーなし）は従来どおり検証できる。
begin;

alter function public.natori_request_data_is_valid_v1(jsonb)
  rename to natori_request_data_is_valid_v1_legacy_20260908;

create function public.natori_request_data_is_valid_v1(
  p_request_data jsonb
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = ''
as $function$
declare
  v_policy text;
  v_allowed_from_text text;
  v_allowed_from date;
begin
  if p_request_data is null
     or pg_catalog.jsonb_typeof(p_request_data) <> 'object'
  then
    return false;
  end if;

  -- 導入前の保存済み RequestData V1 はキーなしのまま既存 validator へ渡す。
  if not (p_request_data ? 'publicationAllowedFrom') then
    return public.natori_request_data_is_valid_v1_legacy_20260908(p_request_data);
  end if;

  v_policy := p_request_data ->> 'publicationPolicy';

  if p_request_data -> 'publicationAllowedFrom' = 'null'::jsonb then
    -- delayed は公開可能日必須。それ以外は null を許可する。
    if v_policy = 'delayed' then
      return false;
    end if;
  else
    -- 日付を持てるのは delayed のときだけ。
    if pg_catalog.jsonb_typeof(p_request_data -> 'publicationAllowedFrom') <> 'string'
       or v_policy <> 'delayed'
    then
      return false;
    end if;

    v_allowed_from_text := p_request_data ->> 'publicationAllowedFrom';
    if v_allowed_from_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       or substring(v_allowed_from_text from 1 for 4)::integer < 100
    then
      return false;
    end if;

    v_allowed_from := pg_catalog.make_date(
      substring(v_allowed_from_text from 1 for 4)::integer,
      substring(v_allowed_from_text from 6 for 2)::integer,
      substring(v_allowed_from_text from 9 for 2)::integer
    );
    if pg_catalog.to_char(v_allowed_from, 'YYYY-MM-DD') <> v_allowed_from_text then
      return false;
    end if;
  end if;

  -- 追加フィールドだけ前段で検証し、それ以外の厳密 contract は既存 validator に委譲する。
  return public.natori_request_data_is_valid_v1_legacy_20260908(
    p_request_data - 'publicationAllowedFrom'
  );
exception
  when others then
    return false;
end;
$function$;

-- helper / wrapper は公開 API にしない。create v2 RPC は SECURITY DEFINER で内部呼び出しする。
revoke all on function
  public.natori_request_data_is_valid_v1_legacy_20260908(jsonb)
from public, anon, authenticated, service_role;

revoke all on function
  public.natori_request_data_is_valid_v1(jsonb)
from public, anon, authenticated, service_role;

commit;
