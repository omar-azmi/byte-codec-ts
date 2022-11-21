/** utility functions for handling buffers and typed arrays, and also reading and writing data to them
 * @module
*/

import { ConstructorOf, NumericArray, NumericDType, TypedArray, TypedArrayConstructor } from "./typedefs.js"

/** checks if an object `obj` is a {@link TypedArray}, based on simply checking whether `obj.buffer` exists or not. <br>
 * this is certainly not a very robust way of verifying. <br>
 * a better approach would be to check if `obj instanceof Object.getPrototypeOf(Uint8Array)`, but this is quicker <br>
*/
export const isTypedArray = (obj: unknown): obj is TypedArray => (obj as TypedArray).buffer ? true : false

/** get a typed array constructor by specifying the type as a string */
export const typed_array_constructor_of = <DType extends NumericDType = NumericDType>(type: `${DType}${string}`): TypedArrayConstructor<DType> => {
	if (type[2] === "c") return Uint8ClampedArray as TypedArrayConstructor<DType>
	type = type[0] + type[1] as typeof type // this is to trim excessive tailing characters
	switch (type as DType) {
		case "u1": return Uint8Array as TypedArrayConstructor<DType>
		case "u2": return Uint16Array as TypedArrayConstructor<DType>
		case "u4": return Uint32Array as TypedArrayConstructor<DType>
		//case "u8": return BigUint64Array as TypedArrayConstructor<DType>
		case "i1": return Int8Array as TypedArrayConstructor<DType>
		case "i2": return Int16Array as TypedArrayConstructor<DType>
		case "i4": return Int32Array as TypedArrayConstructor<DType>
		//case "i8": return BigInt64Array as TypedArrayConstructor<DType>
		case "f4": return Float32Array as TypedArrayConstructor<DType>
		case "f8": return Float64Array as TypedArrayConstructor<DType>
		default: {
			console.error("an unrecognized typed array type `\"${type}\"` was provided")
			return Uint8Array as TypedArrayConstructor<DType>
		}
	}
}

/** dictates if the native endianess of your `TypedArray`s is little endian. */
export const getEnvironmentEndianess = (): boolean => (new Uint8Array(Uint32Array.of(1).buffer))[0] === 1 ? true : false

/** this variable dictates if the native endianess of your `TypedArray`s is little endian. */
export const env_le = getEnvironmentEndianess()

/** swap the endianess of the provided `Uint8Array` buffer array in-place, given that each element has a byte-size of `bytesize`
 * @category inplace
*/
export const swapEndianess = (buf: Uint8Array, bytesize: number): Uint8Array => {
	const len = buf.byteLength
	for (let i = 0; i < len; i += bytesize) buf.subarray(i, i + bytesize).reverse()
	return buf
}

/** 10x faster implementation of {@link swapEndianess} that does not mutatate the original `buf` array
 * @category copy
*/
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

/** concatenate a bunch of `Uint8Array` and `Array<number>` into a single `Uint8Array` array
 * @category copy
*/
export const concatBytes = (...arrs: (Uint8Array | Array<number>)[]): Uint8Array => {
	const offsets: number[] = [0]
	for (const arr of arrs) offsets.push(offsets[offsets.length - 1] + arr.length)
	const outarr = new Uint8Array(offsets.pop()!)
	for (const arr of arrs) outarr.set(arr, offsets.shift())
	return outarr
}

/** concatenate a bunch of {@link TypedArray}
 * @category copy
*/
export const concatTyped = <TA extends TypedArray>(...arrs: TA[]): TA => {
	const offsets: number[] = [0]
	for (const arr of arrs) offsets.push(offsets[offsets.length - 1] + arr.length)
	const outarr = new (arrs[0].constructor as ConstructorOf<TA>)(offsets.pop()!)
	for (const arr of arrs) outarr.set(arr, offsets.shift())
	return outarr
}

/** resovle the positive (normalized) starting and ending indexes of a range. <br>
 * for both `start` and `end`, a negative index can be used to indicate an index from the end of the range, if a `length` is given. <br>
 * for example, `-2` refers to the second to last index (ie `length - 2`).
 * @param start starting index. defaults to `0`
 * @param end ending index. defaults to `undefined` if `length` is not provided. else `end = length` (before offsetting)
 * @param length length of the array in question. required if you want a numeric value of `end` that is `undefined`. defaults to `undefined`
 * @param offset in the very end of evauation, add an addition offset to `start` and `end` indexes
 * @returns a 3-tuple array of resolved [`start` index, `end` index, and `length` of range (ie `end - start`)]
*/
export function resolveRange(start: number | undefined, end: number | undefined, length: number, offset?: number): [start: number, end: number, length: number]
export function resolveRange(start?: number | undefined, end?: number | undefined, length?: undefined, offset?: number): [start: number, end: number | undefined, length: undefined]
export function resolveRange(start?: number | undefined, end?: number | undefined, length?: number, offset?: number) {
	start = start ?? 0
	offset = offset ?? 0
	if (length === undefined) return [start + offset, end === undefined ? end : end + offset, length] as [number, number | undefined, undefined]
	end = end ?? length
	start += start >= 0 ? 0 : length
	end += end >= 0 ? 0 : length
	length = end - start
	return [start + offset, end + offset, length >= 0 ? length : 0] as [number, number, number]
}

/** split {@link TypedArray} after every `step` number of elements through the use of subarray views <br>
 * @deprecated kind of pointless, when {@link sliceSkipTypedSubarray} and {@link sliceSkip} exist
 * @category inplace
*/
export const splitTypedSubarray = <TA extends TypedArray>(arr: TA, step: number): Array<TA> => sliceSkipTypedSubarray(arr, step)

/** slice `slice_length` number of elements, then jump forward `skip_length` number of elements, and repeat <br>
 * optionally provide a `start` index to begin at, and an `end` index to stop at. <br>
 * if you want to skip first and slice second, you can set `start = skip_length` to get the desired equivalent result <br>
 * @category copy
*/
export const sliceSkip = <A extends NumericArray>(arr: A, slice_length: number, skip_length: number = 0, start?: number, end?: number): Array<A> => {
	[start, end,] = resolveRange(start, end, arr.length)
	const out_arr = [] as A[]
	for (let offset = start; offset < end; offset += slice_length + skip_length) out_arr.push(arr.slice(offset, offset + slice_length) as A)
	return out_arr
}

/** similar to {@link sliceSkip}, but for subarray views of {@link TypedArray}. <br>
 * @category inplace
*/
export const sliceSkipTypedSubarray = <TA extends TypedArray>(arr: TA, slice_length: number, skip_length: number = 0, start?: number, end?: number): Array<TA> => {
	[start, end,] = resolveRange(start, end, arr.length)
	const out_arr = [] as TA[]
	for (let offset = start; offset < end; offset += slice_length + skip_length) out_arr.push(arr.subarray(offset, offset + slice_length) as TA)
	return out_arr
}

/** find out if two regular, or typed arrays are element wise equal, and have the same lengths */
export const isIdentical = <T extends ([] | TypedArray)>(arr1: T, arr2: T): boolean => {
	if (arr1.length !== arr2.length) return false
	return isSubidentical(arr1, arr2)
}

/** find out if two regular, or typed arrays are element wise equal upto the last element of the shorter of the two arrays */
export const isSubidentical = <T extends ([] | TypedArray)>(arr1: T, arr2: T): boolean => {
	const len = Math.min(arr1.length, arr2.length)
	for (let i = 0; i < len; i++) if (arr1[i] !== arr2[i]) return false
	return true
}
