export interface TextOverlay {
  id: string;
  content: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: { x: number; y: number };
}

export interface TextBlock {
  id: string;
  type: 'text';
  content: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  isVisible: boolean;
}

export interface ImageData {
  id: string;
  type: 'image';
  file: File;
  previewUrl: string;
  isVisible: boolean;
  texts: TextOverlay[];
}

export type CompositionItem = ImageData | TextBlock;
