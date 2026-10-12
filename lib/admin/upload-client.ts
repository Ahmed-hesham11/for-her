// Browser-side upload to this server's own disk (see app/api/admin/upload).
// Sends the file as the raw request body so large videos stream through.
export async function uploadMedia(file: File, folder: "products" | "categories" | "orders"): Promise<{ url: string | null; error: string | null }> {
  try {
    const response = await fetch(`/api/admin/upload?folder=${folder}&name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url) return { url: null, error: data?.error ?? "تعذّر رفع الملف الآن." };
    return { url: data.url, error: null };
  } catch {
    return { url: null, error: "تعذّر رفع الملف الآن." };
  }
}
