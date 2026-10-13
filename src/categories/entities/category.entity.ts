import { Column, Entity, PrimaryGeneratedColumn, } from 'typeorm';

import { BookCategoryCode } from '../../catalogs/enums/book-category-code.enum';

// Categoría de la taxonomía fija de BiblioLink. Las filas las crea una
// migración, nunca la importación de obras.
@Entity({ name: 'categories' })
export class Category {
    @PrimaryGeneratedColumn({ name: 'category_id', type: 'smallint', unsigned: true, })
    categoryId!: number;

    // Identificador estable que usan los proveedores y la API
    // (`science-fiction-fantasy`). Se guarda como texto y no como ENUM de
    // MySQL para que sumar una categoría sea solo insertar una fila.
    @Column({ type: 'varchar', length: 50, unique: true, })
    code!: BookCategoryCode;

    // Nombre en español que se muestra al usuario.
    @Column({ type: 'varchar', length: 150, unique: true, })
    name!: string;
}
