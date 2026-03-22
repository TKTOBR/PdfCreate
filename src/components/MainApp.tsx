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
  Type as TextIcon
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
import { CompositionItem, ImageData, TextBlock, TextOverlay } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function MainApp() {
  const [items, setItems] = useState<CompositionItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<{ imageId: string, text: TextOverlay } | null>(null);
  const [editingBlock, setEditingBlock] = useState<TextBlock | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newItems: ImageData[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      type: 'image',
      file,
      previewUrl: URL.createObjectURL(file),
      isVisible: true,
      texts: [],
    }));
    setItems((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'text',
      content: "Type your message here...",
      fontSize: 16,
      color: "#000000",
      backgroundColor: "#ffff00", // Bright Yellow
      isVisible: true,
    };
    setItems((prev) => [...prev, newBlock]);
    setEditingBlock(newBlock);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find(item => item.id === id);
      if (target && target.type === 'image') URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const toggleVisibility = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isVisible: !item.isVisible } as CompositionItem : item)));
  };

  const updateTextBlock = (id: string, updates: Partial<TextBlock>) => {
    setItems((prev) => prev.map((item) => (item.id === id && item.type === 'text') ? { ...item, ...updates } as TextBlock : item));
    if (editingBlock?.id === id) setEditingBlock(prev => prev ? { ...prev, ...updates } : null);
  };

  // Overlay management for images (captions on top)
  const addTextOverlay = (imageId: string) => {
    const newOverlay: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      content: "Caption",
      fontSize: 20,
      color: "#ffffff",
      opacity: 1,
      position: { x: 50, y: 50 },
    };
    setItems((prev) => prev.map((item) => 
      (item.id === imageId && item.type === 'image') ? { ...item, texts: [...item.texts, newOverlay] } as ImageData : item
    ));
    setEditingOverlay({ imageId, text: newOverlay });
  };

  const updateTextOverlay = (imageId: string, textId: string, updates: Partial<TextOverlay>) => {
    setItems((prev) => prev.map((item) => 
      (item.id === imageId && item.type === 'image') ? { 
        ...item, 
        texts: item.texts.map(t => t.id === textId ? { ...t, ...updates } : t) 
      } as ImageData : item
    ));
  };

  const removeTextOverlay = (imageId: string, textId: string) => {
    setItems((prev) => prev.map((item) => 
      (item.id === imageId && item.type === 'image') ? { ...item, texts: item.texts.filter(t => t.id !== textId) } as ImageData : item
    ));
    if (editingOverlay?.text.id === textId) setEditingOverlay(null);
  };

  const generatePdf = async () => {
    if (items.length === 0) return;
    setIsGenerating(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const container = document.getElementById("composition-container");
      if (!container) return;

      // Temporary styles for capture to match A4 aspect ratio nicely
      const originalStyle = container.style.cssText;
      container.style.width = "794px"; // A4 width at 96dpi
      container.style.background = "white";

      // Hide controls
      const controls = document.querySelectorAll(".item-controls");
      controls.forEach((c) => ((c as HTMLElement).style.display = "none"));

      const canvas = await html2canvas(container, {
        useCORS: true,
        scale: 2,
        backgroundColor: "#ffffff",
      });

      // Restore
      container.style.cssText = originalStyle;
      controls.forEach((c) => ((c as HTMLElement).style.display = "flex"));

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvasHeight * pdfWidth) / canvasWidth;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const serial = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      pdf.save(`${date}_composition_${serial}.pdf`);
    } catch (e) {
      console.error(e);
      alert("PDF creation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full p-4 gap-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 z-10 bg-background/80 backdrop-blur-md py-4 border-b border-border px-2">
        <h1 className="text-xl font-black tracking-tighter text-primary italic uppercase">CMS Composer</h1>
        <div className="flex gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-2 bg-accent rounded-full text-xs font-bold">
            <Plus size={16} /> Photo
          </button>
          <button onClick={addTextBlock} className="flex items-center gap-1 px-3 py-2 bg-yellow-400 text-black rounded-full text-xs font-bold">
            <TextIcon size={16} /> Text
          </button>
          <button
            onClick={generatePdf}
            disabled={items.length === 0 || isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg disabled:opacity-50"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download size={18} />}
          </button>
        </div>
        <input type="file" multiple accept="image/jpeg,image/png" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      </div>

      {items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-10 gap-8 text-center px-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner">
            <ImageIcon size={48} />
          </motion.div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">Compose Your Report</h2>
            <p className="text-muted-foreground leading-relaxed">Add photos and horizontal text blocks as shown in your sample.</p>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl">Start Building</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div id="composition-container" className="space-y-1">
              <AnimatePresence>
                {items.map((item) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    removeItem={removeItem}
                    toggleVisibility={toggleVisibility}
                    addTextOverlay={addTextOverlay}
                    updateTextOverlay={updateTextOverlay}
                    removeTextOverlay={removeTextOverlay}
                    setEditingOverlay={setEditingOverlay}
                    setEditingBlock={setEditingBlock}
                  />
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Modals for editors */}
      {editingOverlay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-4 font-bold"><h3>Edit Caption</h3><button onClick={() => setEditingOverlay(null)}><X size={20} /></button></div>
            <input type="text" value={editingOverlay.text.content} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { content: e.target.value })} className="w-full bg-accent px-4 py-3 rounded-xl" autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <input type="range" min="10" max="100" value={editingOverlay.text.fontSize} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { fontSize: parseInt(e.target.value) })} className="w-full" />
              <input type="color" value={editingOverlay.text.color} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { color: e.target.value })} className="w-full h-10 rounded-lg" />
            </div>
            <button onClick={() => removeTextOverlay(editingOverlay.imageId, editingOverlay.text.id)} className="w-full py-3 text-red-400 bg-red-400/10 rounded-xl font-bold italic">Delete</button>
            <button onClick={() => setEditingOverlay(null)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold">Done</button>
          </motion.div>
        </div>
      )}

      {editingBlock && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-4 font-bold"><h3>Edit Text Block</h3><button onClick={() => setEditingBlock(null)}><X size={20} /></button></div>
            <textarea value={editingBlock.content} onChange={(e) => updateTextBlock(editingBlock.id, { content: e.target.value })} className="w-full bg-accent px-4 py-3 rounded-xl min-h-[150px]" autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-[10px] font-bold uppercase">Background Color<input type="color" value={editingBlock.backgroundColor} onChange={(e) => updateTextBlock(editingBlock.id, { backgroundColor: e.target.value })} className="w-full h-8 rounded-lg" /></div>
              <div className="space-y-1 text-[10px] font-bold uppercase">Text Size<input type="range" min="10" max="48" value={editingBlock.fontSize} onChange={(e) => updateTextBlock(editingBlock.id, { fontSize: parseInt(e.target.value) })} className="w-full" /></div>
            </div>
            <button onClick={() => setEditingBlock(null)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold">Done</button>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function SortableItem({ item, removeItem, toggleVisibility, addTextOverlay, updateTextOverlay, removeTextOverlay, setEditingOverlay, setEditingBlock }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : 1, opacity: isDragging ? 0.5 : 1 };
  
  return (
    <motion.div ref={setNodeRef} style={style} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("relative group bg-white", !item.isVisible && "opacity-40 grayscale")}>
      
      {item.type === 'image' ? (
        <div className="relative overflow-hidden flex flex-col items-center">
          <div id={`item-container-${item.id}`} className="relative w-full flex items-center justify-center bg-black min-h-[100px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.previewUrl} alt="element" className="w-full h-auto object-contain block" draggable={false} />
            {item.texts.map((text: any) => (
              <DraggableOverlay key={text.id} text={text} imageId={item.id} updateText={updateTextOverlay} setEditingOverlay={setEditingOverlay} />
            ))}
          </div>
          {/* Internal Controls Overlay */}
          <div className="item-controls absolute top-2 right-2 flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
             <div {...attributes} {...listeners} className="p-2 bg-black/50 text-white rounded-lg cursor-grab"><GripVertical size={16} /></div>
             <button onClick={() => addTextOverlay(item.id)} className="p-2 bg-black/50 text-white rounded-lg"><Type size={16} /></button>
             <button onClick={() => toggleVisibility(item.id)} className="p-2 bg-black/50 text-white rounded-lg">{item.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
             <button onClick={() => removeItem(item.id)} className="p-2 bg-red-500/50 text-white rounded-lg"><Trash2 size={16} /></button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div 
            id={`item-container-${item.id}`} 
            className="w-full px-6 py-4 flex items-center min-h-[2rem]"
            style={{ backgroundColor: item.backgroundColor, color: item.color }}
            onClick={() => setEditingBlock(item)}
          >
            <div style={{ fontSize: `${item.fontSize}px`, fontWeight: '500', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{item.content}</div>
          </div>
          {/* Controls Overlay */}
          <div className="item-controls absolute top-2 right-2 flex gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
             <div {...attributes} {...listeners} className="p-2 bg-black/20 text-black rounded-lg cursor-grab"><GripVertical size={16} /></div>
             <button onClick={() => setEditingBlock(item)} className="p-2 bg-black/20 text-black rounded-lg"><Settings size={16} /></button>
             <button onClick={() => toggleVisibility(item.id)} className="p-2 bg-black/20 text-black rounded-lg">{item.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
             <button onClick={() => removeItem(item.id)} className="p-2 bg-red-500/20 text-red-500 rounded-lg"><Trash2 size={16} /></button>
          </div>
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
    <motion.div ref={nodeRef} drag dragMomentum={false} onDragEnd={onDragEnd} className="absolute cursor-move px-2 py-1 rounded z-10" style={{ left: `${text.position.x}%`, top: `${text.position.y}%`, transform: "translate(-50%, -50%)" }}>
      <div onClick={() => setEditingOverlay({ imageId, text })} style={{ fontSize: `${text.fontSize}px`, color: text.color, opacity: text.opacity, fontWeight: "bold", textShadow: "1px 1px 2px rgba(0,0,0,0.8)", textAlign: "center", lineHeight: "1" }}>
        {text.content}
      </div>
    </motion.div>
  );
}
