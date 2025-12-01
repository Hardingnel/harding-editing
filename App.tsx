import React, { useState } from 'react';
import { Header } from './components/Header';
import { ImageUploader } from './components/ImageUploader';
import { Editor } from './components/Editor';

export interface ImageAsset {
  src: string;
  mimeType: string;
  name: string;
}

const App: React.FC = () => {
  const [images, setImages] = useState<ImageAsset[]>([]);

  const handleImagesSelect = (selectedImages: ImageAsset[]) => {
    setImages(selectedImages);
  };

  const handleReset = () => {
    setImages([]);
  };

  // If editing, show full screen editor without global header/padding
  if (images.length > 0) {
    return (
      <Editor initialImages={images} onReset={handleReset} />
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0E12] flex flex-col font-sans selection:bg-cyan-500 selection:text-white text-slate-200">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl w-full space-y-12 relative z-10 animate-fade-in-up">
          <div className="text-center space-y-6">
            <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight">
              AI Photo Editing <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">Reimagined</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">
              Experience the power of Gemini 2.5 Flash Image. Batch processing, professional grade tools, and advanced generative AI in one sleek interface.
            </p>
          </div>
          
          <ImageUploader onImagesSelect={handleImagesSelect} />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
            {[
              { icon: "⚡", title: "Instant AI", desc: "Real-time generative edits with Gemini 2.5" },
              { icon: "🎨", title: "Pro Grading", desc: "Advanced HSL, Tone, and Curve controls" },
              { icon: "📂", title: "Batch Studio", desc: "Import multiple photos and sync edits instantly" }
            ].map((feature, i) => (
              <div key={i} className="bg-[#15161A] p-6 rounded-2xl border border-[#2A2B32] hover:border-cyan-500/30 transition-all group">
                <div className="text-2xl mb-4 bg-[#1F2128] w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-110 transition-transform">{feature.icon}</div>
                <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      <footer className="py-6 text-center text-[10px] text-slate-600 uppercase tracking-widest">
        Powered by Google Gemini API
      </footer>
    </div>
  );
};

export default App;