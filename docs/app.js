/**
 * app.js
 * 音声+静止画 → MP4変換ツール アプリケーションロジック
 *
 * 機能:
 *  - 静止画を OPFS (Origin Private File System) に保存・読み込み・削除
 *  - ffmpeg.wasm を使用して音声+静止画 → MP4 を生成
 *  - 生成した MP4 をブラウザからダウンロード
 */

// -----------------------------------------------------------------------
// ffmpeg.wasm のインポート（CDN）
// -----------------------------------------------------------------------
import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

// -----------------------------------------------------------------------
// DOM 要素の取得
// -----------------------------------------------------------------------
const imageInput      = document.getElementById('image-input');
const imagePreview    = document.getElementById('image-preview');
const imageStatus     = document.getElementById('image-status');
const deleteImageBtn  = document.getElementById('delete-image-btn');
const audioInput      = document.getElementById('audio-input');
const audioFilename   = document.getElementById('audio-filename');
const convertBtn      = document.getElementById('convert-btn');
const convertError    = document.getElementById('convert-error');
const progressBar     = document.getElementById('progress-bar');
const progressText    = document.getElementById('progress-text');
const logArea         = document.getElementById('log-area');
const downloadSection = document.getElementById('download-section');
const downloadLink    = document.getElementById('download-link');

// -----------------------------------------------------------------------
// OPFS (Origin Private File System) ユーティリティ
// -----------------------------------------------------------------------

/** OPFS に保存する静止画のファイル名 */
const OPFS_IMAGE_NAME = 'background-image';

/**
 * OPFS から静止画を読み込む。
 * @returns {Promise<File|null>} ファイルオブジェクト。存在しない場合は null。
 */
async function loadImageFromOPFS() {
  try {
    const root = await navigator.storage.getDirectory();
    const fileHandle = await root.getFileHandle(OPFS_IMAGE_NAME);
    return await fileHandle.getFile();
  } catch {
    // ファイルが存在しない場合は null を返す
    return null;
  }
}

/**
 * 指定した Blob を OPFS に静止画として保存する。
 * @param {Blob} blob 保存する画像 Blob
 */
