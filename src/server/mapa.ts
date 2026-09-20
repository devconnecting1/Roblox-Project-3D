/**
 * Mapa 3D procedural determinístico — sala inicial grande + salas ramificadas
 * + escadas para salas secretas subterrâneas.
 *
 * Zero Interface. Material = Plastic apenas. Sem imóveis estáticos.
 * Mesmo seed = mesmo mapa sempre (Minecraft-style).
 */
import { Lighting, Workspace } from "@rbxts/services";
import {
	SEED,
	ALTURA,
	TAM_LOBBY,
	TAM_SALA,
	PORTA_LARG,
	SALAS_MAX,
	PROFUNDIDADE,
	CHANCE_ESCADA,
	CBASE,
} from "shared/Config";
import { RNG } from "shared/RNG";

const rng = new RNG(SEED);

interface Sala {
	id: number;
	tipo: "pequena" | "media" | "grande";
	larg: number;
	prof: number;
	cx: number;
	cz: number;
	cy: number; // 0 = superfície, < 0 = subsolo
	portas: [number, number][]; // [centro, largura] por parede
	subsolos: number; // quantos sub-salos este tipo gerou
}

const salas: Sala[] = [];
let idGlobal = 0;

// --- Helpers ---

function bloco(
	nome: string,
	tam: Vector3,
	pos: Vector3,
	cor: Color3,
	mat: Enum.Material = Enum.Material.Plastic,
): Part {
	const p = new Instance("Part");
	p.Name = nome;
	p.Size = tam;
	p.Position = pos;
	p.Color = cor;
	p.Material = mat;
	p.Anchored = true;
	p.CanCollide = true;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = Workspace;
	return p;
}

function corSala(tipo: string): Color3 {
	const cores: Record<string, [number, number, number]> = {
		pequena: [0.42, 0.4, 0.37],
		media: [0.35, 0.38, 0.42],
		grande: [0.28, 0.3, 0.34],
	};
	const c = cores[tipo] ?? [0.35, 0.35, 0.35];
	return new Color3(c[0], c[1], c[2]);
}

function corParede(tipo: string): Color3 {
	const cores: Record<string, [number, number, number]> = {
		pequena: [0.33, 0.31, 0.29],
		media: [0.27, 0.29, 0.33],
		grande: [0.22, 0.24, 0.28],
	};
	const c = cores[tipo] ?? [0.3, 0.3, 0.3];
	return new Color3(c[0], c[1], c[2]);
}

function salaNome(s: Sala): string {
	return `${s.id}_${s.tipo}_${s.cy < 0 ? "sub" : "sup"}`;
}

/** Collision check AABB (ignora eixo Y). */
function colide(cx: number, cz: number, larg: number, prof: number, ignorarId: number): boolean {
	for (const s of salas) {
		if (s.id === ignorarId) {
			continue;
		}
		if (math.abs(cx - s.cx) < (larg + s.larg) / 2 + 2 && math.abs(cz - s.cz) < (prof + s.prof) / 2 + 2) {
			return true;
		}
	}
	return false;
}

// --- Construção de sala ---

