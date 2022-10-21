/**
 * a binary serializer (encoder and decoder) for primitive javascript types {@link JSPrimitive} to/from binary representation types {@link PrimitiveType}
 * @module
*/

import { concat, getEnvironmentEndianess, swapEndianessFast, TypedArray, TypedArrayConstructor } from "./utility"

/** unsigned integer, signed integer, or IEEE-754 float */
export type NumericFormatType = "u" | "i" | "f"
/** little-endian, big-endian, clamped 1-byte, or 1-byte */
export type NumericEndianType = "l" | "b" | "c" | ""
/** 1-byte, 2-bytes, 4-bytes, 8-bytes, or variable number of bytes */
export type ByteSize = "1" | "2" | "4" | "8" | "v"

/** indicates the name of a numeric type. <br>
 * the collection of possible valid numeric types is:
 * - `"uv"`,  `"u1"`, `"iv"`, `"i1"`, `"u2l"`, `"u2b"`, `"i2l"`, `"i2b"`, `"u4l"`, `"u4b"`, `"u8l"`, `"u8b"`, `"i4l"`, `"i4b"`, `"i8l"`, `"i8b"`, `"f4l"`, `"f4b"`, `"f8l"`, `"f8b"`, `"u1c"`,
 * 
 * the first character specifies the format:
 * - `u` = unsigned integer
 * - `i` = signed integer
 * - `f` = float IEEE-754
 * 
 * the second character specifies the byte-size:
 * - `v` = variable bytes
 * - `1` = one byte
 * - `2` = two bytes (short)
 * - `4` = four bytes (word)
 * - `8` = eight bytes (long)
 * 
 * the third character specifies the endianess. but in the case of unsigned one byte integers, the `c` character specifies if the value is clamped to 255:
 * - `l` = little endian
 * - `b` = big endian
 * - `c` = clamped (only valid for `"u1c"` type)
*/
export type NumericType = `${NumericFormatType}${ByteSize}${NumericEndianType}` & (
	| `${"u" | "i"}${1 | "v"}`
	| "u1c"
	| `${"u" | "i"}${2}${"l" | "b"}`
	| `${NumericFormatType}${4 | 8}${"l" | "b"}`
)

/** an array (regular javascript array) of numbers can be interpreted as an array of formated binary numbers. `NumericType`s `uv` and `iv` are excluded here */
export type NumericArrayType = Exclude<`${NumericType}[]`, `${"u" | "i"}${"v"}[]`>

/** binary primitive types
 * - {@link NumericType} various binary representations of number
 * - {@link NumericArrayType} various binary representations of array of numbers. requires defining array length (number of items) during decoding as `args[0]`
 * - `"bytes"` a `Uint8Array`, which requires defining a bytesize length during decoding as `args[0]`
 * - `"str"` a string, which requires defining a bytesize length during decoding as `args[0]`
 * - `"cstr"` a null-terminated (`"\u0000"`) string. the null termination byte character is automatically added when encoding
 * - `"bool"` a boolean occupying a single byte
*/
export type PrimitiveType =
	| NumericType
	| NumericArrayType
	| "bytes"
	| "str"
	| "cstr"
	| "bool"

/** primitive javascript types */
export type JSPrimitive = string | boolean | number | bigint | number[] | Uint8Array

/** primitive type encoding signature */
export type EncodeFunc<T extends JSPrimitive, ARGS extends any[] = []> = (value: T, ...args: ARGS) => Uint8Array

/** primitive type decoding signature */
export type DecodeFunc<T extends JSPrimitive, ARGS extends any[] = []> = (buffer: Uint8Array, offset: number, ...args: ARGS) => [value: T, bytesize: number]


const txt_encoder = new TextEncoder()
const txt_decoder = new TextDecoder()
/** dictates if the native endianess of your `TypedArray`s is little endian. @notExported*/
const env_le = getEnvironmentEndianess()

/** read `type` of value from buffer `buf` starting at position `offset` */
export const readFrom = (buf: Uint8Array, offset: number, type: PrimitiveType, ...args: any[]): [value: JSPrimitive, new_offset: number] => {
	const [value, bytesize] = decode(type, buf, offset, ...args)
	return [value, offset + bytesize]
}

