import type { MigrationInterface, QueryRunner } from 'typeorm';

// Agrega a `books` el formato del recurso de `content_reference`.
//
// Los valores del ENUM se copian aquí en lugar de importar
// `BookContentFormat`: una migración debe describir el esquema tal como era
// al escribirla, aunque el enum cambie después.
//
// Las obras ya guardadas quedan con `NULL`: su formato no se deduce de la
// extensión de la URL. Se completa al volver a importarlas.
export class AddBookContentFormat1791216300856 implements MigrationInterface {
    name = 'AddBookContentFormat1791216300856';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TABLE `books` ADD `content_format` ENUM('PDF', 'EPUB', 'HTML', 'TEXT', 'EXTERNAL_PAGE', 'UNSUPPORTED') NULL AFTER `content_reference`",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE `books` DROP COLUMN `content_format`',
        );
    }
}
