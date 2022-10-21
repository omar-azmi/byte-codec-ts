declare const [DEBUG, MINIFY, BUNDLE]: [boolean, boolean, boolean]

/** turn optional properties `K` of interface `I` into required */
export type Require<I, K extends keyof I> = I & Required<Pick<I, K>>

/** represents a typical javasctipt object, something that pairs `keys` with `values` */
export type Obj = { [key: PropertyKey]: any }

/** represents an empty javasctipt object */
export type EmptyObj = { [key: PropertyKey]: never }

/** abstract constructor of any typed array, such as `new Uint8Array(...)` */
export type TypedArrayConstructor = Uint8ArrayConstructor | Int8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor | BigUint64ArrayConstructor | BigInt64ArrayConstructor

/** an instance of any typed array, such as `Uint8Array` */
export type TypedArray = Uint8Array | Int8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigUint64Array | BigInt64Array

/** concatenate a bunch of `Uint8Array` arrays */
export const concat = (...u8arrs: Uint8Array[]): Uint8Array => {
	const offsets: number[] = [0]
	for (const arr of u8arrs) offsets.push(offsets[offsets.length - 1] + arr.length)
	const outarr = new Uint8Array(offsets.pop()!)
	for (const arr of u8arrs) outarr.set(arr, offsets.shift())
	return outarr
}

/** check the endianess of you javascript environment. <br>
 * this is important because multi-byte `TypedArray`s are encoded in your environment's endianess, and you don't get a say in choosing an alternate one
 * @return boolean `true` implies littleEndian, `false` implies bigEndian
*/
export const getEnvironmentEndianess = (): boolean => (new Uint8Array(Uint32Array.of(1).buffer))[0] === 1 ? true : false

/** swap the endianess of the provided `Uint8Array` buffer array in-place, given that each element has a byte-size of `bytesize` */
export const swapEndianess = (buf: Uint8Array, bytesize: number): Uint8Array => {
	const len = buf.byteLength
	for (let i = 0; i < len; i += bytesize) buf.subarray(i, i + bytesize).reverse()
	return buf
}

/** 10x faster implementation of {@link swapEndianess} that does not mutatate the original `buf` array */
export const swapEndianessFast = (buf: Uint8Array, bytesize: number): Uint8Array => {
	const
		len = buf.byteLength,
		swapped_buf = new Uint8Array(len),
		bs = bytesize
	for (let offset = 0; offset < bs; offset++) {
		const a = bs - 1 - offset * 2
		for (let i = offset; i < len + offset; i += bs) swapped_buf[i] = buf[i + a]
	}
	/* the above loop is equivalent to the following: `for (let offset = 0; offset < bs; offset++) for (let i = 0; i < len; i += bs) swapped_buf[i + offset] = buf[i + bs - 1 - offset]` */
	return swapped_buf
}

/** find out if two regular, or typed arrays are element wise equal, and have the same lengths */
export const is_identical = <T extends ([] | TypedArray)>(arr1: T, arr2: T): boolean => {
	const len = arr1.length
	if (arr2.length !== len) return false
	for (let i = 0; i < len; i++) if (arr1[i] !== arr2[i]) return false
	return true
}

/* development helping tools. don't include in production */

/** convert an array of numbers to hex_string, for the sake of representation or visual purposes */
export const to_hex_string = (arr: number[]) => {
	const str = arr.map(v => v.toString(16)).reduce((s, v) => s + "0x" + v + ", ", "")
	return "[" + str.substring(0, str.length - 2) + "]"
}