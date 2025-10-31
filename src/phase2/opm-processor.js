/**
 * OPM AudioWorklet Processor
 * This processor uses the WASM-compiled Nuked-OPM to generate audio in real-time
 */

// Import the OPM WASM module loader
// Note: In AudioWorklet context, we need to use importScripts
importScripts('./opm.js');

class OPMProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        
        this.module = null;
        this.chipPtr = null;
        this.outputBuffer = null;
        this.initialized = false;
        this.clocksPerSample = 81; // 3579545 Hz / 44100 Hz ≈ 81.175
        
        // Initialize the WASM module
        this.initModule();
        
        // Listen for messages from the main thread
        this.port.onmessage = (event) => {
            this.handleMessage(event.data);
        };
    }
    
    async initModule() {
        try {
            // Create the WASM module
            this.module = await createOPMModule();
            
            // Allocate memory for the chip state
            const chipSize = 4096; // Enough space for opm_t structure
            this.chipPtr = this.module._malloc(chipSize);
            
            // Initialize the chip
            this.module._OPM_Reset(this.chipPtr);
            
            this.initialized = true;
            this.port.postMessage({ type: 'initialized' });
        } catch (error) {
            console.error('Failed to initialize OPM module:', error);
            this.port.postMessage({ type: 'error', error: error.message });
        }
    }
    
    handleMessage(data) {
        if (!this.initialized) {
            return;
        }
        
        switch (data.type) {
            case 'write':
                // Write to OPM register
                this.module._OPM_Write(this.chipPtr, data.port, data.value);
                break;
                
            case 'read':
                // Read from OPM register
                const value = this.module._OPM_Read(this.chipPtr, data.port);
                this.port.postMessage({ type: 'read-response', value });
                break;
                
            case 'reset':
                // Reset the chip
                this.module._OPM_Reset(this.chipPtr);
                break;
        }
    }
    
    process(inputs, outputs, parameters) {
        if (!this.initialized || !this.module) {
            // Fill with silence if not initialized
            const output = outputs[0];
            for (let channel = 0; channel < output.length; channel++) {
                output[channel].fill(0);
            }
            return true;
        }
        
        const output = outputs[0];
        const numSamples = output[0].length;
        
        // Allocate buffers for OPM output (int32_t[2])
        const outputPtr = this.module._malloc(8); // 2 * 4 bytes
        const sh1Ptr = this.module._malloc(1);
        const sh2Ptr = this.module._malloc(1);
        const soPtr = this.module._malloc(1);
        
        try {
            // Generate samples
            for (let i = 0; i < numSamples; i++) {
                // Accumulate multiple clock cycles to generate one sample
                let accumLeft = 0;
                let accumRight = 0;
                
                for (let j = 0; j < this.clocksPerSample; j++) {
                    // Call OPM_Clock
                    this.module._OPM_Clock(this.chipPtr, outputPtr, sh1Ptr, sh2Ptr, soPtr);
                    
                    // Read the output values (int32_t)
                    accumLeft += this.module.getValue(outputPtr, 'i32');
                    accumRight += this.module.getValue(outputPtr + 4, 'i32');
                }
                
                // Average and convert to float [-1.0, 1.0]
                const left = (accumLeft / this.clocksPerSample) / 32768.0;
                const right = (accumRight / this.clocksPerSample) / 32768.0;
                
                // Write to output channels
                if (output.length > 0) output[0][i] = left;
                if (output.length > 1) output[1][i] = right;
            }
        } finally {
            // Free temporary buffers
            this.module._free(outputPtr);
            this.module._free(sh1Ptr);
            this.module._free(sh2Ptr);
            this.module._free(soPtr);
        }
        
        return true;
    }
}

registerProcessor('opm-processor', OPMProcessor);
