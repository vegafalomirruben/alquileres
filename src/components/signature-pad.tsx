"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
    onSave: (dataUrl: string) => void;
    onClear?: () => void;
}

export function SignaturePad({ onSave, onClear }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set high-DPI scaling
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);

        ctx.strokeStyle = "#0f172a";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    }, []);

    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();

        if ("touches" in e) {
            const touch = e.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top,
            };
        } else {
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        }
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if ("touches" in e && e.cancelable) {
            // prevent scrolling when drawing on touch devices
            e.preventDefault();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { x, y } = getPos(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasDrawn(true);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return;
        if ("touches" in e && e.cancelable) {
            e.preventDefault();
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { x, y } = getPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas) {
            onSave(canvas.toDataURL("image/png"));
        }
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
        if (onClear) onClear();
        onSave("");
    };

    return (
        <div className="space-y-2">
            <div className="relative border-2 border-dashed border-primary/30 rounded-2xl overflow-hidden bg-background shadow-inner">
                <canvas
                    ref={canvasRef}
                    className="w-full h-36 touch-none cursor-crosshair block"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                />
                {!hasDrawn && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-muted-foreground/50 text-xs font-medium tracking-wide">
                        Firma aquí con el dedo o ratón
                    </div>
                )}
            </div>
            <div className="flex justify-between items-center text-xs">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClear}
                    className="h-8 text-muted-foreground hover:text-destructive gap-1.5"
                >
                    <Eraser className="h-3.5 w-3.5" />
                    Borrar firma
                </Button>
                {hasDrawn && (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="h-3.5 w-3.5" /> Firma capturada
                    </span>
                )}
            </div>
        </div>
    );
}
