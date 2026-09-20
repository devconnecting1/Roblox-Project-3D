/**
 * Mapa 3D (SERVIDOR) — sala inicial, corredor e salas, 100% em código.
 *
 * Zero Interface 2D: tudo é Part no Workspace (chão, paredes, teto,
 * pilares neon, PointLights e SpawnLocation). Layout fixo e interligado:
 * a sala leva ao corredor, o corredor leva às 4 salas.
 */
import { Lighting, Workspace } from "@rbxts/services";

const ALTURA = 12; // pé-direito
const ESPESSURA = 2;

function bloco(
	nome: string,
	tamanho: Vector3,
	pos: Vector3,
	cor: Color3,
	material: Enum.Material = Enum.Material.Slate,
): Part {
	const p = new Instance("Part");
	p.Name = nome;
	p.Size = tamanho;
	p.Position = pos;
	p.Color = cor;
	p.Material = material;
	p.Anchored = true;
	p.CanCollide = true;
	p.TopSurface = Enum.SurfaceType.Smooth;
	p.BottomSurface = Enum.SurfaceType.Smooth;
	p.Parent = Workspace;
	return p;
}

function luz(pai: Instance, nome: string, cor: Color3, alcance: number, brilho: number): PointLight {
	const l = new Instance("PointLight");
	l.Name = nome;
	l.Color = cor;
	l.Range = alcance;
	l.Brightness = brilho;
	l.Shadows = false;
	l.Parent = pai;
	return l;
}

/** Sala fechada com vão(s) de porta. Vãos: lista [eixo, centro, largura]. */
function sala(
	nome: string,
	cx: number,
	cz: number,
	larg: number,
	prof: number,
	corChao: Color3,
	vaosNorte: [number, number][] = [],
	vaosSul: [number, number][] = [],
	vaosOeste: [number, number][] = [],
	vaosLeste: [number, number][] = [],
): void {
	const x0 = cx - larg / 2;
	const x1 = cx + larg / 2;
	const z0 = cz - prof / 2;
	const z1 = cz + prof / 2;
	// Chão + teto
	bloco(
		`${nome}_Chao`,
		new Vector3(larg, ESPESSURA, prof),
		new Vector3(cx, -1, cz),
		corChao,
		Enum.Material.SmoothPlastic,
	);
	bloco(
		`${nome}_Teto`,
		new Vector3(larg, ESPESSURA, prof),
		new Vector3(cx, ALTURA + 1, cz),
		new Color3(0.09, 0.1, 0.13),
	);
	// Paredes com vãos: segmentos ao longo do eixo
	const paredeCor = new Color3(0.16, 0.17, 0.21);
	function paredeEixoZ(x: number, zA: number, zB: number, etiqueta: string): void {
		const comp = zB - zA;
		if (comp <= 0) {
			return;
		}
		bloco(
			`${nome}_${etiqueta}`,
			new Vector3(ESPESSURA, ALTURA, comp),
			new Vector3(x, ALTURA / 2, (zA + zB) / 2),
			paredeCor,
			Enum.Material.Brick,
		);
	}
	function paredeEixoX(z: number, xA: number, xB: number, etiqueta: string): void {
		const comp = xB - xA;
		if (comp <= 0) {
			return;
		}
		bloco(
			`${nome}_${etiqueta}`,
			new Vector3(comp, ALTURA, ESPESSURA),
			new Vector3((xA + xB) / 2, ALTURA / 2, z),
			paredeCor,
			Enum.Material.Brick,
		);
	}
	// Norte (z0) e Sul (z1): vãos = [centroX, largura]
	let cursor = x0;
	const nOrd = [...vaosNorte].sort((a, b) => a[0] < b[0]);
	for (const [c, l] of nOrd) {
		paredeEixoX(z0, cursor, c - l / 2, "N");
		cursor = c + l / 2;
	}
	paredeEixoX(z0, cursor, x1, "N");
	cursor = x0;
	const sOrd = [...vaosSul].sort((a, b) => a[0] < b[0]);
	for (const [c, l] of sOrd) {
		paredeEixoX(z1, cursor, c - l / 2, "S");
		cursor = c + l / 2;
	}
	paredeEixoX(z1, cursor, x1, "S");
	// Oeste (x0) e Leste (x1): vãos = [centroZ, largura]
	let curZ = z0;
	const oOrd = [...vaosOeste].sort((a, b) => a[0] < b[0]);
	for (const [c, l] of oOrd) {
		paredeEixoZ(x0, curZ, c - l / 2, "W");
		curZ = c + l / 2;
	}
	paredeEixoZ(x0, curZ, z1, "W");
	curZ = z0;
	const lOrd = [...vaosLeste].sort((a, b) => a[0] < b[0]);
	for (const [c, l] of lOrd) {
		paredeEixoZ(x1, curZ, c - l / 2, "E");
		curZ = c + l / 2;
	}
	paredeEixoZ(x1, curZ, z1, "E");
}

