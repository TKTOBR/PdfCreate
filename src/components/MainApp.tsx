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
  GripVertical
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
import { ImageData, TextOverlay } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function MainApp() {
  const [images, setImages] = useState<ImageData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingText, setEditingText] = useState<{ imageId: string, text: TextOverlay } | null>(null);

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
    }));
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      const target = prev.find(img => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return filtered;
    });
  };

  const toggleVisibility = (id: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, isVisible: !img.isVisible } : img))
    );
  };

  const addText = (imageId: string) => {
    const newText: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      content: "Input Text",
      fontSize: 24,
      color: "#ffffff",
      opacity: 1,
      position: { x: 50, y: 50 },
    };
    setImages((prev) =>
      prev.map((img) => img.id === imageId ? { ...img, texts: [...img.texts, newText] } : img)
    );
    setEditingText({ imageId, text: newText });
  };

  const updateText = (imageId: string, textId: string, updates: Partial<TextOverlay>) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, texts: img.texts.map((t) => (t.id === textId ? { ...t, ...updates } : t)) }
          : img
      )
    );
    if (editingText && editingText.text.id === textId) {
      setEditingText(prev => prev ? { ...prev, text: { ...prev.text, ...updates } } : null);
    }
  };

  const removeText = (imageId: string, textId: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId ? { ...img, texts: img.texts.filter((t) => t.id !== textId) } : img
      )
    );
    if (editingText && editingText.text.id === textId) setEditingText(null);
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
        const element = document.getElementById(`image-container-${img.id}`);
        if (!element) continue;
        const controls = element.querySelector('.image-controls');
        if (controls) (controls as HTMLElement).style.opacity = '0';
        const canvas = await html2canvas(element, { useCORS: true, scale: 2, backgroundColor: null });
        if (controls) (controls as HTMLElement).style.opacity = '1';
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
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b border-border">
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          Image to PDF
        </h1>
        <div className="flex gap-2">
          {images.length > 0 && (
            <button
              onClick={() => { if(confirm("Clear all?")) { images.forEach(img => URL.revokeObjectURL(img.previewUrl)); setImages([]); } }}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-accent rounded-full text-sm">
            <Plus size={18} /> Add
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
            <h2 className="text-2xl font-bold tracking-tight">Image Composer</h2>
            <p className="text-muted-foreground leading-relaxed">Create PDFs with custom text overlays.</p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full max-w-xs px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-2xl active:scale-95 transition-all"
          >
            Select Images
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((img) => img.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
              <AnimatePresence>
                {images.map((img) => (
                  <SortableImageItem
                    key={img.id}
                    img={img}
                    removeImage={removeImage}
                    toggleVisibility={toggleVisibility}
                    addText={addText}
                    updateText={updateText}
                    removeText={removeText}
                    setEditingText={setEditingText}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {editingText && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-lg font-bold">Edit Text</h3>
                <button onClick={() => setEditingText(null)} className="p-2"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={editingText.text.content}
                  onChange={(e) => updateText(editingText.imageId, editingText.text.id, { content: e.target.value })}
                  className="w-full bg-accent px-4 py-3 rounded-xl"
                  placeholder="Type here..."
                />
                <div className="grid grid-cols-2 gap-4">
                  <input type="range" min="8" max="48" value={editingText.text.fontSize} onChange={(e) => updateText(editingText.imageId, editingText.text.id, { fontSize: parseInt(e.target.value) })} className="w-full" />
                  <input type="color" value={editingText.text.color} onChange={(e) => updateText(editingText.imageId, editingText.text.id, { color: e.target.value })} className="w-10 h-10" />
                </div>
                <button onClick={() => removeText(editingText.imageId, editingText.text.id)} className="w-full py-3 text-red-400 font-medium border border-red-400/20 rounded-xl">Delete Text</button>
              </div>
            </div>
            <div className="p-4 bg-accent/50 flex justify-end">
              <button onClick={() => setEditingText(null)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold">Done</button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function SortableImageItem({ img, removeImage, toggleVisibility, addText, updateText, removeText, setEditingText }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : 1, opacity: isDragging ? 0.5 : 1 };
  return (
    <motion.div ref={setNodeRef} style={style} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={cn("relative rounded-3xl overflow-hidden shadow-xl border border-border group", !img.isVisible && "opacity-40 grayscale")}>
      <div id={`image-container-${img.id}`} className="relative bg-black min-h-[200px] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.previewUrl} alt="element" className="max-w-full h-auto object-contain block" draggable={false} />
        {img.texts.map((text: any) => (<DraggableText key={text.id} text={text} imageId={img.id} updateText={updateText} setEditingText={setEditingText} />))}
      </div>
      <div className="image-controls absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => toggleVisibility(img.id)} className="p-3 bg-black/60 text-white rounded-full">{img.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
        <button onClick={() => addText(img.id)} className="p-3 bg-black/60 text-white rounded-full"><Type size={18} /></button>
        <button onClick={() => removeImage(img.id)} className="p-3 bg-black/60 text-red-400 rounded-full"><Trash2 size={18} /></button>
      </div>
      <div {...attributes} {...listeners} className="absolute top-4 left-4 p-3 bg-black/60 text-white rounded-full cursor-grab"><GripVertical size={18} /></div>
    </motion.div>
  );
}

function DraggableText({ text, imageId, updateText, setEditingText }: any) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const onDragEnd = (_: unknown, info: any) => {
    const parent = nodeRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    updateText(imageId, text.id, { position: { x: Math.max(0, Math.min(100, text.position.x + (info.offset.x / parentRect.width) * 100)), y: Math.max(0, Math.min(100, text.position.y + (info.offset.y / parentRect.height) * 100)) } });
  };
  return (
    <motion.div ref={nodeRef} drag dragMomentum={false} onDragEnd={onDragEnd} className="absolute cursor-move p-2 rounded z-10" style={{ left: `${text.position.x}%`, top: `${text.position.y}%`, transform: "translate(-50%, -50%)" }}>
      <div onClick={() => setEditingText({ imageId, text })} style={{ fontSize: `${text.fontSize}px`, color: text.color, opacity: text.opacity, fontWeight: "bold", textShadow: "2px 2px 4px rgba(0,0,0,0.8)", textAlign: "center" }}>
        {text.content}
      </div>
    </motion.div>
  );
}
