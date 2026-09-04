# =========================
# ✅ WM付与（バッチ処理 / pending/*.json を一括処理）
# - processing-meta/pending/*.json を全件（または BATCH_SIZE 件）処理
# - pending-processing/<filename> をDL
# - WM合成して workspace/wm/<filename> に出力
# =========================

# --- 設定 ---
BATCH_SIZE = 0  # 0 = 全件処理、正数 = 最大N件

# --- install ---
# !pip install -q supabase pillow pillow-heif
from pillow_heif import register_heif_opener
register_heif_opener()

import os, json, re
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from supabase import create_client, Client
from google.colab import userdata

# =========================
# 🧩 安全セーブ用ユーティリティ
# =========================
DEFAULT_BG = (255, 255, 255)

def _flatten_for_jpeg(im: Image.Image, bg=DEFAULT_BG) -> Image.Image:
    if im.mode in ("RGBA", "LA"):
        im = im.convert("RGBA")
        bg_img = Image.new("RGB", im.size, bg)
        bg_img.paste(im, mask=im.split()[-1])
        return bg_img
    if im.mode not in ("RGB",):
        return im.convert("RGB")
    return im

def _mode_for_png_webp(im: Image.Image) -> Image.Image:
    if im.mode in ("RGBA", "LA"):
        return im
    if im.mode == "P":
        return im.convert("RGBA") if "transparency" in im.info else im.convert("RGB")
    if im.mode in ("CMYK", "I", "F", "1"):
        return im.convert("RGB")
    return im

def save_image_any(im: Image.Image, out_path: str, *, bg=DEFAULT_BG) -> str:
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    ext = p.suffix.lower()

    supported = {".png", ".webp", ".jpg", ".jpeg"}
    if ext not in supported:
        p = p.with_suffix(".png")
        ext = ".png"

    exif_bytes = None
    try:
        exif = im.getexif()
        exif_bytes = exif.tobytes() if exif and len(exif) else None
    except Exception:
        pass

    try:
        if ext in (".jpg", ".jpeg"):
            im2 = _flatten_for_jpeg(im, bg)
            im2.save(p, "JPEG", quality=92, optimize=True, subsampling=1, exif=exif_bytes or b"")
        elif ext == ".png":
            im2 = _mode_for_png_webp(im)
            kw = {}
            if exif_bytes:
                kw["exif"] = exif_bytes
            im2.save(p, "PNG", **kw)
        elif ext == ".webp":
            im2 = _mode_for_png_webp(im)
            im2.save(p, "WEBP", quality=90, method=6)
        else:
            im2 = _mode_for_png_webp(im)
            p = p.with_suffix(".png")
            im2.save(p, "PNG")
        return str(p)
    except Exception:
        p = p.with_suffix(".png")
        im2 = _mode_for_png_webp(im)
        im2.save(p, "PNG")
        return str(p)