/** write `type` of `value` to buffer `buf` starting at position `offset` */
export const writeTo = (buf: Uint8Array, offset: number, type: PrimitiveType, value: JSPrimitive, ...args: any[]): [buf: Uint8Array, new_offset: number] => {
	const value_buf = encode(type, value, ...args)
	buf.set(value_buf, offset)
	return [buf, offset + value_buf.length]
}

/** encode a sequential array of items.
 * @example
 * ```ts
 * encodeSeq(["u4b", 0x12AB98], ["str", "hello"], ["bool", false]) === Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0)
 * ```
*/
export const encodeSeq = (...items: Parameters<typeof encode>[]) => {
	const bufs: Uint8Array[] = []
	for (const item of items) bufs.push(encode(...item))
	return concat(...bufs)
}

/** decode as a sequential array of items. this is the inverse of {@link encodeSeq}
 * @example
 * ```ts
 * decodeSeq(Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0), 0, ["u4b"], ["str", 5], ["bool"]) === [[0x12AB98, "hello", false], 10]
 * ```
*/
export const decodeSeq = (buf: Uint8Array, offset: number, ...items: [type: PrimitiveType, ...args: any[]][]): [values: JSPrimitive[], bytesize: number] => {
	const values: JSPrimitive[] = []
	let total_bytesize = 0
	for (const [type, ...args] of items) {
		const [value, bytesize] = decode(type, buf, offset + total_bytesize, ...args)
		values.push(value)
		total_bytesize += bytesize
	}
	return [values, total_bytesize]
}

export const encode = (type: PrimitiveType, value: JSPrimitive, ...args: any[]): ReturnType<EncodeFunc<JSPrimitive>> => {
	switch (type) {
		case "bool": return encode_bool(value as boolean)
		case "cstr": return encode_cstr(value as string)
		case "str": return encode_str(value as string)
		case "bytes": return encode_bytes(value as Uint8Array)
		default: {
			if (type.endsWith("[]")) return encode_number_array(value as number[], type as NumericArrayType)
			else return encode_number(value as number, type as NumericType)
		}
	}
}

export const decode = (type: PrimitiveType, buf: Uint8Array, offset: number, ...args: any[]): ReturnType<DecodeFunc<JSPrimitive>> => {
	switch (type) {
		case "bool": return decode_bool(buf, offset)
		case "cstr": return decode_cstr(buf, offset)
		case "str": return decode_str(buf, offset, ...args)
		case "bytes": return decode_bytes(buf, offset, ...args)
		default: {
			if (type.endsWith("[]")) return decode_number_array(buf, offset, type as NumericArrayType, ...args)
			else return decode_number(buf, offset, type as NumericType)
		}
	}
}

/** @notExported */
const encode_bool: EncodeFunc<boolean> = (value) => Uint8Array.of(value ? 1 : 0)

/** @notExported */
const decode_bool: DecodeFunc<boolean> = (buf, offset = 0) => [buf[offset] >= 1 ? true : false, 1]

/** @notExported */
const encode_cstr: EncodeFunc<string> = (value) => txt_encoder.encode(value + "\u0000")

/** @notExported */
const decode_cstr: DecodeFunc<string> = (buf, offset = 0) => {
	const
		offset_end = buf.indexOf(0x00, offset),
		txt_arr = buf.subarray(offset, offset_end),
		value = txt_decoder.decode(txt_arr)
	return [value, txt_arr.length + 1]
}

/** @notExported */
const encode_str: EncodeFunc<string> = (value) => txt_encoder.encode(value)

/** @notExported */
const decode_str: DecodeFunc<string, [bytesize?: number]> = (buf, offset = 0, bytesize?) => {
	const
		offset_end = bytesize === undefined ? undefined : offset + bytesize,
		txt_arr = buf.subarray(offset, offset_end),
		value = txt_decoder.decode(txt_arr)
	return [value, txt_arr.length]
}

/** @notExported */
const encode_bytes: EncodeFunc<Uint8Array> = (value) => value

