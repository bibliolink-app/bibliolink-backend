import type { MigrationInterface, QueryRunner } from 'typeorm';

// Crea el catálogo de categorías y su tabla puente con `books`.
// Las obras ya importadas quedan sin categorías: se completan al volver
// a importarlas, igual que pasó con `content_format`.
export class AddCategories1791302700856 implements MigrationInterface {
    name = 'AddCategories1791302700856';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'CREATE TABLE `categories` (' +
            '`category_id` SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT, ' +
            '`name` VARCHAR(150) NOT NULL, ' +
            'PRIMARY KEY (`category_id`), ' +
            'UNIQUE INDEX `UQ_categories_name` (`name`)' +
            ') ENGINE=InnoDB',
        );

        await queryRunner.query(
            'CREATE TABLE `book_categories` (' +
            '`book_id` INT UNSIGNED NOT NULL, ' +
            '`category_id` SMALLINT UNSIGNED NOT NULL, ' +
            'PRIMARY KEY (`book_id`, `category_id`), ' +
            'INDEX `IDX_book_categories_category_id` (`category_id`), ' +
            'CONSTRAINT `FK_book_categories_book_id` FOREIGN KEY (`book_id`) ' +
            'REFERENCES `books` (`book_id`) ON DELETE CASCADE, ' +
            'CONSTRAINT `FK_book_categories_category_id` FOREIGN KEY (`category_id`) ' +
            'REFERENCES `categories` (`category_id`) ON DELETE CASCADE' +
            ') ENGINE=InnoDB',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE `book_categories`');
        await queryRunner.query('DROP TABLE `categories`');
    }
}