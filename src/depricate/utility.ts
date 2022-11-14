declare const [DEBUG, MINIFY, BUNDLE]: [boolean, boolean, boolean]
import { SchemaNode } from "./schema_codec"

/** get the constructor function of type `T` */
export type ConstructorOf<T> = new (...args: any[]) => T

/** turn optional properties `K` of interface `I` into required */
export type Require<T, P extends keyof T> = Omit<T, P> & Required<Pick<T, P>>
//export type Require<I, K extends keyof I> = I & Required<Pick<I, K>>

export type OptionalKeysOf<T> = { [K in keyof T as (undefined extends T[K] ? K : never)]: T[K] }

export type ClassFieldsOf<T> = { [K in keyof T as (T[K] extends Function ? never : K)]: T[K] }

export type Decoded<V, ByteSize extends number = number> = [value: V, bytesize: ByteSize]

/** represents a typical javasctipt object, something that pairs `keys` with `values` */
export type Obj = { [key: PropertyKey]: any }

/** represents an empty javasctipt object */
export type EmptyObj = { [key: PropertyKey]: never }

/** unsigned integer, signed integer, or IEEE-754 float */
export type NumericFormatType = "u" | "i" | "f"

/** little-endian, big-endian, clamped 1-byte, or 1-byte */
export type NumericEndianType = "l" | "b"

/** 1-byte, 2-bytes, 4-bytes, 8-bytes, or variable number of bytes */
export type ByteSize = "1" | "2" | "4" | "8"

/** indicates the name of a numeric type. <br>
 * the collection of possible valid numeric types is:
 * - `"u1"`, `"u2"`, `"u4"`, `"u8"`, `"i1"`, `"i2"`, `"i4"`, `"i8"`, `"f4"`, `"f8"`, `"u1c"`
 * 
 * the first character specifies the format:
 * - `u` = unsigned integer
 * - `i` = signed integer
 * - `f` = float IEEE-754
 * 
 * the second character specifies the byte-size:
 * - `1` = one byte
 * - `2` = two bytes (short)
 * - `4` = four bytes (word)
 * - `8` = eight bytes (long)
*/
export type NumericDType = Exclude<`${NumericFormatType}${ByteSize}` | "u1c", "f1" | "f2" | "u8" | "i8">

/** abstract constructor of any typed array, such as `new Uint8Array(...)`
 * you can narrow down the constructor through the use of a  {@link NumericDType} string annotation
 * example: `const clamp_arr_constructor: TypedArrayConstructor<"u1c"> = Uint8ClampedArray`
*/
export type TypedArrayConstructor<DType extends NumericDType = NumericDType> = {
	"u1": Uint8ArrayConstructor
	"u1c": Uint8ClampedArrayConstructor
	"u2": Uint16ArrayConstructor
	"u4": Uint32ArrayConstructor
	// "u8": BigUint64ArrayConstructor
	"i1": Int8ArrayConstructor
	"i2": Int16ArrayConstructor
	"i4": Int32ArrayConstructor
	// "i8": BigInt64ArrayConstructor
	"f4": Float32ArrayConstructor
	"f8": Float64ArrayConstructor
}[DType]

/** an instance of any typed array, such as `Uint8Array`
 * you can narrow down the type through the use of a  {@link NumericDType} string annotation
 * example: `const clammped_bytes_arr: TypedArrayConstructor<"u1c"> = Uint8ClampedArray`
*/
export type TypedArray<DType extends NumericDType = NumericDType> = {
	"u1": Uint8Array
	"u1c": Uint8ClampedArray
	"u2": Uint16Array
	"u4": Uint32Array
	// "u8": BigUint64Array
	"i1": Int8Array
	"i2": Int16Array
	"i4": Int32Array
	// "i8": BigInt64Array
	"f4": Float32Array
	"f8": Float64Array
}[DType]

/** get a typed array constructor by specifying the type as a string */
export const typed_array_constructor_of = <DType extends NumericDType = NumericDType>(type: `${DType}${string}`): TypedArrayConstructor<DType> => {
	if (type[2] === "c") return Uint8ClampedArray as any
	type = type[0] + type[1] as typeof type // this is to trim excessive tailing characters
	switch (type) {
		case "u1": return Uint8Array as any
		case "u2": return Uint16Array as any
		case "u4": return Uint32Array as any
		//case "u8": return BigUint64Array as any
		case "i1": return Int8Array as any
		case "i2": return Int16Array as any
		case "i4": return Int32Array as any
		//case "i8": return BigInt64Array as any
		case "f4": return Float32Array as any
		case "f8": return Float64Array as any
		default: {
			console.error("an unrecognized typed array type `\"${type}\"` was provided")
			return Uint8Array as any
		}
	}
}

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
	if (arr1.length !== arr2.length) return false
	return is_subidentical(arr1, arr2)
}

