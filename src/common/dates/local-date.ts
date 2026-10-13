import { BadRequestException } from '@nestjs/common';

type LocalDateParts = {
    year: number;
    month: number;
    day: number;
};

function isLeapYear(year: number): boolean {
    return (
        year % 4 === 0 &&
        (year % 100 !== 0 || year % 400 === 0)
    );
}

function getDaysInMonth(year: number, month: number): number {
    switch (month) {
        case 2:
            return isLeapYear(year) ? 29 : 28;

        case 4:
        case 6:
        case 9:
        case 11:
            return 30;

        default:
            return 31;
    }
}

function isValidParts(parts: LocalDateParts): boolean {
    if (parts.month < 1 || parts.month > 12) {
        return false;
    }

    if (parts.day < 1) {
        return false;
    }

    return parts.day <= getDaysInMonth(
        parts.year,
        parts.month,
    );
}

export function normalizeLocalDate(value: unknown): string {
    if (typeof value !== 'string') {
        throw new BadRequestException(
            'La fecha debe ser una cadena de texto.',
        );
    }

    const trimmed = value.trim();

    if (!trimmed) {
        throw new BadRequestException(
            'La fecha no puede estar vacía.',
        );
    }

    const match = trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})$/,
    );

    if (!match) {
        throw new BadRequestException(
            `Fecha inválida ("${trimmed}"). El formato válido es YYYY-MM-DD.`,
        );
    }

    const parts: LocalDateParts = {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
    };

    if (!isValidParts(parts)) {
        throw new BadRequestException(
            `La fecha "${trimmed}" no existe.`,
        );
    }

    return trimmed;
}