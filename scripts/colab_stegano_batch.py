# =========================================================
# me-ish: ステガノ + Supabaseアップロード（バッチ処理）
# - processing-meta/pending/*.json を全件（または BATCH_SIZE 件）処理
# - 画像ソース優先順: workspace/glazed → workspace/wm → workspace/input → Supabase
# - 最終PNGを生成して Stegano(LSB) 埋め込み
# - Supabase artworks/final/ にアップロード
# - entries.image_url / display_ready を更新
# - entry_processing_jobs を succeeded に更新
# - 成功したら pending-processing と pending JSON を削除（重複防止）
# =========================================================

# --- 設定 ---
BATCH_SIZE = 0   # 0 = 全件処理、正数 = 最大N件
CLEANUP_PENDING = True  # 成功後に pending-processing と pending json を削除

# --- install ---
# !pip -q install supabase stegano pillow pillow-heif

import os, json, uuid, re
from datetime import datetime
from pathlib import Path
from io import BytesIO

from PIL import Image
from stegano import lsb
from supabase import create_client, Client
from pillow_heif import register_heif_opener
from google.colab import userdata
register_heif_opener()

# -------------------------
# Supabase接続
# -------------------------
ARTWORKS_BUCKET = "artworks"
META_BUCKET = "processing-meta"

