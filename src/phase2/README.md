# Phase 2: Nuked-OPM WASM + AudioWorklet Implementation

このディレクトリには、Nuked-OPMをWASMにコンパイルし、AudioWorkletで実行する440Hz 3秒の音声演奏プログラムが含まれています。

## 概要

- **周波数**: 440Hz (A4音)
- **演奏時間**: 3秒
- **プラットフォーム**: Emscripten WASM + WebAudio AudioWorklet API
- **レジスタ遅延**: FM音源レジスタwrite後に10msのcycle消費
- **実装**: 実際のNuked-OPM C言語エミュレータをWASMにコンパイルして使用

## ファイル構成

- `index.ts` - TypeScript実装のメインファイル（AudioWorklet制御）
- `index.html` - WebAudioプレーヤーのHTML UI
- `opm-processor.js` - AudioWorkletProcessor実装
- `opm.c` / `opm.h` - Nuked-OPMのソースコード
- `opm.js` / `opm.wasm` - Emscriptenでコンパイルされたモジュール
- `LICENSE` - Nuked-OPMのライセンス（LGPL-2.1）

## ビルド方法

プロジェクトルートから以下を実行:

```bash
# 依存関係のインストール
npm install

# WASMモジュールのビルド（初回のみ、またはopm.cを変更した時）
npm run build:wasm

# TypeScriptのビルドとファイルコピー
npm run build
```

ビルド後、`dist/phase2/`ディレクトリに出力されます。

## 実行方法

1. ビルド後、HTTPサーバーを起動:

```bash
npm run serve
```

2. ブラウザで以下のURLを開く:

```
http://localhost:8080/phase2/index.html
```

3. 「▶ 演奏開始」ボタンをクリックして再生

## 実装詳細

### YM2151レジスタ設定

プログラムは以下の手順でYM2151を初期化します:

1. テストレジスタのリセット
2. チャンネル0の設定（440Hz）
   - RL/FB/CON: 0xC7 (両チャンネル、アルゴリズム7)
   - KC (Key Code): 0x4D
   - KF (Key Fraction): 0x18
3. 4つのオペレータ設定
   - DT1/MUL, TL, KS/AR, AMS/D1R, DT2/D2R, D1L/RR
4. キーオン（全オペレータ）

合計29回のレジスタwriteを行い、各writeで10msの遅延が発生します（総遅延時間: 290ms）。

### WebAudio AudioWorklet実装

この実装は、実際のNuked-OPM YM2151エミュレータをEmscriptenでWASMにコンパイルし、AudioWorkletで実行します。

**実装の流れ:**

1. **WASM モジュールのロード**: AudioWorkletProcessor内でNuked-OPMのWASMモジュールをロード
2. **チップの初期化**: OPM_Reset()でYM2151チップを初期化
3. **レジスタ書き込み**: メインスレッドからOPM_Write()でレジスタに値を書き込み
4. **リアルタイム音声生成**: AudioWorklet内でOPM_Clock()を繰り返し呼び出し、音声サンプルを生成
5. **出力**: 生成されたサンプルをWebAudioの出力バッファに書き込み

**クロックレート:**
- YM2151: 3.579545 MHz
- サンプルレート: 44.1 kHz
- 1サンプルあたり約81クロック実行

## 技術スタック

- **TypeScript** - メイン言語
- **WebAudio AudioWorklet API** - リアルタイムオーディオ処理
- **Emscripten WASM** - C言語エミュレータのコンパイル
- **Nuked-OPM** - YM2151エミュレータ（C言語実装）

## 実装の詳細

### WASMコンパイル

Emscriptenを使用してNuked-OPMをWASMにコンパイル:

```bash
emcc opm.c -o opm.js \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_OPM_Clock","_OPM_Write","_OPM_Read","_OPM_Reset","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createOPMModule' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -O2
```

### AudioWorklet Processor

`opm-processor.js`は、AudioWorkletProcessorとして動作し、以下を実行:

- WASMモジュールの初期化
- メインスレッドからのメッセージ受信（レジスタ書き込み）
- process()メソッド内でOPM_Clock()を呼び出してサンプル生成

## 注意事項

- **Emscripten環境**: WASMのビルドにはEmscriptenが必要です
- **CORS設定**: AudioWorkletはCORS制約があるため、適切なHTTPサーバー設定が必要
- **ブラウザ対応**: AudioWorklet APIをサポートするモダンブラウザが必要

## ライセンス

- Nuked-OPMコード: LGPL-2.1（LICENSE参照）
- その他のコード: プロジェクトのライセンスに従う
