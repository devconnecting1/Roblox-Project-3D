/**
 * Chunk manager — gera e descarta chunks ao redor do jogador.
 * Cada chunk é 64×64 studs, dividido em 8×8 tiles de 8×8.
 *
 * Geração procedural determinística (mesmo seed = mesmo mapa).
 * Módulos: room, hall, largRoom, pilar, deadEnd, stair, blackout.
 */
import { Lighting, Players, Workspace } from "@rbxts/services";
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

// ================== tipos ==================

interface Modulo {
	tipo: string;
	// portas: quais lados do chunk têm abertura (N=0, E=1, S=2, W=3)
	portas: boolean[];
	// tiles internos: 0=vazio, 1=chão, 2=parede, 3=pilar
	tiles: number[][];
}

interface Chunk {
	cx: number;
	cz: number;
	modelo: Model;
	modulos: Modulo[];
}

// ================== estado ==================

const chunks = new Map<string, Chunk>();
let rngGlobal = new RNG(SEED);

// ================== helpers ==================

function bloco(
	nome: string,
	tam: Vector3,
	pos: Vector3,
	cor: Color3,
	colidi = true,
	mat = Enum.Material.Plastic,
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
	p.Parent = Workspace;
	return p;
}

function cor3(arr: [number, number, number]): Color3 {
	return new Color3(arr[0], arr[1], arr[2]);
}

function chunkKey(cx: number, cz: number): string {
	return `${cx},${cz}`;
}

// ================== geração de módulo ==================

