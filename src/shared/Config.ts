/**
 * Configuração da geração procedural (SHARED).
 * Mesmo seed = mesmo mapa em todas as máquinas.
 */
export const SEED = 42;

// Salas
export const ALTURA = 12;
export const TAM_LOBBY = 36;
export const TAM_SALA = [14, 22, 32] as const; // pequena / média / grande
export const PORTA_LARG = 8;
export const SALAS_MAX = 30;
export const CBASE = 0;

// Escadas → subsolo
export const PROFUNDIDADE = -16; // Y do subsolo
export const CHANCE_ESCADA = 0.35; // 35% das salas grandes ganham escada
