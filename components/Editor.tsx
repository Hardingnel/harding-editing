import React, { useState, useRef, useEffect } from 'react';
import { 
  Wand2, X, Download, RefreshCw, ZoomIn, ZoomOut, 
  RotateCcw, Sliders, Layers, Sparkles, Image as ImageIcon,
  Save, Undo, Eraser, Sun, Palette, Aperture, ChevronDown,
  Maximize, Minimize, Eye, EyeOff, Crop, Move, Monitor, 
  Smartphone, Share2, FileImage, Droplets, Zap, User, Scissors,
  Copy, Check, ArrowRight, Paintbrush, Clock, History as HistoryIcon,
  Trash2, Upload, Plus
} from 'lucide-react';
import { editImageWithGemini, getAutoEnhancementValues, generateImage } from '../services/geminiService';
import { ImageAsset } from '../App';

interface EditorProps {
  initialImages: ImageAsset[];
  onReset: () => void;
}

interface FilterState {
  // Light
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  
  // Color
  temperature: number;
  tint: number;
  saturation: number;
  vibrance: number;
  hue: number;

  // Detail & Effects
  clarity: number;
  sharpness: number;
  vignette: number;
  blur: number;
}

const INITIAL_FILTERS: FilterState = {
  exposure: 0,
  brightness: 100,
  contrast: 100,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  saturation: 100,
  vibrance: 0,
  hue: 0,
  clarity: 0,
  sharpness: 0,
  vignette: 0,
  blur: 0,
};

const PRESETS = [
    { name: "B&W Noir", filters: {...INITIAL_FILTERS, saturation: 0, contrast: 120}, color: "from-black to-white" },
    { name: "Warmth", filters: {...INITIAL_FILTERS, temperature: 30, tint: -10, contrast: 110}, color: "from-orange-900 to-yellow-500" },
    { name: "Cool & Vivid", filters: {...INITIAL_FILTERS, temperature: -20, saturation: 120, contrast: 115}, color: "from-blue-900 to-cyan-500" },
    { name: "Vintage", filters: {...INITIAL_FILTERS, temperature: 20, saturation: 80, contrast: 90, vignette: 40}, color: "from-amber-800 to-yellow-200" },
    { name: "Cyberpunk", filters: {...INITIAL_FILTERS, hue: 20, saturation: 140, contrast: 130, tint: 40}, color: "from-purple-600 to-pink-400" },
];

const STYLE_PRESETS = [
  { name: "Van Gogh", prompt: "Transform this image into the style of Van Gogh's Starry Night, with swirling brushstrokes and vibrant blue and yellow colors." },
  { name: "Cyberpunk", prompt: "Apply a futuristic cyberpunk style with neon lights, high contrast, and a tech-noir aesthetic." },
  { name: "Watercolor", prompt: "Convert this image into a soft, dreamy watercolor painting with bleeding edges and pastel tones." },
  { name: "Oil Painting", prompt: "Make this look like a classical oil painting with rich textures and visible brushwork." },
  { name: "Anime", prompt: "Transform this image into a high-quality anime style with clean lines and vibrant shading." },
  { name: "Sketch", prompt: "Turn this image into a detailed pencil sketch drawing." },
];

const PLACEHOLDER_PROMPTS = [
  "Make it look like a sunny day...",
  "Add a neon sign in the background...",
  "Change the dress to red...",
  "Give it a cyberpunk vibe...",
  "Remove the person in the background...",
  "Make it look like a vintage polaroid..."
];

const SAMPLE_PROMPTS = [
  "A cinematic studio portrait of a cat wearing a leather jacket and sunglasses, dramatic lighting, high detail",
  "A futuristic cyberpunk city street at night with neon signs and rain reflections, photorealistic",
  "A serene mountain landscape at sunrise with a crystal clear lake reflection, wide angle",
  "A delicious gourmet burger with melting cheese and fresh vegetables, professional food photography",
  "A vintage polaroid style photo of a retro car on a desert highway, nostalgic vibes"
];

interface HistoryStep {
  id: string;
  description: string;
  imageSrc: string; // The base image (before live filters)
  filters: FilterState; // The filters applied to this step
  rotation: number;
  timestamp: number;
}

// State container for a single image in the batch
interface ImageProject {
    id: string;
    originalSrc: string;
    mimeType: string;
    name: string;
    
    // Current Live State
    currentImage: string; 
    filters: FilterState;
    rotation: number;

    // History
    history: HistoryStep[];
    historyIndex: number;
}

