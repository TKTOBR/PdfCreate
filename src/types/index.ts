export interface TextOverlay {
  id: string;
  content: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: { x: number; y: number };
}

export interface ImageMessage {
  content: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  isVisible: boolean;
}

export interface ImageData {
  id: string;
  file: File;
  previewUrl: string;
  isVisible: boolean;
  texts: TextOverlay[];
  message: ImageMessage;
}
