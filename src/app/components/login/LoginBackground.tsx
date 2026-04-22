import { useEffect, useRef } from 'react';

export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w: number, h: number;
    let t = 0;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let sx = mx;
    let sy = my;
    let animationId: number;

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      mx = w / 2;
      my = h / 2;
      sx = mx;
      sy = my;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    resize();

    const waves = Array.from({ length: 8 }, (_, i) => ({
      y: (i + 1) * 0.12,
      amp: 18 + i * 6,
      speed: 0.003 + i * 0.00035,
      thick: 1.5 + i * 0.2,
      color: [0, 0, 0] // logic below uses context theme
    }));

    function drawWave(baseY: number, amp: number, speed: number, isLight: boolean, th: number, i: number) {
      ctx!.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = baseY + Math.sin(x * 0.008 + t * speed) * amp + Math.cos(x * 0.003 - t * speed * 0.9) * amp * 0.35;
        if (x === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      
      const opacity = 0.05 + (i * 0.03);
      if (isLight) {
        ctx!.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
      } else {
        ctx!.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.8})`;
      }
      
      ctx!.lineWidth = th;
      ctx!.stroke();
    }

    function loop() {
      if (!ctx) return;
      t++;
      sx += (mx - sx) * 0.04;
      sy += (my - sy) * 0.04;
      
      const isLight = document.documentElement.classList.contains('light');
      ctx.fillStyle = isLight ? '#ffffff' : '#020617';
      ctx.fillRect(0, 0, w, h);

      // Radial aura following mouse
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 400);
      if (isLight) {
        g.addColorStop(0, 'rgba(0, 0, 0, 0.04)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        g.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      waves.forEach((wv, i) => drawWave(h * wv.y + i * 42, wv.amp, wv.speed, isLight, wv.thick, i));
      animationId = requestAnimationFrame(loop);
    }

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 w-full h-full z-0 pointer-events-none"
    />
  );
}
