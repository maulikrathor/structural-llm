// components/AnnotatedCanvas.tsx
// Draws corner points and labels on the uploaded image using Canvas.
// No extra API calls — uses coordinates already returned by Gemini.

import { useEffect, useRef } from "react";

interface Corner {
  label: string;
  x: number;
  y: number;
}

interface Props {
  imageFile: File;
  corners: Corner[];
}

// Smart label offset: push label away from the nearest structural edge
// so it doesn't overlap the drawing lines.
function getLabelOffset(
  corner: Corner,
  allCorners: Corner[]
): { dx: number; dy: number } {
  const xs = allCorners.map((c) => c.x);
  const ys = allCorners.map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Offset away from the nearest boundary
  const dx = corner.x - (minX + maxX) / 2;
  const dy = corner.y - (minY + maxY) / 2;

  const offsetX = dx >= 0 ? 10 : -22;
  const offsetY = dy >= 0 ? -14 : 16;

  return { dx: offsetX, dy: offsetY };
}

export default function AnnotatedCanvas({ imageFile, corners }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !imageFile || corners.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Match canvas to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Coordinate transform: Gemini gives (0,0) at bottom-left,
      // Canvas has (0,0) at top-left. We need to flip Y.
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      // Fit the coordinate space to the canvas with padding
      const PAD = 0.08; // 8% padding on each side
      const drawW = canvas.width * (1 - 2 * PAD);
      const drawH = canvas.height * (1 - 2 * PAD);
      const originX = canvas.width * PAD;
      const originY = canvas.height * PAD;

      const scaleX = drawW / (maxX - minX || 1);
      const scaleY = drawH / (maxY - minY || 1);
      const scale = Math.min(scaleX, scaleY);

      function toCanvas(cx: number, cy: number) {
        return {
          px: originX + (cx - minX) * scale,
          // Flip Y: structural Y increases upward, canvas Y increases downward
          py: originY + drawH - (cy - minY) * scale,
        };
      }

      // Draw line segments first (under the dots)
      ctx.strokeStyle = "rgba(245, 158, 11, 0.6)"; // amber, semi-transparent
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);

      const cornerMap = Object.fromEntries(corners.map((c) => [c.label, c]));

      // Draw edges in label order (A→B→C→...→last→A)
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

      // Draw corner dots and labels
      corners.forEach((corner) => {
        const { px, py } = toCanvas(corner.x, corner.y);
        const offset = getLabelOffset(corner, corners);

        // Dot
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b"; // amber
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label background for readability
        const label = corner.label;
        ctx.font = "bold 13px sans-serif";
        const textW = ctx.measureText(label).width;
        const lx = px + offset.dx;
        const ly = py + offset.dy;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(lx - 2, ly - 12, textW + 6, 16);

        // Label text
        ctx.fillStyle = "#f59e0b";
        ctx.fillText(label, lx + 1, ly);
      });

      URL.revokeObjectURL(img.src);
    };

    img.src = URL.createObjectURL(imageFile);
  }, [imageFile, corners]);

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
