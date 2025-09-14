--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 17.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS'
);


--
-- Name: consume_cert_token(integer, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.consume_cert_token(p_entry_id integer, p_token_hash text, p_one_time boolean DEFAULT true) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
declare
  v_id uuid;
  v_used timestamptz;
  v_revoked boolean;
  v_expires timestamptz;
begin
  select id, used_at, revoked, expires_at
    into v_id, v_used, v_revoked, v_expires
  from public.cert_links
  where entry_id = p_entry_id
    and token_hash = p_token_hash
  limit 1;

  if v_id is null then
    return false; -- 見つからない
  end if;

  if v_revoked then
    return false; -- 無効化済み
  end if;

  if v_expires is not null and v_expires <= now() then
    return false; -- 期限切れ
  end if;

  if p_one_time and v_used is not null then
    return false; -- すでに消費済み
  end if;

  if p_one_time then
    update public.cert_links
      set used_at = now()
    where id = v_id;
  end if;

  return true;
end;
$$;


--
-- Name: finalize_sale(bigint, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_sale(p_entry_id bigint, p_quantity integer, p_session_id text) RETURNS TABLE(new_edition_sold integer, sold_out boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  v_entry record;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be positive';
  end if;

  -- 対象行をロックして取得
  select * into v_entry
  from public.entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'entry % not found', p_entry_id;
  end if;

  -- 在庫チェック（edition_total が null は無制限）
  if v_entry.edition_total is not null then
    if coalesce(v_entry.edition_sold,0) + p_quantity > v_entry.edition_total then
      raise exception 'sold out: requested %, remaining %',
        p_quantity,
        greatest(v_entry.edition_total - coalesce(v_entry.edition_sold,0), 0);
    end if;
  end if;

  -- インクリメント（sold_out_calc は計算列なので自動反映）
  update public.entries
     set edition_sold = coalesce(edition_sold,0) + p_quantity
   where id = p_entry_id
   returning edition_sold,
             (edition_total is not null and edition_sold >= edition_total)
        into new_edition_sold, sold_out;

  return;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end; $$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: add_prefixes(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.add_prefixes(_bucket_id text, _name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    prefixes text[];
BEGIN
    prefixes := "storage"."get_prefixes"("_name");

    IF array_length(prefixes, 1) > 0 THEN
        INSERT INTO storage.prefixes (name, bucket_id)
        SELECT UNNEST(prefixes) as name, "_bucket_id" ON CONFLICT DO NOTHING;
    END IF;
END;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_prefix(text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix(_bucket_id text, _name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Check if we can delete the prefix
    IF EXISTS(
        SELECT FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name") + 1
          AND "prefixes"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    )
    OR EXISTS(
        SELECT FROM "storage"."objects"
        WHERE "objects"."bucket_id" = "_bucket_id"
          AND "storage"."get_level"("objects"."name") = "storage"."get_level"("_name") + 1
          AND "objects"."name" COLLATE "C" LIKE "_name" || '/%'
        LIMIT 1
    ) THEN
    -- There are sub-objects, skip deletion
    RETURN false;
    ELSE
        DELETE FROM "storage"."prefixes"
        WHERE "prefixes"."bucket_id" = "_bucket_id"
          AND level = "storage"."get_level"("_name")
          AND "prefixes"."name" = "_name";
        RETURN true;
    END IF;
END;
$$;


--
-- Name: delete_prefix_hierarchy_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_prefix_hierarchy_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    prefix text;
BEGIN
    prefix := "storage"."get_prefix"(OLD."name");

    IF coalesce(prefix, '') != '' THEN
        PERFORM "storage"."delete_prefix"(OLD."bucket_id", prefix);
    END IF;

    RETURN OLD;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(name COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                        substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1)))
                    ELSE
                        name
                END AS name, id, metadata, updated_at
            FROM
                storage.objects
            WHERE
                bucket_id = $5 AND
                name ILIKE $1 || ''%'' AND
                CASE
                    WHEN $6 != '''' THEN
                    name COLLATE "C" > $6
                ELSE true END
                AND CASE
                    WHEN $4 != '''' THEN
                        CASE
                            WHEN position($2 IN substring(name from length($1) + 1)) > 0 THEN
                                substring(name from 1 for length($1) + position($2 IN substring(name from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                name COLLATE "C" > $4
                            END
                    ELSE
                        true
                END
            ORDER BY
                name COLLATE "C" ASC) as e order by name COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_token, bucket_id, start_after;
END;
$_$;


--
-- Name: objects_insert_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_insert_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    NEW.level := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: objects_update_prefix_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.objects_update_prefix_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    old_prefixes TEXT[];
BEGIN
    -- Ensure this is an update operation and the name has changed
    IF TG_OP = 'UPDATE' AND (NEW."name" <> OLD."name" OR NEW."bucket_id" <> OLD."bucket_id") THEN
        -- Retrieve old prefixes
        old_prefixes := "storage"."get_prefixes"(OLD."name");

        -- Remove old prefixes that are only used by this object
        WITH all_prefixes as (
            SELECT unnest(old_prefixes) as prefix
        ),
        can_delete_prefixes as (
             SELECT prefix
             FROM all_prefixes
             WHERE NOT EXISTS (
                 SELECT 1 FROM "storage"."objects"
                 WHERE "bucket_id" = OLD."bucket_id"
                   AND "name" <> OLD."name"
                   AND "name" LIKE (prefix || '%')
             )
         )
        DELETE FROM "storage"."prefixes" WHERE name IN (SELECT prefix FROM can_delete_prefixes);

        -- Add new prefixes
        PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    END IF;
    -- Set the new level
    NEW."level" := "storage"."get_level"(NEW."name");

    RETURN NEW;
END;
$$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: prefixes_insert_trigger(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.prefixes_insert_trigger() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    PERFORM "storage"."add_prefixes"(NEW."bucket_id", NEW."name");
    RETURN NEW;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
declare
    can_bypass_rls BOOLEAN;
begin
    SELECT rolbypassrls
    INTO can_bypass_rls
    FROM pg_roles
    WHERE rolname = coalesce(nullif(current_setting('role', true), 'none'), current_user);

    IF can_bypass_rls THEN
        RETURN QUERY SELECT * FROM storage.search_v1_optimised(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    ELSE
        RETURN QUERY SELECT * FROM storage.search_legacy_v1(prefix, bucketname, limits, levels, offsets, search, sortcolumn, sortorder);
    END IF;
end;
$$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v1_optimised(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v1_optimised(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select (string_to_array(name, ''/''))[level] as name
           from storage.prefixes
             where lower(prefixes.name) like lower($2 || $3) || ''%''
               and bucket_id = $4
               and level = $1
           order by name ' || v_sort_order || '
     )
     (select name,
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[level] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where lower(objects.name) like lower($2 || $3) || ''%''
       and bucket_id = $4
       and level = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
BEGIN
    RETURN query EXECUTE
        $sql$
        SELECT * FROM (
            (
                SELECT
                    split_part(name, '/', $4) AS key,
                    name || '/' AS name,
                    NULL::uuid AS id,
                    NULL::timestamptz AS updated_at,
                    NULL::timestamptz AS created_at,
                    NULL::jsonb AS metadata
                FROM storage.prefixes
                WHERE name COLLATE "C" LIKE $1 || '%'
                AND bucket_id = $2
                AND level = $4
                AND name COLLATE "C" > $5
                ORDER BY prefixes.name COLLATE "C" LIMIT $3
            )
            UNION ALL
            (SELECT split_part(name, '/', $4) AS key,
                name,
                id,
                updated_at,
                created_at,
                metadata
            FROM storage.objects
            WHERE name COLLATE "C" LIKE $1 || '%'
                AND bucket_id = $2
                AND level = $4
                AND name COLLATE "C" > $5
            ORDER BY name COLLATE "C" LIMIT $3)
        ) obj
        ORDER BY name COLLATE "C" LIMIT $3;
        $sql$
        USING prefix, bucket_name, limits, levels, start_after;
END;
$_$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_emails (
    email public.citext NOT NULL
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body_md text NOT NULL,
    category text DEFAULT 'info'::text NOT NULL,
    link_url text,
    pinned boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: announcements_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.announcements_public AS
 SELECT announcements.id,
    announcements.title,
    announcements.body_md,
    announcements.category,
    announcements.link_url,
    announcements.pinned,
    announcements.published_at
   FROM public.announcements
  WHERE ((announcements.expires_at IS NULL) OR (announcements.expires_at > now()));


--
-- Name: cert_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cert_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone,
    revoked boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entries (
    id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    artist_name text,
    email text,
    sns_links text NOT NULL,
    title text,
    description text NOT NULL,
    is_for_sale boolean DEFAULT false NOT NULL,
    sale_type text NOT NULL,
    price numeric,
    image_url text NOT NULL,
    gallery_type text,
    confirmed boolean,
    file_name text,
    user_id uuid,
    display_plan text,
    type text,
    is_sold boolean DEFAULT false,
    meish_fee_yen numeric,
    artist_reward_yen numeric,
    is_paid_to_artist boolean,
    paid_at timestamp with time zone,
    likes integer DEFAULT 0 NOT NULL,
    external_user_id uuid,
    edition_total integer,
    edition_sold integer DEFAULT 0 NOT NULL,
    display_ready boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    display_start_at timestamp with time zone,
    display_end_at timestamp with time zone,
    edition_remaining integer GENERATED ALWAYS AS (
CASE
    WHEN (edition_total IS NULL) THEN NULL::integer
    ELSE GREATEST((edition_total - edition_sold), 0)
END) STORED,
    sold_out_calc boolean GENERATED ALWAYS AS (((edition_total IS NOT NULL) AND (edition_sold >= edition_total))) STORED,
    rejected_at timestamp with time zone,
    reject_reason text,
    reject_email_sent_at timestamp with time zone,
    CONSTRAINT entries_edition_le_total CHECK (((edition_total IS NULL) OR (edition_sold <= edition_total))),
    CONSTRAINT entries_edition_sold_nonneg CHECK ((edition_sold >= 0)),
    CONSTRAINT entries_edition_total_pos CHECK (((edition_total IS NULL) OR (edition_total >= 1)))
);


--
-- Name: COLUMN entries.confirmed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.confirmed_at IS '承認日時';


--
-- Name: COLUMN entries.display_start_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.display_start_at IS '展示開始日時（この日時以降に表示対象）';


--
-- Name: COLUMN entries.display_end_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.display_end_at IS '展示終了日時（この日時以降は非表示）';


--
-- Name: COLUMN entries.edition_remaining; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.edition_remaining IS 'Remaining editions (null = unlimited)';


--
-- Name: COLUMN entries.sold_out_calc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.entries.sold_out_calc IS 'Computed SOLD (true when edition_total is not null and edition_sold >= edition_total)';


--
-- Name: entries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.entries ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    is_read boolean DEFAULT false
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text DEFAULT ''''''::text NOT NULL,
    sns_links jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone,
    bio text,
    avatar_url text,
    banner_url text
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id integer NOT NULL,
    price integer,
    buyer_email text,
    stripe_session_id text,
    purchased_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


--
-- Name: special_thanks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.special_thanks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    tagline text,
    homepage_url text,
    twitter_url text,
    instagram_url text,
    is_public boolean DEFAULT true NOT NULL,
    sort_order integer
);


--
-- Name: v_cert_links_active; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_cert_links_active AS
 SELECT cert_links.id,
    cert_links.entry_id,
    cert_links.token_hash,
    cert_links.expires_at,
    cert_links.revoked,
    cert_links.used_at,
    cert_links.created_at,
    cert_links.updated_at
   FROM public.cert_links
  WHERE ((cert_links.revoked = false) AND ((cert_links.expires_at IS NULL) OR (cert_links.expires_at > now())) AND (cert_links.used_at IS NULL));


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    level integer
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: prefixes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.prefixes (
    bucket_id text NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    level integer GENERATED ALWAYS AS (storage.get_level(name)) STORED NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_emails admin_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_emails
    ADD CONSTRAINT admin_emails_pkey PRIMARY KEY (email);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: cert_links cert_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_links
    ADD CONSTRAINT cert_links_pkey PRIMARY KEY (id);


--
-- Name: entries entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entries
    ADD CONSTRAINT entries_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id, entry_id);


--
-- Name: special_thanks special_thanks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.special_thanks
    ADD CONSTRAINT special_thanks_pkey PRIMARY KEY (id);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: prefixes prefixes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT prefixes_pkey PRIMARY KEY (bucket_id, level, name);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: cert_links_entry_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cert_links_entry_active_idx ON public.cert_links USING btree (entry_id, revoked, expires_at);


--
-- Name: cert_links_entry_token_ux; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cert_links_entry_token_ux ON public.cert_links USING btree (entry_id, token_hash);


--
-- Name: special_thanks_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX special_thanks_sort_idx ON public.special_thanks USING btree (sort_order, display_name);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_name_bucket_level_unique; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX idx_name_bucket_level_unique ON storage.objects USING btree (name COLLATE "C", bucket_id, level);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_lower_name ON storage.objects USING btree ((path_tokens[level]), lower(name) text_pattern_ops, bucket_id, level);


--
-- Name: idx_prefixes_lower_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_prefixes_lower_name ON storage.prefixes USING btree (bucket_id, level, ((string_to_array(name, '/'::text))[level]), lower(name) text_pattern_ops);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: objects_bucket_id_level_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX objects_bucket_id_level_idx ON storage.objects USING btree (bucket_id, level, name COLLATE "C");


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cert_links trg_cert_links_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cert_links_set_updated_at BEFORE UPDATE ON public.cert_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: objects objects_delete_delete_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects objects_insert_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();


--
-- Name: objects objects_update_create_prefix; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();


--
-- Name: prefixes prefixes_create_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();


--
-- Name: prefixes prefixes_delete_hierarchy; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: announcements announcements_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: cert_links cert_links_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cert_links
    ADD CONSTRAINT cert_links_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.entries(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: prefixes prefixes_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.prefixes
    ADD CONSTRAINT "prefixes_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: inquiries Allow admin read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin read" ON public.inquiries FOR SELECT TO authenticated USING ((auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid));


--
-- Name: inquiries Allow admin update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin update" ON public.inquiries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: entries Allow linking for entries without user_id; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow linking for entries without user_id" ON public.entries FOR UPDATE TO authenticated USING ((user_id IS NULL)) WITH CHECK (true);


--
-- Name: entries Allow only admin to update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow only admin to update" ON public.entries FOR UPDATE TO authenticated USING ((auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid)) WITH CHECK ((auth.uid() = 'b3211e93-a630-4826-8e78-5a50db043170'::uuid));


--
-- Name: entries Allow public insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public insert" ON public.entries FOR INSERT WITH CHECK (true);


--
-- Name: entries Allow public select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select" ON public.entries FOR SELECT USING (true);


--
-- Name: entries Allow public to increment likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public to increment likes" ON public.entries FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can read their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: announcements admin can delete announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can delete announcements" ON public.announcements FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email()))));


--
-- Name: announcements admin can insert announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can insert announcements" ON public.announcements FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email()))));


--
-- Name: announcements admin can update announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "admin can update announcements" ON public.announcements FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.admin_emails a
  WHERE ((a.email)::text = auth.email()))));


--
-- Name: announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: cert_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cert_links ENABLE ROW LEVEL SECURITY;

--
-- Name: entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;

--
-- Name: inquiries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: special_thanks public read thanks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read thanks" ON public.special_thanks FOR SELECT TO authenticated, anon USING ((is_public = true));


--
-- Name: announcements read announcements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read announcements" ON public.announcements FOR SELECT TO authenticated, anon USING (true);


--
-- Name: sales; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

--
-- Name: special_thanks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.special_thanks ENABLE ROW LEVEL SECURITY;

--
-- Name: objects Allow Insert 1exduyn_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow Insert 1exduyn_0" ON storage.objects FOR INSERT WITH CHECK (true);


--
-- Name: objects Allow public access 1exduyn_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public access 1exduyn_0" ON storage.objects FOR SELECT USING ((bucket_id = 'artworks'::text));


--
-- Name: objects Allow public access 1exduyn_1; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public access 1exduyn_1" ON storage.objects FOR UPDATE USING ((bucket_id = 'artworks'::text));


--
-- Name: objects Allow public access 1exduyn_2; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public access 1exduyn_2" ON storage.objects FOR INSERT WITH CHECK ((bucket_id = 'artworks'::text));


--
-- Name: objects Allow public access 1exduyn_3; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public access 1exduyn_3" ON storage.objects FOR DELETE USING ((bucket_id = 'artworks'::text));


--
-- Name: objects Allow public read access sudlkv_0; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "Allow public read access sudlkv_0" ON storage.objects FOR SELECT USING ((bucket_id = 'processing-meta'::text));


--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: objects delete own avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "delete own avatar" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects delete own banner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "delete own banner" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: prefixes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.prefixes ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: objects update own avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects update own banner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "update own banner" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text))) WITH CHECK (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects upload own avatar; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- Name: objects upload own banner; Type: POLICY; Schema: storage; Owner: -
--

CREATE POLICY "upload own banner" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'banners'::text) AND (split_part(name, '/'::text, 1) = (auth.uid())::text)));


--
-- PostgreSQL database dump complete
--

