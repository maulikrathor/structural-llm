// components/AnnotatedCanvas.tsx
// Draws corner points and labels on the uploaded image using Canvas.
// Uses image_bounds from Gemini to map real coordinates onto correct pixel region.

import { useEffect, useRef } from "react";

interface Corner {
  label: string;
  x: number;
  y: number;
}

interface ImageBounds {
  left_pct: number;
  right_pct: number;
  top_pct: number;
  bottom_pct: number;
}

interface Props {
  imageFile: File;
  corners: Corner[];
  imageBounds?: ImageBounds;
}

function getLabelOffset(corner: Corner, allCorners: Corner[]): { dx: number; dy: number } {
  const xs = allCorners.map((c) => c.x);
  const ys = allCorners.map((c) => c.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = corner.x - cx;
  const dy = corner.y - cy;
  return {
    dx: dx >= 0 ? 10 : -22,
    dy: dy >= 0 ? -14 : 16,
  };
}

export default function AnnotatedCanvas({ imageFile, corners, imageBounds }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !imageFile || corners.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Use image_bounds from Gemini if available, else use conservative default
      const bounds = imageBounds ?? {
        left_pct: 0.08,
        right_pct: 0.92,
        top_pct: 0.08,
        bottom_pct: 0.92,
      };

      const drawX = canvas.width * bounds.left_pct;
      const drawY = canvas.height * bounds.top_pct;
      const drawW = canvas.width * (bounds.right_pct - bounds.left_pct);
      const drawH = canvas.height * (bounds.bottom_pct - bounds.top_pct);

      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;

      // Map real-world coords to canvas pixels
      // Flip Y: structural Y=0 is bottom, canvas Y=0 is top
      function toCanvas(cx: number, cy: number) {
        return {
          px: drawX + ((cx - minX) / rangeX) * drawW,
          py: drawY + drawH - ((cy - minY) / rangeY) * drawH,
        };
      }

      // Draw connecting lines between consecutive corners
      ctx.strokeStyle = "rgba(245, 158, 11, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      for (let i = 0; i < corners.length; i++) {
        const from = corners[i];
        const to = corners[(i + 1) % corners.length];
        const p1 = toCanvas(from.x, from.y);
        const p2 = toCanvas(to.x, to.y);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw dots and labels
      corners.forEach((corner) => {
        const { px, py } = toCanvas(corner.x, corner.y);
        const offset = getLabelOffset(corner, corners);

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.font = "bold 13px sans-serif";
        const lx = px + offset.dx;
        const ly = py + offset.dy;
        const tw = ctx.measureText(corner.label).width;

        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(lx - 2, ly - 12, tw + 6, 16);

        ctx.fillStyle = "#f59e0b";
        ctx.fillText(corner.label, lx + 1, ly);
      });

      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(imageFile);
  }, [imageFile, corners, imageBounds]);

  return (
    <div className="annotated-wrapper">
      <h3>Annotated Drawing</h3>
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: "100%",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          display: "block",
        }}
      />
    </div>
  );
}