# =========================
# 🔑 Supabase接続
# =========================
SUPABASE_URL = userdata.get("SUPABASE_URL")
SUPABASE_KEY = userdata.get("SUPABASE_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("❌ SUPABASE_URL / SUPABASE_KEY が Colab Secret に入っていません")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
print("✅ Supabase接続成功！")

BUCKET_META = "processing-meta"
BUCKET_ART  = "artworks"

# =========================
# 📁 パス定義
# =========================
base_dir = Path("workspace")
base_watermark_path = base_dir / "watermark" / "base_watermark.png"
font_path           = base_dir / "watermark" / "LilitaOne-Regular.ttf"

input_dir = base_dir / "input"
wm_dir    = base_dir / "watermark"
out_dir   = base_dir / "wm"
meta_dir  = base_dir / "meta"

for d in (input_dir, wm_dir, out_dir, meta_dir):
    d.mkdir(parents=True, exist_ok=True)

if not base_watermark_path.exists():
    raise FileNotFoundError(f"❌ base watermark not found: {base_watermark_path}")
if not font_path.exists():
    raise FileNotFoundError(f"❌ font not found: {font_path}")

# =========================
# 📋 pending/*.json を一覧取得
# =========================
def _num_key(name: str) -> int:
    m = re.search(r"(\d+)\.json$", name)
    return int(m.group(1)) if m else 10**18

pending = supabase.storage.from_(BUCKET_META).list("pending", {"limit": 1000}) or []
json_names = sorted(
    [x.get("name") for x in pending if (x.get("name") or "").endswith(".json")],
    key=_num_key,
)
if not json_names:
    raise RuntimeError("❌ processing-meta/pending/*.json がありません")

targets = json_names[:BATCH_SIZE] if BATCH_SIZE > 0 else json_names
print(f"📦 処理対象: {len(targets)} 件")
for t in targets:
    print(f"   - {t} (entry_id={_num_key(t)})")
print()

# =========================
# 🔄 1件ずつ処理
# =========================
def process_wm(json_name: str) -> dict:
    """1件分のWM処理。成功時は {"status":"ok", ...}、失敗時は例外。"""
    entry_id = _num_key(json_name)
    json_path = f"pending/{json_name}"

    # 1) job status → running（service_role key でないと RLS で弾かれる）
    try:
        supabase.table("entry_processing_jobs").update({
            "status": "running",
            "locked_at": "now()",
            "locked_by": "colab-wm",
        }).eq("entry_id", entry_id).execute()
    except Exception as e:
        print(f"  ⚠️ job status 更新スキップ（RLS制限の可能性）: {e}")

    # 2) メタ取得
    meta_bytes = supabase.storage.from_(BUCKET_META).download(json_path)
    meta = json.loads(meta_bytes)
    (meta_dir / json_name).write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    artist_name   = meta["artistName"]
    file_name     = meta["filename"]
    has_signature = meta.get("hasSignature", False)
    stem = Path(file_name).stem

    # 3) 元画像DL
    orig_bytes = supabase.storage.from_(BUCKET_ART).download(f"pending-processing/{file_name}")
    im_orig = Image.open(BytesIO(orig_bytes))
    input_path = Path(save_image_any(im_orig, str(input_dir / file_name)))

    # 4-5) サイン有無で分岐
    if has_signature:
        base_img = Image.open(input_path).convert("RGBA")
        final_path = Path(save_image_any(base_img, str(out_dir / file_name)))
        wm_applied = False
    else:
        # WM画像生成
        base_img_wm = Image.open(base_watermark_path).convert("RGBA")
        width, height = base_img_wm.size

        font_size = 27
        font = ImageFont.truetype(str(font_path), font_size)
        text = f"created by {artist_name}"

        dummy = Image.new("RGBA", (10, 10))
        draw_dummy = ImageDraw.Draw(dummy)
        bbox = draw_dummy.textbbox((0, 0), text, font=font)
        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]

        x = (width - text_w) // 2
        y = height - text_h - 90

        overlay = Image.new("RGBA", base_img_wm.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        outline_range = 2
        for dx in range(-outline_range, outline_range + 1):
            for dy in range(-outline_range, outline_range + 1):
                draw.text((x + dx, y + dy), text, font=font, fill=(128, 128, 128, int(255 * 0.4)))
        draw.text((x, y), text, font=font, fill=(0, 0, 0, 0))

        wm_composited = Image.alpha_composite(base_img_wm, overlay)
        wm_output_path = Path(save_image_any(wm_composited, str(wm_dir / f"{stem}_wm.png")))

        # 元画像とWM合成
        base_img = Image.open(input_path).convert("RGBA")
        wm_img = Image.open(wm_output_path).convert("RGBA")
        wm_resized = wm_img.resize(
            (int(base_img.width * 0.30), int(base_img.height * 0.40)),
            Image.LANCZOS,
        )
        pos = (base_img.width - wm_resized.width - 10, base_img.height - wm_resized.height - 10)
        base_img.alpha_composite(wm_resized, dest=pos)

        final_path = Path(save_image_any(base_img, str(out_dir / file_name)))
        wm_applied = True

    return {
        "entry_id": entry_id,
        "file": file_name,
        "artist": artist_name,
        "wm_applied": wm_applied,
        "output": str(final_path),
    }


# =========================
# 🚀 バッチ実行
# =========================
results = []
for idx, jname in enumerate(targets, 1):
    entry_id = _num_key(jname)
    print(f"--- [{idx}/{len(targets)}] entry_id={entry_id} ({jname}) ---")
    try:
        info = process_wm(jname)
        results.append({"status": "ok", **info})
        wm_label = "WM付与" if info["wm_applied"] else "サインあり(WMスキップ)"
        print(f"  ✅ {wm_label}: {info['file']}")
    except Exception as e:
        results.append({"status": "error", "entry_id": entry_id, "file": jname, "error": str(e)})
        print(f"  ❌ ERROR: {e}")

# =========================
# 📊 サマリー
# =========================
ok_count = sum(1 for r in results if r["status"] == "ok")
print(f"\n{'='*50}")
print(f"✅ WM処理完了: {ok_count}/{len(results)} 件成功")
for r in results:
    icon = "✅" if r["status"] == "ok" else "❌"
    print(f"  {icon} entry_id={r['entry_id']}  {r.get('file', '?')}")
    if r.get("error"):
        print(f"     → {r['error']}")

if ok_count > 0:
    print(f"\n➡️ 次: workspace/wm/ の {ok_count} 件をDLして Glaze → workspace/glazed/ に戻してください")
