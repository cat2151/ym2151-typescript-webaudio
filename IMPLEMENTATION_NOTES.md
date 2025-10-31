# YM2151 WASM + AudioWorklet Implementation Notes

## Overview

This implementation successfully integrates Nuked-OPM YM2151 emulator compiled to WebAssembly with the WebAudio AudioWorklet API for real-time audio synthesis.

## Architecture

```
┌─────────────────┐
│  Main Thread    │
│   (index.ts)    │
│                 │
│ - Initialize    │
│ - Send Regs     │
└────────┬────────┘
         │ MessagePort
         │
┌────────▼────────┐
│ Audio Worklet   │
│(opm-processor.js)│
│                 │
│ ┌─────────────┐ │
│ │WASM Module  │ │
│ │  (opm.wasm) │ │
│ │             │ │
│ │ Nuked-OPM   │ │
│ │  Emulator   │ │
│ └─────────────┘ │
│                 │
│ - OPM_Clock()   │
│ - OPM_Write()   │
│ - Generate PCM  │
└────────┬────────┘
         │
         ▼
    Audio Output
```

## Key Technical Details

### WASM Compilation

The Nuked-OPM C code is compiled to WebAssembly using Emscripten:

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

### Audio Processing Flow

1. **Initialization**:
   - Main thread creates AudioContext
   - Loads AudioWorklet module (`opm-processor.js`)
   - Creates AudioWorkletNode
   - Worklet loads WASM module and initializes OPM chip

2. **Register Programming**:
   - Main thread sends register writes via MessagePort
   - Each write has a 10ms delay (cycle consumption simulation)
   - Worklet immediately writes to WASM OPM chip

3. **Audio Generation**:
   - AudioWorklet's `process()` method called periodically
   - For each audio sample:
     - Calls `OPM_Clock()` ~81 times (3.579545 MHz / 44.1 kHz)
     - Accumulates output
     - Scales to normalized float [-1.0, 1.0]
   - Writes to output buffer

### Clock Rate Calculation

```javascript
const OPM_CLOCK_HZ = 3579545; // YM2151 clock: 3.579545 MHz
const clocksPerSample = Math.round(OPM_CLOCK_HZ / sampleRate);
// At 44.1 kHz: 3579545 / 44100 ≈ 81 clocks per sample
```

### Memory Management

- WASM module manages chip state in linear memory
- `opm_t` structure allocated: 4096 bytes (conservative)
- Temporary buffers for `OPM_Clock()` output allocated/freed per frame

## Browser Requirements

### Minimum Requirements

- **AudioWorklet API**: Chrome 64+, Firefox 76+, Safari 14.1+, Edge 79+
- **WebAssembly**: All modern browsers (Chrome 57+, Firefox 52+, Safari 11+, Edge 16+)
- **ES6 Modules**: Required for module imports

### CORS Considerations

AudioWorklet requires proper CORS headers:
- Files must be served from HTTP server (not `file://`)
- Use `npm run serve` which starts server with CORS enabled
- For production, ensure server sends appropriate headers

### Cross-Origin Isolation (Optional)

For SharedArrayBuffer support (not currently used):
```
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

## Performance Characteristics

### CPU Usage

- **Per Sample**: ~81 OPM_Clock() calls
- **Per Second**: ~3.58 million clock cycles
- **Typical CPU Load**: <5% on modern hardware

### Latency

- AudioWorklet provides low-latency audio (typically <10ms)
- Additional 290ms startup delay from register programming (10ms × 29 writes)

### Memory Usage

- WASM Module: ~20 KB
- Chip State: ~4 KB
- JavaScript Overhead: <1 MB

## Testing

### Manual Testing Steps

1. Build the project:
   ```bash
   npm install
   npm run build:wasm  # First time only
   npm run build
   ```

2. Start server:
   ```bash
   npm run serve
   ```

3. Open browser:
   ```
   http://localhost:8080/phase2/index.html
   ```

4. Click "▶ 演奏開始" button

5. Expected behavior:
   - Console shows register writes (29 writes)
   - After ~290ms, audio starts playing
   - 440Hz tone plays for 3 seconds
   - Smooth, clean audio output

### Troubleshooting

**No Audio**:
- Check browser console for errors
- Verify AudioWorklet is supported
- Check audio output device
- Ensure user gesture (button click) triggered playback

**Incorrect Frequency**:
- Verify register values in console
- Check sample rate in AudioContext
- Verify clock rate calculation

**Distorted Audio**:
- Check output scaling (should be /32768.0)
- Verify clocksPerSample calculation
- Check for buffer underruns in console

## Known Limitations

1. **Single Voice**: Currently implements only one channel (440Hz tone)
2. **Static Programming**: Register values are hardcoded
3. **No Dynamic Control**: Cannot change parameters during playback
4. **No VGM Playback**: Not integrated with VGM file format

## Future Enhancements

Possible improvements:
- Multiple voice support
- Dynamic register control
- VGM file playback
- Visual feedback (oscilloscope, spectrum analyzer)
- Parameter controls (frequency, envelope, etc.)
- Record/export functionality

## Security

- No user input passed to WASM (only internal register values)
- No external dependencies loaded
- CORS-aware implementation
- No eval() or dynamic code generation
- CodeQL scan: 0 vulnerabilities found

## References

- [Nuked-OPM](https://github.com/nukeykt/Nuked-OPM) - Original YM2151 emulator
- [Emscripten](https://emscripten.org/) - WebAssembly compiler
- [AudioWorklet API](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [YM2151 Technical Manual](http://www.vgmpf.com/Wiki/index.php?title=YM2151)
