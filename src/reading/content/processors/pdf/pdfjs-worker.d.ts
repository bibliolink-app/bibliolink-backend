// `pdfjs-dist` no publica tipos para el worker. Solo se usa para registrarlo
// en `globalThis.pdfjsWorker`, así que basta con declarar lo que exporta.
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
    export const WorkerMessageHandler: unknown;
}
