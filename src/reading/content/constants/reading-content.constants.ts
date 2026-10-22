export const TARGET_PAGE_CHARACTERS = 6_000;

export const PDF_RENDER_SCALE = 1.5;
export const PDF_MAX_CANVAS_DIMENSION = 8_192;
export const PDF_MAX_CANVAS_PIXELS = 16_777_216;

// Calidades JPEG que se prueban, de mayor a menor, hasta que la página entra
// en el límite de respuesta.
export const PDF_JPEG_QUALITIES = [0.85, 0.7, 0.5] as const;

// Tamaño máximo de la imagen (data URL en base64) de una página. Vercel corta
// las respuestas de más de 4.5 MB; se deja margen para el resto del JSON.
export const PDF_MAX_IMAGE_DATA_URL_LENGTH = 4_000_000;
