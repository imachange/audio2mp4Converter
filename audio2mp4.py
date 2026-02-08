import subprocess
import time
from pathlib import Path

# ■ 設定エリア --------------------------
# 出力するファイル名
OUTPUT_FILENAME = "movie.mp4"

# 許可する拡張子リスト（これ以外は無視します）
AUDIO_EXTS = {'.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'}
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}
# ---------------------------------------

def main():
    # スクリプトのある場所を基準にする
    base_dir = Path(__file__).resolve().parent
    
    print(f"📂 作業ディレクトリ: {base_dir}")
    print("-" * 40)

    # 1. audio.* を探す
    # base_dir.glob("audio.*") で "audio" から始まる全ファイルを取得し、
    # その中から「許可された音声拡張子」を持つ最初の1つを見つける
    audio_path = next(
        (p for p in base_dir.glob("audio.*") if p.suffix.lower() in AUDIO_EXTS), 
        None
    )

    # 2. cover.* を探す
    # 同様に "cover" から始まる画像ファイルを見つける
    image_path = next(
        (p for p in base_dir.glob("cover.*") if p.suffix.lower() in IMAGE_EXTS), 
        None
    )

    # 3. ファイル存在チェック
    missing = []
    if not audio_path:
        missing.append(f"音声ファイル (audio.mp3, audio.wav 等)")
    if not image_path:
        missing.append(f"画像ファイル (cover.jpg, cover.png 等)")

    if missing:
        print("❌ 必要なファイルが見つかりません:")
        for m in missing:
            print(f"   - {m}")
        input("\nエンターキーを押して終了...")
        return

    # 出力パス
    output_path = base_dir / OUTPUT_FILENAME

    print(f"🎵 発見: {audio_path.name}")
    print(f"🖼️  発見: {image_path.name}")
    print(f"🎥 作成: {OUTPUT_FILENAME}")
    print("-" * 40)

    # 4. FFmpegコマンド構築
    cmd = [
        "ffmpeg",
        "-y",                     # 上書き許可
        "-loop", "1",             # 画像ループ
        "-i", str(image_path),    # 自動検出した画像
        "-i", str(audio_path),    # 自動検出した音声
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2", # 奇数サイズ対策
        "-shortest",              # 音声が終わったら終了
        str(output_path)
    ]

    try:
        # 実行
        subprocess.run(cmd, check=True)
        print("\n" + "=" * 40)
        print(f"✅ 変換成功！: {output_path.name}")
        print("=" * 40)
    except subprocess.CalledProcessError:
        print("\n❌ FFmpegのエラーが発生しました。")
    except Exception as e:
        print(f"\n❌ 予期せぬエラー: {e}")

    # ウィンドウをすぐに閉じないための待機
    input("\nエンターキーを押して終了...")

if __name__ == "__main__":
    main()