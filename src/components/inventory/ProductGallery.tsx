import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageDropzone, ImagePreview } from './ImageDropzone';
import { useProductImages, useUploadProductImage, useDeleteProductImage, useSetPrincipalImage, ProductImage } from '@/hooks/useProductImages';
import { Loader2, Images, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductGalleryProps {
  productId: string;
  productType: 'inventory' | 'cliente_inventario';
  userId: string;
  productName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductGallery({ 
  productId, 
  productType, 
  userId, 
  productName,
  open,
  onOpenChange
}: ProductGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const { data: images = [], isLoading } = useProductImages(productId, productType);
  const uploadImage = useUploadProductImage();
  const deleteImage = useDeleteProductImage();
  const setPrincipal = useSetPrincipalImage();

  const handleFilesSelected = async (files: File[]) => {
    for (const file of files) {
      await uploadImage.mutateAsync({
        productId,
        productType,
        file,
        userId,
        esPrincipal: images.length === 0
      });
    }
  };

  const handleDelete = (image: ProductImage) => {
    deleteImage.mutate(image);
    if (selectedIndex !== null && selectedIndex >= images.length - 1) {
      setSelectedIndex(images.length > 1 ? images.length - 2 : null);
    }
  };

  const handleSetPrincipal = (image: ProductImage) => {
    setPrincipal.mutate(image);
  };

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Galería de Imágenes - {productName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Upload Area */}
          <ImageDropzone 
            onFilesSelected={handleFilesSelected}
            isUploading={uploadImage.isPending}
            multiple
          />

          {/* Images Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : images.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Images className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No hay imágenes</p>
              <p className="text-sm">Arrastra imágenes o haz clic para subir</p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-4 md:grid-cols-6 gap-3 p-1">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedIndex(index)}
                  >
                    <ImagePreview
                      src={image.image_url}
                      isPrincipal={image.es_principal}
                      onRemove={() => handleDelete(image)}
                      onSetPrincipal={() => handleSetPrincipal(image)}
                      isLoading={deleteImage.isPending || setPrincipal.isPending}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Summary */}
          <div className="flex items-center justify-between pt-2 border-t text-sm text-muted-foreground">
            <span>{images.length} imagen{images.length !== 1 ? 'es' : ''}</span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>

        {/* Lightbox */}
        {selectedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setSelectedIndex(null)}
          >
            <button 
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
              onClick={() => setSelectedIndex(null)}
            >
              <X className="h-8 w-8" />
            </button>
            
            {selectedIndex !== null && selectedIndex > 0 && (
              <button
                className="absolute left-4 text-white hover:text-gray-300 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(selectedIndex - 1);
                }}
              >
                <ChevronLeft className="h-10 w-10" />
              </button>
            )}
            
            {selectedIndex !== null && selectedIndex < images.length - 1 && (
              <button
                className="absolute right-4 text-white hover:text-gray-300 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIndex(selectedIndex + 1);
                }}
              >
                <ChevronRight className="h-10 w-10" />
              </button>
            )}
            
            <img
              src={selectedImage.image_url}
              alt=""
              className="max-h-[85vh] max-w-[85vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
              {selectedIndex !== null ? selectedIndex + 1 : 0} / {images.length}
              {selectedImage.es_principal && (
                <span className="ml-2 bg-primary px-2 py-0.5 rounded text-xs">Principal</span>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Compact gallery for inline display
interface ProductGalleryInlineProps {
  productId: string;
  productType: 'inventory' | 'cliente_inventario';
  onOpenGallery: () => void;
}

export function ProductGalleryInline({ 
  productId, 
  productType,
  onOpenGallery 
}: ProductGalleryInlineProps) {
  const { data: images = [], isLoading } = useProductImages(productId, productType);
  
  if (isLoading) {
    return (
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const principalImage = images.find(img => img.es_principal) || images[0];
  const imageCount = images.length;

  return (
    <button 
      onClick={onOpenGallery}
      className="relative w-10 h-10 rounded-lg bg-muted overflow-hidden group"
    >
      {principalImage ? (
        <>
          <img 
            src={principalImage.image_url} 
            alt=""
            className="w-full h-full object-cover"
          />
          {imageCount > 1 && (
            <div className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-tl">
              +{imageCount - 1}
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Images className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={cn(
        "absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity",
        "flex items-center justify-center"
      )}>
        <Images className="h-4 w-4 text-primary" />
      </div>
    </button>
  );
}
