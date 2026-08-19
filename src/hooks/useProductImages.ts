import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductImage {
  id: string;
  product_id: string;
  product_type: 'inventory' | 'cliente_inventario';
  image_url: string;
  storage_path: string | null;
  orden: number;
  es_principal: boolean;
  created_at: string;
}

export function useProductImages(productId: string | null, productType: 'inventory' | 'cliente_inventario') {
  return useQuery({
    queryKey: ['product-images', productId, productType],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .eq('product_type', productType)
        .order('orden', { ascending: true });
      
      if (error) throw error;
      return data as ProductImage[];
    },
    enabled: !!productId,
  });
}

export function useUploadProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      productType,
      file,
      userId,
      esPrincipal = false
    }: {
      productId: string;
      productType: 'inventory' | 'cliente_inventario';
      file: File;
      userId: string;
      esPrincipal?: boolean;
    }) => {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}/${productId}/${Date.now()}.${fileExt}`;
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(uploadData.path);
      
      // Get current max orden
      const { data: existingImages } = await supabase
        .from('product_images')
        .select('orden')
        .eq('product_id', productId)
        .eq('product_type', productType)
        .order('orden', { ascending: false })
        .limit(1);
      
      const nextOrden = existingImages && existingImages.length > 0 
        ? (existingImages[0].orden || 0) + 1 
        : 0;

      // If this is principal, unset other principal images
      if (esPrincipal) {
        await supabase
          .from('product_images')
          .update({ es_principal: false })
          .eq('product_id', productId)
          .eq('product_type', productType);
      }
      
      // Insert record
      const { data, error } = await supabase
        .from('product_images')
        .insert({
          product_id: productId,
          product_type: productType,
          image_url: urlData.publicUrl,
          storage_path: uploadData.path,
          orden: nextOrden,
          es_principal: esPrincipal || nextOrden === 0
        })
        .select()
        .single();
      
      if (error) throw error;

      // Si es la imagen principal (o la primera), la reflejamos también en la
      // columna imagen_url del producto, que es la que usan la tabla y los PDF
      // (ficha técnica). Antes sólo se hacía al marcar "principal" a mano.
      if (esPrincipal || nextOrden === 0) {
        const table = productType === 'inventory' ? 'inventory' : 'cliente_inventario';
        await supabase.from(table).update({ imagen_url: urlData.publicUrl }).eq('id', productId);
      }

      return data as ProductImage;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['product-images', variables.productId, variables.productType]
      });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      toast.success('Imagen subida correctamente');
    },
    onError: (error: Error) => {
      toast.error(`Error al subir imagen: ${error.message}`);
    },
  });
}

export function useDeleteProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (image: ProductImage) => {
      // Delete from storage if we have the path
      if (image.storage_path) {
        await supabase.storage
          .from('product-images')
          .remove([image.storage_path]);
      }
      
      // Delete record
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', image.id);
      
      if (error) throw error;
      return image;
    },
    onSuccess: (image) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-images', image.product_id, image.product_type] 
      });
      toast.success('Imagen eliminada');
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}

export function useSetPrincipalImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (image: ProductImage) => {
      // Unset all principal
      await supabase
        .from('product_images')
        .update({ es_principal: false })
        .eq('product_id', image.product_id)
        .eq('product_type', image.product_type);
      
      // Set this as principal
      const { error } = await supabase
        .from('product_images')
        .update({ es_principal: true })
        .eq('id', image.id);
      
      if (error) throw error;
      
      // Also update the main product image_url
      const table = image.product_type === 'inventory' ? 'inventory' : 'cliente_inventario';
      await supabase
        .from(table)
        .update({ imagen_url: image.image_url })
        .eq('id', image.product_id);
      
      return image;
    },
    onSuccess: (image) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-images', image.product_id, image.product_type] 
      });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['cliente-inventario'] });
      toast.success('Imagen principal actualizada');
    },
  });
}

export function useReorderImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      images, 
      productId, 
      productType 
    }: { 
      images: ProductImage[]; 
      productId: string;
      productType: 'inventory' | 'cliente_inventario';
    }) => {
      for (let i = 0; i < images.length; i++) {
        await supabase
          .from('product_images')
          .update({ orden: i })
          .eq('id', images[i].id);
      }
      return { productId, productType };
    },
    onSuccess: ({ productId, productType }) => {
      queryClient.invalidateQueries({ 
        queryKey: ['product-images', productId, productType] 
      });
    },
  });
}
