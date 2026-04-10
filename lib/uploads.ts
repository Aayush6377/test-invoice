import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export async function uploadImage( file: File, subfolder: string = "" ): Promise<{ url: string | null; error: string | null }> {
  try {
    if (!file) {
      return { url: null, error: "No file provided for upload" };
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueFilename = `${Date.now()}-${sanitizedName}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", subfolder);

    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, uniqueFilename);

    await writeFile(filePath, buffer);

    const publicUrl = subfolder ? `/uploads/${subfolder}/${uniqueFilename}` : `/uploads/${uniqueFilename}`;

    return { url: publicUrl, error: null };
  } catch {
    return { url: null, error: "Failed to save the image to the server." };
  }
}

export async function deleteImage(fileUrl: string): Promise<{ success: boolean; error: string | null }> {
  try {
    if (!fileUrl) {
      return { success: false, error: "No file URL provided." };
    }

    const relativePath = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    await unlink(absolutePath);

    return { success: true, error: null };
  } catch {
    return { success: false, error: "Failed to delete the image" };
  }
}