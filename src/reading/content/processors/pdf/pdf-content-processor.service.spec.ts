import { UnprocessableEntityException } from '@nestjs/common';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { ReadingContentType } from '../../../enums/reading-content-type.enum';
import { PDF_MAX_IMAGE_DATA_URL_LENGTH } from '../../constants/reading-content.constants';
import { PdfContentProcessorService } from './pdf-content-processor.service';

// PDF de una página con texto en Helvetica sin incrustar: obliga a PDF.js a
// usar sus fuentes estándar.
function helveticaPdf(): Buffer {
    const stream = 'BT /F1 24 Tf 40 100 Td (Hola BiblioLink) Tj ET';
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((object, index) => {
        offsets.push(pdf.length);
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(pdf, 'latin1');
}

function createService() {
    const logger = { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() };
    const service = new PdfContentProcessorService(logger as unknown as PinoLogger);
    return { service, logger };
}

describe('PdfContentProcessorService', () => {
    it('devuelve la página como imagen JPEG', async () => {
        const { service } = createService();
        const page = await service.process(helveticaPdf(), 1);

        expect(page.contentType).toBe(ReadingContentType.IMAGE);
        expect(page.content.startsWith('data:image/jpeg;base64,')).toBe(true);
        expect(page.hasNextPage).toBe(false);
    }, 30_000);

    it('rechaza páginas que no existen', async () => {
        const { service } = createService();
        await expect(service.process(helveticaPdf(), 0)).rejects.toBeInstanceOf(UnprocessableEntityException);
        await expect(service.process(helveticaPdf(), 2)).rejects.toThrow('La página solicitada no existe.');
    }, 30_000);

    it('registra la causa real cuando el PDF no se puede procesar', async () => {
        const { service, logger } = createService();
        await expect(service.process(Buffer.from('esto no es un pdf'), 1))
            .rejects.toThrow('No fue posible procesar el contenido PDF.');

        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ reason: expect.stringContaining('Invalid PDF structure') }),
            'PDF page processing failed',
        );
    }, 30_000);

    describe('tamaño de la imagen', () => {
        // Canvas falso: el tamaño del data URL depende de la calidad pedida.
        const canvasOfSize = (sizeByQuality: Record<number, number>) => ({
            toDataURL: vi.fn((_type: string, quality = 1) => 'x'.repeat(sizeByQuality[quality] ?? 0)),
        });
        const encode = (service: PdfContentProcessorService, canvas: unknown) =>
            (service as unknown as { encodePage(canvas: unknown): string }).encodePage(canvas);

        it('baja la calidad hasta que la página entra en el límite', () => {
            const { service } = createService();
            const canvas = canvasOfSize({ 0.85: PDF_MAX_IMAGE_DATA_URL_LENGTH + 1, 0.7: 1_000 });

            expect(encode(service, canvas)).toHaveLength(1_000);
            expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
            expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.7);
        });

        it('rechaza la página si ni con la calidad mínima entra', () => {
            const { service } = createService();
            const tooBig = PDF_MAX_IMAGE_DATA_URL_LENGTH + 1;
            const canvas = canvasOfSize({ 0.85: tooBig, 0.7: tooBig, 0.5: tooBig });

            expect(() => encode(service, canvas)).toThrow('La página PDF es demasiado grande para mostrarse.');
        });
    });
});