function construirSala(s: Sala): void {
	const x0 = s.cx - s.larg / 2;
	const x1 = s.cx + s.larg / 2;
	const z0 = s.cz - s.prof / 2;
	const z1 = s.cz + s.prof / 2;
	const base = s.cy;
	const nome = salaNome(s);
	const paredeCor = corParede(s.tipo);
	const chaoCor = corSala(s.tipo);

	// Chão
	bloco(`${nome}_Chao`, new Vector3(s.larg + 2, 2, s.prof + 2), new Vector3(s.cx, base - 1, s.cz), chaoCor);
	// Teto
	bloco(
		`${nome}_Teto`,
		new Vector3(s.larg + 2, 2, s.prof + 2),
		new Vector3(s.cx, base + ALTURA + 1, s.cz),
		new Color3(0.18, 0.19, 0.22),
	);

	// Paredes: segmentos ao longo de X (norte/sul) e Z (oeste/leste)
	const larguraParede = 2;
	const h = ALTURA / 2 + base;

	// Norte (z0) — vãos = [centroX, largura]
	const nOrd = [...s.portas].sort((a, b) => a[0] < b[0]);
	let curX = x0;
	for (const [c, l] of nOrd) {
		const ate = c - l / 2;
		if (ate > curX) {
			bloco(
				`${nome}_N_${curX}`,
				new Vector3(ate - curX, ALTURA, larguraParede),
				new Vector3((curX + ate) / 2, h, z0),
				paredeCor,
			);
		}
		curX = c + l / 2;
	}
	if (curX < x1) {
		bloco(`${nome}_N_F`, new Vector3(x1 - curX, ALTURA, larguraParede), new Vector3((curX + x1) / 2, h, z0), paredeCor);
	}

	// Sul (z1)
	curX = x0;
	for (const [c, l] of nOrd) {
		const ate = c - l / 2;
		if (ate > curX) {
			bloco(
				`${nome}_S_${curX}`,
				new Vector3(ate - curX, ALTURA, larguraParede),
				new Vector3((curX + ate) / 2, h, z1),
				paredeCor,
			);
		}
		curX = c + l / 2;
	}
	if (curX < x1) {
		bloco(`${nome}_S_F`, new Vector3(x1 - curX, ALTURA, larguraParede), new Vector3((curX + x1) / 2, h, z1), paredeCor);
	}

	// Oeste (x0) — vãos = [centroZ, largura]
	const oOrd = [...s.portas].sort((a, b) => a[0] < b[0]);
	let curZ = z0;
	for (const [c, l] of oOrd) {
		const ate = c - l / 2;
		if (ate > curZ) {
			bloco(
				`${nome}_W_${curZ}`,
				new Vector3(larguraParede, ALTURA, ate - curZ),
				new Vector3(x0, h, (curZ + ate) / 2),
				paredeCor,
			);
		}
		curZ = c + l / 2;
	}
	if (curZ < z1) {
		bloco(`${nome}_W_F`, new Vector3(larguraParede, ALTURA, z1 - curZ), new Vector3(x0, h, (curZ + z1) / 2), paredeCor);
	}

	// Leste (x1)
	curZ = z0;
	for (const [c, l] of oOrd) {
		const ate = c - l / 2;
		if (ate > curZ) {
			bloco(
				`${nome}_E_${curZ}`,
				new Vector3(larguraParede, ALTURA, ate - curZ),
				new Vector3(x1, h, (curZ + ate) / 2),
				paredeCor,
			);
		}
		curZ = c + l / 2;
	}
	if (curZ < z1) {
		bloco(`${nome}_E_F`, new Vector3(larguraParede, ALTURA, z1 - curZ), new Vector3(x1, h, (curZ + z1) / 2), paredeCor);
	}

	// Luzes pontuais
	if (s.larg >= 20) {
		const cols = s.larg >= 30 ? 3 : 2;
		const filas = s.prof >= 30 ? 3 : 2;
		for (let i = 0; i < cols; i++) {
			for (let j = 0; j < filas; j++) {
				const lx = x0 + (s.larg * (i + 1)) / (cols + 1);
				const lz = z0 + (s.prof * (j + 1)) / (filas + 1);
				const lamp = bloco(
					`${nome}_Lamp_${i}_${j}`,
					new Vector3(2, 1, 2),
					new Vector3(lx, base + ALTURA - 1, lz),
					new Color3(0, 0, 0),
				);
				lamp.Transparency = 1;
				lamp.CanCollide = false;
				const pl = new Instance("PointLight");
				pl.Color = new Color3(1, 0.93, 0.78);
				pl.Range = 30;
				pl.Brightness = 1.5;
				pl.Shadows = false;
				pl.Parent = lamp;
			}
		}
	} else {
		const lamp = bloco(
			`${nome}_Lamp`,
			new Vector3(2, 1, 2),
			new Vector3(s.cx, base + ALTURA - 1, s.cz),
			new Color3(0, 0, 0),
		);
		lamp.Transparency = 1;
		lamp.CanCollide = false;
		const pl = new Instance("PointLight");
		pl.Color = new Color3(1, 0.93, 0.78);
		pl.Range = 22;
		pl.Brightness = 1.5;
		pl.Shadows = false;
		pl.Parent = lamp;
	}
}

// --- Escadas / subsolo ---