function gerarModulo(rng: RNG): Modulo {
	// seleciona tipo por peso
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

	// portas: aleatório mas com pelo menos 1
	const portas = [false, false, false, false];
	const nPortas = tipo === "deadEnd" ? 1 : rng.nextInt(2, 4);
	const lados = [0, 1, 2, 3];
	// shuffle
	for (let i = lados.size() - 1; i > 0; i--) {
		const j = rng.nextInt(0, i);
		const tmp = lados[i];
		lados[i] = lados[j];
		lados[j] = tmp;
	}
	for (let i = 0; i < nPortas && i < 4; i++) {
		portas[lados[i]] = true;
	}

	// tiles internos 8×8
	const tiles: number[][] = [];
	for (let z = 0; z < TILES_POR_CHUNK; z++) {
		tiles[z] = [];
		for (let x = 0; x < TILES_POR_CHUNK; x++) {
			tiles[z][x] = 1; // chão por padrão
		}
	}

	if (tipo === "room" || tipo === "largRoom") {
		// paredes nas bordas (menos nas portas)
		for (let i = 0; i < TILES_POR_CHUNK; i++) {
			if (!portas[0]) {
				tiles[0][i] = 2;
			} // norte
			if (!portas[2]) {
				tiles[TILES_POR_CHUNK - 1][i] = 2;
			} // sul
			if (!portas[3]) {
				tiles[i][0] = 2;
			} // oeste
			if (!portas[1]) {
				tiles[i][TILES_POR_CHUNK - 1] = 2;
			} // leste
		}
		// sala grande: mais espaço interno
		if (tipo === "largRoom") {
			// remove paredes internas extras
			for (let z = 2; z < TILES_POR_CHUNK - 2; z++) {
				for (let x = 2; x < TILES_POR_CHUNK - 2; x++) {
					tiles[z][x] = 1;
				}
			}
		}
	} else if (tipo === "hall") {
		// corredor: só 2 portas opostas ou adjacentes
		const p1 = lados[0];
		const p2 = lados[1];
		portas[0] = false;
		portas[1] = false;
		portas[2] = false;
		portas[3] = false;
		portas[p1] = true;
		portas[p2] = true;
		// preenche tudo como parede, depois escava o corredor
		for (let z = 0; z < TILES_POR_CHUNK; z++) {
			for (let x = 0; x < TILES_POR_CHUNK; x++) {
				tiles[z][x] = 2;
			}
		}
		if (p1 === 0 || p1 === 2) {
			// corredor vertical (N-S)
			for (let z = 0; z < TILES_POR_CHUNK; z++) {
				for (let x = 2; x < 6; x++) {
					tiles[z][x] = 1;
				}
			}
			// abre as portas
			if (portas[0]) {
				for (let x = 2; x < 6; x++) {
					tiles[0][x] = 1;
				}
			}
			if (portas[2]) {
				for (let x = 2; x < 6; x++) {
					tiles[TILES_POR_CHUNK - 1][x] = 1;
				}
			}
		} else {
			// corredor horizontal (W-E)
			for (let z = 2; z < 6; z++) {
				for (let x = 0; x < TILES_POR_CHUNK; x++) {
					tiles[z][x] = 1;
				}
			}
			if (portas[3]) {
				for (let z = 2; z < 6; z++) {
					tiles[z][0] = 1;
				}
			}
			if (portas[1]) {
				for (let z = 2; z < 6; z++) {
					tiles[z][TILES_POR_CHUNK - 1] = 1;
				}
			}
		}
	} else if (tipo === "pilar") {
		// sala com pilares em grade
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
		// pilares a cada 3 tiles
		for (let z = 2; z < TILES_POR_CHUNK - 1; z += 3) {
			for (let x = 2; x < TILES_POR_CHUNK - 1; x += 3) {
				tiles[z][x] = 3;
			}
		}
	} else if (tipo === "deadEnd") {
		// 1 porta, resto parede
		for (let i = 0; i < TILES_POR_CHUNK; i++) {
			tiles[0][i] = 2;
			tiles[TILES_POR_CHUNK - 1][i] = 2;
			tiles[i][0] = 2;
			tiles[i][TILES_POR_CHUNK - 1] = 2;
		}
		// abre só 1 porta
		if (portas[0]) {
			for (let x = 2; x < 6; x++) {
				tiles[0][x] = 1;
			}
		} else if (portas[1]) {
			for (let z = 2; z < 6; z++) {
				tiles[z][TILES_POR_CHUNK - 1] = 1;
			}
		} else if (portas[2]) {
			for (let x = 2; x < 6; x++) {
				tiles[TILES_POR_CHUNK - 1][x] = 1;
			}
		} else if (portas[3]) {
			for (let z = 2; z < 6; z++) {
				tiles[z][0] = 1;
			}
		}
	} else if (tipo === "stair") {
		// escada no centro
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
	} else if (tipo === "blackout") {
		// escuro: todas as paredes, sem portas (mas permite entrada lateral)
		portas[0] = false;
		portas[1] = false;
		portas[2] = false;
		portas[3] = false;
		for (let z = 0; z < TILES_POR_CHUNK; z++) {
			for (let x = 0; x < TILES_POR_CHUNK; x++) {
				tiles[z][x] = 2;
			}
		}
	}

	return { tipo, portas, tiles };
}

// ================== construção visual ==================

