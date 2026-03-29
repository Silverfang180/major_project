import React, { useEffect, useRef } from 'react';

export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W: number, H: number, dpr: number;
    let branches: Branch[] = [];
    let nodes: Node[] = [];
    let frameCount = 0;
    let animationFrameId: number;

    const isLight = document.documentElement.classList.contains('light');

    const colors = isLight 
      ? [
          'rgba(56,120,220,A)', // blue
          'rgba(30,150,230,A)', // cyan
          'rgba(70,100,180,A)', // navy
          'rgba(56,120,220,A)',
          'rgba(30,150,230,A)',
        ]
      : [
          'rgba(46,120,228,A)',
          'rgba(56,200,240,A)',
          'rgba(79,163,255,A)',
          'rgba(30, 90,180,A)',
          'rgba(100,180,255,A)',
        ];

    class Node {
      x: number = 0;
      y: number = 0;
      r: number = 0;
      alpha: number = 0;
      pulse: number = 0;
      speed: number = 0;
      color: string = '';

      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * W;
        this.y = Math.random() * H;
        this.r = 0.8 + Math.random() * 1.6;
        this.alpha = 0.08 + Math.random() * 0.18;
        this.pulse = Math.random() * Math.PI * 2;
        this.speed = 0.003 + Math.random() * 0.008;
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }
      draw() {
        if (!ctx) return;
        this.pulse += this.speed;
        const a = this.alpha * (0.6 + 0.4 * Math.sin(this.pulse));
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.color.replace('A', a.toFixed(2));
        ctx.fill();
      }
    }

    class Branch {
      x: number;
      y: number;
      angle: number;
      color: string;
      speed: number;
      life: number;
      maxLife: number;
      width: number;
      trail: { x: number; y: number; a: number }[];
      maxTrail: number;
      turnRate: number;
      spawned: boolean;

      constructor(startX: number, startY: number, angle: number, color: string, speed: number, life: number) {
        this.x = startX;
        this.y = startY;
        this.angle = angle;
        this.color = color;
        this.speed = speed;
        this.life = life;
        this.maxLife = life;
        this.width = Math.random() * 1.2 + 0.4;
        this.trail = [];
        this.maxTrail = 60 + Math.random() * 80;
        this.turnRate = (Math.random() - 0.5) * 0.018;
        this.spawned = false;
      }

      update() {
        this.angle += this.turnRate + Math.sin(Date.now() * 0.0003 + this.x * 0.005) * 0.006;
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;
        this.trail.push({ x: this.x, y: this.y, a: this.life / this.maxLife });
        if (this.trail.length > this.maxTrail) this.trail.shift();

        if (!this.spawned && this.life < this.maxLife * 0.55 && Math.random() < 0.005) {
          this.spawned = true;
          branches.push(new Branch(
            this.x, this.y,
            this.angle + (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 6 + Math.random() * 0.3),
            this.color, this.speed * 0.85,
            this.life * 0.8
          ));
        }
      }

      draw() {
        if (!ctx || this.trail.length < 2) return;
        for (let i = 1; i < this.trail.length; i++) {
          const t0 = this.trail[i - 1];
          const t1 = this.trail[i];
          const prog = i / this.trail.length;
          const alpha = prog * (this.life / this.maxLife) * 0.7;
          ctx.beginPath();
          ctx.moveTo(t0.x, t0.y);
          ctx.lineTo(t1.x, t1.y);
          ctx.strokeStyle = this.color.replace('A', alpha.toFixed(2));
          ctx.lineWidth = this.width * prog;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        const headAlpha = (this.life / this.maxLife) * 0.9;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = this.color.replace('A', headAlpha.toFixed(2));
        ctx.fill();
      }

      isDead() { return this.life <= 0 || this.x < -100 || this.x > W + 100 || this.y < -100 || this.y > H + 100; }
    }

    function resize() {
      dpr = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + 'px';
      canvas!.style.height = H + 'px';
      ctx!.scale(dpr, dpr);
      nodes = Array.from({ length: 55 }, () => new Node());
    }

    function spawnBranch() {
      const side = Math.random();
      let sx, sy, angle;
      if (side < 0.65) {
        sx = -10;
        sy = H * (0.1 + Math.random() * 0.8);
        angle = (Math.random() - 0.3) * 0.5;
      } else if (side < 0.80) {
        sx = W * (0.1 + Math.random() * 0.8);
        sy = H + 10;
        angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      } else {
        sx = W * (0.1 + Math.random() * 0.8);
        sy = -10;
        angle = Math.PI / 2 + (Math.random() - 0.5) * 0.8;
      }
      const color = colors[Math.floor(Math.random() * colors.length)];
      const speed = 1.2 + Math.random() * 1.8;
      const life = 280 + Math.random() * 320;
      branches.push(new Branch(sx, sy, angle, color, speed, life));
    }

    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    function loop() {
      if (isLight) {
        ctx!.fillStyle = 'rgba(248,250,252,0.22)'; // Slate 50 with alpha
      } else {
        ctx!.fillStyle = 'rgba(6,10,18,0.18)';
      }
      ctx!.fillRect(0, 0, W, H);

      nodes.forEach(n => n.draw());
      if (frameCount % 28 === 0 && branches.length < 18) spawnBranch();
      branches = branches.filter(b => !b.isDead());
      branches.forEach(b => { b.update(); b.draw(); });

      const gr = ctx!.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 130);
      if (isLight) {
        gr.addColorStop(0, 'rgba(46,120,228,0.06)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
      } else {
        gr.addColorStop(0, 'rgba(46,120,228,0.04)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
      }
      ctx!.fillStyle = gr;
      ctx!.fillRect(0, 0, W, H);

      frameCount++;
      animationFrameId = requestAnimationFrame(loop);
    }

    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < 6; i++) setTimeout(spawnBranch, i * 400);
    loop();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />
      <div className="fixed inset-0 z-1 pointer-events-none opacity-[0.028] bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E')] bg-[length:180px_180px]" />
      <div className="fixed -left-[12vw] top-[20vh] w-[55vw] h-[70vh] z-1 pointer-events-none opacity-70 animate-[glowPulse_8s_ease-in-out_infinite_alternate] bg-[radial-gradient(ellipse_at_30%_40%,rgba(46,120,228,0.13)_0%,rgba(56,200,240,0.06)_40%,transparent_70%)]" />
      <div className="fixed -right-[8vw] bottom-[5vh] w-[45vw] h-[60vh] z-1 pointer-events-none opacity-70 animate-[glowPulse_10s_ease-in-out_infinite_alternate-reverse] bg-[radial-gradient(ellipse_at_70%_60%,rgba(56,200,240,0.09)_0%,rgba(46,120,228,0.05)_50%,transparent_70%)]" />
      <style>{`
        @keyframes glowPulse {
          from { opacity: 0.7; transform: scale(1); }
          to { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </>
  );
}