function construirEscada(s: Sala): void {
	const nome = salaNome(s);
	// Escada no canto sudoeste da sala
	const sx = s.cx - s.larg / 2 + 4;
	const sz = s.cz - s.prof / 2 + 4;
	const base = s.cy;
	const degraus = 6;
	const dx = 2.4;
	const dz = 2;
	const dy = -math.abs(PROFUNDIDADE - base) / degraus;

	// Poço no chão (vazio)
	bloco(
		`${nome}_Poco`,
		new Vector3(dx * degraus + 2, 2, dz + 2),
		new Vector3(sx + (degraus * dx) / 2, base - 1, sz),
		new Color3(0.12, 0.12, 0.14),
	);

	// Degraus
	for (let i = 0; i < degraus; i++) {
		bloco(
			`${nome}_Deg_${i}`,
			new Vector3(dx, 1, dz),
			new Vector3(sx + i * dx, base + i * dy + 0.5, sz),
			new Color3(0.25, 0.25, 0.28),
		);
	}

	// Guarda-corpo lateral (2 barras)
	for (let i = 0; i < degraus; i++) {
		bloco(
			`${nome}_Grd_${i}`,
			new Vector3(0.6, 2.5, 0.6),
			new Vector3(sx + i * dx - 1.5, base + i * dy + 1.5, sz),
			new Color3(0.4, 0.4, 0.45),
		);
	}

	// Sala secreta no subsolo (tamanho aleatório pequeno/médio)
	const subLarg = rng.nextInt(14, 26);
	const subProf = rng.nextInt(14, 26);
	const subCx = sx + degraus * dx + subLarg / 2 + 4;
	const subCz = sz;
	const subCy = PROFUNDIDADE;

	if (!colide(subCx, subCz, subLarg, subProf, -1)) {
		const sub: Sala = {
			id: ++idGlobal,
			tipo: subLarg >= 22 ? "media" : "pequena",
			larg: subLarg,
			prof: subProf,
			cx: subCx,
			cz: subCz,
			cy: subCy,
			portas: [],
			subsolos: 0,
		};
		salas.push(sub);
		construirSala(sub);

		// Conecta poço da escada com a sub-sala (corredor subterrâneo)
		const connLarg = math.abs(subCx - sx - degraus * dx) + 4;
		const connCx = (sx + degraus * dx + subCx) / 2;
		bloco(
			`${nome}_Conn_${sub.id}`,
			new Vector3(connLarg, ALTURA, dz + 2),
			new Vector3(connCx, subCy + ALTURA / 2, sz),
			corParede(sub.tipo),
		);
	}
}

// --- Geração procedural principal ---

