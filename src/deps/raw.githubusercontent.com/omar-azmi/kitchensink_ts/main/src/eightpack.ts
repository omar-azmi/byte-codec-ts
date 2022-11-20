/** utility functions for packing and unpacking bytes (8-bits) of primitive javascript objects. <br>
 * and hence the name of the module (*8(bit)pack*)
 * @module
*/

import { decode_varint, decode_varint_array, encode_varint, encode_varint_array } from "./eightpack-varint.js"
import { concatBytes, env_le, swapEndianessFast, typed_array_constructor_of } from "./typedbuffer.js"
import { NumericArrayType, NumericType, TypedArray, VarNumericArrayType, VarNumericType } from "./typedefs.js"

/** binary primitive types
 * - {@link NumericType} various binary representations of number
 * - {@link NumericArrayType} various binary representations of array of numbers. requires defining array length (number of items) during decoding as `args[0]`
 * - `"bytes"` a `Uint8Array`, which requires defining a bytesize length during decoding as `args[0]`
 * - `"str"` a string, which requires defining a bytesize length during decoding as `args[0]`
 * - `"cstr"` a null-terminated (`"\u0000"`) string. the null termination byte character is automatically added when encoding
 * - `"bool"` a boolean occupying a single byte
*/
export type PrimitiveType =
	| PrimitiveArrayType
	| NumericType
	| VarNumericType
	| "cstr"
	| "bool"

/** primitive types that typically require length information to be decoded */
export type PrimitiveArrayType =
	| NumericArrayType
	| VarNumericArrayType
	| "bytes"
	| "str"

/** all unpack functions return their decoded outputs in a 2-tupple array; <br>
 * the first element being the decoded value `V`, and the second being the number of bytes this data occupied */
export type Decoded<V, ByteSize extends number = number> = [value: V, bytesize: ByteSize]

/** primitive javascript types */
export type JSPrimitive = string | boolean | number | bigint | number[] | Uint8Array

/** packing function signature for {@link JSPrimitive} types */
export type EncodeFunc<T extends JSPrimitive, ARGS extends any[] = []> = (value: T, ...args: ARGS) => Uint8Array

/** unpacking function signature for {@link JSPrimitive} types */
export type DecodeFunc<T extends JSPrimitive, ARGS extends any[] = []> = (buffer: Uint8Array, offset: number, ...args: ARGS) => Decoded<T>

const txt_encoder = new TextEncoder()
const txt_decoder = new TextDecoder()

/** read `type` of value from buffer `buf` starting at position `offset` */
export const readFrom = (buf: Uint8Array, offset: number, type: PrimitiveType, ...args: any[]): [value: JSPrimitive, new_offset: number] => {
	const [value, bytesize] = unpack(type, buf, offset, ...args)
	return [value, offset + bytesize]
}

/** write `type` of `value` to buffer `buf` starting at position `offset` */
export const writeTo = (buf: Uint8Array, offset: number, type: PrimitiveType, value: JSPrimitive, ...args: any[]): [buf: Uint8Array, new_offset: number] => {
	const value_buf = pack(type, value, ...args)
	buf.set(value_buf, offset)
	return [buf, offset + value_buf.length]
}

/** encode a sequential array of items.
 * @example
 * ```ts
 * packSeq(["u4b", 0x12AB98], ["str", "hello"], ["bool", false]) === Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0)
 * ```
*/
export const packSeq = (...items: Parameters<typeof pack>[]) => {
	const bufs: Uint8Array[] = []
	for (const item of items) bufs.push(pack(...item))
	return concatBytes(...bufs)
}

/** decode as a sequential array of items. this is the inverse of {@link packSeq}
 * @example
 * ```ts
 * unpackSeq(Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0), 0, ["u4b"], ["str", 5], ["bool"]) === [[0x12AB98, "hello", false], 10]
 * ```
*/
export const unpackSeq = (buf: Uint8Array, offset: number, ...items: [type: PrimitiveType, ...args: any[]][]): Decoded<JSPrimitive[]> => {
	const values: JSPrimitive[] = []
	let total_bytesize = 0
	for (const [type, ...args] of items) {
		const [value, bytesize] = unpack(type, buf, offset + total_bytesize, ...args)
		values.push(value)
		total_bytesize += bytesize
	}
	return [values, total_bytesize]
}

/** auto value encoder/packer for {@link PrimitiveType} */
export const pack = (type: PrimitiveType, value: JSPrimitive, ...args: any[]): ReturnType<EncodeFunc<JSPrimitive>> => {
	switch (type) {
		case "bool": return encode_bool(value as boolean)
		case "cstr": return encode_cstr(value as string)
		case "str": return encode_str(value as string)
		case "bytes": return encode_bytes(value as Uint8Array)
		default: {
			if (type[1] === "v")
				return type.endsWith("[]") ?
					encode_varint_array(value as number[], type as VarNumericArrayType) :
					encode_varint(value as number, type as VarNumericType)
			else
				return type.endsWith("[]") ?
					encode_number_array(value as number[], type as NumericArrayType) :
					encode_number(value as number, type as NumericType)
		}
	}
}

