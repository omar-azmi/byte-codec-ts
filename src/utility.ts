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

/** abstract constructor of any typed array, such as `new Uint8Array(...)` */
export type TypedArrayConstructor = Uint8ArrayConstructor | Int8ArrayConstructor | Uint8ClampedArrayConstructor | Int16ArrayConstructor | Uint16ArrayConstructor | Int32ArrayConstructor | Uint32ArrayConstructor | Float32ArrayConstructor | Float64ArrayConstructor //| BigUint64ArrayConstructor | BigInt64ArrayConstructor

/** an instance of any typed array, such as `Uint8Array` */
export type TypedArray = Uint8Array | Int8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array //| BigUint64Array | BigInt64Array

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
