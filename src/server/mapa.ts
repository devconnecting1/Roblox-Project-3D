/**
 * Mapa 3D procedural determinístico — sala inicial grande + salas ramificadas
 * + escadas para salas secretas subterrâneas.
 *
 * Zero Interface. Material = Plastic apenas. Sem imóveis estáticos.
 * Mesmo seed = mesmo mapa sempre.
 *
 * Algoritmo: 2 fases
 *   1) Determina posições e conexões (BFS sem RNG extra)
 *   2) Constrói tudo uma vez só
 */
import { Lighting, Workspace } from "@rbxts/services";
import { SEED, ALTURA, TAM_LOBBY, PORTA_LARG, SALAS_MAX, PROFUNDIDADE, CHANCE_ESCADA } from "shared/Config";
import { RNG } from "shared/RNG";

const rng = new RNG(SEED);

const TAMOS = [14, 22, 32];
const TIPOS = ["pequena", "media", "grande"];
const PW = 2;
const GAP = 4;

let idGen = 0;

interface Sala {
	id: number;
	tipo: string;
	larg: number;
	prof: number;
	cx: number;
	cz: number;
	cy: number;
	portas: number[]; // ids das salas adjacentes com abertura
}

const salas: Sala[] = [];
const links: [number, number][] = [];

// ================== helpers ==================

function bloco(nome: string, tam: Vector3, pos: Vector3, cor: Color3, colidi = true): Part {
	const p = new Instance("Part");
	p.Name = nome;
	p.Size = tam;
	p.Position = pos;
	p.Color = cor;
	p.Material = Enum.Material.Plastic;
	p.Anchored = true;
	p.CanCollide = colidi;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = Workspace;
	return p;
}

function salaCores(tipo: string): [Color3, Color3] {
	if (tipo === "pequena") {
		return [new Color3(0.42, 0.4, 0.37), new Color3(0.33, 0.31, 0.29)];
	}
	if (tipo === "media") {
		return [new Color3(0.35, 0.38, 0.42), new Color3(0.27, 0.29, 0.33)];
	}
	return [new Color3(0.28, 0.3, 0.34), new Color3(0.22, 0.24, 0.28)];
}

function colide(cx: number, cz: number, larg: number, prof: number): boolean {
	for (const s of salas) {
		if (math.abs(cx - s.cx) < (larg + s.larg) / 2 + 3 && math.abs(cz - s.cz) < (prof + s.prof) / 2 + 3) {
			return true;
		}
	}
	return false;
}

function find(id: number): Sala | undefined {
	for (const s of salas) {
		if (s.id === id) {
			return s;
		}
	}
	return undefined;
}

function segmentarParede(
	inicio: number,
	fim: number,
	centrosPorta: number[],
	largPorta: number,
): { cx: number; w: number }[] {
	const segs: { cx: number; w: number }[] = [];
	let cur = inicio;
	for (const pc of centrosPorta) {
		const pIni = pc - largPorta / 2;
		const pFim = pc + largPorta / 2;
		if (pIni > cur) {
			segs.push({ cx: (cur + pIni) / 2, w: pIni - cur });
		}
		cur = pFim;
	}
	if (cur < fim) {
		segs.push({ cx: (cur + fim) / 2, w: fim - cur });
	}
	return segs;
}

// ================== fase 1: determinar layout ==================

function determinarLayout(): void {
	salas.clear();
	links.clear();
	idGen = 0;

	// lobby
	const lobby: Sala = {
		id: ++idGen,
		tipo: "grande",
		larg: TAM_LOBBY,
		prof: TAM_LOBBY,
		cx: 0,
		cz: 0,
		cy: 0,
		portas: [],
	};
	salas.push(lobby);

	// BFS
	type Cand = { paiId: number; dx: number; dz: number };
	const allDirs = [
		{ dx: 1, dz: 0 },
		{ dx: -1, dz: 0 },
		{ dx: 0, dz: 1 },
		{ dx: 0, dz: -1 },
	];

	const fila: Cand[] = [];
	for (const d of allDirs) {
		fila.push({ paiId: lobby.id, dx: d.dx, dz: d.dz });
	}

	while (salas.size() < SALAS_MAX && fila.size() > 0) {
		const fi = rng.nextInt(0, fila.size() - 1);
		const cand = fila[fi];
		fila.remove(fi);

		const pai = find(cand.paiId);
		if (pai === undefined) {
			continue;
		}

		const tipoIdx = rng.nextInt(0, 2);
		const novoT = TAMOS[tipoIdx];
		const novoNome = TIPOS[tipoIdx];

		const ncx = cand.dx !== 0 ? pai.cx + cand.dx * ((pai.larg + novoT) / 2 + GAP) : pai.cx;
		const ncz = cand.dz !== 0 ? pai.cz + cand.dz * ((pai.prof + novoT) / 2 + GAP) : pai.cz;

		if (colide(ncx, ncz, novoT, novoT)) {
			continue;
		}

		const nova: Sala = { id: ++idGen, tipo: novoNome, larg: novoT, prof: novoT, cx: ncx, cz: ncz, cy: 0, portas: [] };
		salas.push(nova);
		links.push([pai.id, nova.id]);
		nova.portas.push(pai.id);
		pai.portas.push(nova.id);

		// filhos
		const nFilhos = rng.nextInt(1, 3);
		for (let i = 0; i < nFilhos && salas.size() + fila.size() < SALAS_MAX; i++) {
			const d = rng.choose(allDirs);
			fila.push({ paiId: nova.id, dx: d.dx, dz: d.dz });
		}
	}
}

