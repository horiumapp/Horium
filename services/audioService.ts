// A zero-dependency audio service using the Web Audio API for UI feedback sounds.

class AudioService {
    private audioContext: AudioContext | null = null;
    private isMuted: boolean = false;

    constructor() {
        try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                const savedMuted = localStorage.getItem('horium_muted');
                this.isMuted = savedMuted === 'true';
            }
        } catch {
            this.isMuted = false;
        }
    }

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        // Browsers might suspend the audio context if there was no prior interaction
        // or during long idle times. We aggressively resume it here.
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(e => console.error("Audio resume failed", e));
        }
        return this.audioContext;
    }

    public setMuted(muted: boolean) {
        this.isMuted = muted;
        try {
            if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
                localStorage.setItem('horium_muted', muted.toString());
            }
        } catch {}
    }

    public getMuted() {
        return this.isMuted;
    }

    // A subtle, modern click sound
    public playClick() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.05);
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    }

    // A positive, ascending "success" sound
    public playSuccess() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();

            // Note 1
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(440, ctx.currentTime); // A4
            gain1.gain.setValueAtTime(0.1, ctx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(ctx.currentTime);
            osc1.stop(ctx.currentTime + 0.1);

            // Note 2
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
            gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(ctx.currentTime + 0.1);
            osc2.stop(ctx.currentTime + 0.3);

        } catch (e) {
            console.error("Audio playback failed", e);
        }
    }

    // A "cash register" or "coin" sound for license approval
    public playChaChing() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.setValueAtTime(2000, ctx.currentTime + 0.05);

            gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    }

    // A subtle "pop" sound for deletion or modal dismiss
    public playPop() {
        if (this.isMuted) return;
        try {
            const ctx = this.getContext();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.08);

            gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    }
}

export const audio = new AudioService();
