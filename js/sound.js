/* WordQuest Web Audio Synthesizer */
export class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99];
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playLetterSelect(index) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const freq = this.scale[index % this.scale.length];
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.16);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.16);
    }

    playWordCorrect() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.07));

            gain.gain.setValueAtTime(0.15, this.ctx.currentTime + (idx * 0.07));
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (idx * 0.07) + 0.32);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + (idx * 0.07));
            osc.stop(this.ctx.currentTime + (idx * 0.07) + 0.32);
        });
    }

    playBonusWord() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.05));

            gain.gain.setValueAtTime(0.12, this.ctx.currentTime + (idx * 0.05));
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (idx * 0.05) + 0.28);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + (idx * 0.05));
            osc.stop(this.ctx.currentTime + (idx * 0.05) + 0.28);
        });
    }

    playWordWrong() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(90, this.ctx.currentTime + 0.22);

        gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.22);
    }

    playHint() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [392.00, 523.25, 659.25];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime + (idx * 0.06));

            gain.gain.setValueAtTime(0.12, this.ctx.currentTime + (idx * 0.06));
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (idx * 0.06) + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + (idx * 0.06));
            osc.stop(this.ctx.currentTime + (idx * 0.06) + 0.25);
        });
    }

    playLevelWinFanfare() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const notes = [
            { f: 523.25, d: 0.12 },
            { f: 659.25, d: 0.12 },
            { f: 783.99, d: 0.12 },
            { f: 1046.50, d: 0.38 }
        ];

        let offset = 0;
        notes.forEach((n) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.f, this.ctx.currentTime + offset);

            gain.gain.setValueAtTime(0.18, this.ctx.currentTime + offset);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + offset + n.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(this.ctx.currentTime + offset);
            osc.stop(this.ctx.currentTime + offset + n.d);

            offset += 0.09;
        });
    }
}