/** auto buffer decoder/unpacker for {@link PrimitiveType} */
export const unpack = (type: PrimitiveType, buf: Uint8Array, offset: number, ...args: any[]): ReturnType<DecodeFunc<JSPrimitive>> => {
	switch (type) {
		case "bool": return decode_bool(buf, offset)
		case "cstr": return decode_cstr(buf, offset)
		case "str": return decode_str(buf, offset, ...args)
		case "bytes": return decode_bytes(buf, offset, ...args)
		default: {
			if (type[1] === "v")
				return type.endsWith("[]") ?
					decode_varint_array(buf, offset, type as VarNumericArrayType, ...args) :
					decode_varint(buf, offset, type as VarNumericType)
			else
				return type.endsWith("[]") ?
					decode_number_array(buf, offset, type as NumericArrayType, ...args) :
					decode_number(buf, offset, type as NumericType)
		}
	}
}

/** pack a `boolean` as 1-byte of data */
export const encode_bool: EncodeFunc<boolean> = (value) => Uint8Array.of(value ? 1 : 0)

/** unpack a `boolean` from 1-byte of data */
export const decode_bool: DecodeFunc<boolean> = (buf, offset = 0) => [buf[offset] >= 1 ? true : false, 1]

/** pack a `string` as an array of characters, terminated by the `"\u0000"` charbyte. this is the c convention of strings */
export const encode_cstr: EncodeFunc<string> = (value) => txt_encoder.encode(value + "\u0000")

/** unpack a `string` as an array of characters that's terminated by `"\u0000"` charbyte. this is the c convention of strings */
export const decode_cstr: DecodeFunc<string> = (buf, offset = 0) => {
	const
		offset_end = buf.indexOf(0x00, offset),
		txt_arr = buf.subarray(offset, offset_end),
		value = txt_decoder.decode(txt_arr)
	return [value, txt_arr.length + 1]
}

/** pack a `string` as an array of characters */
export const encode_str: EncodeFunc<string> = (value) => txt_encoder.encode(value)

/** unpack a `string` as an array of characters. you must provide the `bytesize` of the string being decoded, otherwise the decoder will unpack till the end of the buffer */
export const decode_str: DecodeFunc<string, [bytesize?: number]> = (buf, offset = 0, bytesize?) => {
	const
		offset_end = bytesize === undefined ? undefined : offset + bytesize,
		txt_arr = buf.subarray(offset, offset_end),
		value = txt_decoder.decode(txt_arr)
	return [value, txt_arr.length]
}

/** pack a `Uint8Array` array of bytes as is. (ie: don't perform any operation) */
export const encode_bytes: EncodeFunc<Uint8Array> = (value) => value

/** unpack a `Uint8Array` array of bytes. you must provide the `bytesize` of the bytes being decoded, otherwise the decoder will unpack till the end of the buffer */
export const decode_bytes: DecodeFunc<Uint8Array, [bytesize?: number]> = (buf, offset = 0, bytesize?) => {
	const
		offset_end = bytesize === undefined ? undefined : offset + bytesize,
		value = buf.slice(offset, offset_end)
	return [value, value.length]
}

/** pack a numeric array (`number[]`) in the provided {@link NumericArrayType} byte representation */
export const encode_number_array: EncodeFunc<number[], [type: NumericArrayType]> = (value, type) => {
	const
		[t, s, e] = type,
		typed_arr_constructor = typed_array_constructor_of(type),
		bytesize = parseInt(s) as (1 | 2 | 4 | 8),
		is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false,
		typed_arr: TypedArray = typed_arr_constructor.from(value)
	if (typed_arr instanceof Uint8Array) return typed_arr
	const buf = new Uint8Array(typed_arr.buffer)
	if (is_native_endian) return buf
	else return swapEndianessFast(buf, bytesize)
}

/** unpack a numeric array (`number[]`) that's encoded in one of {@link NumericArrayType} byte representation. you must provide the `array_length` of the array being decoded, otherwise the decoder will unpack till the end of the buffer */
export const decode_number_array: DecodeFunc<number[], [type: NumericArrayType, array_length?: number]> = (buf, offset = 0, type, array_length?) => {
	const
		[t, s, e] = type,
		bytesize = parseInt(s) as (1 | 2 | 4 | 8),
		is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false,
		bytelength = array_length ? bytesize * array_length : undefined,
		array_buf = buf.slice(offset, bytelength ? offset + bytelength : undefined),
		array_bytesize = array_buf.length,
		typed_arr_constructor = typed_array_constructor_of(type),
		typed_arr: TypedArray = new typed_arr_constructor(is_native_endian ? array_buf.buffer : swapEndianessFast(array_buf, bytesize).buffer)
	return [Array.from(typed_arr), array_bytesize]
}

/** pack a `number` in the provided {@link NumericType} byte representation */
export const encode_number: EncodeFunc<number, [type: NumericType]> = (value, type) => encode_number_array([value,], type as `${typeof type}[]`)

/** unpack a `number` in the provided {@link NumericType} byte representation */
export const decode_number: DecodeFunc<number, [type: NumericType]> = (buf, offset = 0, type) => {
	const [value_arr, bytesize] = decode_number_array(buf, offset, type as `${typeof type}[]`, 1)
	return [value_arr[0], bytesize]
}
