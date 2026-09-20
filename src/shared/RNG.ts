/**
 * RNG determinístico (mulberry32) — mesmo seed = mesmo mapa sempre.
 * Usa bit32 do Lua (sem Math.imul).
 */
export class RNG {
	private s: number;
	constructor(seed: number) {
		this.s = seed | 0;
	}
	next(): number {
		this.s = (this.s + 0x6d2b79f5) | 0;
		let t = bit32.bxor(this.s, bit32.rshift(this.s, 15));
		t = bit32.band(t * (1 | bit32.band(this.s, 0x7fffffff)), 0xffffffff);
		t = (t + bit32.lshift(t, 7)) | 0;
		t = bit32.bxor(t, bit32.rshift(t, 11));
		t = (t + bit32.lshift(t, 3)) | 0;
		t = bit32.bxor(t, bit32.rshift(t, 14));
		return bit32.band(t, 0xffffffff) / 4294967296;
	}
	nextInt(min: number, max: number): number {
		return math.floor(this.next() * (max - min + 1)) + min;
	}
	choose<T>(arr: T[]): T {
		return arr[this.nextInt(0, arr.size() - 1)];
	}
}