// ================== fase 2: construir tudo ==================

function construirSala(s: Sala): void {
	const [chaoCor, paredeCor] = salaCores(s.tipo);
	const x0 = s.cx - s.larg / 2;
	const x1 = s.cx + s.larg / 2;
	const z0 = s.cz - s.prof / 2;
	const z1 = s.cz + s.prof / 2;
	const h = ALTURA / 2 + s.cy;
	const n = `${s.id}_${s.tipo}`;

	// chão + teto
	bloco(`${n}_Chao`, new Vector3(s.larg, 2, s.prof), new Vector3(s.cx, s.cy - 1, s.cz), chaoCor);
	bloco(
		`${n}_Teto`,
		new Vector3(s.larg, 2, s.prof),
		new Vector3(s.cx, s.cy + ALTURA + 1, s.cz),
		new Color3(0.18, 0.19, 0.22),
	);

	// norte (z0): portas = salas com cz < s.cz
	const nPortas: number[] = [];
	for (const pid of s.portas) {
		const o = find(pid);
		if (o !== undefined && o.cz < s.cz) {
			nPortas.push(o.cx);
		}
	}
	nPortas.sort((a, b) => a < b);
	for (const seg of segmentarParede(x0, x1, nPortas, PORTA_LARG)) {
		bloco(`${n}_N_${seg.cx}`, new Vector3(seg.w, ALTURA, PW), new Vector3(seg.cx, h, z0), paredeCor);
	}

	// sul (z1): salas com cz > s.cz
	const sPortas: number[] = [];
	for (const pid of s.portas) {
		const o = find(pid);
		if (o !== undefined && o.cz > s.cz) {
			sPortas.push(o.cx);
		}
	}
	sPortas.sort((a, b) => a < b);
	for (const seg of segmentarParede(x0, x1, sPortas, PORTA_LARG)) {
		bloco(`${n}_S_${seg.cx}`, new Vector3(seg.w, ALTURA, PW), new Vector3(seg.cx, h, z1), paredeCor);
	}

	// oeste (x0): salas com cx < s.cx
	const wPortas: number[] = [];
	for (const pid of s.portas) {
		const o = find(pid);
		if (o !== undefined && o.cx < s.cx) {
			wPortas.push(o.cz);
		}
	}
	wPortas.sort((a, b) => a < b);
	for (const seg of segmentarParede(z0, z1, wPortas, PORTA_LARG)) {
		bloco(`${n}_W_${seg.cx}`, new Vector3(PW, ALTURA, seg.w), new Vector3(x0, h, seg.cx), paredeCor);
	}

	// leste (x1): salas com cx > s.cx
	const ePortas: number[] = [];
	for (const pid of s.portas) {
		const o = find(pid);
		if (o !== undefined && o.cx > s.cx) {
			ePortas.push(o.cz);
		}
	}
	ePortas.sort((a, b) => a < b);
	for (const seg of segmentarParede(z0, z1, ePortas, PORTA_LARG)) {
		bloco(`${n}_E_${seg.cx}`, new Vector3(PW, ALTURA, seg.w), new Vector3(x1, h, seg.cx), paredeCor);
	}

	// luzes
	if (s.larg >= 20) {
		const cols = s.larg >= 30 ? 3 : 2;
		const linhas = s.prof >= 30 ? 3 : 2;
		for (let i = 0; i < cols; i++) {
			for (let j = 0; j < linhas; j++) {
				const lx = x0 + (s.larg * (i + 1)) / (cols + 1);
				const lz = z0 + (s.prof * (j + 1)) / (linhas + 1);
				const lamp = bloco(
					`${n}_L${i}${j}`,
					new Vector3(2, 1, 2),
					new Vector3(lx, s.cy + ALTURA - 1, lz),
					new Color3(0, 0, 0),
					false,
				);
				lamp.Transparency = 1;
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
			`${n}_L`,
			new Vector3(2, 1, 2),
			new Vector3(s.cx, s.cy + ALTURA - 1, s.cz),
			new Color3(0, 0, 0),
			false,
		);
		lamp.Transparency = 1;
		const pl = new Instance("PointLight");
		pl.Color = new Color3(1, 0.93, 0.78);
		pl.Range = 22;
		pl.Brightness = 1.5;
		pl.Shadows = false;
		pl.Parent = lamp;
	}
}

function construirEscada(s: Sala): void {
	const n = `${s.id}_${s.tipo}`;
	const sx = s.cx - s.larg / 2 + 5;
	const sz = s.cz - s.prof / 2 + 5;
	const deg = 6;
	const dx = 2.4;
	const dy = math.abs(PROFUNDIDADE) / deg;

	bloco(
		`${n}_Buraco`,
		new Vector3(dx * deg + 3, 2.2, 4),
		new Vector3(sx + (deg * dx) / 2, s.cy - 1, sz),
		new Color3(0.1, 0.1, 0.12),
	);

	for (let i = 0; i < deg; i++) {
		bloco(
			`${n}_Dg${i}`,
			new Vector3(dx, 1, 3),
			new Vector3(sx + i * dx, s.cy - i * dy - 0.5, sz),
			new Color3(0.25, 0.25, 0.28),
		);
		bloco(
			`${n}_Gd${i}`,
			new Vector3(0.6, 2.5, 0.6),
			new Vector3(sx + i * dx - 1.8, s.cy - i * dy + 1, sz),
			new Color3(0.4, 0.4, 0.45),
		);
	}

	const subL = rng.nextInt(14, 24);
	const subP = rng.nextInt(14, 24);
	const subCx = sx + deg * dx + subL / 2 + 4;

	if (!colide(subCx, sz, subL, subP)) {
		const sub: Sala = {
			id: ++idGen,
			tipo: subL >= 20 ? "media" : "pequena",
			larg: subL,
			prof: subP,
			cx: subCx,
			cz: sz,
			cy: PROFUNDIDADE,
			portas: [],
		};
		salas.push(sub);
		construirSala(sub);
		const connL = math.abs(subCx - sx - deg * dx) + 4;
		const connCx = (sx + deg * dx + subCx) / 2;
		bloco(
			`${n}_Conn`,
			new Vector3(connL, ALTURA, 4),
			new Vector3(connCx, PROFUNDIDADE + ALTURA / 2, sz),
			salaCores(sub.tipo)[1],
		);
	}
}

// ================== main ==================

function gerar(): void {
	for (const c of Workspace.GetChildren()) {
		if (c.IsA("BasePart") || c.IsA("Model")) {
			c.Destroy();
		}
	}

	Lighting.Ambient = new Color3(0.08, 0.08, 0.1);
	Lighting.OutdoorAmbient = new Color3(0.08, 0.08, 0.1);
	Lighting.FogStart = 50;
	Lighting.FogEnd = 200;
	Lighting.GlobalShadows = true;
	Lighting.Brightness = 0.8;

	// fase 1
	determinarLayout();

	// fase 2: constrói tudo
	for (const s of salas) {
		construirSala(s);
	}

	// escadas (só em grandes)
	const escadaRng = new RNG(SEED + 1000);
	for (const s of salas) {
		if (s.tipo === "grande" && escadaRng.next() < CHANCE_ESCADA) {
			construirEscada(s);
		}
	}

	// spawn
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "Spawn";
	spawn.Size = new Vector3(6, 1, 6);
	spawn.Position = new Vector3(0, 1, 0);
	spawn.Color = new Color3(0.55, 0.57, 0.6);
	spawn.Material = Enum.Material.Plastic;
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.TopSurface = Enum.SurfaceType.Smooth;
	spawn.BottomSurface = Enum.SurfaceType.Smooth;
	spawn.Parent = Workspace;

	print(`[3D] ${salas.size()} salas, ${links.size()} portas.`);
}

export function construirMapa(): void {
	gerar();
	print(`[3D] Mapa ok: ${salas.size()} salas, seed ${SEED}.`);
}
