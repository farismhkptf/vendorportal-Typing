import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSignatureChange?: (dataUrl: string | null) => void;
  className?: string;
  disabled?: boolean;
}

export interface SignaturePadHandle {
  clear: () => void;
  getDataUrl: () => string | null;
  isEmpty: () => boolean;
  getBlob: () => Promise<Blob | null>;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ onSignatureChange, className, disabled = false }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    useImperativeHandle(ref, () => ({
      clear: () => {
        clearCanvas();
      },
      getDataUrl: () => {
        if (isEmpty) return null;
        return canvasRef.current?.toDataURL("image/png") || null;
      },
      isEmpty: () => isEmpty,
      getBlob: async () => {
        if (isEmpty || !canvasRef.current) return null;
        return new Promise<Blob | null>((resolve) => {
          canvasRef.current!.toBlob((blob) => resolve(blob), "image/png");
        });
      },
    }));

    const getPos = (e: MouseEvent | TouchEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      if ("touches" in e) {
        const touch = e.touches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const clearCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
      onSignatureChange?.(null);
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const onStart = (e: MouseEvent | TouchEvent) => {
        if (disabled) return;
        e.preventDefault();
        isDrawing.current = true;
        lastPos.current = getPos(e);
      };

      const onMove = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing.current || disabled) return;
        e.preventDefault();
        const pos = getPos(e);
        if (lastPos.current) {
          ctx.beginPath();
          ctx.moveTo(lastPos.current.x, lastPos.current.y);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }
        lastPos.current = pos;
        if (isEmpty) {
          setIsEmpty(false);
          const dataUrl = canvas.toDataURL("image/png");
          onSignatureChange?.(dataUrl);
        } else {
          const dataUrl = canvas.toDataURL("image/png");
          onSignatureChange?.(dataUrl);
        }
      };

      const onEnd = () => {
        isDrawing.current = false;
        lastPos.current = null;
      };

      canvas.addEventListener("mousedown", onStart);
      canvas.addEventListener("mousemove", onMove);
      canvas.addEventListener("mouseup", onEnd);
      canvas.addEventListener("mouseleave", onEnd);
      canvas.addEventListener("touchstart", onStart, { passive: false });
      canvas.addEventListener("touchmove", onMove, { passive: false });
      canvas.addEventListener("touchend", onEnd);

      return () => {
        canvas.removeEventListener("mousedown", onStart);
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mouseup", onEnd);
        canvas.removeEventListener("mouseleave", onEnd);
        canvas.removeEventListener("touchstart", onStart);
        canvas.removeEventListener("touchmove", onMove);
        canvas.removeEventListener("touchend", onEnd);
      };
    }, [disabled, isEmpty, onSignatureChange]);

    return (
      <div className={cn("relative", className)}>
        <div className="relative border-2 border-dashed border-border rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className={cn(
              "w-full touch-none",
              disabled ? "cursor-not-allowed opacity-60" : "cursor-crosshair"
            )}
            data-testid="signature-canvas"
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-muted-foreground">Sign here</p>
            </div>
          )}
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearCanvas}
            className="mt-1 text-muted-foreground h-7 gap-1"
            data-testid="button-clear-signature"
          >
            <RotateCcw className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