/** Pilar neon (marco visual da sala) com luz própria. */
function farol(nome: string, x: number, z: number, cor: Color3): void {
	const p = bloco(nome, new Vector3(2, 8, 2), new Vector3(x, 4, z), cor, Enum.Material.Neon);
	p.CanCollide = true;
	luz(p, `${nome}_Luz`, cor, 40, 2);
}

export function construirMapa(): void {
	// Clima: escuro com neblina curta (igual ao 2D)
	Lighting.Ambient = new Color3(0.08, 0.08, 0.1);
	Lighting.OutdoorAmbient = new Color3(0.08, 0.08, 0.1);
	Lighting.FogStart = 60;
	Lighting.FogEnd = 220;
	Lighting.GlobalShadows = true;
	Lighting.Brightness = 1;

	// SALA INICIAL (44×44) — vão norte leva ao corredor
	sala("Lobby", 0, 0, 44, 44, new Color3(0.55, 0.57, 0.63), [[0, 8]], []);
	// Âncora da luz do lobby num bloco invisível no teto
	const ancora = bloco(
		"AncoraLobby",
		new Vector3(2, 1, 2),
		new Vector3(0, 10, 0),
		new Color3(0, 0, 0),
		Enum.Material.SmoothPlastic,
	);
	ancora.Transparency = 1;
	ancora.CanCollide = false;
	luz(ancora, "LuzLobby", new Color3(1, 0.95, 0.85), 70, 2);
	farol("FarolLobby", 0, 12, new Color3(1, 0.85, 0.3));

	// CORREDOR (8 de largura, z −22 → −82) — vão sul casa com a sala; tampa no fim
	sala(
		"Corredor",
		0,
		-52,
		8,
		60,
		new Color3(0.32, 0.33, 0.38),
		[],
		[[0, 8]],
		[
			[-40, 6],
			[-64, 6],
		],
		[
			[-40, 6],
			[-64, 6],
		],
	);
	for (const z of [-34, -52, -70]) {
		const poste = bloco(
			`Poste_${z}`,
			new Vector3(1, 2, 1),
			new Vector3(0, 11, z),
			new Color3(0, 0, 0),
			Enum.Material.SmoothPlastic,
		);
		poste.Transparency = 1;
		poste.CanCollide = false;
		luz(poste, `LuzCorr_${z}`, new Color3(1, 0.9, 0.75), 34, 2);
	}

	// 4 SALAS (18×16) penduradas no corredor: vãos casados dos dois lados
	sala("SalaVerde", -15, -40, 18, 16, new Color3(0.24, 0.55, 0.28), [], [], [], [[-40, 6]]);
	sala("SalaAzul", 15, -40, 18, 16, new Color3(0.23, 0.43, 0.71), [], [], [[-40, 6]], []);
	sala("SalaLaranja", -15, -64, 18, 16, new Color3(0.71, 0.42, 0.16), [], [], [], [[-64, 6]]);
	sala("SalaRoxa", 15, -64, 18, 16, new Color3(0.55, 0.35, 0.71), [], [], [[-64, 6]], []);
	farol("FarolVerde", -15, -40, new Color3(0.3, 1, 0.4));
	farol("FarolAzul", 15, -40, new Color3(0.35, 0.65, 1));
	farol("FarolLaranja", -15, -64, new Color3(1, 0.6, 0.2));
	farol("FarolRoxo", 15, -64, new Color3(0.75, 0.5, 1));

	// Spawn na sala inicial
	const spawn = new Instance("SpawnLocation");
	spawn.Name = "SpawnLobby";
	spawn.Size = new Vector3(6, 1, 6);
	spawn.Position = new Vector3(0, 1, 10);
	spawn.Color = new Color3(0.6, 0.62, 0.68);
	spawn.Material = Enum.Material.SmoothPlastic;
	spawn.Anchored = true;
	spawn.Neutral = true;
	spawn.Enabled = true;
	spawn.Parent = Workspace;

	print("[3D] Mapa construído: sala + corredor + 4 salas, tudo em código.");
}
