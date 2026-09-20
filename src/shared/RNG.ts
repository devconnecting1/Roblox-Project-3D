/**
 * RNG determinístico (mulberry32) — mesmo seed = mesmo mapa sempre.
 */
export class RNG {
	private s: number;
	constructor(seed: number) {
		this.s = seed | 0;
	}
	next(): number {
		this.s = (this.s + 0x6d2b79f5) | 0;
		let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	nextInt(min: number, max: number): number {
		return math.floor(this.next() * (max - min + 1)) + min;
	}
	choose<T>(arr: T[]): T {
		return arr[this.nextInt(0, arr.size() - 1)];
	}
}
