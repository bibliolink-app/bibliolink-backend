// PDF.js dibuja las páginas con `@napi-rs/canvas`, pero lo carga con
// `createRequire(...)("@napi-rs/canvas")`, una ruta que el rastreo de archivos
// de Vercel no puede seguir. Importarlo aquí lo hace visible para el rastreo
// (y entra el binario nativo de la plataforma). Además tiene que cargarse antes
// que PDF.js, que lo usa al importarse.
import '@napi-rs/canvas';

import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { dirname, join } from 'node:path';

import { ReadingPageResponseDto } from '../../../dto/reading-page-response.dto';
import { ReadingContentType } from '../../../enums/reading-content-type.enum';
import { PDF_JPEG_QUALITIES, PDF_MAX_CANVAS_DIMENSION, PDF_MAX_CANVAS_PIXELS, PDF_MAX_IMAGE_DATA_URL_LENGTH, PDF_RENDER_SCALE, } from '../../constants/reading-content.constants';

interface PdfCanvas {
    toDataURL(type: string, quality?: number): string;
}

interface PdfCanvasAndContext {
    canvas: PdfCanvas;
    context: CanvasRenderingContext2D;
}

interface PdfCanvasFactory {
    create(width: number, height: number): PdfCanvasAndContext;
    destroy(canvasAndContext: PdfCanvasAndContext): void;
}

// Carpetas de datos de PDF.js: fuentes estándar (las que un PDF usa sin
// incrustar, como Helvetica) y decodificadores `.wasm` (JPEG 2000, JBIG2).
// PDF.js las lee del disco y exige la barra final. Se calculan con
// `require.resolve` para que el rastreo de Vercel también las incluya.
const PDFJS_ROOT = dirname(require.resolve('pdfjs-dist/package.json'));
const PDFJS_STANDARD_FONTS_URL = `${join(PDFJS_ROOT, 'standard_fonts')}/`;
const PDFJS_WASM_URL = `${join(PDFJS_ROOT, 'wasm')}/`;

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

@Injectable()
export class PdfContentProcessorService {
    private pdfjs: Promise<PdfjsModule> | null = null;

    constructor(
        @InjectPinoLogger(PdfContentProcessorService.name)
        private readonly logger: PinoLogger,
    ) { }

    async process(pdf: Buffer, pageNumber: number): Promise<ReadingPageResponseDto> {
        if (pageNumber < 1) {
            throw new UnprocessableEntityException('El número de página debe ser mayor o igual a 1.');
        }

        const pdfjs = await this.loadPdfjs();
        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(pdf),
            standardFontDataUrl: PDFJS_STANDARD_FONTS_URL,
            wasmUrl: PDFJS_WASM_URL,
        });

        try {
            const document = await loadingTask.promise;

            if (pageNumber > document.numPages) {
                throw new UnprocessableEntityException('La página solicitada no existe.');
            }

            const page = await document.getPage(pageNumber);

            try {
                const viewport = page.getViewport({ scale: PDF_RENDER_SCALE, });
                const width = Math.ceil(viewport.width);
                const height = Math.ceil(viewport.height);

                this.ensureValidCanvasSize(width, height);

                const canvasFactory = document.canvasFactory;

                if (!this.isPdfCanvasFactory(canvasFactory)) {
                    throw new UnprocessableEntityException('No fue posible inicializar el renderizador PDF.');
                }

                const canvasAndContext = canvasFactory.create(width, height);

                try {
                    await page.render({
                        canvas: null,
                        canvasContext: canvasAndContext.context,
                        viewport,
                    }).promise;

                    return {
                        pageNumber,
                        contentType: ReadingContentType.IMAGE,
                        content: this.encodePage(canvasAndContext.canvas),
                        hasNextPage: pageNumber < document.numPages,
                    };
                } finally {
                    canvasFactory.destroy(canvasAndContext);
                }
            } finally {
                page.cleanup();
            }
        } catch (error: unknown) {
            if (error instanceof UnprocessableEntityException) {
                throw error;
            }

            // El cliente recibe un mensaje genérico, pero la causa queda en los
            // logs: sin esto, una falla de empaquetado (canvas o worker
            // ausentes) solo se ve como un 422 sin explicación.
            this.logger.error(
                {
                    err: error,
                    reason: error instanceof Error ? error.message.slice(0, 500) : String(error),
                    pageNumber,
                },
                'PDF page processing failed',
            );

            throw new UnprocessableEntityException('No fue posible procesar el contenido PDF.');
        } finally {
            await loadingTask.destroy();
        }
    }

    // Carga PDF.js una sola vez por instancia. El worker se importa con un
    // texto fijo y se registra en `globalThis.pdfjsWorker`: en Node, PDF.js
    // corre el worker en el mismo hilo y, si no lo encuentra registrado, lo
    // importa con una ruta calculada que Vercel no empaqueta.
    private loadPdfjs(): Promise<PdfjsModule> {
        this.pdfjs ??= (async () => {
            const [pdfjs, worker] = await Promise.all([
                import('pdfjs-dist/legacy/build/pdf.mjs'),
                import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
            ]);

            (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker ??= worker;

            return pdfjs;
        })().catch((error: unknown) => {
            // Si la carga falla, se permite reintentar en la próxima página.
            this.pdfjs = null;
            throw error;
        });

        return this.pdfjs;
    }

    // Codifica la página como JPEG. PNG ocupaba hasta 5 MB en páginas con
    // fotos o escaneos, y Vercel corta las respuestas de más de 4.5 MB. Se baja
    // la calidad hasta que entra; si ni así entra, la página no se puede servir.
    private encodePage(canvas: PdfCanvas): string {
        for (const quality of PDF_JPEG_QUALITIES) {
            const dataUrl = canvas.toDataURL('image/jpeg', quality);

            if (dataUrl.length <= PDF_MAX_IMAGE_DATA_URL_LENGTH) {
                return dataUrl;
            }
        }

        throw new UnprocessableEntityException('La página PDF es demasiado grande para mostrarse.');
    }

    private isPdfCanvasFactory(value: object): value is PdfCanvasFactory {
        return (
            'create' in value &&
            typeof value.create === 'function' &&
            'destroy' in value &&
            typeof value.destroy === 'function'
        );
    }

    private ensureValidCanvasSize(width: number, height: number): void {
        const exceedsDimension =
            width <= 0 ||
            height <= 0 ||
            width > PDF_MAX_CANVAS_DIMENSION ||
            height > PDF_MAX_CANVAS_DIMENSION;

        const exceedsArea = width * height > PDF_MAX_CANVAS_PIXELS;

        if (exceedsDimension || exceedsArea) {
            throw new UnprocessableEntityException('La página PDF excede las dimensiones permitidas.');
        }
    }
}
