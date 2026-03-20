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
    const newImages: ImageData[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      type: 'image',
      file,
      previewUrl: URL.createObjectURL(file),
      isVisible: true,
      texts: [],
    }));
    setItems((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'text',
      content: "Type your message here...",
      fontSize: 24,
      color: "#ffffff",
      backgroundColor: "#1e293b",
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

  const addTextOverlay = (imageId: string) => {
    const newOverlay: TextOverlay = {
      id: Math.random().toString(36).substr(2, 9),
      content: "Photo Caption",
      fontSize: 24,
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

  const updateTextBlock = (id: string, updates: Partial<TextBlock>) => {
    setItems((prev) => prev.map((item) => (item.id === id && item.type === 'text') ? { ...item, ...updates } as TextBlock : item));
    if (editingBlock?.id === id) setEditingBlock(prev => prev ? { ...prev, ...updates } : null);
  };

  const generatePdf = async () => {
    if (items.length === 0) return;
    setIsGenerating(true);
    try {
      const [ { default: jsPDF }, { default: html2canvas } ] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);
      const pdf = new jsPDF("p", "mm", "a4");
      const visibleItems = items.filter(i => i.isVisible);
      for (let i = 0; i < visibleItems.length; i++) {
        const item = visibleItems[i];
        const element = document.getElementById(`item-container-${item.id}`);
        if (!element) continue;
        const controls = element.querySelector('.item-controls');
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
          PDF Composer
        </h1>
        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              onClick={() => { if(confirm("Clear all?")) { items.forEach(i => i.type === 'image' && URL.revokeObjectURL(i.previewUrl)); setItems([]); } }}
              className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"
            >
              <Trash2 size={20} />
            </button>
          )}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-accent rounded-full text-xs">
            <Plus size={16} /> Photo
          </button>
          <button onClick={addTextBlock} className="flex items-center gap-2 px-3 py-2 bg-accent rounded-full text-xs">
            <TextIcon size={16} /> Text
          </button>
          <button
            onClick={generatePdf}
            disabled={items.length === 0 || isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-bold shadow-lg disabled:opacity-50"
          >
            {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Download size={18} />}
            <span>Export</span>
          </button>
        </div>
        <input type="file" multiple accept="image/jpeg,image/png" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
      </div>

      {items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center -mt-10 gap-8 text-center px-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-24 h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary shadow-inner">
            <TextIcon size={48} />
          </motion.div>
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight">Gift Your Story</h2>
            <p className="text-muted-foreground leading-relaxed">Combine photos and messages into a beautiful PDF.</p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl">Add Photos</button>
            <button onClick={addTextBlock} className="px-6 py-3 bg-accent rounded-2xl font-bold">Add Message</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-6">
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

      {editingOverlay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-lg font-bold">Edit Caption</h3>
                <button onClick={() => setEditingOverlay(null)} className="p-2"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={editingOverlay.text.content}
                  onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { content: e.target.value })}
                  className="w-full bg-accent px-4 py-3 rounded-xl focus:outline-none"
                  placeholder="Caption here..."
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Size</label>
                    <input type="range" min="12" max="64" value={editingOverlay.text.fontSize} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { fontSize: parseInt(e.target.value) })} className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Color</label>
                    <input type="color" value={editingOverlay.text.color} onChange={(e) => updateTextOverlay(editingOverlay.imageId, editingOverlay.text.id, { color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
                  </div>
                </div>
                <button onClick={() => removeTextOverlay(editingOverlay.imageId, editingOverlay.text.id)} className="w-full py-3 text-red-400 font-bold bg-red-400/10 rounded-xl">Delete Caption</button>
              </div>
            </div>
            <div className="p-4 bg-accent/50 flex justify-end">
              <button onClick={() => setEditingOverlay(null)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold">Done</button>
            </div>
          </motion.div>
        </div>
      )}

      {editingBlock && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h3 className="text-lg font-bold">Edit Message</h3>
                <button onClick={() => setEditingBlock(null)} className="p-2"><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <textarea
                  value={editingBlock.content}
                  onChange={(e) => updateTextBlock(editingBlock.id, { content: e.target.value })}
                  className="w-full bg-accent px-4 py-3 rounded-xl focus:outline-none min-h-[120px]"
                  placeholder="Your message..."
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Text Color</label>
                    <input type="color" value={editingBlock.color} onChange={(e) => updateTextBlock(editingBlock.id, { color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground">Background</label>
                    <input type="color" value={editingBlock.backgroundColor} onChange={(e) => updateTextBlock(editingBlock.id, { backgroundColor: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-accent/50 flex justify-end">
              <button onClick={() => setEditingBlock(null)} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold">Done</button>
            </div>
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
    <motion.div ref={setNodeRef} style={style} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={cn("relative rounded-3xl overflow-hidden shadow-xl border border-border bg-card flex flex-col transition-opacity", !item.isVisible && "opacity-60 grayscale")}>
      
      {item.type === 'image' ? (
        <>
          <div id={`item-container-${item.id}`} className="relative bg-black min-h-[200px] flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.previewUrl} alt="element" className="max-w-full h-auto object-contain block" draggable={false} />
            {item.texts.map((text: any) => (
              <DraggableOverlay key={text.id} text={text} imageId={item.id} updateText={updateTextOverlay} setEditingOverlay={setEditingOverlay} />
            ))}
          </div>
          <div className="flex items-center justify-between p-3 bg-accent/20 border-t border-border/50">
            <div className="flex items-center gap-1">
              <div {...attributes} {...listeners} className="p-2 text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-accent rounded-lg">
                <GripVertical size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Move</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => addTextOverlay(item.id)} className="flex items-center gap-1 px-3 py-2 bg-primary/10 text-primary rounded-xl font-bold text-xs"><Type size={16} />Caption</button>
              <button onClick={() => toggleVisibility(item.id)} className="p-2">{item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <button onClick={() => removeItem(item.id)} className="p-2 text-red-400"><Trash2 size={18} /></button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div 
            id={`item-container-${item.id}`} 
            className="p-12 flex items-center justify-center min-h-[160px] text-center"
            style={{ backgroundColor: item.backgroundColor, color: item.color }}
            onClick={() => setEditingBlock(item)}
          >
            <div style={{ fontSize: `${item.fontSize}px`, fontWeight: '500', lineHeight: '1.4' }}>{item.content}</div>
          </div>
          <div className="flex items-center justify-between p-3 bg-accent/20 border-t border-border/50">
            <div className="flex items-center gap-1">
              <div {...attributes} {...listeners} className="p-2 text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-accent rounded-lg">
                <GripVertical size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Message</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingBlock(item)} className="p-2 text-primary"><Settings size={18} /></button>
              <button onClick={() => toggleVisibility(item.id)} className="p-2">{item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
              <button onClick={() => removeItem(item.id)} className="p-2 text-red-400"><Trash2 size={18} /></button>
            </div>
          </div>
        </>
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