function construirChunk(cx: number, cz: number): Chunk {
	const modelo = new Instance("Model");
	modelo.Name = `Chunk_${cx}_${cz}`;

	const baseX = cx * CHUNK_TAM;
	const baseZ = cz * CHUNK_TAM;
	const rng = new RNG(SEED + cx * 7919 + cz * 7907);

	// gera módulo para este chunk
	const mod = gerarModulo(rng);

	// chão global do chunk (base)
	const chaoCor = cor3(COR_CHAO);
	const chaoTam = new Vector3(CHUNK_TAM, 1, CHUNK_TAM);
	const chao = new Instance("Part");
	chao.Name = "Chao";
	chao.Size = chaoTam;
	chao.Position = new Vector3(baseX + CHUNK_TAM / 2, -0.5, baseZ + CHUNK_TAM / 2);
	chao.Color = chaoCor;
	chao.Material = Enum.Material.Fabric; // carpete
	chao.Anchored = true;
	chao.CanCollide = true;
	chao.TopSurface = Enum.SurfaceType.Smooth;
	chao.BottomSurface = Enum.SurfaceType.Smooth;
	chao.Parent = modelo;

	// teto global
	const tetoCor = cor3(COR_TETO);
	const teto = new Instance("Part");
	teto.Name = "Teto";
	teto.Size = chaoTam;
	teto.Position = new Vector3(baseX + CHUNK_TAM / 2, ALTURA + 0.5, baseZ + CHUNK_TAM / 2);
	teto.Color = tetoCor;
	teto.Material = Enum.Material.SmoothPlastic;
	teto.Anchored = true;
	teto.CanCollide = true;
	teto.TopSurface = Enum.SurfaceType.Smooth;
	teto.BottomSurface = Enum.SurfaceType.Smooth;
	teto.Parent = modelo;

	// constrói tiles
	const paredeCor1 = cor3(COR_PAREDE);
	const paredeCor2 = cor3(COR_PAREDE2);
	const luzCor = cor3(COR_LUZ);

	for (let z = 0; z < TILES_POR_CHUNK; z++) {
		for (let x = 0; x < TILES_POR_CHUNK; x++) {
			const tipo = mod.tiles[z][x];
			const tx = baseX + x * TILE_TAM + TILE_TAM / 2;
			const tz = baseZ + z * TILE_TAM + TILE_TAM / 2;

			if (tipo === 2) {
				// parede
				const paredeCor = rng.next() > 0.5 ? paredeCor1 : paredeCor2;
				const p = new Instance("Part");
				p.Name = `W_${x}_${z}`;
				p.Size = new Vector3(TILE_TAM, ALTURA, TILE_TAM);
				p.Position = new Vector3(tx, ALTURA / 2, tz);
				p.Color = paredeCor;
				p.Material = Enum.Material.SmoothPlastic; // parede lisa (wallpaper)
				p.Anchored = true;
				p.CanCollide = true;
				p.TopSurface = Enum.SurfaceType.Smooth;
				p.BottomSurface = Enum.SurfaceType.Smooth;
				p.Parent = modelo;
			} else if (tipo === 3) {
				// pilar
				const p = new Instance("Part");
				p.Name = `P_${x}_${z}`;
				p.Size = new Vector3(TILE_TAM * 0.6, ALTURA, TILE_TAM * 0.6);
				p.Position = new Vector3(tx, ALTURA / 2, tz);
				p.Color = paredeCor1;
				p.Material = Enum.Material.SmoothPlastic;
				p.Anchored = true;
				p.CanCollide = true;
				p.TopSurface = Enum.SurfaceType.Smooth;
				p.BottomSurface = Enum.SurfaceType.Smooth;
				p.Parent = modelo;
			}
		}
	}

	// iluminação fluorescente (teto)
	if (mod.tipo !== "blackout") {
		const nLuzes = mod.tipo === "largRoom" ? 4 : mod.tipo === "pilar" ? 3 : 2;
		for (let i = 0; i < nLuzes; i++) {
			const lx = baseX + (CHUNK_TAM * (i + 1)) / (nLuzes + 1);
			const lz = baseZ + CHUNK_TAM / 2;

			// tubo fluorescente (part fino no teto)
			const tubo = new Instance("Part");
			tubo.Name = `Fluor_${i}`;
			tubo.Size = new Vector3(0.4, 0.3, CHUNK_TAM * 0.6);
			tubo.Position = new Vector3(lx, ALTURA - 0.15, lz);
			tubo.Color = new Color3(0.95, 0.95, 0.9);
			tubo.Material = Enum.Material.Neon;
			tubo.Anchored = true;
			tubo.CanCollide = false;
			tubo.TopSurface = Enum.SurfaceType.Smooth;
			tubo.BottomSurface = Enum.SurfaceType.Smooth;
			tubo.Parent = modelo;

			// PointLight
			const pl = new Instance("PointLight");
			pl.Color = luzCor;
			pl.Range = 40;
			pl.Brightness = 1.2;
			pl.Shadows = false;
			pl.Parent = tubo;
		}
	}

	// escada (se módulo é stair)
	if (mod.tipo === "stair") {
		const sx = baseX + CHUNK_TAM / 2 - 8;
		const sz = baseZ + CHUNK_TAM / 2;
		const deg = 6;
		const dx = 2.5;
		for (let i = 0; i < deg; i++) {
			const d = new Instance("Part");
			d.Name = `Deg_${i}`;
			d.Size = new Vector3(dx, 1, 4);
			d.Position = new Vector3(sx + i * dx, i * -2 + 0.5, sz);
			d.Color = new Color3(0.4, 0.38, 0.35);
			d.Material = Enum.Material.Concrete;
			d.Anchored = true;
			d.CanCollide = true;
			d.TopSurface = Enum.SurfaceType.Smooth;
			d.BottomSurface = Enum.SurfaceType.Smooth;
			d.Parent = modelo;
		}
	}

	modelo.Parent = Workspace;

	return { cx, cz, modelo, modulos: [mod] };
}

