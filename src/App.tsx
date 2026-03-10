/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Palette, 
  Eraser, 
  RotateCcw, 
  Download, 
  Sparkles, 
  Loader2, 
  Check,
  ChevronRight,
  Info,
  Key,
  ExternalLink,
  ArrowLeft,
  Paintbrush
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

// Expanded predefined colors for the palette
const COLORS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#A52A2A', '#808080', '#FFC0CB', '#90EE90', '#ADD8E6',
  '#F5F5DC', '#2F4F4F', '#D2691E', '#4682B4', '#DAA520'
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'draw' | 'result'>('draw');

  // Initialize canvas and check API key
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set initial background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Set line properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Check if API key is selected
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, [activeTab]); // Re-init when switching back to draw tab

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    // Scale coordinates if canvas internal size differs from CSS size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = color;
    ctx.lineTo(x * scaleX, y * scaleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x * scaleX, y * scaleY);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setResultImage(null);
  };

  const transformToStitch = async () => {
    if (!hasApiKey) {
      await handleSelectKey();
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsProcessing(true);
    // On mobile, switch to result tab immediately to show loading
    if (window.innerWidth < 1024) {
      setActiveTab('result');
    }

    try {
      const base64Image = canvas.toDataURL('image/png').split(',')[1];
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: 'image/png',
              },
            },
            {
              text: 'Transform this drawing into a realistic high-quality cross-stitch embroidery pattern. The final image should look like it is stitched onto a white Aida fabric background, with visible "X" shaped stitches for each color. Maintain the original colors and shapes as much as possible, but give it a realistic textile texture. The output should be just the image of the cross-stitch.',
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
          }
        }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setResultImage(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error: any) {
      console.error('Transformation failed:', error);
      if (error.message?.includes("Requested entity was not found") || error.message?.includes("permission")) {
        setHasApiKey(false);
        alert('API Key error. Please select a valid API key from a paid Google Cloud project.');
      } else {
        alert('Failed to transform. Please try again.');
      }
      // If failed on mobile, maybe go back to draw tab
      if (window.innerWidth < 1024) {
        setActiveTab('draw');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadResult = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = 'my-cross-stitch.png';
    link.click();
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans selection:bg-[#5A5A40] selection:text-white pb-20 lg:pb-0">
      {/* Header */}
      <header className="border-b border-black/10 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shadow-lg">
              <Palette size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">StitchCraft</h1>
              <p className="text-[10px] uppercase tracking-widest text-[#5A5A40]/60 font-bold">AI Cross Stitch Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasApiKey === false && (
              <button 
                onClick={handleSelectKey}
                className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-medium hover:bg-amber-100 transition-colors"
              >
                <Key size={14} /> <span className="hidden sm:inline">Connect API Key</span>
              </button>
            )}
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className="p-2 hover:bg-black/5 rounded-full transition-colors"
            >
              <Info size={20} className="text-[#5A5A40]" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 lg:py-12">
        {hasApiKey === false && (
          <div className="mb-8 p-6 bg-amber-50 rounded-3xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 shrink-0">
                <Key size={20} />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-medium text-amber-900">API Key Required</h2>
                <p className="text-sm text-amber-800/80 leading-relaxed">
                  To use high-quality image generation, you must select a paid Gemini API key. 
                </p>
                <div className="flex items-center gap-4 pt-2">
                  <button 
                    onClick={handleSelectKey}
                    className="px-6 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors shadow-lg shadow-amber-600/20"
                  >
                    Select API Key
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showInfo && (
          <div className="mb-8 p-6 bg-white rounded-3xl border border-black/5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-lg font-medium mb-2">How it works</h2>
            <p className="text-sm text-[#5A5A40]/80 leading-relaxed">
              1. Draw your design on the canvas.<br />
              2. Click "Transform" to let the AI convert your drawing into a realistic cross-stitch pattern.<br />
              3. Download your final masterpiece!
            </p>
          </div>
        )}

        {/* Mobile Tab Switcher */}
        <div className="flex lg:hidden mb-6 bg-white/50 p-1 rounded-2xl border border-black/5">
          <button 
            onClick={() => setActiveTab('draw')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === 'draw' ? "bg-white shadow-sm text-[#5A5A40]" : "text-[#5A5A40]/50"
            )}
          >
            <Paintbrush size={16} /> Draw
          </button>
          <button 
            onClick={() => setActiveTab('result')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2",
              activeTab === 'result' ? "bg-white shadow-sm text-[#5A5A40]" : "text-[#5A5A40]/50"
            )}
          >
            <Sparkles size={16} /> Result
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Drawing Area */}
          <div className={cn("space-y-6", activeTab !== 'draw' && "hidden lg:block")}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]/60">Drawing Canvas</h2>
              <button 
                onClick={clearCanvas}
                className="p-2 hover:bg-white rounded-xl border border-black/5 transition-all shadow-sm flex items-center gap-2 text-xs font-medium"
              >
                <RotateCcw size={14} /> Clear
              </button>
            </div>

            <div className="relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={800}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full aspect-square bg-white rounded-[32px] shadow-2xl border border-black/5 cursor-crosshair touch-none"
              />
            </div>

            {/* Repositioned Toolbar: Between Canvas and Button */}
            <div className="bg-white p-6 rounded-[32px] shadow-lg border border-black/5 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Color Palette</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Custom</span>
                    <input 
                      type="color" 
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-6 h-6 rounded-md cursor-pointer border-none bg-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-10 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "aspect-square rounded-full border border-black/10 transition-transform hover:scale-110",
                        color === c && "ring-2 ring-[#5A5A40] ring-offset-2 scale-110"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="h-px bg-black/5" />

              <div className="flex items-center gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]/60">Brush Size</span>
                    <span className="text-[10px] font-bold text-[#5A5A40]">{brushSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="60" 
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-full accent-[#5A5A40]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={transformToStitch}
              disabled={isProcessing}
              className="w-full py-5 bg-[#5A5A40] text-white rounded-2xl font-medium shadow-xl shadow-[#5A5A40]/20 hover:bg-[#4A4A35] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 group"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Stitching your design...</span>
                </>
              ) : (
                <>
                  <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                  <span>Transform to Cross Stitch</span>
                </>
              )}
            </button>
          </div>

          {/* Result Area */}
          <div className={cn("space-y-6", activeTab !== 'result' && "hidden lg:block")}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]/60">Final Result</h2>
              {activeTab === 'result' && (
                <button 
                  onClick={() => setActiveTab('draw')}
                  className="lg:hidden p-2 hover:bg-white rounded-xl border border-black/5 transition-all shadow-sm flex items-center gap-2 text-xs font-medium"
                >
                  <ArrowLeft size={14} /> Back to Draw
                </button>
              )}
            </div>
            
            <div className="aspect-square bg-white rounded-[32px] shadow-2xl border border-black/5 overflow-hidden flex items-center justify-center relative group">
              {resultImage ? (
                <>
                  <img 
                    src={resultImage} 
                    alt="Cross stitch result" 
                    className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      onClick={downloadResult}
                      className="bg-white text-[#1A1A1A] px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:scale-105 transition-transform"
                    >
                      <Download size={18} /> Download Pattern
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-12 space-y-4">
                  <div className="w-20 h-20 bg-[#F5F2ED] rounded-full flex items-center justify-center mx-auto text-[#5A5A40]/30">
                    <Sparkles size={40} />
                  </div>
                  <p className="text-[#5A5A40]/40 text-sm italic">
                    Your cross-stitch pattern will appear here after transformation.
                  </p>
                </div>
              )}

              {isProcessing && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <Loader2 className="animate-spin text-[#5A5A40]" size={48} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-[#5A5A40] rounded-full animate-ping" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-[#5A5A40] animate-pulse">AI is stitching...</p>
                </div>
              )}
            </div>

            {resultImage && (
              <div className="p-6 bg-[#5A5A40]/5 rounded-3xl border border-[#5A5A40]/10 flex items-start gap-4">
                <div className="w-8 h-8 bg-[#5A5A40] rounded-full flex items-center justify-center text-white shrink-0">
                  <Check size={16} />
                </div>
                <div>
                  <h3 className="font-medium text-sm">Transformation Complete</h3>
                  <p className="text-xs text-[#5A5A40]/70 mt-1 leading-relaxed">
                    The AI has successfully converted your drawing into a cross-stitch texture.
                  </p>
                  <button 
                    onClick={downloadResult}
                    className="mt-4 w-full py-3 bg-white border border-black/5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 lg:hidden"
                  >
                    <Download size={14} /> Download Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-black/5 text-center">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#5A5A40]/40 font-bold">
          Powered by Gemini 3.1 & StitchCraft AI
        </p>
      </footer>
    </div>
  );
}