function gerar(): void {
	const tamTipos = TAM_SALA as unknown as number[];
	const tipoNomes = ["pequena", "media", "grande"] as const;

	// Limpa Workspace
	for (const c of Workspace.GetChildren()) {
		if (c.IsA("BasePart") || c.IsA("Model")) {
			c.Destroy();
		}
	}

	// Clima
	Lighting.Ambient = new Color3(0.08, 0.08, 0.1);
	Lighting.OutdoorAmbient = new Color3(0.08, 0.08, 0.1);
	Lighting.FogStart = 50;
	Lighting.FogEnd = 200;
	Lighting.GlobalShadows = true;
	Lighting.Brightness = 0.8;

	salas.clear();
	idGlobal = 0;

	// 1. Lobby central (grande)
	const lobby: Sala = {
		id: ++idGlobal,
		tipo: "grande",
		larg: TAM_LOBBY,
		prof: TAM_LOBBY,
		cx: 0,
		cz: 0,
		cy: 0,
		portas: [[0, PORTA_LARG]],
		subsolos: 0,
	};
	salas.push(lobby);
	construirSala(lobby);

	// Spawn
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "Spawn";
	spawn.Size = new Vector3(6, 1, 6);
	spawn.Position = new Vector3(0, 1, 10);
	spawn.Color = new Color3(0.55, 0.57, 0.6);
	spawn.Material = Enum.Material.Plastic;
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.TopSurface = Enum.SurfaceType.Smooth;
	spawn.BottomSurface = Enum.SurfaceType.Smooth;
	spawn.Parent = Workspace;

	// 2. Ramificações a partir das portas
	type Candidato = {
		salaRef: Sala;
		portaIdx: number; // índice da porta na parede
		eixoX: boolean; // true = porta nas paredes Leste/Oeste (eixo X)
		lado: number; // +1 ou -1: direção de saída
	};

	const candidatos: Candidato[] = [];
	for (const dir of [1, -1]) {
		for (let i = 0; i < 2; i++) {
			candidatos.push({ salaRef: lobby, portaIdx: i, eixoX: i === 0, lado: dir });
		}
	}

	let tentativas = 0;
	while (salas.size() < SALAS_MAX && candidatos.size() > 0 && tentativas < 200) {
		tentativas++;
		const idx = rng.nextInt(0, candidatos.size() - 1);
		const cand = candidatos[idx];
		candidatos.remove(idx);

		const ref = cand.salaRef;
		// Posição da porta na parede
		const portasRef = cand.eixoX ? ref.portas : ref.portas;
		const pc = portasRef[cand.portaIdx] ?? [0, PORTA_LARG];
		const portaCentro = pc[0];
		const portaLarg = math.min(pc[1], PORTA_LARG);

		// Tamanho da nova sala
		const tipoIdx = rng.nextInt(0, 2);
		const novoLarg = tamTipos[tipoIdx];
		const novoProf = tamTipos[tipoIdx];
		const novoTipo = tipoNomes[tipoIdx];

		// Direção de saída: 4 eixos (N/S/E/W)
		const dirs = cand.eixoX
			? [
					{ eixoX: true, lado: 1 }, // Leste
					{ eixoX: true, lado: -1 }, // Oeste
					{ eixoX: false, lado: 1 }, // Sul
					{ eixoX: false, lado: -1 }, // Norte
				]
			: [
					{ eixoX: false, lado: 1 },
					{ eixoX: false, lado: -1 },
					{ eixoX: true, lado: 1 },
					{ eixoX: true, lado: -1 },
				];
		rng.choose(dirs); // escolhe uma direção aleatória

		let novoCx: number;
		let novoCz: number;
		if (cand.eixoX) {
			// Porta nas paredes Leste/Oeste da ref
			novoCx = ref.cx + cand.lado * ((ref.larg + novoLarg) / 2 + 2);
			novoCz = ref.cz + portaCentro;
		} else {
			// Porta nas paredes Norte/Sul da ref
			novoCx = ref.cx + portaCentro;
			novoCz = ref.cz + cand.lado * ((ref.prof + novoProf) / 2 + 2);
		}

		if (colide(novoCx, novoCz, novoLarg, novoProf, -1)) {
			continue;
		}

		const novaSala: Sala = {
			id: ++idGlobal,
			tipo: novoTipo,
			larg: novoLarg,
			prof: novoProf,
			cx: novoCx,
			cz: novoCz,
			cy: ref.cy,
			portas: [[0, PORTA_LARG]],
			subsolos: 0,
		};
		salas.push(novaSala);
		construirSala(novaSala);

		// 3. Escada para subsolo (sala grande, 35% de chance)
		if (novoTipo === "grande" && rng.next() < CHANCE_ESCADA && novaSala.subsolos === 0) {
			novaSala.subsolos++;
			construirEscada(novaSala);
		}

		// 4. Gera novos candidatos a partir desta sala (1–3 portas extras)
		const numPortas = rng.nextInt(1, 3);
		const dirsPossiveis = [
			{ eixoX: true, lado: 1 },
			{ eixoX: true, lado: -1 },
			{ eixoX: false, lado: 1 },
			{ eixoX: false, lado: -1 },
		];
		for (let p = 0; p < numPortas && candidatos.size() < SALAS_MAX; p++) {
			const d = rng.choose(dirsPossiveis);
			candidatos.push({ salaRef: novaSala, portaIdx: 0, eixoX: d.eixoX, lado: d.lado });
		}
	}

	// 5. Porta final (tampa norte do lobby — acesso visual ao corredor)
	bloco(
		"PortaFinal_N",
		new Vector3(PORTA_LARG + 4, ALTURA, 2),
		new Vector3(0, ALTURA / 2, -(TAM_LOBBY / 2 + 1)),
		new Color3(0.35, 0.35, 0.4),
	);
}

export function construirMapa(): void {
	gerar();
	print(`[3D] Mapa procedural gerado: ${salas.size()} salas, seed ${SEED}.`);
}