SUPABASE_URL = userdata.get("SUPABASE_URL")
SUPABASE_KEY = userdata.get("SUPABASE_SERVICE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("❌ SUPABASE_URL / SUPABASE_SERVICE_KEY が Colab Secret に入っていません")

if not SUPABASE_URL.endswith("/"):
    SUPABASE_URL = SUPABASE_URL + "/"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ Supabase 接続OK")

# -------------------------
# workspace 準備
# -------------------------
WS = Path("workspace")
DIR_INPUT  = WS / "input"
DIR_WM     = WS / "wm"
DIR_GLAZED = WS / "glazed"
DIR_FINAL  = WS / "final"
for d in (DIR_INPUT, DIR_WM, DIR_GLAZED, DIR_FINAL):
    d.mkdir(parents=True, exist_ok=True)

# -------------------------
# pending/*.json を一覧取得
# -------------------------
def _num_key(name: str) -> int:
    m = re.search(r"(\d+)\.json$", name)
    return int(m.group(1)) if m else 10**18

res = supabase.storage.from_(META_BUCKET).list("pending", {"limit": 1000})
json_names = sorted(
    [x.get("name") for x in (res or [])
     if isinstance(x, dict) and (x.get("name") or "").endswith(".json") and re.search(r"\d+\.json$", x.get("name", ""))],
    key=_num_key,
)
if not json_names:
    raise RuntimeError("❌ processing-meta/pending に処理対象 json がありません")

targets = json_names[:BATCH_SIZE] if BATCH_SIZE > 0 else json_names
print(f"📦 処理対象: {len(targets)} 件")
for t in targets:
    print(f"   - {t} (entry_id={_num_key(t)})")
print()

# -------------------------
# 1件分の処理関数
# -------------------------
def process_stegano(json_name: str) -> dict:
    """1件分のステガノ+アップロード処理。"""
    json_path = f"pending/{json_name}"
    entry_id = _num_key(json_name)

    # 1) メタ取得
    raw = supabase.storage.from_(META_BUCKET).download(json_path)
    meta = json.loads(raw if isinstance(raw, (bytes, bytearray)) else str(raw))

    artist_name = str(meta.get("artistName", "")).strip()
    original_filename = str(meta.get("filename", "")).strip()
    if not artist_name or not original_filename:
        raise RuntimeError(f"meta が不正: {meta}")

    stem = Path(original_filename).stem

    # 2) 入力画像の決定（優先: glazed → wm → input → Supabase）
    src_path = None
    for p in (DIR_GLAZED / original_filename, DIR_WM / original_filename, DIR_INPUT / original_filename):
        if p.exists():
            src_path = p
            break

    if src_path is None:
        key = f"pending-processing/{original_filename}"
        blob = supabase.storage.from_(ARTWORKS_BUCKET).download(key)
        if not isinstance(blob, (bytes, bytearray)):
            raise FileNotFoundError(f"Supabase から画像取得に失敗: {key}")
        src_path = DIR_INPUT / original_filename
        with open(src_path, "wb") as f:
            f.write(blob)

    # 3) PNG正規化
    tmp_png = DIR_FINAL / f"{stem}__tmp.png"
    img = Image.open(src_path)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA")
    img.save(tmp_png, format="PNG")

    # 4) LSBステガノ埋め込み
    unique_id = str(uuid.uuid4())[:10]
    timestamp = datetime.now().isoformat(timespec="seconds")
    message = (
        f"created_by: {artist_name}\n"
        f"protected_by: me-ish\n"
        f"id: {unique_id}\n"
        f"processed_at: {timestamp}"
    )

    final_png_path = DIR_FINAL / f"{stem}.png"
    lsb.hide(str(tmp_png), message).save(final_png_path)

    # tmp削除
    tmp_png.unlink(missing_ok=True)

    # 5) Supabaseアップロード
    final_name = f"{stem}.png"
    upload_key = f"final/{final_name}"

    with open(final_png_path, "rb") as f:
        data = f.read()

    supabase.storage.from_(ARTWORKS_BUCKET).upload(
        upload_key,
        data,
        {"content-type": "image/png", "upsert": "true"},
    )

    pub = supabase.storage.from_(ARTWORKS_BUCKET).get_public_url(upload_key)
    public_url = pub["data"]["publicUrl"] if isinstance(pub, dict) else str(pub)

    # 6) entries 更新
    try:
        supabase.table("entries").update(
            {"image_url": public_url, "display_ready": True}
        ).eq("id", entry_id).execute()
    except Exception as e:
        raise RuntimeError(f"entries 更新失敗（service_role key が必要です）: {e}")

    # 7) job status → succeeded（service_role key でないと RLS で弾かれる）
    try:
        supabase.table("entry_processing_jobs").update({
            "status": "succeeded",
            "last_error": None,
            "locked_by": "colab-stegano",
            "locked_at": "now()",
        }).eq("entry_id", entry_id).execute()
    except Exception as e:
        print(f"  ⚠️ job status 更新スキップ（RLS制限の可能性）: {e}")

    # 8) 掃除
    if CLEANUP_PENDING:
        try:
            supabase.storage.from_(ARTWORKS_BUCKET).remove([f"pending-processing/{original_filename}"])
            supabase.storage.from_(META_BUCKET).remove([json_path])
        except Exception as e:
            print(f"  ⚠️ 掃除で失敗（続行）: {e}")

    return {
        "entry_id": entry_id,
        "file": original_filename,
        "artist": artist_name,
        "public_url": public_url,
        "source": str(src_path),
    }


# -------------------------
# 🚀 バッチ実行
# -------------------------
results = []
for idx, jname in enumerate(targets, 1):
    entry_id = _num_key(jname)
    print(f"--- [{idx}/{len(targets)}] entry_id={entry_id} ({jname}) ---")
    try:
        info = process_stegano(jname)
        results.append({"status": "ok", **info})
        print(f"  ✅ {info['file']} → {info['public_url']}")
    except Exception as e:
        results.append({"status": "error", "entry_id": entry_id, "file": jname, "error": str(e)})
        print(f"  ❌ ERROR: {e}")
        # エラー時は job を failed に（可能なら）
        try:
            supabase.table("entry_processing_jobs").update({
                "status": "failed",
                "last_error": str(e)[:500],
                "locked_by": "colab-stegano",
            }).eq("entry_id", entry_id).execute()
        except Exception:
            pass

# -------------------------
# 📊 サマリー
# -------------------------
ok_count = sum(1 for r in results if r["status"] == "ok")
err_count = len(results) - ok_count
print(f"\n{'='*50}")
print(f"✅ ステガノ+アップロード完了: {ok_count}/{len(results)} 件成功")
if err_count > 0:
    print(f"❌ {err_count} 件失敗:")
for r in results:
    icon = "✅" if r["status"] == "ok" else "❌"
    print(f"  {icon} entry_id={r['entry_id']}  {r.get('file', '?')}")
    if r.get("error"):
        print(f"     → {r['error']}")

print(f"\n✅ DONE: {ok_count} 件処理完了")
