import type { MigrationInterface, QueryRunner } from 'typeorm';

// Reemplaza las categorías libres (los descriptores tal como los publicaba
// cada proveedor) por la taxonomía fija de BiblioLink.
//
// Las filas actuales de `categories` y `book_categories` se borran: eran
// datos derivados de la importación y se regeneran ya traducidos al volver a
// importar las obras (`POST /books/import/all` o una importación puntual).
//
// Las categorías se copian aquí en lugar de importar `BookCategoryCode`: una
// migración debe describir el esquema tal como era al escribirla. Cada código
// tiene que coincidir con el enum.
const CATEGORIES: readonly (readonly [code: string, name: string])[] = [
    // Literatura
    ['fiction', 'Ficción'],
    ['classics', 'Clásicos de la literatura'],
    ['science-fiction-fantasy', 'Ciencia ficción y fantasía'],
    ['mystery-thriller', 'Misterio y suspenso'],
    ['horror', 'Terror'],
    ['romance', 'Romance'],
    ['adventure', 'Aventura'],
    ['historical-fiction', 'Novela histórica'],
    ['short-stories', 'Cuentos y relatos'],
    ['poetry', 'Poesía'],
    ['drama', 'Teatro'],
    ['humor', 'Humor y sátira'],
    ['mythology-folklore', 'Mitología y folclore'],
    ['children-young-adult', 'Infantil y juvenil'],
    ['essays', 'Ensayos, cartas y discursos'],

    // No ficción y académico
    ['biography', 'Biografías y memorias'],
    ['history', 'Historia'],
    ['philosophy-religion', 'Filosofía y religión'],
    ['social-sciences', 'Ciencias sociales y política'],
    ['economics-business', 'Economía y negocios'],
    ['natural-sciences', 'Ciencias naturales'],
    ['mathematics', 'Matemáticas y estadística'],
    ['technology', 'Tecnología e informática'],
    ['health', 'Medicina y salud'],
    ['arts', 'Arte y música'],
    ['language-education', 'Lengua, educación y referencia'],
    ['travel', 'Viajes'],
    ['lifestyle', 'Hogar, naturaleza y pasatiempos'],
];

export class ReplaceCategoriesWithTaxonomy1791393184403 implements MigrationInterface {
    name = 'ReplaceCategoriesWithTaxonomy1791393184403';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DELETE FROM `book_categories`');
        await queryRunner.query('DELETE FROM `categories`');

        await queryRunner.query(
            'ALTER TABLE `categories` ' +
            'ADD `code` VARCHAR(50) NOT NULL AFTER `category_id`, ' +
            'ADD UNIQUE INDEX `UQ_categories_code` (`code`)',
        );

        await queryRunner.query(
            'INSERT INTO `categories` (`code`, `name`) VALUES ' +
            CATEGORIES.map(() => '(?, ?)').join(', '),
            CATEGORIES.flat(),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Vuelve a la tabla de nombres libres, vacía: las categorías que
        // existían antes de esta migración no se pueden reconstruir.
        await queryRunner.query('DELETE FROM `book_categories`');
        await queryRunner.query('DELETE FROM `categories`');

        await queryRunner.query(
            'ALTER TABLE `categories` ' +
            'DROP INDEX `UQ_categories_code`, ' +
            'DROP COLUMN `code`',
        );
    }
}
