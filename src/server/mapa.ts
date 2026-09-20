/**
 * Backrooms Level 0 — procedural chunk manager.
 * Phase 1: layout (30 surface + 20 underground)
 * Phase 2: build with neighbor-aware walls
 */
import { Lighting, Players, RunService, Workspace } from "@rbxts/services";
import {
	SEED,
	CHUNK_TAM,
	TILE_TAM,
	TILES_POR_CHUNK,
	GERAR_RAIO,
	DESCARTAR_RAIO,
	ALTURA,
	MODOS,
	COR_PAREDE,
	COR_PAREDE2,
	COR_CHAO,
	COR_TETO,
	COR_LUZ,
	MAX_SALAS_SUP,
	MAX_SALAS_SUB,
} from "shared/Config";
import { RNG } from "shared/RNG";

interface Modulo {
	tipo: string;
	portas: boolean[];
	tiles: number[][];
}

interface ChunkData {
	cx: number;
	cz: number;
	cy: number; // 0 = superficie, -18 = sub
	mod: Modulo;
	modelo: Model | undefined;
}

const layout = new Map<string, ChunkData>();
const cKey = (cx: number, cz: number, cy = 0) => `${cx},${cz},${cy}`;
const cGet = (cx: number, cz: number, cy = 0) => layout.get(cKey(cx, cz, cy));
const cor3 = (a: [number, number, number]) => new Color3(a[0], a[1], a[2]);

// ===================== modulo =====================

function gerarModulo(rng: RNG): Modulo {
	const total =
		MODOS["room"] +
		MODOS["hall"] +
		MODOS["largRoom"] +
		MODOS["pilar"] +
		MODOS["deadEnd"] +
		MODOS["stair"] +
		MODOS["blackout"];
	let r = rng.next() * total;
	let tipo = "room";
	for (const [t, peso] of ["room", "hall", "largRoom", "pilar", "deadEnd", "stair", "blackout"] as const) {
		r -= MODOS[t];
		if (r <= 0) {
			tipo = t;
			break;
		}
	}

	const portas = [false, false, false, false];
	const lados = [0, 1, 2, 3];
	for (let i = lados.size() - 1; i > 0; i--) {
		const j = rng.nextInt(0, i);
		const tmp = lados[i];
		lados[i] = lados[j];
		lados[j] = tmp;
	}
	const nP = tipo === "blackout" ? 0 : rng.nextInt(2, 4);
	for (let i = 0; i < nP && i < 4; i++) {
		portas[lados[i]] = true;
	}

	const N = TILES_POR_CHUNK;
	const tiles: number[][] = [];
	for (let z = 0; z < N; z++) {
		tiles[z] = [];
		for (let x = 0; x < N; x++) {
			tiles[z][x] = 1;
		}
	}

	function borda(): void {
		for (let i = 0; i < N; i++) {
			if (!portas[0]) {
				tiles[0][i] = 2;
			}
			if (!portas[2]) {
				tiles[N - 1][i] = 2;
			}
			if (!portas[3]) {
				tiles[i][0] = 2;
			}
			if (!portas[1]) {
				tiles[i][N - 1] = 2;
			}
		}
	}

	if (tipo === "room" || tipo === "largRoom" || tipo === "pilar" || tipo === "stair") {
		borda();
		if (tipo === "pilar") {
			for (let z = 2; z < N - 1; z += 3) {
				for (let x = 2; x < N - 1; x += 3) {
					tiles[z][x] = 3;
				}
			}
		}
	} else if (tipo === "hall") {
		const p1 = lados[0];
		portas[0] = false;
		portas[1] = false;
		portas[2] = false;
		portas[3] = false;
		portas[p1] = true;
		portas[(p1 + 2) % 4] = true;
		for (let z = 0; z < N; z++) {
			for (let x = 0; x < N; x++) {
				tiles[z][x] = 2;
			}
		}
		if (p1 === 0 || p1 === 2) {
			for (let z = 0; z < N; z++) {
				for (let x = 2; x < 6; x++) {
					tiles[z][x] = 1;
				}
			}
		} else {
			for (let z = 2; z < 6; z++) {
				for (let x = 0; x < N; x++) {
					tiles[z][x] = 1;
				}
			}
		}
	} else if (tipo === "deadEnd") {
		borda();
	} else if (tipo === "blackout") {
		for (let z = 0; z < N; z++) {
			for (let x = 0; x < N; x++) {
				tiles[z][x] = 2;
			}
		}
	}

	return { tipo, portas, tiles };
}

