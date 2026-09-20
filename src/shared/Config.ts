/**
 * Config 3D (SHARED) — paleta e dimensões do mapa, fonte única
 * para servidor e cliente.
 */
export const ALTURA_PE = 12;
export const COR_PAREDE: [number, number, number] = [0.16, 0.17, 0.21];
export const SALAS: { nome: string; cor: [number, number, number] }[] = [
	{ nome: "Lobby", cor: [0.55, 0.57, 0.63] },
	{ nome: "Corredor", cor: [0.32, 0.33, 0.38] },
	{ nome: "SalaVerde", cor: [0.24, 0.55, 0.28] },
	{ nome: "SalaAzul", cor: [0.23, 0.43, 0.71] },
	{ nome: "SalaLaranja", cor: [0.71, 0.42, 0.16] },
	{ nome: "SalaRoxa", cor: [0.55, 0.35, 0.71] },
];
