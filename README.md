# ym2151-typescript-webaudio

YM2151 (OPM) FM音源エミュレータのTypeScript + WebAudio実装

## Phase 2: Nuked-OPM WebAudio Player

440Hz 3秒の音声をWebAudioで演奏するプログラム実装。

### 特徴

- Nuked-OPMベースの実装
- TypeScript + WebAudio API
- FM音源レジスタwrite後に10msのcycle消費
- ブラウザで直接実行可能

### クイックスタート

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# HTTPサーバー起動
npm run serve

# ブラウザで開く
# http://localhost:8080/dist/phase2/index.html
```

詳細は [src/phase2/README.md](src/phase2/README.md) を参照してください。

## ライセンス

- Nuked-OPM: LGPL-2.1
- その他: MIT