/** @notExported */
const decode_bytes: DecodeFunc<Uint8Array, [bytesize?: number]> = (buf, offset = 0, bytesize?) => {
	const
		offset_end = bytesize === undefined ? undefined : offset + bytesize,
		value = buf.slice(offset, offset_end)
	return [value, value.length]
}

/** get a typed array constructor by specifying the type as a string
 * @notExported
*/
const typed_array_constructor_of = (type: `${NumericFormatType}${Exclude<ByteSize, "v">}${string}`): TypedArrayConstructor => {
	if (type[2] === "c") return Uint8ClampedArray
	type = type[0] + type[1] as typeof type // this is to trim excessive tailing characters
	switch (type as `${NumericFormatType}${Exclude<ByteSize, "v">}`) {
		case "u1": return Uint8Array
		case "u2": return Uint16Array
		case "u4": return Uint32Array
		case "u8": return BigUint64Array
		case "i1": return Int8Array
		case "i2": return Int16Array
		case "i4": return Int32Array
		case "i8": return BigInt64Array
		case "f4": return Float32Array
		case "f8": return Float64Array
		default: {
			Error("an unrecognized typed array type `\"${type}\"` was provided")
			return Uint8Array
		}
	}
}

/** @notExported */
const encode_number_array: EncodeFunc<number[], [type: NumericArrayType]> = (value, type) => {
	const
		typed_arr_constructor = typed_array_constructor_of(type),
		[t, s, e] = type,
		bytesize = parseInt(s) as (1 | 2 | 4 | 8),
		is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false,
		typed_arr: TypedArray = typed_arr_constructor.from(value)
	if (typed_arr instanceof Uint8Array) return typed_arr
	const buf = new Uint8Array(typed_arr.buffer)
	if (is_native_endian) return buf
	else return swapEndianessFast(buf, bytesize)
}

