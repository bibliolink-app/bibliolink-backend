// Describe los datos necesarios para preparar el administrador inicial.
// Los segundos nombres y apellidos son opcionales.
export interface InitialSuperAdminSeed {
    firstName: string;
    middleName?: string;
    firstSurname: string;
    secondSurname?: string;
    identification: string;
    email: string;
    roleName: string;
}
