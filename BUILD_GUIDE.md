# Build Guide - YM2151 WASM + AudioWorklet

This guide explains how to build and run the YM2151 WASM AudioWorklet implementation.

## Prerequisites

### System Requirements

- Node.js 14+ and npm
- Emscripten SDK (for WASM compilation)
- Modern web browser with AudioWorklet support

### Installing Emscripten

#### On Ubuntu/Debian:
```bash
sudo apt-get install emscripten
```

#### Using emsdk (All platforms):
```bash
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh
```

## Build Process

### Build Flow Diagram

```
┌──────────────┐
│   opm.c      │  Nuked-OPM C source
│   opm.h      │
└──────┬───────┘
       │
       │ emcc (Emscripten)
       ▼
┌──────────────┐
│   opm.wasm   │  WebAssembly binary
│   opm.js     │  JS loader
└──────┬───────┘
       │
       │ npm run build:copy
       ▼
┌──────────────┐
│  dist/       │
│  phase2/     │
│  ├─ opm.wasm │
│  └─ opm.js   │
└──────────────┘

┌──────────────┐
│  index.ts    │  TypeScript source
└──────┬───────┘
       │
       │ tsc (TypeScript compiler)
       ▼
┌──────────────┐
│  index.js    │  JavaScript output
└──────┬───────┘
       │
       │ npm run build:copy
       ▼
┌──────────────┐
│  dist/       │
│  phase2/     │
│  └─ index.js │
└──────────────┘

┌──────────────┐
│ Static Files │
│ ├─ index.html│
│ └─ opm-      │
│    processor │
│    .js       │
└──────┬───────┘
       │
       │ npm run build:copy
       ▼
┌──────────────┐
│  dist/       │
│  phase2/     │  Ready to serve!
│  ├─ index.html
│  ├─ index.js │
│  ├─ opm.wasm │
│  ├─ opm.js   │
│  └─ opm-     │
│     processor│
│     .js      │
└──────────────┘
```

## Step-by-Step Build Instructions

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/cat2151/ym2151-typescript-webaudio.git
cd ym2151-typescript-webaudio
npm install
```

### 2. Compile WASM (First Time or After Modifying C Code)

```bash
npm run build:wasm
```

This command:
- Compiles `src/phase2/opm.c` to WebAssembly
- Generates `src/phase2/opm.wasm` and `src/phase2/opm.js`
- Exports required functions: `OPM_Clock`, `OPM_Write`, `OPM_Read`, `OPM_Reset`

**Note**: Only needed once or when C source is modified.

### 3. Build TypeScript and Deploy

```bash
npm run build
```

This command:
- Compiles TypeScript (`index.ts` → `index.js`)
- Copies all necessary files to `dist/phase2/`:
  - `index.html`
  - `index.js`
  - `opm.wasm`
  - `opm.js`
  - `opm-processor.js`

### 4. Start Development Server

```bash
npm run serve
```

This starts an HTTP server at `http://localhost:8080` with:
- CORS enabled
- Cache disabled (`-c-1` flag)

### 5. Open in Browser

Navigate to: `http://localhost:8080/phase2/index.html`

## Individual Build Commands

For more granular control:

### Compile WASM Only
```bash
npm run build:wasm
```

### Compile TypeScript Only
```bash
npm run build:ts
```

### Copy Files to dist
```bash
npm run build:copy
```

### Complete Build (TypeScript + Copy)
```bash
npm run build
```

## Build Outputs

### Source Files (`src/phase2/`)
```
src/phase2/
├── opm.c              # C source (input)
├── opm.h              # C header (input)
├── opm.wasm           # Compiled WASM (output)
├── opm.js             # WASM loader (output)
├── opm-processor.js   # AudioWorklet processor
├── index.ts           # TypeScript source (input)
├── index.html         # HTML UI
└── README.md          # Documentation
```

### Distribution Files (`dist/phase2/`)
```
dist/phase2/
├── index.html         # HTML UI
├── index.js           # Compiled TypeScript
├── opm.wasm           # WASM binary
├── opm.js             # WASM loader
└── opm-processor.js   # AudioWorklet processor
```

## Emscripten Compilation Details

### Full Command
```bash
emcc src/phase2/opm.c -o src/phase2/opm.js \
  -s WASM=1 \
  -s EXPORTED_FUNCTIONS='["_OPM_Clock","_OPM_Write","_OPM_Read","_OPM_Reset","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue"]' \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createOPMModule' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -O2
```

### Flags Explained

- `-s WASM=1`: Output WebAssembly
- `-s EXPORTED_FUNCTIONS=...`: Functions accessible from JS
- `-s EXPORTED_RUNTIME_METHODS=...`: Emscripten runtime methods
- `-s MODULARIZE=1`: Create ES6 module
- `-s EXPORT_NAME='createOPMModule'`: Module factory function name
- `-s ALLOW_MEMORY_GROWTH=1`: Allow dynamic memory allocation
- `-O2`: Optimization level 2

## Troubleshooting

### Emscripten Not Found
```
Error: emcc: command not found
```
**Solution**: Install Emscripten (see Prerequisites section)

### TypeScript Compilation Errors
```
Error: Cannot find module 'typescript'
```
**Solution**: Run `npm install`

### Files Not Copied to dist
```
Error: ENOENT: no such file or directory
```
**Solution**: Ensure `build:wasm` was run first to generate WASM files

### Server Won't Start
```
Error: listen EADDRINUSE :::8080
```
**Solution**: Port 8080 is in use. Kill the process or use a different port:
```bash
npx http-server -p 8081 -c-1 --cors dist
```

### Browser Can't Load AudioWorklet
```
Error: Failed to load AudioWorklet module
```
**Solution**: 
- Ensure files are served via HTTP (not `file://`)
- Check browser console for CORS errors
- Verify `opm-processor.js` is in `dist/phase2/`

## Clean Build

To start fresh:

```bash
# Remove build outputs
rm -rf dist/
rm -f src/phase2/opm.wasm src/phase2/opm.js

# Rebuild everything
npm run build:wasm
npm run build
```

## Production Build

For production deployment:

1. Build with optimizations:
   ```bash
   npm run build:wasm  # Already uses -O2
   npm run build
   ```

2. Deploy `dist/phase2/` directory to web server

3. Ensure server sends correct MIME types:
   - `.wasm` → `application/wasm`
   - `.js` → `application/javascript`
   - `.html` → `text/html`

4. Enable compression (gzip/brotli) for smaller downloads

5. Set appropriate Cache-Control headers for static assets

## Development Tips

### Watch Mode (TypeScript)
For automatic recompilation on changes:
```bash
npx tsc --watch
```

### Live Reload
Use a live-reload server for development:
```bash
npx live-server dist --port=8080 --no-browser
```

### Debug Build
For easier debugging, compile WASM without optimization:
```bash
cd src/phase2
emcc opm.c -o opm.js -s WASM=1 ... -O0 -g
```

## Next Steps

After successful build:
1. Open `http://localhost:8080/phase2/index.html`
2. Click "▶ 演奏開始" button
3. Observe console logs showing register writes
4. Listen to 440Hz tone for 3 seconds

See [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) for architecture details and testing guidance.