// ===================== phase 1: layout =====================

function gerarLayout(): void {
	layout.clear();
	const rng = new RNG(SEED);

	// superficie
	const lobby: ChunkData = { cx: 0, cz: 0, cy: 0, mod: gerarModulo(rng), modelo: undefined };
	layout.set(cKey(0, 0, 0), lobby);

	const fila: [number, number][] = [];
	const dirs: [number, number][] = [
		[0, -1],
		[0, 1],
		[-1, 0],
		[1, 0],
	];
	for (const [dx, dz] of dirs) {
		fila.push([dx, dz]);
	}

	let count = 1;
	while (count < MAX_SALAS_SUP && fila.size() > 0) {
		const fi = rng.nextInt(0, fila.size() - 1);
		const [fx, fz] = fila[fi];
		fila.remove(fi);

		if (layout.has(cKey(fx, fz, 0))) {
			continue;
		}

		const mod = gerarModulo(rng);
		const ch: ChunkData = { cx: fx, cz: fz, cy: 0, mod, modelo: undefined };
		layout.set(cKey(fx, fz, 0), ch);
		count++;

		for (const [dx, dz] of dirs) {
			const nx = fx + dx;
			const nz = fz + dz;
			if (!layout.has(cKey(nx, nz, 0)) && count + fila.size() < MAX_SALAS_SUP + 10) {
				fila.push([nx, nz]);
			}
		}
	}

	// garante portas (min 1 por sala nao-blackout)
	for (const [, ch] of layout) {
		if (ch.cy !== 0) {
			continue;
		}
		const m = ch.mod;
		if (m.tipo === "blackout") {
			continue;
		}
		if (!m.portas[0] && !m.portas[1] && !m.portas[2] && !m.portas[3]) {
			const rng2 = new RNG(SEED + ch.cx * 3571 + ch.cz * 3581);
			const lado = rng2.nextInt(0, 3);
			m.portas[lado] = true;
			const N = TILES_POR_CHUNK;
			if (lado === 0) {
				for (let x = 2; x < 6; x++) {
					m.tiles[0][x] = 1;
				}
			} else if (lado === 2) {
				for (let x = 2; x < 6; x++) {
					m.tiles[N - 1][x] = 1;
				}
			} else if (lado === 3) {
				for (let z = 2; z < 6; z++) {
					m.tiles[z][0] = 1;
				}
			} else {
				for (let z = 2; z < 6; z++) {
					m.tiles[z][N - 1] = 1;
				}
			}
		}
	}

	// subterraneo: gera a partir dos modulos stair
	const stairChunks: ChunkData[] = [];
	for (const [, ch] of layout) {
		if (ch.cy === 0 && ch.mod.tipo === "stair") {
			stairChunks.push(ch);
		}
	}

	let subCount = 0;
	const subFila: [number, number][] = [];

	for (const stair of stairChunks) {
		if (subCount >= MAX_SALAS_SUB) {
			break;
		}
		// primeira sala subterranea abaixo do stair
		const sx = stair.cx;
		const sz = stair.cz + 1; // ao sul do stair
		if (!layout.has(cKey(sx, sz, -1)) && subCount < MAX_SALAS_SUB) {
			const mod = gerarModulo(rng);
			const ch: ChunkData = { cx: sx, cz: sz, cy: -1, mod, modelo: undefined };
			layout.set(cKey(sx, sz, -1), ch);
			subCount++;
			subFila.push([sx, sz]);
		}
	}

	// expande subterraneo
	while (subCount < MAX_SALAS_SUB && subFila.size() > 0) {
		const fi = rng.nextInt(0, subFila.size() - 1);
		const [fx, fz] = subFila[fi];
		subFila.remove(fi);

		for (const [dx, dz] of dirs) {
			const nx = fx + dx;
			const nz = fz + dz;
			if (!layout.has(cKey(nx, nz, -1)) && subCount < MAX_SALAS_SUB) {
				const mod = gerarModulo(rng);
				const ch: ChunkData = { cx: nx, cz: nz, cy: -1, mod, modelo: undefined };
				layout.set(cKey(nx, nz, -1), ch);
				subCount++;
				subFila.push([nx, nz]);
			}
		}
	}

	// garante portas no subterraneo
	for (const [, ch] of layout) {
		if (ch.cy !== -1) {
			continue;
		}
		const m = ch.mod;
		if (m.tipo === "blackout") {
			continue;
		}
		if (!m.portas[0] && !m.portas[1] && !m.portas[2] && !m.portas[3]) {
			const rng2 = new RNG(SEED + ch.cx * 3571 + ch.cz * 3581 + 999);
			const lado = rng2.nextInt(0, 3);
			m.portas[lado] = true;
			const N = TILES_POR_CHUNK;
			if (lado === 0) {
				for (let x = 2; x < 6; x++) {
					m.tiles[0][x] = 1;
				}
			} else if (lado === 2) {
				for (let x = 2; x < 6; x++) {
					m.tiles[N - 1][x] = 1;
				}
			} else if (lado === 3) {
				for (let z = 2; z < 6; z++) {
					m.tiles[z][0] = 1;
				}
			} else {
				for (let z = 2; z < 6; z++) {
					m.tiles[z][N - 1] = 1;
				}
			}
		}
	}
}