// ================== sistema de chunks ==================

function gerarChunksProximos(jogadorX: number, jogadorZ: number): void {
	const jcX = math.floor(jogadorX / CHUNK_TAM);
	const jcZ = math.floor(jogadorZ / CHUNK_TAM);

	for (let dx = -GERAR_RAIO; dx <= GERAR_RAIO; dx++) {
		for (let dz = -GERAR_RAIO; dz <= GERAR_RAIO; dz++) {
			const key = chunkKey(jcX + dx, jcZ + dz);
			if (!chunks.has(key)) {
				const chunk = construirChunk(jcX + dx, jcZ + dz);
				chunks.set(key, chunk);
			}
		}
	}

	// descarta chunks distantes
	const paraApagar: string[] = [];
	for (const [key, chunk] of chunks) {
		const distX = math.abs(chunk.cx - jcX);
		const distZ = math.abs(chunk.cz - jcZ);
		if (distX > DESCARTAR_RAIO || distZ > DESCARTAR_RAIO) {
			paraApagar.push(key);
		}
	}
	for (const key of paraApagar) {
		const chunk = chunks.get(key);
		if (chunk !== undefined) {
			chunk.modelo.Destroy();
			chunks.delete(key);
		}
	}
}

// ================== loop principal ==================

let inicializado = false;

function iniciar(): void {
	if (inicializado) {
		return;
	}
	inicializado = true;

	// limpa workspace (ignora Terrain — não pode ser Destroy)
	for (const c of Workspace.GetChildren()) {
		if (c.IsA("Terrain")) {
			continue;
		}
		if (c.IsA("BasePart") || c.IsA("Model")) {
			c.Destroy();
		}
	}

	// clima Backrooms
	Lighting.Ambient = new Color3(0.5, 0.48, 0.4);
	Lighting.OutdoorAmbient = new Color3(0.15, 0.15, 0.12);
	Lighting.FogStart = 0;
	Lighting.FogEnd = 120;
	Lighting.FogColor = new Color3(0.7, 0.65, 0.5);
	Lighting.GlobalShadows = false;
	Lighting.Brightness = 0.3;
	Lighting.ClockTime = 14; // tarde eterna

	// gera chunk inicial
	gerarChunksProximos(0, 0);

	// spawn
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "Spawn";
	spawn.Size = new Vector3(6, 1, 6);
	spawn.Position = new Vector3(0, 1, 0);
	spawn.Color = cor3(COR_CHAO);
	spawn.Material = Enum.Material.Fabric;
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.TopSurface = Enum.SurfaceType.Smooth;
	spawn.BottomSurface = Enum.SurfaceType.Smooth;
	spawn.Parent = Workspace;

	// loop de atualização
	const conn = game.GetService("RunService").Heartbeat.Connect(() => {
		const player = Players.GetChildren()[0] as Player | undefined;
		if (player === undefined) {
			return;
		}
		const char = player.Character;
		if (char === undefined) {
			return;
		}
		const hrp = char.FindFirstChild("HumanoidRootPart") as Part | undefined;
		if (hrp === undefined) {
			return;
		}
		gerarChunksProximos(hrp.Position.X, hrp.Position.Z);
	});

	print("[Backrooms] Servidor no ar. Chunks gerados ao redor do jogador.");
}

export function construirMapa(): void {
	iniciar();
}
