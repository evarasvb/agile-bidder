import { useState, useCallback } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidImageFile } from '@/hooks/useProductImageUpload';

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  isUploading?: boolean;
  multiple?: boolean;
  className?: string;
}

export function ImageDropzone({ 
  onFilesSelected, 
  isUploading = false,
  multiple = true,
  className 
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const files = Array.from(e.dataTransfer.files).filter(file => {
      if (!isValidImageFile(file)) {
        setError('Solo se permiten imágenes JPG, PNG, WebP o GIF de máximo 5MB');
        return false;
      }
      return true;
    });
    
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
  }, [onFilesSelected, multiple]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const files = Array.from(e.target.files || []).filter(file => {
      if (!isValidImageFile(file)) {
        setError('Solo se permiten imágenes JPG, PNG, WebP o GIF de máximo 5MB');
        return false;
      }
      return true;
    });
    
    if (files.length > 0) {
      onFilesSelected(multiple ? files : [files[0]]);
    }
    e.target.value = '';
  };

  return (
    <div className={className}>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer",
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          isUploading && "opacity-50 pointer-events-none"
        )}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple={multiple}
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload-dropzone"
          disabled={isUploading}
        />
        <label htmlFor="image-upload-dropzone" className="cursor-pointer block">
          {isUploading ? (
            <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
          ) : (
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          )}
          <p className="text-sm font-medium">
            {isUploading ? 'Subiendo...' : 'Arrastra imágenes aquí'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            o haz clic para seleccionar
          </p>
        </label>
      </div>
      {error && (
        <p className="text-xs text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}

interface ImagePreviewProps {
  src: string;
  alt?: string;
  onRemove?: () => void;
  isPrincipal?: boolean;
  onSetPrincipal?: () => void;
  isLoading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ImagePreview({ 
  src, 
  alt = '', 
  onRemove, 
  isPrincipal,
  onSetPrincipal,
  isLoading,
  size = 'md'
}: ImagePreviewProps) {
  const [imageError, setImageError] = useState(false);
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32'
  };

  return (
    <div className={cn(
      "relative group rounded-lg overflow-hidden bg-muted",
      sizeClasses[size],
      isPrincipal && "ring-2 ring-primary ring-offset-2"
    )}>
      {imageError ? (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      ) : (
        <img 
          src={src} 
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
      
      {/* Overlay with actions */}
      <div className={cn(
        "absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity",
        "flex items-center justify-center gap-1"
      )}>
        {onSetPrincipal && !isPrincipal && (
          <button
            onClick={onSetPrincipal}
            disabled={isLoading}
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white text-xs"
            title="Establecer como principal"
          >
            ★
          </button>
        )}
        {onRemove && (
          <button
            onClick={onRemove}
            disabled={isLoading}
            className="p-1.5 rounded-full bg-white/20 hover:bg-destructive text-white"
            title="Eliminar"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      
      {/* Principal badge */}
      {isPrincipal && (
        <div className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
          Principal
        </div>
      )}
      
      {isLoading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
        </div>
      )}
    </div>
  );
}
