# Phase 2: Nuked-OPM WebAudio Implementation

このディレクトリには、Nuked-OPMを使用した440Hz 3秒の音声演奏プログラムが含まれています。

## 概要

- **周波数**: 440Hz (A4音)
- **演奏時間**: 3秒
- **プラットフォーム**: WebAudio API
- **レジスタ遅延**: FM音源レジスタwrite後に10msのcycle消費

## ファイル構成

- `index.ts` - TypeScript実装のメインファイル
- `index.html` - WebAudioプレーヤーのHTML UI
- `opm.c` / `opm.h` - Nuked-OPMのソースコード（参考用）
- `LICENSE` - Nuked-OPMのライセンス（LGPL-2.1）

## ビルド方法

プロジェクトルートから以下を実行:

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
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
http://localhost:8080/dist/phase2/index.html
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

### WebAudio実装

現在の実装は、YM2151のレジスタ設定をシミュレートし、TypeScriptで直接440Hzのサイン波を生成してWebAudio APIで再生します。Nuked-OPMのC言語コードは参考資料として含まれています。

## 技術スタック

- **TypeScript** - メイン言語
- **WebAudio API** - ブラウザオーディオ再生
- **Nuked-OPM** - YM2151エミュレータ（参考用に同梱）

## 注意事項

この実装は、YM2151/OPMのレジスタ設定とタイミングをシミュレートしたものです。Nuked-OPMのC言語コードは、正確なレジスタ仕様を参照するために含まれています。

将来的にNuked-OPMを直接統合する場合は、EmscriptenでWASMにコンパイルして使用できます:

```bash
npm run build:wasm
```

（注: Emscripten環境のセットアップが必要です）

## ライセンス

- Nuked-OPMコード: LGPL-2.1（LICENSE参照）
- その他のコード: プロジェクトのライセンスに従う
