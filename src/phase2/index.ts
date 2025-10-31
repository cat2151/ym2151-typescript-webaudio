/**
 * YM2151 (OPM) WebAudio Player with WASM and AudioWorklet
 * Uses Nuked-OPM WASM module with AudioWorklet for real-time synthesis
 * 
 * This implementation uses actual YM2151 emulation via WASM
 * with register writes processed in real-time.
 */

// YM2151 clock frequency
const OPM_CLOCK = 3579545; // 3.579545 MHz
const SAMPLE_RATE = 44100; // 44.1kHz

// YM2151 Register addresses
const REG_TEST = 0x01;
const REG_KON = 0x08;
const REG_NOISE = 0x0F;
const REG_CLKA1 = 0x10;
const REG_CLKA2 = 0x11;
const REG_CLKB = 0x12;
const REG_TIMER = 0x14;
const REG_LFRQ = 0x18;
const REG_PMD_AMD = 0x19;
const REG_CT_W = 0x1B;

// Channel registers (CH0 = 0x20-0x27)
const REG_RL_FB_CON = 0x20; // RL, FB, CON
const REG_KC = 0x28;        // Key Code
const REG_KF = 0x30;        // Key Fraction

// Operator registers (M1, M2, C1, C2)
const REG_DT1_MUL = 0x40;   // DT1, MUL
const REG_TL = 0x60;        // Total Level
const REG_KS_AR = 0x80;     // Key Scale, Attack Rate
const REG_AMS_EN_D1R = 0xA0; // AMS Enable, Decay 1 Rate
const REG_DT2_D2R = 0xC0;   // DT2, Decay 2 Rate
const REG_D1L_RR = 0xE0;    // Decay 1 Level, Release Rate

interface OPMRegisterWrite {
    address: number;
    data: number;
    delay: number; // ms
}

class OPMPlayer {
    private audioContext: AudioContext | null = null;
    private workletNode: AudioWorkletNode | null = null;
    private registerWrites: OPMRegisterWrite[] = [];
    private workletReady: boolean = false;
    
    constructor() {
        this.setupRegisters();
    }
    
    /**
     * Setup YM2151 registers to generate 440Hz tone
     */
    private setupRegisters(): void {
        // Reset test register
        this.addRegisterWrite(REG_TEST, 0x00);
        
        // Setup channel 0 for 440Hz
        // Key Code and Key Fraction for 440Hz
        // KC = 0x4C (middle C area), KF adjusted for 440Hz
        const channel = 0;
        
        // RL=3 (both L/R), FB=0, CON=7 (direct algorithm)
        this.addRegisterWrite(REG_RL_FB_CON + channel, 0xC7);
        
        // Key Code for ~440Hz
        // YM2151 uses: F = (Clock / 64) * KC * 2^(KF/64) / 2
        // For 440Hz: KC=0x4D, KF=0x18 (approximate)
        this.addRegisterWrite(REG_KC + channel, 0x4D);
        this.addRegisterWrite(REG_KF + channel, 0x18);
        
        // Setup all 4 operators (M1=0, M2=8, C1=16, C2=24)
        for (let op = 0; op < 4; op++) {
            const opOffset = op * 8 + channel;
            
            // DT1=0, MUL=1 (1x frequency)
            this.addRegisterWrite(REG_DT1_MUL + opOffset, 0x01);
            
            // TL=0 (maximum volume for carrier, muted for modulators in alg 7)
            const tl = (op === 3) ? 0x00 : 0x7F; // Only C2 is audible in algorithm 7
            this.addRegisterWrite(REG_TL + opOffset, tl);
            
            // KS=0, AR=31 (fast attack)
            this.addRegisterWrite(REG_KS_AR + opOffset, 0x1F);
            
            // AMS=0, D1R=0 (no decay)
            this.addRegisterWrite(REG_AMS_EN_D1R + opOffset, 0x00);
            
            // DT2=0, D2R=0
            this.addRegisterWrite(REG_DT2_D2R + opOffset, 0x00);
            
            // D1L=0, RR=15 (fast release)
            this.addRegisterWrite(REG_D1L_RR + opOffset, 0x0F);
        }
        
        // Key ON for channel 0, all operators
        this.addRegisterWrite(REG_KON, 0x78 | channel); // 0x78 = all 4 operators on
    }
    
