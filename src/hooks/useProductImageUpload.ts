import { supabase } from '@/integrations/supabase/client';

export async function uploadProductImage(
  file: File, 
  userId: string, 
  sku: string
): Promise<string | null> {
  try {
    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${sku}-${Date.now()}.${fileExt}`;
    
    // Upload to storage
    const { data, error } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });
    
    if (error) {
      console.error('Error uploading image:', error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export function validateImageUrl(url: string): boolean {
  if (!url || url.trim() === '') return true; // Empty is valid (optional field)
  
  try {
    const parsed = new URL(url);
    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    // Check for common image extensions or known image hosts
    const path = parsed.pathname.toLowerCase();
    const isImageExtension = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i.test(path);
    const isKnownImageHost = [
      'images.unsplash.com',
      'imgur.com',
      'i.imgur.com',
      'cloudinary.com',
      'res.cloudinary.com',
      'storage.googleapis.com',
      's3.amazonaws.com',
    ].some(host => parsed.hostname.includes(host));
    
    // Accept if it has image extension or is from known host, or just accept any https URL
    return parsed.protocol === 'https:' || isImageExtension || isKnownImageHost;
  } catch {
    return false;
  }
}

export function isValidImageFile(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const maxSize = 5 * 1024 * 1024; // 5MB
  
  return validTypes.includes(file.type) && file.size <= maxSize;
}
