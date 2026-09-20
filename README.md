# Roblox-Project-3D

Jogo 3D em **Workspace puro (zero Interface 2D)** com roblox-ts + Rojo. O mapa é construído 100% em código pelo servidor. Build automático via GitHub Actions (artifact `.rbxlx`).

## Mapa atual
- **Sala inicial** (44×44) com spawn, pilar neon e vão norte
- **Corredor** (8×60) com 3 postes de luz e tampa no fim
- **4 salas** 18×16 penduradas no corredor (Verde/Azul/Laranja/Roxa), cada uma com pilar neon + luz própria
- Clima escuro com neblina curta

## Dev
- `npm install` → `npm run build:place` (gera `build.rbxlx`)
- `npm run serve` + `rojo serve` para sync no Studio