// Quick prompt presets including the requested templates
const AI_TOOLS = [
  {
    category: "AI Enhance",
    icon: Zap,
    tools: [
      { name: "Auto Light & Color", prompt: "Auto correct exposure, contrast, and white balance for a balanced, natural look." },
      { name: "HDR Effect", prompt: "Apply a subtle HDR effect, balancing shadows and highlights for more detail." },
    ]
  },
  {
    category: "Generative Templates",
    icon: Wand2,
    tools: [
      { 
        name: "Only Background", 
        isTemplate: true,
        prompt: "Using the uploaded reference image, keep the person’s exact face, facial expression, hairstyle, natural skin tone, and outfit completely unchanged. Do not alter their body shape, pose, or clothing. Replace only the background with [DESCRIBE BACKGROUND HERE], using soft, even studio lighting, gentle shadows, and a professional portrait look. Maintain high resolution, sharp details, and natural color balance. Do not change the subject’s identity, skin, or clothes in any way—only the background." 
      },
      { 
        name: "Only Clothes", 
        isTemplate: true,
        prompt: "Using the uploaded reference image, keep the person’s exact face, facial expression, hairstyle, natural skin texture, and the original background fully unchanged. Do not modify the pose or the lighting on the face. Change only the outfit to [DESCRIBE OUTFIT HERE] while matching the lighting and perspective of the original photo. Preserve the original body proportions and silhouette. Do not change the person’s identity or skin tone—only replace the clothing." 
      },
      { 
        name: "Background + Clothes", 
        isTemplate: true,
        prompt: "Using the uploaded reference image, keep the person’s exact face, facial expression, hairstyle, and natural skin tone completely unchanged. Do not alter their identity or body proportions. Change the outfit to [DESCRIBE OUTFIT] and replace the background with [DESCRIBE BACKGROUND]. Match the lighting direction and intensity so the subject blends naturally with the new background. Maintain high resolution, sharp details, and realistic shadows while keeping the subject’s skin and facial features exactly as in the reference." 
      },
      { 
        name: "Skin Retouch", 
        prompt: "Using the uploaded reference image, keep the person’s face structure, expression, and natural skin tone exactly the same. Do not change their identity, body shape, clothes, or background. Apply a subtle professional beauty retouch: gently smooth the skin while preserving pores and texture, reduce harsh shadows or shiny hotspots, even out minor blemishes, and slightly enhance clarity around the eyes and lips. Keep the edit natural and realistic, as if done by a high-end studio retoucher." 
      },
      { 
        name: "Full Creative Edit", 
        isTemplate: true,
        prompt: "Using the uploaded reference image as a base, keep the person’s core identity and facial structure recognizable, but allow creative changes to the background, outfit, and overall skin styling. Transform the outfit into [FASHION STYLE], change the background to [ENVIRONMENT], and apply a stylized skin look such as [STYLE e.g. soft cinematic grading]. Maintain correct anatomy and proportions, with high resolution, clean edges, and cinematic lighting" 
      },
    ]
  },
  {
    category: "Studio Light",
    icon: Sun,
    tools: [
      { name: "Softbox Lighting", prompt: "Add soft, diffuse studio lighting to the subject." },
      { name: "Rim Light", prompt: "Add a dramatic rim light (backlight) to outline the subject." },
      { name: "Butterfly Light", prompt: "Apply butterfly lighting to the subject's face (glamour lighting, symmetric shadow under nose)." },
      { name: "Loop Light", prompt: "Apply loop lighting to the subject (small shadow of the nose on the cheek)." },
      { name: "Rembrandt", prompt: "Apply Rembrandt lighting (classic triangle of light on the cheek)." },
      { name: "Cinematic", prompt: "Apply cinematic teal and orange lighting." },
    ]
  },
  {
    category: "Background",
    icon: Layers,
    tools: [
      { name: "Blur Background", prompt: "Blur the background of the image to create a depth of field effect (bokeh)." },
      { name: "Remove Background", prompt: "Remove the background and make it transparent." },
      { name: "Replace with Studio Grey", prompt: "Change the background to a solid professional studio dark grey." },
    ]
  }
];