    /**
     * Add a register write with 10ms delay
     */
    private addRegisterWrite(address: number, data: number): void {
        this.registerWrites.push({
            address,
            data,
            delay: 10 // 10ms cycle consumption per register write
        });
    }
    
    /**
     * Write a register to the OPM worklet
     */
    private writeRegister(port: number, value: number): void {
        if (!this.workletNode) {
            throw new Error('Worklet not initialized');
        }
        this.workletNode.port.postMessage({
            type: 'write',
            port: port,
            value: value
        });
    }
    
    /**
     * Initialize AudioWorklet
     */
    private async initWorklet(): Promise<void> {
        if (!this.audioContext) {
            throw new Error('AudioContext not initialized');
        }
        
        console.log('Loading AudioWorklet module...');
        
        // Register the AudioWorklet processor
        await this.audioContext.audioWorklet.addModule('./opm-processor.js');
        
        console.log('Creating AudioWorklet node...');
        
        // Create the worklet node
        this.workletNode = new AudioWorkletNode(this.audioContext, 'opm-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [2] // Stereo output
        });
        
        // Wait for worklet to be initialized
        await new Promise<void>((resolve) => {
            this.workletNode!.port.onmessage = (event) => {
                if (event.data.type === 'initialized') {
                    console.log('AudioWorklet initialized successfully');
                    this.workletReady = true;
                    resolve();
                } else if (event.data.type === 'error') {
                    console.error('AudioWorklet error:', event.data.error);
                }
            };
        });
        
        // Connect to audio output
        this.workletNode.connect(this.audioContext.destination);
    }
    
    /**
     * Play 440Hz tone for 3 seconds with register write delays
     */
    async play(): Promise<void> {
        // Initialize AudioContext
        this.audioContext = new AudioContext();
        
        console.log('Starting OPM WASM AudioWorklet playback...');
        console.log(`Sample Rate: ${this.audioContext.sampleRate}Hz`);
        console.log(`Total register writes: ${this.registerWrites.length}`);
        
        // Initialize the AudioWorklet
        await this.initWorklet();
        
        // Calculate total delay from register writes
        const totalDelay = this.registerWrites.reduce((sum, write) => sum + write.delay, 0);
        console.log(`Total register write delay: ${totalDelay}ms`);
        
        // Send register writes to the worklet with delays
        console.log('Writing registers to WASM OPM...');
        for (let i = 0; i < this.registerWrites.length; i++) {
            const write = this.registerWrites[i];
            console.log(`Write ${i + 1}/${this.registerWrites.length}: Reg 0x${write.address.toString(16).padStart(2, '0')} = 0x${write.data.toString(16).padStart(2, '0')}`);
            
            // Write to the worklet
            this.writeRegister(write.address, write.data);
            
            // Wait 10ms per register write (cycle consumption)
            await this.delay(write.delay);
        }
        
        console.log('Register writes complete. Audio is now playing from WASM OPM...');
        
        // Play for 3 seconds
        const duration = 3.0; // seconds
        console.log(`Playing 440Hz tone for ${duration} seconds...`);
        
        // Wait for playback to complete
        await this.delay(duration * 1000);
        
        console.log('Playback complete.');
        
        // Clean up
        if (this.workletNode) {
            this.workletNode.disconnect();
            this.workletNode = null;
        }
        await this.audioContext.close();
        this.audioContext = null;
    }
    
    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    (window as any).OPMPlayer = OPMPlayer;
}

export { OPMPlayer };
