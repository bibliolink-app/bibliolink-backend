import { IsDefined, IsNotEmpty, IsString, IsStrongPassword, MaxLength } from 'class-validator';

export class CreateUserDto {
    @IsNotEmpty({ message: 'Username is required' })
    @IsString({ message: 'Username must be a string' })
    @IsDefined({ message: 'Username is required' })
    @MaxLength(50)
    userName: string

    @IsNotEmpty({ message: 'Name is required' })
    @IsString({ message: 'Name must be a string' })
    @IsDefined({ message: 'Name is required' })
    @MaxLength(50)
    name: string

    @IsString({ message: 'Second name must be a string' })
    @MaxLength(50)
    secondName?: string | null

    @IsNotEmpty({ message: 'First last name is required' })
    @IsString({ message: 'First last name must be a string' })
    @IsDefined({ message: 'First last name is required' })
    @MaxLength(50)
    firstLastName: string

    @IsNotEmpty({ message: 'Second last name is required' })
    @IsString({ message: 'Second last name must be a string' })
    @IsDefined({ message: 'Second last name is required' })
    @MaxLength(50)
    secondLastName?: string | null

    @IsNotEmpty({ message: 'Email is required' })
    @IsString({ message: 'Email must be a string' })
    @IsDefined({ message: 'Email is required' })
    @MaxLength(100)
    email: string

    @IsStrongPassword()
    password: string

    @IsNotEmpty({ message: 'Birth date is required' })
    @IsString({ message: 'Birth date must be a string' })
    @IsDefined({ message: 'Birth date is required' })
    birthDate: string
}