/** @notExported */
const decode_number_array: DecodeFunc<number[], [type: NumericArrayType, array_length?: number]> = (buf, offset = 0, type, array_length?) => {
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

/** @notExported */
const encode_number: EncodeFunc<number, [type: NumericType]> = (value, type) => {
	const [t, s, e] = type
	if (s === "v") return t === "u" ? encode_uvar(value) : encode_ivar(value)
	const
		typed_arr_constructor = typed_array_constructor_of(t + s + (e || "") as `${NumericFormatType}${1 | 2 | 4 | 8}${NumericEndianType}`),
		bytesize = parseInt(s) as (1 | 2 | 4 | 8),
		is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false,
		buf = typed_arr_constructor.of(value)
	if (!is_native_endian) buf.reverse()
	return new Uint8Array(buf.buffer)
}

/** @notExported */
const decode_number: DecodeFunc<number, [type: NumericType]> = (buf, offset = 0, type) => {
	const [t, s, e] = type
	if (s === "v") return t === "u" ? decode_uvar(buf, offset) : decode_ivar(buf, offset)
	const
		typed_arr_constructor = typed_array_constructor_of(t + s + (e || "") as `${NumericFormatType}${1 | 2 | 4 | 8}${NumericEndianType}`),
		bytesize = parseInt(s) as (1 | 2 | 4 | 8),
		is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false,
		number_buf = buf.slice(offset, offset + bytesize)
	if (!is_native_endian) number_buf.reverse()
	return [Number(new typed_arr_constructor(number_buf.buffer)[0]), bytesize]
}

/** `uvar` stands for unsigned variable-sized integer <br>
 * this number occupies a variable number of bytes to accomodate the integer that it's holding <br>
 * it uses the first bit of the octet (0bXYYYYYYY) to signal whether the integer carries on to the next byte (X == 1) or not (X == 0), <br>
 * and uses base 7 big endian encoding to read the data bytes (YYYYYYY) <br>
 * you can read more about it on wikipedia: "https://en.wikipedia.org/wiki/Variable-length_quantity" <br>
 * the following table lists the first few bounds of this encoding: <br>
 * | decimal          | unsigned big endian binary                  | unsigned variable binary         |
 * |------------------|---------------------------------------------|----------------------------------|
 * | 0                | 0b00000000 0b00000000 0b00000000 0b00000000 | 0b00000000                       |
 * | 127 = 2^7 - 1    | 0b00000000 0b00000000 0b00000000 0b01111111 | 0b01111111                       |
 * | 128 = 2^7        | 0b00000000 0b00000000 0b00000000 0b10000000 | 0b10000001 0b00000000            |
 * | 16383 = 2^14 - 1 | 0b00000000 0b00000000 0b00111111 0b11111111 | 0b11111111 0b01111111            |
 * | 16384 = 2^14     | 0b00000000 0b00000000 0b01000000 0b00000000 | 0b10000001 0b10000000 0b00000000 |
 * <br>
 * this encoding is especially useful for encoding the length of other variables as in their header (begining of their sequence)
 * @notExported
*/
const encode_uvar: EncodeFunc<number | bigint> = (value) => {
	value = BigInt(value) * (value >= 0 ? 1n : -1n) // converting to absolute value
	const lsb_to_msb: number[] = []
	do {
		lsb_to_msb.push(Number((value & 0b01111111n) + 0b10000000n))
		value >>= 7n
	} while (value > 0n)
	lsb_to_msb[0] &= 0b01111111
	return Uint8Array.from(lsb_to_msb.reverse())
}

/** @see {@link encode_uvar}
 * @notExported
*/
const decode_uvar: DecodeFunc<number> = (buf, offset = 0) => {
	const offset_start = offset
	let
		byte: number,
		value: bigint = 0n
	do {
		byte = buf[offset++]
		value <<= 7n
		value += BigInt(byte & 0b01111111)
	} while (byte >> 7 == 1)
	return [Number(value), offset - offset_start]
}

/** `ivar` stands for signed variable-sized integer <br>
 * it's similar to `uvar`, except that in the first byte, the second-major bit `Z` of the octet (0b0ZYYYYYY), signals whether the number is positive (Z == 0), or negative (Z == 1) <br>
 * the following table lists the first few bounds of this encoding: <br>
 * | decimal             | signed big endian binary                    | signed variable binary           |
 * |---------------------|---------------------------------------------|----------------------------------|
 * |  0                  | 0b00000000 0b00000000 0b00000000 0b00000000 | 0b00000000 or 0b01000000         |
 * |  63 =   2^6 - 1     | 0b00000000 0b00000000 0b00000000 0b00111111 | 0b00111111                       |
 * | -63 = -(2^6 - 1)    | 0b00000000 0b00000000 0b00000000 0b11000001 | 0b01111111                       |
 * |  8191 =   2^13 - 1  | 0b00000000 0b00000000 0b00011111 0b11111111 | 0b10111111 0b01111111            |
 * | -8191 = -(2^13 - 1) | 0b00000000 0b00000000 0b11100000 0b00000001 | 0b11111111 0b01111111            |
 * <br>
 * @notExported
*/
const encode_ivar: EncodeFunc<number | bigint> = (value) => {
	const
		sign = value >= 0 ? 1n : -1n,
		lsb_to_msb: number[] = []
	value = BigInt(value) * sign // `val` is now positive
	while (value > 0b00111111n) {
		lsb_to_msb.push(Number((value & 0b01111111n) + 0b10000000n))
		value >>= 7n
	}
	lsb_to_msb.push(Number((value & 0b00111111n) | (sign == -1n ? 0b11000000n : 0b10000000n)))
	lsb_to_msb[0] &= 0b01111111
	return Uint8Array.from(lsb_to_msb.reverse())
}

/** @see {@link encode_ivar}
 * @notExported
*/
const decode_ivar: DecodeFunc<number> = (buf, offset = 0) => {
	const offset_start = offset
	let
		byte: number = buf[offset++],
		sign: bigint = (byte & 0b01000000) > 0n ? -1n : 1n,
		value: bigint = BigInt(byte & 0b00111111)
	while (byte >> 7 == 1) {
		byte = buf[offset++]
		value <<= 7n
		value += BigInt(byte & 0b01111111)
	}
	value *= sign
	return [Number(value), offset - offset_start]
}

export default { encode, decode, encodeSeq, decodeSeq, writeTo, readFrom }