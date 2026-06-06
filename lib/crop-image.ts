export type CropPixels = { x: number; y: number; width: number; height: number }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = src
  })
}

/**
 * Render the saved image to a canvas and return a PNG blob.
 * - mode "crop": copies the selected crop rectangle into the output (no distortion).
 * - mode "stretch": stretches the entire source image to fill the output frame.
 */
export async function getCroppedBlob(
  imageSrc: string,
  mode: "crop" | "stretch",
  cropPixels: CropPixels | null,
  outWidth: number,
  outHeight: number,
): Promise<Blob> {
  const img = await loadImage(imageSrc)
  const canvas = document.createElement("canvas")
  canvas.width = outWidth
  canvas.height = outHeight
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas not supported")

  if (mode === "stretch" || !cropPixels) {
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, outWidth, outHeight)
  } else {
    ctx.drawImage(
      img,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      outWidth,
      outHeight,
    )
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not render image"))), "image/png", 0.92)
  })
}