// ===================== phase 2: build =====================

function mkPart(
	nome: string,
	tam: Vector3,
	pos: Vector3,
	cor: Color3,
	mat: Enum.Material,
	colidi: boolean,
	parent: Instance,
): Part {
	const p = new Instance("Part");
	p.Name = nome;
	p.Size = tam;
	p.Position = pos;
	p.Color = cor;
	p.Material = mat;
	p.Anchored = true;
	p.CanCollide = colidi;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = parent;
	return p;
}

function construirChunk(ch: ChunkData): void {
	const modelo = new Instance("Model");
	modelo.Name = `Chunk_${ch.cx}_${ch.cz}_${ch.cy}`;

	const bx = ch.cx * CHUNK_TAM;
	const bz = ch.cz * CHUNK_TAM;
	const baseY = ch.cy;
	const N = TILES_POR_CHUNK;
	const rng = new RNG(SEED + ch.cx * 7919 + ch.cz * 7907 + ch.cy * 12345);
	const mod = ch.mod;

	const chaoCor = cor3(COR_CHAO);
	const tetoCor = cor3(COR_TETO);
	const p1 = cor3(COR_PAREDE);
	const p2 = cor3(COR_PAREDE2);
	const lzCor = cor3(COR_LUZ);

	// chao + teto
	mkPart(
		"Chao",
		new Vector3(CHUNK_TAM, 1, CHUNK_TAM),
		new Vector3(bx + CHUNK_TAM / 2, baseY - 0.5, bz + CHUNK_TAM / 2),
		chaoCor,
		Enum.Material.Plastic,
		true,
		modelo,
	);
	mkPart(
		"Teto",
		new Vector3(CHUNK_TAM, 1, CHUNK_TAM),
		new Vector3(bx + CHUNK_TAM / 2, baseY + ALTURA + 0.5, bz + CHUNK_TAM / 2),
		tetoCor,
		Enum.Material.Plastic,
		true,
		modelo,
	);

	// tiles internos
	for (let z = 0; z < N; z++) {
		for (let x = 0; x < N; x++) {
			const t = mod.tiles[z][x];
			const tx = bx + x * TILE_TAM + TILE_TAM / 2;
			const tz = bz + z * TILE_TAM + TILE_TAM / 2;
			if (t === 2) {
				const c = rng.next() > 0.5 ? p1 : p2;
				mkPart(
					`W_${x}_${z}`,
					new Vector3(TILE_TAM, ALTURA, TILE_TAM),
					new Vector3(tx, baseY + ALTURA / 2, tz),
					c,
					Enum.Material.Plastic,
					true,
					modelo,
				);
			} else if (t === 3) {
				mkPart(
					`P_${x}_${z}`,
					new Vector3(TILE_TAM * 0.6, ALTURA, TILE_TAM * 0.6),
					new Vector3(tx, baseY + ALTURA / 2, tz),
					p1,
					Enum.Material.Plastic,
					true,
					modelo,
				);
			}
		}
	}

	// paredes entre chunks (neighbor-aware)
	const vizN = cGet(ch.cx, ch.cz - 1, ch.cy);
	const vizS = cGet(ch.cx, ch.cz + 1, ch.cy);
	const vizW = cGet(ch.cx - 1, ch.cz, ch.cy);
	const vizE = cGet(ch.cx + 1, ch.cz, ch.cy);

	// norte
	if (!mod.portas[0] && !(vizN !== undefined && vizN.mod.portas[2])) {
		for (let x = 0; x < N; x++) {
			if (mod.tiles[0][x] === 2) {
				continue;
			}
			const xW = bx + x * TILE_TAM + TILE_TAM / 2;
			const c = rng.next() > 0.5 ? p1 : p2;
			mkPart(
				`BN_${x}`,
				new Vector3(TILE_TAM, ALTURA, TILE_TAM),
				new Vector3(xW, baseY + ALTURA / 2, bz),
				c,
				Enum.Material.Plastic,
				true,
				modelo,
			);
		}
	}
	// sul
	if (!mod.portas[2] && !(vizS !== undefined && vizS.mod.portas[0])) {
		for (let x = 0; x < N; x++) {
			if (mod.tiles[N - 1][x] === 2) {
				continue;
			}
			const xW = bx + x * TILE_TAM + TILE_TAM / 2;
			const zW = bz + CHUNK_TAM;
			const c = rng.next() > 0.5 ? p1 : p2;
			mkPart(
				`BS_${x}`,
				new Vector3(TILE_TAM, ALTURA, TILE_TAM),
				new Vector3(xW, baseY + ALTURA / 2, zW),
				c,
				Enum.Material.Plastic,
				true,
				modelo,
			);
		}
	}
	// oeste
	if (!mod.portas[3] && !(vizW !== undefined && vizW.mod.portas[1])) {
		for (let z = 0; z < N; z++) {
			if (mod.tiles[z][0] === 2) {
				continue;
			}
			const zW = bz + z * TILE_TAM + TILE_TAM / 2;
			const c = rng.next() > 0.5 ? p1 : p2;
			mkPart(
				`BW_${z}`,
				new Vector3(TILE_TAM, ALTURA, TILE_TAM),
				new Vector3(bx, baseY + ALTURA / 2, zW),
				c,
				Enum.Material.Plastic,
				true,
				modelo,
			);
		}
	}
	// leste
	if (!mod.portas[1] && !(vizE !== undefined && vizE.mod.portas[3])) {
		for (let z = 0; z < N; z++) {
			if (mod.tiles[z][N - 1] === 2) {
				continue;
			}
			const xW = bx + CHUNK_TAM;
			const zW = bz + z * TILE_TAM + TILE_TAM / 2;
			const c = rng.next() > 0.5 ? p1 : p2;
			mkPart(
				`BE_${z}`,
				new Vector3(TILE_TAM, ALTURA, TILE_TAM),
				new Vector3(xW, baseY + ALTURA / 2, zW),
				c,
				Enum.Material.Plastic,
				true,
				modelo,
			);
		}
	}

	// fluorescentes
	if (mod.tipo !== "blackout") {
		const nL = mod.tipo === "largRoom" ? 4 : mod.tipo === "pilar" ? 3 : 2;
		for (let i = 0; i < nL; i++) {
			const lx = bx + (CHUNK_TAM * (i + 1)) / (nL + 1);
			const lz = bz + CHUNK_TAM / 2;
			const tubo = mkPart(
				`Fluor_${i}`,
				new Vector3(0.4, 0.3, CHUNK_TAM * 0.6),
				new Vector3(lx, baseY + ALTURA - 0.15, lz),
				new Color3(0.95, 0.95, 0.9),
				Enum.Material.Neon,
				false,
				modelo,
			);
			const pl = new Instance("PointLight");
			pl.Color = lzCor;
			pl.Range = 45;
			pl.Brightness = 1.5;
			pl.Shadows = false;
			pl.Parent = tubo;
		}
	}

	// escada subterranea (só na superficie)
	if (mod.tipo === "stair" && ch.cy === 0) {
		const sx = bx + CHUNK_TAM / 2 - 8;
		const sz = bz + CHUNK_TAM / 2;
		const deg = 8;
		const dxSt = 2;
		const dySt = 18 / deg;

		// degraus descendo
		for (let i = 0; i < deg; i++) {
			mkPart(
				`Deg_${i}`,
				new Vector3(dxSt, 1, 4),
				new Vector3(sx + i * dxSt, -i * dySt - 0.5, sz),
				new Color3(0.35, 0.33, 0.3),
				Enum.Material.Plastic,
				true,
				modelo,
			);
		}

		// corredor vertical连接ando escada ao sub
		const connCx = (sx + (deg - 1) * dxSt) / 2;
		const connL = deg * dxSt + 4;
		mkPart(
			"Stair_Conn",
			new Vector3(connL, ALTURA, 4),
			new Vector3(connCx, -9, sz),
			p1,
			Enum.Material.Plastic,
			true,
			modelo,
		);
	}

	modelo.Parent = Workspace;
	ch.modelo = modelo;
}