export const Editor: React.FC<EditorProps> = ({ initialImages, onReset }) => {
  // Initialize projects state from props
  const [projects, setProjects] = useState<ImageProject[]>(() => 
    initialImages.map((img, idx) => {
        const initialStep: HistoryStep = {
            id: `step-${Date.now()}-${idx}-init`,
            description: "Original Import",
            imageSrc: img.src,
            filters: { ...INITIAL_FILTERS },
            rotation: 0,
            timestamp: Date.now()
        };
        return {
            id: `img-${Date.now()}-${idx}`,
            originalSrc: img.src,
            mimeType: img.mimeType,
            name: img.name,
            currentImage: img.src,
            filters: { ...INITIAL_FILTERS },
            rotation: 0,
            history: [initialStep],
            historyIndex: 0,
        };
    })
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const activeProject = projects[activeIndex];
  
  // Use current live state
  const currentImage = activeProject.currentImage;
  const filters = activeProject.filters;

  const [zoom, setZoom] = useState(1);
  const [expandedSection, setExpandedSection] = useState<string>('Generative Templates');
  const [activeSliderGroup, setActiveSliderGroup] = useState<'Light' | 'Color' | 'Detail'>('Light');
  const [rightPanelTab, setRightPanelTab] = useState<'Tools' | 'History'>('Tools');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Custom prompt input
  const [customPrompt, setCustomPrompt] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const customPromptInputRef = useRef<HTMLInputElement>(null);

  // Style Transfer State
  const [customStyleImage, setCustomStyleImage] = useState<{src: string, mimeType: string} | null>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  const imageRef = useRef<HTMLImageElement>(null);

  // Rotate placeholder
  useEffect(() => {
    const interval = setInterval(() => {
        setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDER_PROMPTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // --- Actions ---

  const areFiltersEqual = (a: FilterState, b: FilterState) => {
    return (Object.keys(a) as Array<keyof FilterState>).every(k => a[k] === b[k]);
  };

  const updateActiveProject = (updates: Partial<ImageProject>) => {
    setProjects(prev => {
      const copy = [...prev];
      copy[activeIndex] = { ...copy[activeIndex], ...updates };
      return copy;
    });
  };

  const updateLiveFilters = (newFilters: Partial<FilterState>) => {
      updateActiveProject({ filters: { ...filters, ...newFilters } });
  };

  const addHistoryStep = (description: string, newImage?: string, newFilters?: FilterState, newRotation?: number) => {
    setProjects(prev => {
        const copy = [...prev];
        const project = copy[activeIndex];
        
        // Truncate future history if we are in the middle
        const history = project.history.slice(0, project.historyIndex + 1);
        
        const nextImage = newImage || project.currentImage;
        const nextFilters = newFilters || project.filters;
        const nextRotation = newRotation !== undefined ? newRotation : project.rotation;

        // Optimization: Don't add step if nothing changed
        const currentStep = history[history.length - 1];
        if (
            currentStep.imageSrc === nextImage &&
            areFiltersEqual(currentStep.filters, nextFilters) &&
            currentStep.rotation === nextRotation
        ) {
            return prev;
        }

        const newStep: HistoryStep = {
            id: `step-${Date.now()}`,
            description,
            imageSrc: nextImage,
            filters: { ...nextFilters },
            rotation: nextRotation,
            timestamp: Date.now()
        };

        history.push(newStep);
        
        copy[activeIndex] = {
            ...project,
            currentImage: nextImage,
            filters: { ...nextFilters },
            rotation: nextRotation,
            history: history,
            historyIndex: history.length - 1
        };
        
        return copy;
    });
  };

  const restoreHistoryStep = (index: number) => {
      const step = activeProject.history[index];
      updateActiveProject({
          historyIndex: index,
          currentImage: step.imageSrc,
          filters: { ...step.filters },
          rotation: step.rotation
      });
  };

  const handleUndo = () => {
    if (activeProject.historyIndex > 0) {
        restoreHistoryStep(activeProject.historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (activeProject.historyIndex < activeProject.history.length - 1) {
        restoreHistoryStep(activeProject.historyIndex + 1);
    }
  };

  // Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      
      // Windows standard for Redo (Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProject.historyIndex, activeProject.history.length, activeIndex]);

  // Helper to bake filters into an image (for AI processing or Export)
  const bakeImage = async (project: ImageProject, applyVisualFilters: boolean = true): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      // Use current live image
      img.src = project.currentImage;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject("No context");

        // Handle Rotation
        if (project.rotation % 180 !== 0) {
          canvas.width = img.naturalHeight;
          canvas.height = img.naturalWidth;
        } else {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }

        const w = canvas.width;
        const h = canvas.height;

        if (applyVisualFilters) {
            const f = project.filters;
            ctx.filter = `
            brightness(${f.brightness + f.exposure}%) 
            contrast(${f.contrast}%) 
            saturate(${f.saturation + f.vibrance}%) 
            sepia(${0}%) 
            grayscale(${0}%)
            blur(${f.blur}px)
            hue-rotate(${f.hue}deg)
            `;
        }

        ctx.translate(w / 2, h / 2);
        ctx.rotate((project.rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.filter = 'none';

        if (applyVisualFilters) {
            const f = project.filters;
            // Overlays
            if (f.temperature !== 0) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = f.temperature > 0 
                ? `rgba(255, 160, 20, ${f.temperature / 200})` 
                : `rgba(20, 100, 255, ${Math.abs(f.temperature) / 200})`;
            ctx.fillRect(0, 0, w, h);
            }
            
            if (f.tint !== 0) {
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillStyle = f.tint > 0 
                ? `rgba(255, 20, 255, ${f.tint / 200})` 
                : `rgba(20, 255, 20, ${Math.abs(f.tint) / 200})`;
            ctx.fillRect(0, 0, w, h);
            }

            if (f.vignette > 0) {
            ctx.globalCompositeOperation = 'source-over';
            const radius = Math.max(w, h) * 0.8;
            const gradient = ctx.createRadialGradient(w/2, h/2, radius * 0.3, w/2, h/2, radius);
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, `rgba(0,0,0,${f.vignette / 120})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, w, h);
            }
        }

        resolve(canvas.toDataURL(project.mimeType));
      };
      img.onerror = reject;
    });
  };

  const handleGeminiEdit = async (
    prompt: string, 
    loadingText: string = "Processing...", 
    styleRef?: { base64: string, mimeType: string }
  ) => {
    setIsProcessing(true);
    setLoadingMessage(loadingText);
    try {
      // Bake current filters before sending to AI so AI sees the "current look"
      const baked = await bakeImage(activeProject, true);
      const result = await editImageWithGemini(baked, activeProject.mimeType, prompt, styleRef);
      
      // Add new history step with new image and reset filters (since they are baked in).
      // CRITICAL: Explicitly reset rotation to 0, because bakeImage() has already applied 
      // the rotation to the pixels sent to the AI. The returned image is "upright".
      const desc = styleRef ? "Style Transfer" : `AI: ${prompt.length > 20 ? prompt.substring(0, 20)+'...' : prompt}`;
      addHistoryStep(desc, result.imageUrl, INITIAL_FILTERS, 0); 
    } catch (e) {
      console.error(e);
      alert("AI Processing Failed. Please try again.");
    } finally {
      setIsProcessing(false);
      setLoadingMessage("");
    }
  };

  const handleAutoEdit = () => {
    handleGeminiEdit(
        "Enhance this photo to look like a high-end professional image with perfect lighting, sharpness, and natural color balance.", 
        "Magic Auto Edit..."
    );
  };

  const handleGenerateNewSample = async () => {
    setIsProcessing(true);
    setLoadingMessage("Generating New Sample...");
    try {
      const prompt = SAMPLE_PROMPTS[Math.floor(Math.random() * SAMPLE_PROMPTS.length)];
      const result = await generateImage(prompt);
      
      const newIdx = projects.length;
      const newImage: ImageProject = {
            id: `img-${Date.now()}-${newIdx}`,
            originalSrc: result.imageUrl,
            mimeType: 'image/png', // Gemini outputs png/jpeg usually
            name: `ai-sample-${Date.now()}.png`,
            currentImage: result.imageUrl,
            filters: { ...INITIAL_FILTERS },
            rotation: 0,
            history: [{
                id: `step-${Date.now()}-init`,
                description: "AI Generated",
                imageSrc: result.imageUrl,
                filters: { ...INITIAL_FILTERS },
                rotation: 0,
                timestamp: Date.now()
            }],
            historyIndex: 0,
      };
      
      setProjects(prev => [...prev, newImage]);
      setActiveIndex(newIdx); // Switch to the new image
      
    } catch (e) {
      console.error(e);
      alert("Failed to generate sample");
    } finally {
      setIsProcessing(false);
      setLoadingMessage("");
    }
  };

  const handleTemplateClick = (tool: any) => {
    if (tool.isTemplate) {
        setCustomPrompt(tool.prompt);
        customPromptInputRef.current?.focus();
    } else {
        handleGeminiEdit(tool.prompt, `Applying ${tool.name}...`);
    }
  };

  // Auto Levels: Brightness & Contrast
  const handleAutoEnhance = async () => {
    setIsProcessing(true);
    setLoadingMessage("Analyzing Levels...");
    try {
        const baked = await bakeImage(activeProject, false); // No filters, raw image
        const values = await getAutoEnhancementValues(baked, activeProject.mimeType);
        
        // Update live filters (Exclude saturation for Levels tool)
        const newFilters = {
            ...activeProject.filters,
            brightness: values.brightness,
            contrast: values.contrast
        };
        
        // Add History Step
        addHistoryStep("Auto Levels", undefined, newFilters);
        
    } catch (e) {
        console.error(e);
    } finally {
        setIsProcessing(false);
        setLoadingMessage("");
    }
  };

  // Auto Color: Saturation
  const handleAutoSaturation = async () => {
    setIsProcessing(true);
    setLoadingMessage("Analyzing Color...");
    try {
        const baked = await bakeImage(activeProject, false); // No filters, raw image
        const values = await getAutoEnhancementValues(baked, activeProject.mimeType);
        
        // Only update saturation
        const newFilters = {
            ...activeProject.filters,
            saturation: values.saturation
        };
        
        addHistoryStep("Auto Color", undefined, newFilters);
    } catch (e) {
        console.error(e);
    } finally {
        setIsProcessing(false);
        setLoadingMessage("");
    }
  };

  const handleSyncToAll = () => {
      if (confirm("This will apply the current Light/Color settings to all images in the batch. Continue?")) {
        const currentFilters = activeProject.filters;
        setProjects(prev => prev.map(p => {
             // We need to add a history step for each project effectively?
             // For simplicity in batch, we just update the current state and push history
             const newHistory = [...p.history];
             const newStep = {
                 id: `step-${Date.now()}-sync`,
                 description: "Batch Sync",
                 imageSrc: p.currentImage,
                 filters: { ...currentFilters },
                 rotation: p.rotation,
                 timestamp: Date.now()
             };
             newHistory.push(newStep);

             return {
                ...p,
                filters: { ...currentFilters },
                history: newHistory,
                historyIndex: newHistory.length - 1
             };
        }));
      }
  };

  const handleApplyPresetToAll = (presetFilters: FilterState, presetName: string) => {
    if (confirm(`Apply ${presetName} preset to ALL images in the batch?`)) {
        setProjects(prev => prev.map(p => {
             const newHistory = [...p.history];
             const newStep = {
                 id: `step-${Date.now()}-preset-all`,
                 description: `Preset: ${presetName}`,
                 imageSrc: p.currentImage,
                 filters: { ...presetFilters },
                 rotation: p.rotation,
                 timestamp: Date.now()
             };
             newHistory.push(newStep);

             return {
                ...p,
                filters: { ...presetFilters },
                history: newHistory,
                historyIndex: newHistory.length - 1
             };
        }));
    }
  };

  const handleRemoveBackground = () => {
      handleGeminiEdit("Remove the background from this image and make it transparent.", "Removing Background...");
  };

  const handleStyleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomStyleImage({
          src: reader.result as string,
          mimeType: file.type || 'image/jpeg'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleApplyCustomStyle = () => {
    if (customStyleImage) {
      const prompt = "Transfer the artistic style of the second image (reference) onto the first image (target). Maintain the subject structure and composition of the first image, but adopt the color palette, brushwork, texture, and artistic technique of the second image.";
      handleGeminiEdit(prompt, "Transferring Style...", { base64: customStyleImage.src, mimeType: customStyleImage.mimeType });
    }
  };

  const handleBatchExport = async () => {
    setIsProcessing(true);
    setLoadingMessage("Preparing batch export...");
    
    // Sequential download to avoid browser blocking
    for (let i = 0; i < projects.length; i++) {
        setLoadingMessage(`Exporting ${i+1}/${projects.length}...`);
        try {
            const url = await bakeImage(projects[i], true);
            const link = document.createElement('a');
            link.href = url;
            link.download = `harding-${projects[i].name || `img-${i}`}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Small delay to prevent browser throttling
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            console.error(`Failed to export image ${i}`, e);
        }
    }
    
    setIsProcessing(false);
    setLoadingMessage("");
  };

  // --- UI Components ---

  const Slider = ({ label, value, min, max, onChange, onCommit, colorClass = "accent-cyan-400" }: any) => (
    <div className="space-y-2 py-1">
      <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-semibold text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-cyan-200">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={(e) => onCommit && onCommit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit && onCommit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit && onCommit(Number((e.target as HTMLInputElement).value))}
        className={`w-full h-1 bg-slate-800 rounded-full appearance-none cursor-pointer hover:bg-slate-700 transition-all ${colorClass} slider-thumb-glow`}
      />
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#0D0E12] text-slate-200 font-sans overflow-hidden">
      
      {/* 2. Top Toolbar */}
      <div className="h-14 bg-[#15161A] border-b border-[#2A2B32] flex items-center justify-between px-4 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <div className="bg-[#2A2B32] p-1.5 rounded-lg">
              <FileImage className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold hidden md:inline">Library ({projects.length})</span>
          </button>
          
          <div className="h-6 w-px bg-[#2A2B32]" />
          
          <div className="flex items-center gap-1">
            <button onClick={handleUndo} disabled={activeProject.historyIndex===0} className="p-2 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-[#2A2B32] rounded-lg transition-colors" title="Undo (Ctrl+Z)">
              <Undo className="w-4 h-4" />
            </button>
            <button onClick={handleRedo} disabled={activeProject.historyIndex===activeProject.history.length-1} className="p-2 text-slate-400 hover:text-white disabled:opacity-30 hover:bg-[#2A2B32] rounded-lg transition-colors" title="Redo (Ctrl+Shift+Z)">
              <RotateCcw className="w-4 h-4 scale-x-[-1]" />
            </button>
          </div>
          
          <div className="h-6 w-px bg-[#2A2B32]" />

          <button onClick={() => addHistoryStep("Reset All", undefined, INITIAL_FILTERS, 0)} className="text-xs font-medium text-slate-500 hover:text-cyan-400 uppercase tracking-wider">
            Reset Edits
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1F2128] rounded-full border border-[#2A2B32] text-xs font-mono text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
            <span className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-cyan-400'}`} />
            {isProcessing ? 'PROCESSING' : 'READY'}
          </div>
          
          <button 
            onClick={handleBatchExport}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold px-5 py-2 rounded-lg transition-all shadow-[0_0_20px_rgba(8,145,178,0.3)] border border-cyan-500/30"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT ALL
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        
        {/* 3. Left Panel - AI Tools */}
        <div className="w-72 bg-[#111216] border-r border-[#2A2B32] flex flex-col z-40 hidden md:flex">
          <div className="p-4 border-b border-[#2A2B32] flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-500" />
              AI Studio
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
             <div className="px-2 pb-2">
                 <h4 className="text-[10px] font-bold text-slate-600 uppercase mb-2">Quick Actions</h4>
                 <div className="grid grid-cols-2 gap-2">
                     <button 
                        onClick={handleAutoEnhance}
                        disabled={isProcessing}
                        className="bg-[#1F2128] hover:bg-[#2A2B32] text-slate-300 hover:text-white p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-[#2A2B32]"
                     >
                         <Zap className="w-4 h-4 text-blue-400" />
                         <span className="text-[10px] font-bold uppercase">Auto Levels</span>
                     </button>
                     <button 
                        onClick={handleAutoSaturation}
                        disabled={isProcessing}
                        className="bg-[#1F2128] hover:bg-[#2A2B32] text-slate-300 hover:text-white p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-[#2A2B32]"
                     >
                         <Droplets className="w-4 h-4 text-fuchsia-400" />
                         <span className="text-[10px] font-bold uppercase">Auto Color</span>
                     </button>
                     <button 
                        onClick={handleAutoEdit}
                        disabled={isProcessing}
                        className="bg-gradient-to-br from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-900/20"
                     >
                         <Sparkles className="w-4 h-4 text-white" />
                         <span className="text-[10px] font-bold uppercase">Magic Edit</span>
                     </button>
                     <button 
                        onClick={handleRemoveBackground}
                        disabled={isProcessing}
                        className="bg-[#1F2128] hover:bg-[#2A2B32] text-slate-300 hover:text-white p-3 rounded-xl flex flex-col items-center justify-center gap-2 transition-all border border-[#2A2B32]"
                     >
                         <Eraser className="w-4 h-4 text-yellow-400" />
                         <span className="text-[10px] font-bold uppercase">Remove BG</span>
                     </button>
                     <button 
                        onClick={handleGenerateNewSample}
                        disabled={isProcessing}
                        className="col-span-2 bg-[#1F2128] hover:bg-[#2A2B32] text-slate-300 hover:text-white p-3 rounded-xl flex items-center justify-center gap-3 transition-all border border-[#2A2B32]"
                     >
                         <Wand2 className="w-4 h-4 text-emerald-400" />
                         <span className="text-[10px] font-bold uppercase">Gen Sample</span>
                     </button>
                 </div>
             </div>

            {AI_TOOLS.map((category) => (
              <div key={category.category} className="rounded-xl overflow-hidden bg-[#18191E] border border-[#2A2B32]">
                <button 
                  onClick={() => setExpandedSection(expandedSection === category.category ? '' : category.category)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium text-slate-200 hover:bg-[#1F2128] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <category.icon className="w-4 h-4 text-cyan-500" />
                    {category.category}
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedSection === category.category ? 'rotate-180' : ''}`} />
                </button>
                
                {expandedSection === category.category && (
                  <div className="p-2 pt-0 space-y-1 bg-[#15161A]">
                    {category.tools.map((tool) => (
                      <button
                        key={tool.name}
                        disabled={isProcessing}
                        onClick={() => handleTemplateClick(tool)}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-400 hover:text-white hover:bg-[#1F2128] rounded-lg transition-colors flex items-center justify-between group"
                      >
                        <span className={tool.isTemplate ? "text-cyan-200" : ""}>{tool.name}</span>
                        {tool.isTemplate ? (
                            <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-500 transition-opacity" />
                        ) : (
                            <Wand2 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-fuchsia-500 transition-opacity" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Style Transfer Section */}
            <div className="rounded-xl overflow-hidden bg-[#18191E] border border-[#2A2B32]">
              <button 
                onClick={() => setExpandedSection(expandedSection === 'Style Transfer' ? '' : 'Style Transfer')}
                className="w-full flex items-center justify-between p-3 text-sm font-medium text-slate-200 hover:bg-[#1F2128] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4 text-fuchsia-500" />
                  Style Transfer
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedSection === 'Style Transfer' ? 'rotate-180' : ''}`} />
              </button>
              
              {expandedSection === 'Style Transfer' && (
                <div className="p-3 pt-0 space-y-4 bg-[#15161A]">
                  {/* Custom Upload */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase">Custom Reference</h5>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={styleInputRef}
                      className="hidden" 
                      onChange={handleStyleFileUpload}
                    />
                    {!customStyleImage ? (
                      <button 
                        onClick={() => styleInputRef.current?.click()}
                        className="w-full border border-dashed border-slate-700 hover:border-cyan-500 bg-[#0D0E12] rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-cyan-400 transition-all"
                      >
                        <Upload className="w-5 h-5" />
                        <span className="text-xs">Upload Style Image</span>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative rounded-lg overflow-hidden border border-[#2A2B32] aspect-video group">
                          <img src={customStyleImage.src} alt="Style Ref" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setCustomStyleImage(null)}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-red-500/80 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <button 
                          onClick={handleApplyCustomStyle}
                          disabled={isProcessing}
                          className="w-full bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-400 text-xs font-bold py-2 rounded-lg transition-all"
                        >
                          Apply Style
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Presets */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase">Presets</h5>
                    <div className="grid grid-cols-2 gap-2">
                      {STYLE_PRESETS.map((style) => (
                        <button
                          key={style.name}
                          disabled={isProcessing}
                          onClick={() => handleGeminiEdit(style.prompt, `Applying ${style.name}...`)}
                          className="text-xs p-2 bg-[#1F2128] hover:bg-[#2A2B32] border border-[#2A2B32] hover:border-cyan-500/30 rounded-lg text-slate-300 hover:text-white transition-all text-center"
                        >
                          {style.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
          
          {/* Custom Prompt Box */}
          <div className="p-4 border-t border-[#2A2B32] bg-[#15161A]">
            <label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Prompt Editor</label>
            <div className="relative">
              <textarea 
                ref={customPromptInputRef}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={PLACEHOLDER_PROMPTS[placeholderIndex]}
                className="w-full bg-[#0D0E12] border border-[#2A2B32] rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-colors pr-8 min-h-[80px]"
                onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if(customPrompt) handleGeminiEdit(customPrompt);
                    }
                }}
              />
              <button 
                disabled={!customPrompt || isProcessing}
                onClick={() => handleGeminiEdit(customPrompt)}
                className="absolute right-2 bottom-2 p-1.5 bg-cyan-900/50 hover:bg-cyan-500/50 text-cyan-400 hover:text-white rounded transition-colors"
              >
                <Zap className="w-3 h-3" />
              </button>
            </div>
            {/* Suggestion Chips */}
            <div className="flex gap-2 overflow-x-auto custom-scrollbar mt-2 pb-1">
                {["Vintage", "Cyberpunk", "Sunset", "B&W"].map(tag => (
                    <button 
                        key={tag} 
                        onClick={() => setCustomPrompt(`Make it ${tag} style`)}
                        className="whitespace-nowrap px-2 py-1 rounded bg-[#1F2128] border border-[#2A2B32] text-[10px] text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
                    >
                        {tag}
                    </button>
                ))}
            </div>
          </div>
        </div>

        {/* 1. Main Workspace (Center) */}
        <div className="flex-1 relative bg-[#0D0E12] flex flex-col overflow-hidden">
          
          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden select-none">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" 
                 style={{ 
                   backgroundImage: 'linear-gradient(#1F2128 1px, transparent 1px), linear-gradient(90deg, #1F2128 1px, transparent 1px)', 
                   backgroundSize: '40px 40px' 
                 }} 
            />

            <div 
              className="relative shadow-2xl transition-transform duration-200 ease-out"
              style={{ 
                transform: `scale(${zoom})`,
                cursor: 'grab'
              }}
              onMouseDown={() => setIsComparing(true)}
              onMouseUp={() => setIsComparing(false)}
              onMouseLeave={() => setIsComparing(false)}
            >
              {/* Checkerboard for Transparency */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #1F2128 25%, transparent 25%), linear-gradient(-45deg, #1F2128 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1F2128 75%), linear-gradient(-45deg, transparent 75%, #1F2128 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
                }}
              />
              <div className="relative group z-10">
                 {/* Image */}
                <img 
                  ref={imageRef}
                  src={isComparing ? activeProject.originalSrc : currentImage} 
                  alt="Editor workspace"
                  className="max-w-[80vw] max-h-[60vh] object-contain rounded-lg ring-1 ring-[#2A2B32] shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-[#0D0E12]"
                  style={{
                    filter: isComparing ? 'none' : `
                      brightness(${filters.brightness + filters.exposure}%) 
                      contrast(${filters.contrast}%) 
                      saturate(${filters.saturation + filters.vibrance}%) 
                      grayscale(${0}%)
                      blur(${filters.blur}px)
                      hue-rotate(${filters.hue}deg)
                    `
                  }}
                />
                
                {/* CSS Overlays for non-filter props */}
                {!isComparing && (
                  <>
                     <div 
                        className="absolute inset-0 pointer-events-none mix-blend-overlay rounded-lg"
                        style={{ backgroundColor: filters.temperature !== 0 ? (filters.temperature > 0 ? `rgba(255, 160, 20, ${filters.temperature/200})` : `rgba(20, 100, 255, ${Math.abs(filters.temperature)/200})`) : 'transparent' }}
                      />
                      <div 
                        className="absolute inset-0 pointer-events-none mix-blend-overlay rounded-lg"
                        style={{ backgroundColor: filters.tint !== 0 ? (filters.tint > 0 ? `rgba(255, 20, 255, ${filters.tint/200})` : `rgba(20, 255, 20, ${Math.abs(filters.tint)/200})`) : 'transparent' }}
                      />
                      {filters.vignette > 0 && (
                        <div 
                            className="absolute inset-0 pointer-events-none rounded-lg"
                            style={{ background: `radial-gradient(circle, transparent 50%, rgba(0,0,0, ${(filters.vignette/100) * 0.9}) 140%)` }}
                        />
                      )}
                  </>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-[#0D0E12]/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 border-4 border-[#2A2B32] rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-cyan-400 border-r-fuchsia-500 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-cyan-400 font-bold text-sm tracking-widest uppercase animate-pulse">{loadingMessage}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Zoom Controls */}
            <div className="absolute right-6 bottom-6 flex flex-col gap-2 bg-[#15161A]/90 backdrop-blur border border-[#2A2B32] p-2 rounded-xl shadow-xl z-30">
              <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="p-2 hover:bg-[#2A2B32] rounded-lg text-slate-400 hover:text-white transition-colors">
                <ZoomIn className="w-5 h-5" />
              </button>
              <div className="text-center text-[10px] font-mono text-slate-500 py-1">{Math.round(zoom * 100)}%</div>
              <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.1))} className="p-2 hover:bg-[#2A2B32] rounded-lg text-slate-400 hover:text-white transition-colors">
                <ZoomOut className="w-5 h-5" />
              </button>
              
              <div className="h-px bg-[#2A2B32] my-1" />
              
              <button 
                onMouseDown={() => setIsComparing(true)}
                onMouseUp={() => setIsComparing(false)}
                onMouseLeave={() => setIsComparing(false)}
                onTouchStart={() => setIsComparing(true)}
                onTouchEnd={() => setIsComparing(false)}
                className={`p-2 rounded-lg transition-colors ${isComparing ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-[#2A2B32] text-slate-400 hover:text-white'}`}
                title="Hold to see original"
              >
                <Eye className="w-5 h-5" />
              </button>
            </div>

            {/* Before/After Indicator */}
            <div className="absolute top-6 left-1/2 -translate-x-1/2 pointer-events-none">
                <div className={`px-4 py-1 rounded-full bg-black/50 backdrop-blur border border-white/10 text-[10px] font-bold uppercase tracking-widest transition-opacity duration-200 ${isComparing ? 'opacity-100 text-yellow-400' : 'opacity-0 text-white'}`}>
                    Original
                </div>
            </div>
          </div>
          
          {/* Filmstrip / Image Selector */}
          {projects.length > 1 && (
             <div className="h-20 bg-[#0D0E12] border-t border-[#2A2B32] flex items-center px-4 overflow-x-auto space-x-2 shrink-0 z-30 custom-scrollbar">
                {projects.map((p, idx) => (
                    <button 
                        key={p.id}
                        onClick={() => setActiveIndex(idx)}
                        className={`relative h-14 w-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${idx === activeIndex ? 'border-cyan-400 opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}
                    >
                        <img src={p.currentImage} className="w-full h-full object-cover" />
                    </button>
                ))}
             </div>
          )}

          {/* 4. Bottom Panel - Manual Sliders */}
          <div className="h-48 bg-[#15161A] border-t border-[#2A2B32] flex flex-col z-40 shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-[#2A2B32]">
               {['Light', 'Color', 'Detail'].map(group => (
                 <button
                    key={group}
                    onClick={() => setActiveSliderGroup(group as any)}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 ${activeSliderGroup === group ? 'border-cyan-400 text-white bg-[#1F2128]' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-[#1A1C22]'}`}
                 >
                    {group}
                 </button>
               ))}
               
               {/* Sync Button */}
               {projects.length > 1 && (
                   <button 
                    onClick={handleSyncToAll}
                    className="px-6 py-3 border-l border-[#2A2B32] text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-cyan-400 hover:bg-[#1F2128] transition-colors flex items-center gap-2"
                   >
                       <Copy className="w-3.5 h-3.5" />
                       Sync All
                   </button>
               )}
            </div>

            {/* Slider Area */}
            <div className="flex-1 p-6 overflow-x-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4 min-w-max md:min-w-0">
                {activeSliderGroup === 'Light' && (
                  <>
                    <Slider label="Exposure" value={filters.exposure} min={-100} max={100} onChange={(v: number) => updateLiveFilters({exposure: v})} onCommit={(v: number) => addHistoryStep("Adjust Exposure", undefined, {...filters, exposure: v})} />
                    <Slider label="Contrast" value={filters.contrast} min={0} max={200} onChange={(v: number) => updateLiveFilters({contrast: v})} onCommit={(v: number) => addHistoryStep("Adjust Contrast", undefined, {...filters, contrast: v})} />
                    <Slider label="Brightness" value={filters.brightness} min={0} max={200} onChange={(v: number) => updateLiveFilters({brightness: v})} onCommit={(v: number) => addHistoryStep("Adjust Brightness", undefined, {...filters, brightness: v})} />
                    <Slider label="Highlights (Sim)" value={filters.highlights} min={-100} max={100} onChange={(v: number) => updateLiveFilters({highlights: v})} onCommit={(v: number) => addHistoryStep("Adjust Highlights", undefined, {...filters, highlights: v})} colorClass="accent-yellow-400" />
                    <Slider label="Shadows (Sim)" value={filters.shadows} min={-100} max={100} onChange={(v: number) => updateLiveFilters({shadows: v})} onCommit={(v: number) => addHistoryStep("Adjust Shadows", undefined, {...filters, shadows: v})} />
                  </>
                )}
                {activeSliderGroup === 'Color' && (
                  <>
                     <Slider label="Temp" value={filters.temperature} min={-100} max={100} onChange={(v: number) => updateLiveFilters({temperature: v})} onCommit={(v: number) => addHistoryStep("Adjust Temperature", undefined, {...filters, temperature: v})} colorClass="accent-orange-400" />
                     <Slider label="Tint" value={filters.tint} min={-100} max={100} onChange={(v: number) => updateLiveFilters({tint: v})} onCommit={(v: number) => addHistoryStep("Adjust Tint", undefined, {...filters, tint: v})} colorClass="accent-fuchsia-400" />
                     <Slider label="Saturation" value={filters.saturation} min={0} max={200} onChange={(v: number) => updateLiveFilters({saturation: v})} onCommit={(v: number) => addHistoryStep("Adjust Saturation", undefined, {...filters, saturation: v})} />
                     <Slider label="Vibrance" value={filters.vibrance} min={0} max={100} onChange={(v: number) => updateLiveFilters({vibrance: v})} onCommit={(v: number) => addHistoryStep("Adjust Vibrance", undefined, {...filters, vibrance: v})} />
                     <Slider label="Hue" value={filters.hue} min={-180} max={180} onChange={(v: number) => updateLiveFilters({hue: v})} onCommit={(v: number) => addHistoryStep("Adjust Hue", undefined, {...filters, hue: v})} colorClass="accent-purple-400" />
                  </>
                )}
                {activeSliderGroup === 'Detail' && (
                  <>
                     <Slider label="Sharpness (Sim)" value={filters.sharpness} min={0} max={100} onChange={(v: number) => updateLiveFilters({sharpness: v})} onCommit={(v: number) => addHistoryStep("Adjust Sharpness", undefined, {...filters, sharpness: v})} />
                     <Slider label="Blur" value={filters.blur} min={0} max={20} onChange={(v: number) => updateLiveFilters({blur: v})} onCommit={(v: number) => addHistoryStep("Adjust Blur", undefined, {...filters, blur: v})} />
                     <Slider label="Vignette" value={filters.vignette} min={0} max={100} onChange={(v: number) => updateLiveFilters({vignette: v})} onCommit={(v: number) => addHistoryStep("Adjust Vignette", undefined, {...filters, vignette: v})} />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Right Panel - Advanced & History (Collapsible) */}
        <div className="w-16 lg:w-64 bg-[#111216] border-l border-[#2A2B32] flex flex-col z-40 shrink-0">
             {/* Right Panel Tabs */}
            <div className="flex border-b border-[#2A2B32] hidden lg:flex">
                <button 
                    onClick={() => setRightPanelTab('Tools')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${rightPanelTab === 'Tools' ? 'text-white border-b-2 border-cyan-400 bg-[#1F2128]' : 'text-slate-500 hover:bg-[#1A1C22]'}`}
                >
                    Tools
                </button>
                <button 
                    onClick={() => setRightPanelTab('History')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${rightPanelTab === 'History' ? 'text-white border-b-2 border-cyan-400 bg-[#1F2128]' : 'text-slate-500 hover:bg-[#1A1C22]'}`}
                >
                    History
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {rightPanelTab === 'Tools' && (
                    <div className="flex flex-col gap-1 p-2">
                        <button onClick={() => addHistoryStep("Rotate 90", undefined, undefined, (activeProject.rotation + 90) % 360)} className="flex items-center gap-3 p-3 text-slate-400 hover:text-white hover:bg-[#1F2128] rounded-xl transition-all group">
                            <Crop className="w-5 h-5 text-cyan-500" />
                            <span className="text-sm font-medium hidden lg:block">Rotate 90°</span>
                        </button>
                        
                        <div className="h-px bg-[#2A2B32] my-2" />
                        
                        <div className="hidden lg:block px-2 py-1">
                            <span className="text-[10px] font-bold text-slate-600 uppercase">Presets</span>
                        </div>
                        
                        <div className="space-y-1">
                            {PRESETS.map((preset) => (
                                <div key={preset.name} className="group relative flex items-center">
                                    <button 
                                        onClick={() => addHistoryStep(`Preset: ${preset.name}`, undefined, preset.filters)}
                                        className="flex-1 flex items-center gap-3 p-2.5 text-slate-400 hover:text-white hover:bg-[#1F2128] rounded-xl transition-all"
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-gradient-to-tr ${preset.color} border border-slate-600`}></div>
                                        <span className="text-sm font-medium hidden lg:block">{preset.name}</span>
                                    </button>
                                    {/* Apply to All Button */}
                                    {projects.length > 1 && (
                                        <button 
                                            onClick={() => handleApplyPresetToAll(preset.filters, preset.name)}
                                            title="Apply to All Images"
                                            className="absolute right-2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-cyan-900/50 text-cyan-500 rounded transition-all hidden lg:block"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                {rightPanelTab === 'History' && (
                    <div className="p-2 space-y-1">
                        {activeProject.history.map((step, idx) => (
                            <button
                                key={step.id}
                                onClick={() => restoreHistoryStep(idx)}
                                className={`w-full text-left p-2.5 rounded-lg text-xs font-medium flex items-center gap-3 transition-colors ${idx === activeProject.historyIndex ? 'bg-cyan-900/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-[#1F2128] hover:text-white'}`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full ${idx === activeProject.historyIndex ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                                <div className="flex-1 truncate">
                                    {step.description}
                                </div>
                                {idx === activeProject.historyIndex && <Check className="w-3 h-3" />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Mobile/Collapsed Toggle for History */}
            <div className="lg:hidden p-2 border-t border-[#2A2B32]">
                <button 
                    onClick={() => setRightPanelTab(rightPanelTab === 'Tools' ? 'History' : 'Tools')}
                    className="w-full p-2 flex items-center justify-center text-slate-400 hover:text-white"
                >
                    {rightPanelTab === 'Tools' ? <HistoryIcon className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
                </button>
            </div>
        </div>
      </div>

      {/* 6. Footer Info Bar */}
      <div className="h-6 bg-[#0D0E12] border-t border-[#2A2B32] flex items-center justify-between px-4 text-[10px] text-slate-600 shrink-0 select-none">
        <div className="flex items-center gap-4">
            <span>READY</span>
            <span>GEMINI 2.5 FLASH IMAGE</span>
        </div>
        <div className="flex items-center gap-4">
            <span>Step {activeProject.historyIndex + 1}/{activeProject.history.length}</span>
            <span>{Math.round(zoom * 100)}%</span>
            <span>R: {activeProject.rotation || 0}°</span>
        </div>
      </div>
      
      {/* Mobile Styles Injection */}
      <style>{`
        .slider-thumb-glow::-webkit-slider-thumb {
            box-shadow: 0 0 10px currentColor;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #111216;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2A2B32;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4B5563;
        }
      `}</style>
    </div>
  );
};