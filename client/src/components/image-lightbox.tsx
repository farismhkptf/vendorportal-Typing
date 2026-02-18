import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LightboxFile {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
}

interface ImageLightboxProps {
  files: LightboxFile[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

function isPdf(file: LightboxFile): boolean {
  if (file.mimeType === "application/pdf") return true;
  return file.fileName.toLowerCase().endsWith(".pdf");
}

function isImage(file: LightboxFile): boolean {
  if (file.mimeType && file.mimeType.startsWith("image/")) return true;
  const ext = file.fileName.toLowerCase().split(".").pop() || "";
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext);
}

export function ImageLightbox({ files, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  const goNext = useCallback(() => {
    if (files.length > 1) {
      setCurrentIndex((i) => (i + 1) % files.length);
    }
  }, [files.length]);

  const goPrev = useCallback(() => {
    if (files.length > 1) {
      setCurrentIndex((i) => (i - 1 + files.length) % files.length);
    }
  }, [files.length]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, handleClose, goNext, goPrev]);

  if (!open || files.length === 0) return null;

  const file = files[currentIndex];

  const content = (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      onClick={handleClose}
      data-testid="lightbox-backdrop"
    >
      <div className="absolute inset-0 bg-black/80" />

      <Button
        size="icon"
        variant="ghost"
        className="absolute top-4 right-4 z-[101] text-white hover:bg-white/20"
        onClick={(e) => {
          e.stopPropagation();
          handleClose();
        }}
        data-testid="button-lightbox-close"
      >
        <X className="h-5 w-5" />
      </Button>

      {files.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 z-[101] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            data-testid="button-lightbox-prev"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 z-[101] flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            data-testid="button-lightbox-next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      <div
        className="relative z-[101] flex max-h-[85vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isPdf(file) ? (
          <div className="flex flex-col items-center gap-3">
            <iframe
              src={file.fileUrl}
              className="h-[80vh] w-[80vw] rounded-md bg-white"
              title={file.fileName}
            />
          </div>
        ) : isImage(file) ? (
          <img
            src={file.fileUrl}
            alt={file.fileName}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-md"
            data-testid="lightbox-image"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white">
            <FileText className="h-16 w-16" />
            <p className="text-sm">Preview not available</p>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-6 left-1/2 z-[101] flex -translate-x-1/2 items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="max-w-[50vw] truncate text-sm text-white" data-testid="lightbox-filename">
          {file.fileName}
        </span>
        {files.length > 1 && (
          <span className="text-xs text-white/60">
            {currentIndex + 1} / {files.length}
          </span>
        )}
        <a
          href={file.fileUrl}
          download={file.fileName}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-white hover:bg-white/20"
            data-testid="button-lightbox-download"
          >
            <Download className="h-4 w-4" />
          </Button>
        </a>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