// ===================== streaming =====================

function gerarChunks(jX: number, jZ: number): void {
	const jcX = math.floor(jX / CHUNK_TAM);
	const jcZ = math.floor(jZ / CHUNK_TAM);

	for (let dx = -GERAR_RAIO; dx <= GERAR_RAIO; dx++) {
		for (let dz = -GERAR_RAIO; dz <= GERAR_RAIO; dz++) {
			const key = cKey(jcX + dx, jcZ + dz, 0);
			if (!layout.has(key)) {
				const rng = new RNG(SEED + (jcX + dx) * 7919 + (jcZ + dz) * 7907);
				const ch: ChunkData = { cx: jcX + dx, cz: jcZ + dz, cy: 0, mod: gerarModulo(rng), modelo: undefined };
				layout.set(key, ch);
			}
			const ch = layout.get(key)!;
			if (ch.modelo === undefined) {
				construirChunk(ch);
			}
		}
	}

	// descarta longe
	const ap: string[] = [];
	for (const [key, ch] of layout) {
		if (
			ch.modelo !== undefined &&
			ch.cy === 0 &&
			(math.abs(ch.cx - jcX) > DESCARTAR_RAIO || math.abs(ch.cz - jcZ) > DESCARTAR_RAIO)
		) {
			ch.modelo.Destroy();
			ch.modelo = undefined;
			ap.push(key);
		}
	}
	for (const key of ap) {
		layout.delete(key);
	}
}

