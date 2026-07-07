/** Public URL for a path in the `photos` bucket (bucket is public-read). */
export function photoUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}

export function ticketPhotoPath(shopId: string, ticketId: string, fileName: string): string {
  return `shops/${shopId}/tickets/${ticketId}/${fileName}`;
}

export function logoPath(shopId: string, fileName: string): string {
  return `shops/${shopId}/logo/${fileName}`;
}
