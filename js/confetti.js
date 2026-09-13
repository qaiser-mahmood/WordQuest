/* WordQuest Confetti Celebration Particle System */
let confettiParticles = [];
let confettiAnimationId = null;

export function startConfetti(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth : window.innerWidth;
    canvas.height = canvas.parentElement ? canvas.parentElement.clientHeight : window.innerHeight;

    confettiParticles = [];
    const colors = ['#f43f5e', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#fbbf24'];

    for (let i = 0; i < 90; i++) {
        confettiParticles.push({
            x: Math.random() * canvas.width,
            y: -20 - Math.random() * 50,
            w: 8 + Math.random() * 8,
            h: 8 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: 2.2 + Math.random() * 3.8,
            speedX: -2 + Math.random() * 4,
            angle: Math.random() * 360,
            spin: -4 + Math.random() * 8
        });
    }

    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);

    function update() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = 0;

        confettiParticles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.angle += p.spin;

            if (p.y < canvas.height + 20) active++;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.angle * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        });

        if (active > 0) {
            confettiAnimationId = requestAnimationFrame(update);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    update();
}

export function clearConfetti(canvas) {
    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    confettiParticles = [];
}
