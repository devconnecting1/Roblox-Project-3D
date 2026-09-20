/**
 * Chunk manager — Backrooms Level 0 procedural.
 * Chunks 64x64 studs, 8x8 tiles. Gera ao redor do jogador, descarta longe.
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
} from "shared/Config";
import { RNG } from "shared/RNG";

interface Modulo {
	tipo: string;
	portas: boolean[];
	tiles: number[][];
}

interface Chunk {
	cx: number;
	cz: number;
	modelo: Model;
}

const chunks = new Map<string, Chunk>();

function cor3(a: [number, number, number]): Color3 {
	return new Color3(a[0], a[1], a[2]);
}
function chunkKey(cx: number, cz: number): string {
	return `${cx},${cz}`;
}

// ---------- modulo ----------

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
	const tipos: [string, number][] = [
		["room", MODOS["room"]],
		["hall", MODOS["hall"]],
		["largRoom", MODOS["largRoom"]],
		["pilar", MODOS["pilar"]],
		["deadEnd", MODOS["deadEnd"]],
		["stair", MODOS["stair"]],
		["blackout", MODOS["blackout"]],
	];
	for (const [t, peso] of tipos) {
		r -= peso;
		if (r <= 0) {
			tipo = t;
			break;
		}
	}

	const portas = [false, false, false, false];
	const nPortas = tipo === "deadEnd" || tipo === "blackout" ? 1 : rng.nextInt(2, 4);
	const lados = [0, 1, 2, 3];
	for (let i = lados.size() - 1; i > 0; i--) {
		const j = rng.nextInt(0, i);
		const tmp = lados[i];
		lados[i] = lados[j];
		lados[j] = tmp;
	}
	for (let i = 0; i < nPortas && i < 4; i++) {
		portas[lados[i]] = true;
	}

	const tiles: number[][] = [];
	for (let z = 0; z < TILES_POR_CHUNK; z++) {
		tiles[z] = [];
		for (let x = 0; x < TILES_POR_CHUNK; x++) {
			tiles[z][x] = 1;
		}
	}

	function paredeBorda(): void {
		for (let i = 0; i < TILES_POR_CHUNK; i++) {
			if (!portas[0]) {
				tiles[0][i] = 2;
			}
			if (!portas[2]) {
				tiles[TILES_POR_CHUNK - 1][i] = 2;
			}
			if (!portas[3]) {
				tiles[i][0] = 2;
			}
			if (!portas[1]) {
				tiles[i][TILES_POR_CHUNK - 1] = 2;
			}
		}
	}

	if (tipo === "room" || tipo === "largRoom" || tipo === "pilar" || tipo === "stair") {
		paredeBorda();
		if (tipo === "pilar") {
			for (let z = 2; z < TILES_POR_CHUNK - 1; z += 3) {
				for (let x = 2; x < TILES_POR_CHUNK - 1; x += 3) {
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
		for (let z = 0; z < TILES_POR_CHUNK; z++) {
			for (let x = 0; x < TILES_POR_CHUNK; x++) {
				tiles[z][x] = 2;
			}
		}
		if (p1 === 0 || p1 === 2) {
			for (let z = 0; z < TILES_POR_CHUNK; z++) {
				for (let x = 2; x < 6; x++) {
					tiles[z][x] = 1;
				}
			}
		} else {
			for (let z = 2; z < 6; z++) {
				for (let x = 0; x < TILES_POR_CHUNK; x++) {
					tiles[z][x] = 1;
				}
			}
		}
	} else if (tipo === "deadEnd") {
		for (let i = 0; i < TILES_POR_CHUNK; i++) {
			tiles[0][i] = 2;
			tiles[TILES_POR_CHUNK - 1][i] = 2;
			tiles[i][0] = 2;
			tiles[i][TILES_POR_CHUNK - 1] = 2;
		}
		const pa = lados[0];
		if (pa === 0) {
			for (let x = 2; x < 6; x++) {
				tiles[0][x] = 1;
			}
		} else if (pa === 2) {
			for (let x = 2; x < 6; x++) {
				tiles[TILES_POR_CHUNK - 1][x] = 1;
			}
		} else if (pa === 3) {
			for (let z = 2; z < 6; z++) {
				tiles[z][0] = 1;
			}
		} else {
			for (let z = 2; z < 6; z++) {
				tiles[z][TILES_POR_CHUNK - 1] = 1;
			}
		}
	} else if (tipo === "blackout") {
		for (let z = 0; z < TILES_POR_CHUNK; z++) {
			for (let x = 0; x < TILES_POR_CHUNK; x++) {
				tiles[z][x] = 2;
			}
		}
	}

	return { tipo, portas, tiles };
}

// ---------- chunk ----------

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

function construirChunk(cx: number, cz: number): Chunk {
	const modelo = new Instance("Model");
	modelo.Name = `Chunk_${cx}_${cz}`;

	const bx = cx * CHUNK_TAM;
	const bz = cz * CHUNK_TAM;
	const rng = new RNG(SEED + cx * 7919 + cz * 7907);
	const mod = gerarModulo(rng);

	const chaoCor = cor3(COR_CHAO);
	const tetoCor = cor3(COR_TETO);
	const p1 = cor3(COR_PAREDE);
	const p2 = cor3(COR_PAREDE2);
	const lzCor = cor3(COR_LUZ);

	// chao + teto
	mkPart(
		"Chao",
		new Vector3(CHUNK_TAM, 1, CHUNK_TAM),
		new Vector3(bx + CHUNK_TAM / 2, -0.5, bz + CHUNK_TAM / 2),
		chaoCor,
		Enum.Material.Plastic,
		true,
		modelo,
	);
	mkPart(
		"Teto",
		new Vector3(CHUNK_TAM, 1, CHUNK_TAM),
		new Vector3(bx + CHUNK_TAM / 2, ALTURA + 0.5, bz + CHUNK_TAM / 2),
		tetoCor,
		Enum.Material.Plastic,
		true,
		modelo,
	);

	// tiles
	for (let z = 0; z < TILES_POR_CHUNK; z++) {
		for (let x = 0; x < TILES_POR_CHUNK; x++) {
			const t = mod.tiles[z][x];
			const tx = bx + x * TILE_TAM + TILE_TAM / 2;
			const tz = bz + z * TILE_TAM + TILE_TAM / 2;
			if (t === 2) {
				const c = rng.next() > 0.5 ? p1 : p2;
				mkPart(
					`W_${x}_${z}`,
					new Vector3(TILE_TAM, ALTURA, TILE_TAM),
					new Vector3(tx, ALTURA / 2, tz),
					c,
					Enum.Material.Plastic,
					true,
					modelo,
				);
			} else if (t === 3) {
				mkPart(
					`P_${x}_${z}`,
					new Vector3(TILE_TAM * 0.6, ALTURA, TILE_TAM * 0.6),
					new Vector3(tx, ALTURA / 2, tz),
					p1,
					Enum.Material.Plastic,
					true,
					modelo,
				);
			}
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
				new Vector3(lx, ALTURA - 0.15, lz),
				new Color3(0.95, 0.95, 0.9),
				Enum.Material.Neon,
				false,
				modelo,
			);
			const pl = new Instance("PointLight");
			pl.Color = lzCor;
			pl.Range = 40;
			pl.Brightness = 1.2;
			pl.Shadows = false;
			pl.Parent = tubo;
		}
	}

	// escada subterranea
	if (mod.tipo === "stair") {
		const sx = bx + CHUNK_TAM / 2 - 8;
		const sz = bz + CHUNK_TAM / 2;
		const deg = 8;
		const dxSt = 2;
		const dySt = 16 / deg;

		mkPart(
			"Buraco",
			new Vector3(dxSt * deg + 3, 1.2, 5),
			new Vector3(sx + (deg * dxSt) / 2, -0.5, sz),
			new Color3(0.08, 0.08, 0.1),
			Enum.Material.Plastic,
			false,
			modelo,
		);

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

		const subCX = sx + deg * dxSt + 12;
		const subCZ = sz;
		const subY = -16;
		const subL = 24;
		const subP = 20;
		const subH = ALTURA / 2 + subY;

		mkPart(
			"Sub_Chao",
			new Vector3(subL, 1, subP),
			new Vector3(subCX, subY - 0.5, subCZ),
			chaoCor,
			Enum.Material.Plastic,
			true,
			modelo,
		);
		mkPart(
			"Sub_Teto",
			new Vector3(subL, 1, subP),
			new Vector3(subCX, subY + ALTURA + 0.5, subCZ),
			tetoCor,
			Enum.Material.Plastic,
			true,
			modelo,
		);
		mkPart(
			"Sub_N",
			new Vector3(subL, ALTURA, 2),
			new Vector3(subCX, subH, subCZ - subP / 2),
			p1,
			Enum.Material.Plastic,
			true,
			modelo,
		);
		mkPart(
			"Sub_S",
			new Vector3(subL, ALTURA, 2),
			new Vector3(subCX, subH, subCZ + subP / 2),
			p1,
			Enum.Material.Plastic,
			true,
			modelo,
		);
		mkPart(
			"Sub_W",
			new Vector3(2, ALTURA, subP),
			new Vector3(subCX - subL / 2, subH, subCZ),
			p1,
			Enum.Material.Plastic,
			true,
			modelo,
		);
		mkPart(
			"Sub_E",
			new Vector3(2, ALTURA, subP),
			new Vector3(subCX + subL / 2, subH, subCZ),
			p1,
			Enum.Material.Plastic,
			true,
			modelo,
		);

		const subLuz = mkPart(
			"Sub_Luz",
			new Vector3(0.4, 0.3, subL * 0.6),
			new Vector3(subCX, subY + ALTURA - 0.15, subCZ),
			new Color3(0.95, 0.95, 0.9),
			Enum.Material.Neon,
			false,
			modelo,
		);
		const spl = new Instance("PointLight");
		spl.Color = lzCor;
		spl.Range = 35;
		spl.Brightness = 1;
		spl.Shadows = false;
		spl.Parent = subLuz;

		// corredor conectando escada a sub-sala
		const connL = math.abs(subCX - sx - deg * dxSt) + 4;
		const connCx = (sx + deg * dxSt + subCX) / 2;
		mkPart(
			"Sub_Conn",
			new Vector3(connL, ALTURA, 4),
			new Vector3(connCx, subH, subCZ),
			p1,
			Enum.Material.Plastic,
			true,
			modelo,
		);
	}

	modelo.Parent = Workspace;
	return { cx, cz, modelo };
}

// ---------- chunk streaming ----------

function gerarChunks(jX: number, jZ: number): void {
	const jcX = math.floor(jX / CHUNK_TAM);
	const jcZ = math.floor(jZ / CHUNK_TAM);

	for (let dx = -GERAR_RAIO; dx <= GERAR_RAIO; dx++) {
		for (let dz = -GERAR_RAIO; dz <= GERAR_RAIO; dz++) {
			const key = chunkKey(jcX + dx, jcZ + dz);
			if (!chunks.has(key)) {
				chunks.set(key, construirChunk(jcX + dx, jcZ + dz));
			}
		}
	}

	const ap: string[] = [];
	for (const [key, ch] of chunks) {
		if (math.abs(ch.cx - jcX) > DESCARTAR_RAIO || math.abs(ch.cz - jcZ) > DESCARTAR_RAIO) {
			ap.push(key);
		}
	}
	for (const key of ap) {
		const ch = chunks.get(key);
		if (ch !== undefined) {
			ch.modelo.Destroy();
			chunks.delete(key);
		}
	}
}

// ---------- init ----------

let init = false;

export function construirMapa(): void {
	if (init) {
		return;
	}
	init = true;

	// limpa TUDO do workspace (menos Terrain)
	for (const c of Workspace.GetChildren()) {
		if (c.IsA("Terrain")) {
			continue;
		}
		if (c.Name === "Camera") {
			continue;
		}
		c.Destroy();
	}

	// limpa Lighting: remove Boom, ColorGrading, SunRays, etc
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
	Lighting.Technology = Enum.Technology.Compatibility;

	// gera chunks iniciais
	gerarChunks(0, 0);

	// spawn DENTRO do chunk (chao em Y=0, spawn em Y=1)
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

	// heartbeat: gerar chunks ao redor do jogador
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

	print("[Backrooms] Mapa gerado. Seed:", SEED);
}
