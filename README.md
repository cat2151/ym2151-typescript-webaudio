# ym2151-typescript-webaudio

YM2151 (OPM) FM音源エミュレータのTypeScript + WebAudio実装

## Phase 2: Nuked-OPM WASM + AudioWorklet Player

440Hz 3秒の音声をWebAudioで演奏するプログラム実装。

### 特徴

- **Nuked-OPM WASM実装**: EmscriptenでコンパイルされたNuked-OPMを使用
- **AudioWorklet**: リアルタイムで音声を生成
- **実際のYM2151エミュレーション**: C言語実装のエミュレータによる正確な音源再現
- TypeScript + WebAudio API
- FM音源レジスタwrite後に10msのcycle消費
- ブラウザで直接実行可能

### クイックスタート

```bash
# 依存関係のインストール
npm install

# ビルド（WASM + TypeScript）
npm run build:wasm  # WASMモジュールのビルド（初回のみ）
npm run build       # TypeScriptビルドとファイルコピー

# HTTPサーバー起動
npm run serve

# ブラウザで開く
# http://localhost:8080/phase2/index.html
```

詳細は [src/phase2/README.md](src/phase2/README.md) を参照してください。

## ライセンス

- Nuked-OPM: LGPL-2.1
- その他: MIT