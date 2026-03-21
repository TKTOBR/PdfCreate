"use client";

import { useState, useCallback, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Download, 
  Move, 
  Eye, 
  EyeOff, 
  Type, 
  Settings, 
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
  Type as TextIcon,
  MessageSquare
} from "lucide-react";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent,
  TouchSensor
} from "@dnd-kit/core";
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import { ImageData, TextOverlay, ImageMessage } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function MainApp() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<{ imageId: string, text: TextOverlay } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ imageId: string, message: ImageMessage } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newImages: ImageData[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      isVisible: true,
      texts: [],
      message: {
        content: "",
        fontSize: 24,
        color: "#000000",
        backgroundColor: "#fef08a", // Default Yellow
        isVisible: true,
      }
    }));
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find(img => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const toggleVisibility = (id: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, isVisible: !img.isVisible } : img)));
  };

  // Overlay management
  const addTextOverlay = (imageId: string) => {
    const newOverlay: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      content: "Photo Caption",
      fontSize: 24,
      color: "#ffffff",
      opacity: 1,
      position: { x: 50, y: 50 },
    };
    setImages((prev) => prev.map((img) => 
      img.id === imageId ? { ...img, texts: [...img.texts, newOverlay] } : img
    ));
    setEditingOverlay({ imageId, text: newOverlay });
  };

  const updateTextOverlay = (imageId: string, textId: string, updates: Partial<TextOverlay>) => {
    setImages((prev) => prev.map((img) => 
      img.id === imageId ? { 
        ...img, 
        texts: img.texts.map(t => t.id === textId ? { ...t, ...updates } : t) 
      } : img
    ));
  };

  const removeTextOverlay = (imageId: string, textId: string) => {
    setImages((prev) => prev.map((img) => 
      img.id === imageId ? { ...img, texts: img.texts.filter(t => t.id !== textId) } : img
    ));
    if (editingOverlay?.text.id === textId) setEditingOverlay(null);
  };

  // Message management
  const updateMessage = (imageId: string, updates: Partial<ImageMessage>) => {
    setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, message: { ...img.message, ...updates } } : img)));
    if (editingMessage?.imageId === imageId) {
      setEditingMessage(prev => prev ? { ...prev, message: { ...prev.message, ...updates } } : null);
    }
  };

  const generatePdf = async () => {
    if (images.length === 0) return;
    setIsGenerating(true);
    try {
      const [ { default: jsPDF }, { default: html2canvas } ] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);
      const pdf = new jsPDF("p", "mm", "a4");
      const visibleImages = images.filter(img => img.isVisible);
      for (let i = 0; i < visibleImages.length; i++) {
        const img = visibleImages[i];
        const element = document.getElementById(`full-card-${img.id}`);
        if (!element) continue;

        // Hide controls during capture
        const controls = element.querySelector('.card-controls');
        if (controls) (controls as HTMLElement).style.display = 'none';

        const canvas = await html2canvas(element, { useCORS: true, scale: 2, backgroundColor: null });
        
        if (controls) (controls as HTMLElement).style.display = 'flex';

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      }
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const serial = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      pdf.save(`${date}_composition_${serial}.pdf`);
    } catch (e) {
      alert("PDF creation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b border-border">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          PDF Composer
        </h1>
        <div className="flex gap-2">
          {images.length > 0 && (
            <button
              onClick={() => { if(confirm("Clear all?")) { images.forEach(i => URL.revokeObjectURL(i.previewUrl)); setImages([]); } }}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg">
            <Plus size={18} /> Add Photos
          </button>
          <button
            onClick={generatePdf}
            disabled={images.length === 0 || isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg disabled:opacity-50"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download size={18} />}
            <span>Export</span>
          </button>
        </div>
        <input type="file" multiple accept="image/jpeg,image/png" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      </div>

      {images.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-10 gap-8 text-center px-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner">
            <ImageIcon size={48} />
          </motion.div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">Image & Message</h2>
            <p className="text-muted-foreground leading-relaxed">Select photos and add messages to each page.</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl">Get Started</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((img) => img.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-12">
              <AnimatePresence>
                {images.map((img) => (
                  <SortableImageItem
                    key={img.id}
                    img={img}
                    removeImage={removeImage}
                    toggleVisibility={toggleVisibility}
                    addTextOverlay={addTextOverlay}
                    updateTextOverlay={updateTextOverlay}
                    removeTextOverlay={removeTextOverlay}
                    setEditingOverlay={setEditingOverlay}
                    setEditingMessage={setEditingMessage}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Overlay modal */}
      {editingOverlay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-4"><h3 className="text-lg font-bold">Photo Caption</h3><button onClick={() => setEditingOverlay(null)}><X size={20} /></button></div>
            <input type="text" value={editingOverlay.text.content} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { content: e.target.value })} className="w-full bg-accent px-4 py-3 rounded-xl focus:outline-none" autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <input type="range" min="12" max="64" value={editingOverlay.text.fontSize} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { fontSize: parseInt(e.target.value) })} className="w-full" />
              <input type="color" value={editingOverlay.text.color} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { color: e.target.value })} className="w-full h-10 rounded-lg" />
            </div>
            <button onClick={() => removeTextOverlay(editingOverlay.imageId, editingOverlay.text.id)} className="w-full py-3 text-red-400 bg-red-400/10 rounded-xl">Delete Caption</button>
            <div className="flex justify-end pt-4"><button onClick={() => setEditingOverlay(null)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold">Done</button></div>
          </motion.div>
        </div>
      )}

      {/* Message Modal */}
      {editingMessage && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-4"><h3 className="text-lg font-bold">Page Message</h3><button onClick={() => setEditingMessage(null)}><X size={20} /></button></div>
            <textarea value={editingMessage.message.content} onChange={(e) => updateMessage(editingMessage.imageId, { content: e.target.value })} className="w-full bg-accent px-4 py-3 rounded-xl min-h-[120px]" placeholder="Set your message..." autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><label className="text-[10px] uppercase font-bold text-muted-foreground">Text Color</label><input type="color" value={editingMessage.message.color} onChange={(e) => updateMessage(editingMessage.imageId, { color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" /></div>
              <div className="space-y-1"><label className="text-[10px] uppercase font-bold text-muted-foreground">Background</label><input type="color" value={editingMessage.message.backgroundColor} onChange={(e) => updateMessage(editingMessage.imageId, { backgroundColor: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" /></div>
            </div>
            <div className="flex justify-end pt-4"><button onClick={() => setEditingMessage(null)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold">Done</button></div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function SortableImageItem({ img, removeImage, toggleVisibility, addTextOverlay, updateTextOverlay, removeTextOverlay, setEditingOverlay, setEditingMessage }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : 1, opacity: isDragging ? 0.5 : 1 };
  
  return (
    <motion.div ref={setNodeRef} style={style} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={cn("relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-border bg-[#000000] flex flex-col transition-opacity", !img.isVisible && "opacity-60")}>
      
      {/* Container to capture for PDF */}
      <div id={`full-card-${img.id}`} className="bg-black flex flex-col">
          {/* Image Part */}
          <div className="relative bg-black min-h-[300px] flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.previewUrl} alt="composition" className="max-w-full h-auto object-contain block" draggable={false} />
            {img.texts.map((text: any) => (
              <DraggableOverlay key={text.id} text={text} imageId={img.id} updateText={updateTextOverlay} setEditingOverlay={setEditingOverlay} />
            ))}
          </div>

          {/* Message Part (Yellow block) */}
          <div 
            className="flex-1 py-12 px-8 text-center flex flex-col items-center justify-center min-h-[100px]"
            style={{ backgroundColor: img.message.backgroundColor, color: img.message.color }}
            onClick={() => setEditingMessage({ imageId: img.id, message: img.message })}
          >
            {img.message.content ? (
                <div style={{ fontSize: `${img.message.fontSize}px`, fontWeight: '600', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{img.message.content}</div>
            ) : (
                <div className="opacity-30 italic text-sm">Tap to add a message for this image</div>
            )}
          </div>
      </div>

      {/* Control Bar (Excluded from PDF) */}
      <div className="card-controls flex items-center justify-between p-4 bg-[#111111] border-t border-white/10 text-white">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="p-3 bg-white/5 rounded-2xl cursor-grab active:cursor-grabbing hover:bg-white/10"><GripVertical size={20} /></div>
          <span className="text-[10px] uppercase font-bold tracking-widest opacity-50 ml-1">Page {img.id.slice(0,3)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => addTextOverlay(img.id)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-2xl font-bold text-xs"><ImageIcon size={16} />Caption</button>
          <button onClick={() => setEditingMessage({ imageId: img.id, message: img.message })} className="flex items-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded-2xl font-bold text-xs"><MessageSquare size={16} />Message</button>
          <button onClick={() => toggleVisibility(img.id)} className="p-3 bg-white/5 rounded-2xl">{img.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
          <button onClick={() => removeImage(img.id)} className="p-3 bg-red-400/10 text-red-400 rounded-2xl"><Trash2 size={18} /></button>
        </div>
      </div>

      {!img.isVisible && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none z-20">
             <div className="bg-white/10 backdrop-blur-md px-6 py-2 rounded-full font-bold text-sm text-white">Excluded from PDF</div>
        </div>
      )}
    </motion.div>
  );
}

function DraggableOverlay({ text, imageId, updateText, setEditingOverlay }: any) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const onDragEnd = (_: unknown, info: any) => {
    const parent = nodeRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    updateText(imageId, text.id, { position: { x: Math.max(0, Math.min(100, text.position.x + (info.offset.x / parentRect.width) * 100)), y: Math.max(0, Math.min(100, text.position.y + (info.offset.y / parentRect.height) * 100)) } });
  };
  return (
    <motion.div ref={nodeRef} drag dragMomentum={false} onDragEnd={onDragEnd} className="absolute cursor-move p-2 rounded z-10" style={{ left: `${text.position.x}%`, top: `${text.position.y}%`, transform: "translate(-50%, -50%)" }}>
      <div onClick={() => setEditingOverlay({ imageId, text })} style={{ fontSize: `${text.fontSize}px`, color: text.color, opacity: text.opacity, fontWeight: "bold", textShadow: "2px 2px 4px rgba(0,0,0,0.8)", textAlign: "center" }}>
        {text.content}
      </div>
    </motion.div>
  );
}
