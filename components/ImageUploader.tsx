import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Layers, Sparkles, Wand2, Loader2, X, Check, FileImage, Maximize2, HardDrive } from 'lucide-react';
import { generateImage } from '../services/geminiService';

interface ImageUploaderProps {
  onImagesSelect: (images: Array<{ src: string; mimeType: string; name: string }>) => void;
}

interface RawCandidate {
  width: number;
  height: number;
  sizeBytes: number;
  blob: Blob;
  id: string;
}

interface PendingRawFile {
  file: File;
  candidates: RawCandidate[];
}

const SAMPLE_PROMPTS = [
  "A cinematic studio portrait of a cat wearing a leather jacket and sunglasses, dramatic lighting, high detail",
  "A futuristic cyberpunk city street at night with neon signs and rain reflections, photorealistic",
  "A serene mountain landscape at sunrise with a crystal clear lake reflection, wide angle",
  "A delicious gourmet burger with melting cheese and fresh vegetables, professional food photography",
  "A vintage polaroid style photo of a retro car on a desert highway, nostalgic vibes"
];

const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingRaw, setIsProcessingRaw] = useState(false);
  
  // State for manual RAW selection
  const [pendingRawFiles, setPendingRawFiles] = useState<PendingRawFile[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  // Helper to parse JPEG dimensions from binary data
  const getJpegDimensions = (data: Uint8Array): { width: number; height: number } | null => {
    let i = 0;
    // Check SOI (FF D8)
    if (data.length < 2 || data[i] !== 0xFF || data[i+1] !== 0xD8) return null;
    i += 2;
    
    while (i < data.length) {
      while (data[i] !== 0xFF) {
          i++;
          if (i >= data.length) return null;
      }
      while (data[i] === 0xFF) {
          i++;
          if (i >= data.length) return null;
      }
      
      const marker = data[i];
      i++;
      
      // Standalone markers
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) continue;
      
      if (i + 1 >= data.length) return null;
      const len = (data[i] << 8) | data[i+1];
      
      // SOF0 (Baseline) or SOF2 (Progressive) - Contains dimensions
      if (marker === 0xC0 || marker === 0xC2) {
        if (i + 6 >= data.length) return null;
        const h = (data[i+5] << 8) | data[i+6];
        const w = (data[i+7] << 8) | data[i+8];
        return { width: w, height: h };
      }
      
      i += len;
    }
    return null;
  };

  // Scan file for all valid JPEGs
  const extractRawCandidates = async (file: File): Promise<RawCandidate[]> => {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const len = bytes.length;
      
      const candidates: RawCandidate[] = [];
      let offset = 0;

      // Scan for JPEG sequences (FF D8 ... FF D9)
      while (offset < len - 1) {
        // Look for Start of Image (FF D8)
        // Relaxed check: We only check for FF D8. 
        // Some previous logic checked for FF D8 FF, but that is too strict for all RAW formats.
        if (bytes[offset] === 0xFF && bytes[offset+1] === 0xD8) {
          const start = offset;
          let end = -1;
          
          // Look for End of Image (FF D9)
          for (let j = start + 2; j < len - 1; j++) {
            if (bytes[j] === 0xFF && bytes[j+1] === 0xD9) {
              end = j + 2;
              break;
            }
          }

          if (end !== -1) {
            const size = end - start;
            // Ignore tiny thumbnails (< 20KB) to reduce noise and false positives
            if (size > 20480) {
              const jpegBytes = bytes.subarray(start, end);
              const dims = getJpegDimensions(jpegBytes);
              
              // Only add if we successfully parsed dimensions
              if (dims) {
                 const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
                 candidates.push({
                   width: dims.width,
                   height: dims.height,
                   sizeBytes: size,
                   blob: blob,
                   id: `${file.name}-${start}`
                 });
              }
            }
            // Advance offset past this JPEG
            offset = end;
          } else {
             // False start or truncated, advance slightly
             offset += 1;
          }
        } else {
          offset++;
        }
      }

      // Sort by resolution (pixels) descending
      return candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
    } catch (e) {
      console.error("RAW extraction failed", e);
      return [];
    }
  };

  const processFiles = async (files: File[]) => {
    // Allow standard images and Canon RAW formats
    const validFiles = files.filter(f => 
      f.type.startsWith('image/') || 
      /\.(cr2|cr3|crw)$/i.test(f.name)
    );
    
    if (validFiles.length === 0) {
      alert('Please upload valid image files (JPEG, PNG, WEBP, or Canon RAW)');
      return;
    }

    const rawFiles = validFiles.filter(f => /\.(cr2|cr3|crw)$/i.test(f.name));
    if (rawFiles.length > 0) {
      setIsProcessingRaw(true);
    }

    const processedImages: Array<{ src: string; mimeType: string; name: string }> = [];
    const manualReviewNeeded: PendingRawFile[] = [];

    await Promise.all(validFiles.map(async (file) => {
      // Check if it's a RAW file
      if (/\.(cr2|cr3|crw)$/i.test(file.name)) {
        try {
          const candidates = await extractRawCandidates(file);
          
          if (candidates.length === 0) {
             // IF NO CANDIDATES FOUND:
             // Do NOT fallback to reading the raw file as base64. 
             // Browsers CANNOT display 'data:application/octet-stream' in an <img> tag if the data is CR2.
             // This results in a broken image icon.
             console.warn(`No embedded JPEG preview found in ${file.name}`);
             alert(`Could not extract a preview from ${file.name}. The file might not contain a large enough embedded JPEG.`);
             return; 
          } else if (candidates.length === 1) {
             // Only one candidate, use it automatically
             const src = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(candidates[0].blob);
             });
             processedImages.push({ src, mimeType: 'image/jpeg', name: file.name });
          } else {
             // Multiple candidates found -> Ask user
             manualReviewNeeded.push({ file, candidates });
          }
        } catch (e) {
          console.error(`Failed to process RAW file ${file.name}`, e);
          alert(`Error processing ${file.name}`);
        }
      } else {
        // Standard Image Processing
        const src = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        processedImages.push({
          src,
          mimeType: file.type || 'image/jpeg',
          name: file.name
        });
      }
    }));

    setIsProcessingRaw(false);

    // Emit processed images immediately
    if (processedImages.length > 0) {
      onImagesSelect(processedImages);
    }

    // Set pending state for manual review
    if (manualReviewNeeded.length > 0) {
      setPendingRawFiles(manualReviewNeeded);
    }
  };

  const handleSelectRawCandidate = async (pendingFile: PendingRawFile, candidate: RawCandidate) => {
     try {
        const src = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(candidate.blob);
        });
        
        onImagesSelect([{
            src,
            mimeType: 'image/jpeg',
            name: pendingFile.file.name
        }]);

        // Remove from pending list
        setPendingRawFiles(prev => prev.filter(p => p.file !== pendingFile.file));

     } catch (e) {
         console.error("Error selecting candidate", e);
     }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files as File[]);
    }
  };

  const handleGenerateSample = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the file upload click
    setIsGenerating(true);
    try {
      const prompt = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
      const result = await generateImage(prompt);
      
      onImagesSelect([{
        src: result.imageUrl,
        mimeType: 'image/png', // Gemini returns png usually
        name: 'ai-generated-sample.png'
      }]);
      
    } catch (error) {
      console.error("Failed to generate sample", error);
      alert("Could not generate sample. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      
      {/* RAW Selection Modal */}
      {pendingRawFiles.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#15161A] border border-[#2A2B32] rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-[#2A2B32] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-400/10 text-yellow-400 rounded-lg">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold">Select RAW Previews</h3>
                            <p className="text-xs text-slate-400">Multiple embedded images found. Choose the best resolution.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setPendingRawFiles([])}
                        className="p-2 hover:bg-[#2A2B32] text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {pendingRawFiles.map((item, idx) => (
                        <div key={idx} className="space-y-3">
                            <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                <FileImage className="w-4 h-4 text-cyan-500" />
                                {item.file.name}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {item.candidates.map((candidate, cIdx) => (
                                    <button 
                                        key={candidate.id}
                                        onClick={() => handleSelectRawCandidate(item, candidate)}
                                        className="flex items-center gap-4 p-3 rounded-xl border border-[#2A2B32] bg-[#1F2128] hover:border-cyan-500/50 hover:bg-[#2A2B32] transition-all group text-left"
                                    >
                                        <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center shrink-0">
                                            {cIdx === 0 ? <Maximize2 className="w-6 h-6 text-yellow-400" /> : <ImageIcon className="w-6 h-6 text-slate-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-200">{candidate.width} x {candidate.height}</span>
                                                {cIdx === 0 && <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold">Full Res</span>}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                                                <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" /> {formatBytes(candidate.sizeBytes)}</span>
                                                <span>•</span>
                                                <span>{(candidate.width / candidate.height).toFixed(2)}:1</span>
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-lg">
                                                <Check className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      <div 
        className={`w-full border-2 border-dashed rounded-3xl transition-all cursor-pointer group p-6 md:p-12 text-center relative overflow-hidden ${isDragging ? 'border-cyan-500 bg-slate-800/80' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 hover:border-cyan-500/50'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessingRaw && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*, .cr2, .cr3, .crw"
          multiple
          className="hidden" 
        />
        
        <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-500/10 to-transparent transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

        <div className="flex flex-col items-center justify-center space-y-6 relative z-10">
          <div className={`p-6 rounded-full transition-transform duration-300 shadow-xl border ${isDragging ? 'scale-110 bg-slate-700 border-cyan-500' : 'bg-slate-800 border-slate-700 group-hover:border-cyan-500/30'}`}>
            {isProcessingRaw ? (
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            ) : (
              <Upload className={`w-10 h-10 ${isDragging ? 'text-cyan-400' : 'text-cyan-600 group-hover:text-cyan-400'}`} />
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-white">
              {isProcessingRaw ? "Analyzing RAW Files..." : "Upload Photos"}
            </h3>
            <p className="text-slate-400">
              {isProcessingRaw ? "Extracting preview layers" : "Drag & drop single or multiple files"}
            </p>
          </div>
          {!isProcessingRaw && (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                <ImageIcon className="w-3 h-3" />
                <span>JPEG, PNG, RAW</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                <Layers className="w-3 h-3" />
                <span>Batch Support</span>
                </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <div className="h-px bg-slate-800 flex-1" />
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">or</span>
        <div className="h-px bg-slate-800 flex-1" />
      </div>

      <button
        onClick={handleGenerateSample}
        disabled={isGenerating || isProcessingRaw}
        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/30 text-slate-300 hover:text-white p-4 rounded-xl flex items-center justify-center gap-3 transition-all group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-fuchsia-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="font-semibold">Generating Sample...</span>
          </>
        ) : (
          <>
            <Wand2 className="w-5 h-5 text-fuchsia-500 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Auto-Generate Sample Image</span>
            <Sparkles className="w-4 h-4 text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
          </>
        )}
      </button>
    </div>
  );
};