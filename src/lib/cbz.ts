import JSZip from 'jszip';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']);

function isImageFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
  return IMAGE_EXTS.has(ext);
}

export async function loadCbzAsImages(file: File): Promise<Array<{ name: string; data: Blob }>> {
  const zip = await JSZip.loadAsync(file);

  const entries = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && isImageFile(name))
    .sort();

  const results = await Promise.all(
    entries.map(async (name) => ({
      name,
      data: await zip.files[name].async('blob'),
    }))
  );

  return results;
}