// ===================== init =====================

let init = false;

export function construirMapa(): void {
	if (init) {
		return;
	}
	init = true;

	// limpa TUDO
	for (const c of Workspace.GetChildren()) {
		if (c.IsA("Terrain") || c.Name === "Camera") {
			continue;
		}
		c.Destroy();
	}

	// limpa Lighting
	for (const c of Lighting.GetChildren()) {
		c.Destroy();
	}
	Lighting.Ambient = new Color3(0.4, 0.38, 0.32);
	Lighting.OutdoorAmbient = new Color3(0.15, 0.15, 0.12);
	Lighting.FogStart = 0;
	Lighting.FogEnd = 100;
	Lighting.FogColor = new Color3(0.6, 0.55, 0.42);
	Lighting.GlobalShadows = false;
	Lighting.Brightness = 0;
	Lighting.ClockTime = 14;

	// layout
	gerarLayout();

	// build tudo
	for (const [, ch] of layout) {
		construirChunk(ch);
	}

	// spawn
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "Spawn";
	spawn.Size = new Vector3(6, 1, 6);
	spawn.Position = new Vector3(0, 1, 0);
	spawn.Color = cor3(COR_CHAO);
	spawn.Material = Enum.Material.Plastic;
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.TopSurface = Enum.SurfaceType.Smooth;
	spawn.BottomSurface = Enum.SurfaceType.Smooth;
	spawn.Parent = Workspace;

	// streaming
	RunService.Heartbeat.Connect(() => {
		const pl = Players.GetPlayers()[0];
		if (pl === undefined) {
			return;
		}
		const ch = pl.Character;
		if (ch === undefined) {
			return;
		}
		const hrp = ch.FindFirstChild("HumanoidRootPart") as Part | undefined;
		if (hrp === undefined) {
			return;
		}
		gerarChunks(hrp.Position.X, hrp.Position.Z);
	});

	let sup = 0;
	let sub = 0;
	for (const [, ch] of layout) {
		if (ch.cy === 0) {
			sup++;
		} else {
			sub++;
		}
	}
	print(`[Backrooms] Sup: ${sup}, Sub: ${sub}`);
}
