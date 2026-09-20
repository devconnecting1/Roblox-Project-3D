/**
 * Configuração do gerador procedural Backrooms Level 0.
 */
export const SEED = 42;

// Chunk
export const CHUNK_TAM = 64;
export const TILE_TAM = 8;
export const TILES_POR_CHUNK = CHUNK_TAM / TILE_TAM;

// Geração
export const GERAR_RAIO = 3;
export const DESCARTAR_RAIO = 5;
export const ALTURA = 11;
export const MAX_SALAS_SUP = 30;
export const MAX_SALAS_SUB = 20;

// Pesos dos módulos
export const MODOS: Record<string, number> = {
	room: 65,
	hall: 12,
	largRoom: 5,
	pilar: 5,
	deadEnd: 3,
	stair: 8,
	blackout: 2,
};

// Visual Backrooms
export const COR_PAREDE: [number, number, number] = [0.76, 0.7, 0.42];
export const COR_PAREDE2: [number, number, number] = [0.72, 0.66, 0.38];
export const COR_CHAO: [number, number, number] = [0.55, 0.48, 0.32];
export const COR_TETO: [number, number, number] = [0.85, 0.83, 0.75];
export const COR_LUZ: [number, number, number] = [1, 0.97, 0.9];