async function saveImageToOPFS(blob) {
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(OPFS_IMAGE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

/**
 * OPFS から静止画を削除する。
 */
async function deleteImageFromOPFS() {
  const root = await navigator.storage.getDirectory();
  await root.removeEntry(OPFS_IMAGE_NAME);
}

// -----------------------------------------------------------------------
// UI ヘルパー
// -----------------------------------------------------------------------

/**
 * ログエリアにメッセージを追記する。
 * @param {string} message 表示するメッセージ
 */
function appendLog(message) {
  logArea.textContent += message + '\n';
  // 常に最下行へスクロール
  logArea.scrollTop = logArea.scrollHeight;
}

/**
 * 進捗バーとテキストを更新する。
 * @param {number} ratio 進捗割合 (0.0 〜 1.0)
 */
function updateProgress(ratio) {
  const pct = Math.round(ratio * 100);
  progressBar.value = pct;
  progressText.textContent = `${pct}%`;
}

/**
 * 画像プレビューと UI 状態を「保存済み」に更新する。
 * @param {string} objectURL 表示する画像の Object URL
 */
function setImageSaved(objectURL) {
  imagePreview.src = objectURL;
  imagePreview.style.display = 'block';
  imageStatus.textContent = '✅ 画像保存済み';
  imageStatus.className = 'status-saved';
  deleteImageBtn.style.display = 'inline-block';
  updateConvertButton();
}

/**
 * 画像プレビューと UI 状態を「未保存」にリセットする。
 */
function setImageUnsaved() {
  // 古い Object URL を解放
  if (imagePreview.src && imagePreview.src.startsWith('blob:')) {
    URL.revokeObjectURL(imagePreview.src);
  }
  imagePreview.src = '';
  imagePreview.style.display = 'none';
  imageStatus.textContent = '📂 画像未保存';
  imageStatus.className = 'status-unsaved';
  deleteImageBtn.style.display = 'none';
  updateConvertButton();
}

/**
 * 「動画を生成」ボタンの有効/無効を更新する。
 * 静止画が保存済みの場合のみ有効にする。
 */
function updateConvertButton() {
  const hasImage = imageStatus.className === 'status-saved';
  convertBtn.disabled = !hasImage;
}

// -----------------------------------------------------------------------
// 初期化処理：ページ読み込み時に OPFS から静止画を復元する
// -----------------------------------------------------------------------
async function init() {
  // OPFS 非対応ブラウザへの警告
  if (!navigator.storage || !navigator.storage.getDirectory) {
    appendLog('⚠️ このブラウザは OPFS (Origin Private File System) に対応していません。');
    appendLog('   Chrome/Edge 86+, Firefox 111+, Safari 15.2+ をご利用ください。');
    return;
  }

  appendLog('🚀 アプリを初期化中...');

  const savedFile = await loadImageFromOPFS();
  if (savedFile) {
    const url = URL.createObjectURL(savedFile);
    setImageSaved(url);
    appendLog('📂 保存済みの静止画を読み込みました。');
  } else {
    appendLog('📂 保存済みの静止画はありません。');
  }
}

// -----------------------------------------------------------------------
// イベントリスナー
// -----------------------------------------------------------------------

// ① 静止画の選択・保存
imageInput.addEventListener('change', async () => {
  const file = imageInput.files[0];
  if (!file) return;

  try {
    appendLog(`🖼️ 静止画を保存中: ${file.name}`);
    await saveImageToOPFS(file);
    const url = URL.createObjectURL(file);
    setImageSaved(url);
    appendLog('✅ 静止画を保存しました。');
  } catch (err) {
    appendLog(`❌ 静止画の保存に失敗しました: ${err.message}`);
  }
});

// ① 静止画の削除
deleteImageBtn.addEventListener('click', async () => {
  try {
    await deleteImageFromOPFS();
    setImageUnsaved();
    // ファイル input をリセット
    imageInput.value = '';
    appendLog('🗑️ 静止画を削除しました。');
  } catch (err) {
    appendLog(`❌ 静止画の削除に失敗しました: ${err.message}`);
  }
});

// ② 音声ファイルの選択
audioInput.addEventListener('change', () => {
  const file = audioInput.files[0];
  if (file) {
    audioFilename.textContent = `🎵 選択中: ${file.name}`;
  } else {
    audioFilename.textContent = 'ファイル未選択';
  }
  convertError.textContent = '';
});

// ② 動画を生成
convertBtn.addEventListener('click', async () => {
  convertError.textContent = '';
  downloadSection.style.display = 'none';

  // バリデーション：静止画の確認
  const savedImage = await loadImageFromOPFS();
  if (!savedImage) {
    convertError.textContent = '⚠️ 静止画が保存されていません。先に静止画を選択してください。';
    return;
  }

  // バリデーション：音声ファイルの確認
  const audioFile = audioInput.files[0];
  if (!audioFile) {
    convertError.textContent = '⚠️ 音声ファイルを選択してください。';
    return;
  }

  // ボタンを無効化して二重実行を防止
  convertBtn.disabled = true;
  logArea.textContent = '';
  updateProgress(0);

  try {
    appendLog('⏳ ffmpeg.wasm を読み込み中...');
    await runFFmpeg(savedImage, audioFile);
  } catch (err) {
    appendLog(`❌ エラーが発生しました: ${err.message}`);
    convertError.textContent = `❌ 変換に失敗しました: ${err.message}`;
  } finally {
    convertBtn.disabled = false;
  }
});

// -----------------------------------------------------------------------
// ffmpeg.wasm を使った変換処理
// -----------------------------------------------------------------------

/** マイクロ秒から秒への変換係数 */
const MICROSECONDS_TO_SECONDS = 1_000_000;

/** タイムスタンプ文字列の長さ（'YYYY-MM-DDTHH-MM-SS' = 19文字） */
const TIMESTAMP_LENGTH = 19;
let ffmpeg = null;

/**
 * ffmpeg.wasm インスタンスを取得する（遅延ロード）。
 * @returns {Promise<FFmpeg>}
 */
async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();

  // ログコールバック
  ffmpeg.on('log', ({ message }) => {
    appendLog(message);
  });

  // 進捗コールバック
  ffmpeg.on('progress', ({ progress, time }) => {
    updateProgress(Math.min(progress, 1));
    if (time !== undefined) {
      appendLog(`⏱️ 処理時間: ${(time / MICROSECONDS_TO_SECONDS).toFixed(1)}秒`);
    }
  });

  // ffmpeg.wasm コアをローカルベンダーファイルから読み込む（同一オリジン）
  appendLog('📦 ffmpeg コアを読み込み中...');
  await ffmpeg.load({
    coreURL:   await toBlobURL('./vendor/ffmpeg-core.js',   'text/javascript'),
    wasmURL:   await toBlobURL('./vendor/ffmpeg-core.wasm', 'application/wasm'),
    workerURL: await toBlobURL('./vendor/worker.js',        'text/javascript'),
  });
  appendLog('✅ ffmpeg の読み込み完了。');

  return ffmpeg;
}

/**
 * ffmpeg.wasm で静止画 + 音声 → MP4 を生成してダウンロードリンクを設定する。
 * @param {File} imageFile  OPFS から取得した静止画ファイル
 * @param {File} audioFile  ユーザーが選択した音声ファイル
 */
async function runFFmpeg(imageFile, audioFile) {
  const ff = await getFFmpeg();

  // 入力ファイルの拡張子を保持（ffmpeg がコーデックを正しく判定できるよう）
  const imageExt = imageFile.name.split('.').pop() || 'jpg';
  const audioExt = audioFile.name.split('.').pop() || 'mp3';
  const inputImage = `input.${imageExt}`;
  const inputAudio = `input.${audioExt}`;
  const outputFile = 'output.mp4';

  appendLog(`🖼️ 静止画を書き込み中: ${inputImage}`);
  ff.writeFile(inputImage, await fetchFile(imageFile));

  appendLog(`🎵 音声ファイルを書き込み中: ${inputAudio}`);
  ff.writeFile(inputAudio, await fetchFile(audioFile));

  appendLog('🎥 変換処理を開始...');
  appendLog(`コマンド: ffmpeg -loop 1 -i ${inputImage} -i ${inputAudio} -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest ${outputFile}`);

  await ff.exec([
    '-loop', '1',
    '-i', inputImage,
    '-i', inputAudio,
    '-c:v', 'libx264',
    '-tune', 'stillimage',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-pix_fmt', 'yuv420p',
    '-shortest',
    outputFile,
  ]);

  appendLog('📤 出力ファイルを読み込み中...');
  const data = await ff.readFile(outputFile);

  // Uint8Array → Blob → Object URL
  const blob = new Blob([data.buffer], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);

  // タイムスタンプ付きファイル名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, TIMESTAMP_LENGTH);
  const filename = `audio-video-${timestamp}.mp4`;

  downloadLink.href = url;
  downloadLink.download = filename;
  downloadSection.style.display = 'block';

  updateProgress(1);
  appendLog(`✅ 変換完了！ "${filename}" をダウンロードできます。`);

  // 一時ファイルをメモリから解放
  try {
    await ff.deleteFile(inputImage);
    await ff.deleteFile(inputAudio);
    await ff.deleteFile(outputFile);
  } catch {
    // 解放失敗は無視
  }
}

// -----------------------------------------------------------------------
// アプリ起動
// -----------------------------------------------------------------------
init().catch((err) => {
  appendLog(`❌ 初期化エラー: ${err.message}`);
});
