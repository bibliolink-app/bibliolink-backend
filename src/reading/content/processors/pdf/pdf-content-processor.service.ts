import { Injectable, UnprocessableEntityException } from '@nestjs/common';

import { ReadingPageResponseDto } from '../../../dto/reading-page-response.dto';
import { ReadingContentType } from '../../../enums/reading-content-type.enum';
import { PDF_MAX_CANVAS_DIMENSION, PDF_MAX_CANVAS_PIXELS, PDF_RENDER_SCALE, } from '../../constants/reading-content.constants';

interface PdfCanvas {
    toDataURL(type?: string): string;
}

interface PdfCanvasAndContext {
    canvas: PdfCanvas;
    context: CanvasRenderingContext2D;
}

interface PdfCanvasFactory {
    create(width: number, height: number): PdfCanvasAndContext;
    destroy(canvasAndContext: PdfCanvasAndContext): void;
}

@Injectable()
export class PdfContentProcessorService {
    async process(pdf: Buffer, pageNumber: number): Promise<ReadingPageResponseDto> {
        if (pageNumber < 1) {
            throw new UnprocessableEntityException('El número de página debe ser mayor o igual a 1.');
        }

        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(pdf), });

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
                        content: canvasAndContext.canvas.toDataURL('image/png'),
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

            throw new UnprocessableEntityException('No fue posible procesar el contenido PDF.');
        } finally {
            await loadingTask.destroy();
        }
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