/** find out if two regular, or typed arrays are element wise equal upto the last element of the shorter of the two arrays */
export const is_subidentical = <T extends ([] | TypedArray)>(arr1: T, arr2: T): boolean => {
	const len = Math.min(arr1.length, arr2.length)
	for (let i = 0; i < len; i++) if (arr1[i] !== arr2[i]) return false
	return true
}

/** parse files based on a specific schema `S` */
export class FileParser<S extends SchemaNode<any, string>> {
	/** the html input element that provides a gateway for user file selection */
	readonly loader_input: HTMLInputElement = document.createElement("input")
	readonly downloader_link: HTMLAnchorElement = document.createElement("a")
	readonly file_reader = new FileReader()
	/** schema to be used for encoding and decoding */
	readonly schema: S
	/** a list of decoded files. you can delete the entries here to save up memory */
	loaded_data: NonNullable<S["value"]>[] = []

	/**
	 * @param schema which schema class to base the decoding and encoding on
	 * @param attach_to where do you wish to attach the `loader_input` html element? if `undefined`, it will not get attached to the DOM. default = document.body
	*/
	constructor(schema: S, attach_to: HTMLElement | undefined = document.body) {
		this.schema = schema
		this.loader_input.type = "file"
		this.loader_input.innerHTML = "load file"
		this.loader_input.onchange = () => {
			const
				files = this.loader_input.files!,
				len = files.length
			for (let i = 0; i < len; i++) this.parseFile(files[i]).then(data => this.loaded_data.push(data))
		}
		this.downloader_link.innerHTML = "download file"
		if (attach_to instanceof HTMLElement) {
			attach_to.appendChild(this.loader_input)
			attach_to.appendChild(this.downloader_link)
		}
	}

	/** parse and decode the provided file */
	parseFile(file: File) {
		return new Promise<NonNullable<S["value"]>>((resolve, reject) => {
			this.file_reader.readAsArrayBuffer(file)
			this.file_reader.onload = () => resolve(this.parseBuffer(this.file_reader.result as ArrayBuffer))
			this.file_reader.onerror = () => reject(this.file_reader.error)
		})
	}

	/** parse and decode the provided buffer */
	parseBuffer(buf: ArrayBuffer): NonNullable<S["value"]> {
		let t0: number
		if (DEBUG) t0 = performance.now()
		const
			bin = new Uint8Array(buf),
			[value, bytesize] = this.schema.decode(bin, 0)
		if (DEBUG) {
			let t1 = performance.now()
			console.log("loaded data: ", value)
			console.log("parsing time: ", t1 - t0!, "ms")
		}
		return value
	}

	/** clear the loaded data to free memory */
	clearLoadedData(): void {
		while (this.loaded_data.length > 0) this.loaded_data.pop()
	}

	/** encode the provided javascript object into a `Uint8Array` bytes array using `this.schema.encode` */
	encodeObject(value: NonNullable<S["value"]>): Uint8Array {
		return this.schema.encode(value)
	}

	/** download the provided javascript object as a binary blob, by encoding it based on `this.schema.encode` */
	downloadObject(value: NonNullable<S["value"]>, filename: string = "") {
		const blob = new Blob([this.encodeObject(value)], { type: "application/octet-stream" })
		const url = URL.createObjectURL(blob)
		this.downloader_link.setAttribute("href", url)
		this.downloader_link.setAttribute("download", filename)
		this.downloader_link.click() // start downloading
	}
}

/* development helping tools. don't include in production */

/** convert an array of numbers to hex_string, for the sake of representation or visual purposes */
export const to_hex_string = (arr: number[] | TypedArray, sep: string = ", ", prefix: string = "0x", trailing_sep: boolean = false) => {
	const num_arr: number[] = (arr as TypedArray).buffer ? Array.from(arr as TypedArray) : arr as number[]
	const str = num_arr.map(v => v.toString(16).toUpperCase()).reduce((s, v) => {
		v = v.length === 2 ? v : "0" + v
		return s + prefix + v + sep
	}, "")
	return "[" + str.substring(0, str.length - (trailing_sep ? 0 : sep.length)) + "]"
}
