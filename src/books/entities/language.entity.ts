import { Column, Entity, PrimaryColumn, } from 'typeorm';

@Entity({ name: 'languages' })
export class Language {
    @PrimaryColumn({ name: 'language_code', type: 'varchar', length: 10, })
    languageCode!: string;

    @Column({ type: 'varchar', length: 100, })
    name!: string;
}