import { useEffect, useRef } from 'react';

const Waveform = ({ analyzer, isListening }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!isListening || !analyzer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyzer.getByteTimeDomainData(dataArray);

      // Clear Canvas
      ctx.fillStyle = 'rgba(15, 23, 42, 0.2)'; // Match background with trail effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Set Waveform style
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3b82f6'; // Primary Blue
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#3b82f6';

      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isListening, analyzer]);

  return (
    <div className="w-full h-32 glass-card rounded-2xl overflow-hidden mt-8 flex items-center justify-center relative">
      {!isListening && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-sm italic">
          Waiting for audio input...
        </div>
      )}
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={128} 
        className="w-full h-full"
      />
    </div>
  );
};

export default Waveform;
