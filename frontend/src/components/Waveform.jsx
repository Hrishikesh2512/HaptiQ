import { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 48;

const Waveform = ({ analyzer, isListening }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      setReady(true);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const ctx = canvas.getContext('2d');

    if (!isListening || !analyzer) {
      cancelAnimationFrame(animRef.current);
      // Draw idle state
      const draw = () => {
        const w = canvas.offsetWidth;
        const h = canvas.offsetHeight;
        ctx.clearRect(0, 0, w, h);
        const barW = 3;
        const gap = (w - BAR_COUNT * barW) / (BAR_COUNT + 1);
        for (let i = 0; i < BAR_COUNT; i++) {
          const x = gap + i * (barW + gap);
          const idleH = 4 + Math.sin(Date.now() / 1200 + i * 0.4) * 2;
          const yCenter = h / 2;
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.roundRect(x, yCenter - idleH / 2, barW, idleH, 2);
          ctx.fill();
        }
        animRef.current = requestAnimationFrame(draw);
      };
      draw();
      return () => cancelAnimationFrame(animRef.current);
    }

    const dataArray = new Uint8Array(analyzer.frequencyBinCount);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const step = Math.floor(dataArray.length / BAR_COUNT);
      const barW = 3;
      const gap = (w - BAR_COUNT * barW) / (BAR_COUNT + 1);

      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) sum += dataArray[i * step + j];
        const avg = sum / step;
        const normalized = avg / 255;
        const barH = Math.max(4, normalized * (h * 0.85));
        const x = gap + i * (barW + gap);
        const yCenter = h / 2;

        // Color based on intensity
        const hue = 230 + normalized * 40;
        const sat = 70 + normalized * 30;
        const lit = 50 + normalized * 20;
        ctx.fillStyle = `hsla(${hue}, ${sat}%, ${lit}%, ${0.5 + normalized * 0.5})`;

        ctx.beginPath();
        ctx.roundRect(x, yCenter - barH / 2, barW, barH, 2);
        ctx.fill();
      }
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isListening, analyzer, ready]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default Waveform;
