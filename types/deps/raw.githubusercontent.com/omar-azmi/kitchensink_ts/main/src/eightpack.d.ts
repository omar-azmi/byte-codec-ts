/** utility functions for packing and unpacking bytes (8-bits) of primitive javascript objects. <br>
 * and hence the name of the module (*8(bit)pack*)
 * @module
*/
import { NumericArrayType, NumericType, VarNumericArrayType, VarNumericType } from "./typedefs.js";
/** binary primitive types
 * - {@link NumericType} various binary representations of number
 * - {@link NumericArrayType} various binary representations of array of numbers. requires defining array length (number of items) during decoding as `args[0]`
 * - `"bytes"` a `Uint8Array`, which requires defining a bytesize length during decoding as `args[0]`
 * - `"str"` a string, which requires defining a bytesize length during decoding as `args[0]`
 * - `"cstr"` a null-terminated (`"\u0000"`) string. the null termination byte character is automatically added when encoding
 * - `"bool"` a boolean occupying a single byte
*/
export declare type PrimitiveType = PrimitiveArrayType | NumericType | VarNumericType | "cstr" | "bool";
/** primitive types that typically require length information to be decoded */
export declare type PrimitiveArrayType = NumericArrayType | VarNumericArrayType | "bytes" | "str";
/** all unpack functions return their decoded outputs in a 2-tupple array; <br>
 * the first element being the decoded value `V`, and the second being the number of bytes this data occupied */
export declare type Decoded<V, ByteSize extends number = number> = [value: V, bytesize: ByteSize];
/** primitive javascript types */
export declare type JSPrimitive = string | boolean | number | bigint | number[] | Uint8Array;
/** packing function signature for {@link JSPrimitive} types */
export declare type EncodeFunc<T extends JSPrimitive, ARGS extends any[] = []> = (value: T, ...args: ARGS) => Uint8Array;
/** unpacking function signature for {@link JSPrimitive} types */
export declare type DecodeFunc<T extends JSPrimitive, ARGS extends any[] = []> = (buffer: Uint8Array, offset: number, ...args: ARGS) => Decoded<T>;
/** read `type` of value from buffer `buf` starting at position `offset` */
export declare const readFrom: (buf: Uint8Array, offset: number, type: PrimitiveType, ...args: any[]) => [value: JSPrimitive, new_offset: number];
/** write `type` of `value` to buffer `buf` starting at position `offset` */
export declare const writeTo: (buf: Uint8Array, offset: number, type: PrimitiveType, value: JSPrimitive, ...args: any[]) => [buf: Uint8Array, new_offset: number];
/** encode a sequential array of items.
 * @example
 * ```ts
 * packSeq(["u4b", 0x12AB98], ["str", "hello"], ["bool", false]) === Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0)
 * ```
*/
export declare const packSeq: (...items: Parameters<typeof pack>[]) => Uint8Array;
/** decode as a sequential array of items. this is the inverse of {@link packSeq}
 * @example
 * ```ts
 * unpackSeq(Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0), 0, ["u4b"], ["str", 5], ["bool"]) === [[0x12AB98, "hello", false], 10]
 * ```
*/
export declare const unpackSeq: (buf: Uint8Array, offset: number, ...items: [type: PrimitiveType, ...args: any[]][]) => Decoded<JSPrimitive[], number>;
/** auto value encoder/packer for {@link PrimitiveType} */
export declare const pack: (type: PrimitiveType, value: JSPrimitive, ...args: any[]) => ReturnType<EncodeFunc<JSPrimitive>>;
/** auto buffer decoder/unpacker for {@link PrimitiveType} */
export declare const unpack: (type: PrimitiveType, buf: Uint8Array, offset: number, ...args: any[]) => Decoded<JSPrimitive, number>;
/** pack a `boolean` as 1-byte of data */
export declare const encode_bool: EncodeFunc<boolean>;
/** unpack a `boolean` from 1-byte of data */
export declare const decode_bool: DecodeFunc<boolean>;
/** pack a `string` as an array of characters, terminated by the `"\u0000"` charbyte. this is the c convention of strings */
export declare const encode_cstr: EncodeFunc<string>;
/** unpack a `string` as an array of characters that's terminated by `"\u0000"` charbyte. this is the c convention of strings */
export declare const decode_cstr: DecodeFunc<string>;
/** pack a `string` as an array of characters */
export declare const encode_str: EncodeFunc<string>;
/** unpack a `string` as an array of characters. you must provide the `bytesize` of the string being decoded, otherwise the decoder will unpack till the end of the buffer */
export declare const decode_str: DecodeFunc<string, [bytesize?: number]>;
/** pack a `Uint8Array` array of bytes as is. (ie: don't perform any operation) */
export declare const encode_bytes: EncodeFunc<Uint8Array>;
/** unpack a `Uint8Array` array of bytes. you must provide the `bytesize` of the bytes being decoded, otherwise the decoder will unpack till the end of the buffer */
export declare const decode_bytes: DecodeFunc<Uint8Array, [bytesize?: number]>;
/** pack a numeric array (`number[]`) in the provided {@link NumericArrayType} byte representation */
export declare const encode_number_array: EncodeFunc<number[], [type: NumericArrayType]>;
/** unpack a numeric array (`number[]`) that's encoded in one of {@link NumericArrayType} byte representation. you must provide the `array_length` of the array being decoded, otherwise the decoder will unpack till the end of the buffer */
export declare const decode_number_array: DecodeFunc<number[], [type: NumericArrayType, array_length?: number]>;
/** pack a `number` in the provided {@link NumericType} byte representation */
export declare const encode_number: EncodeFunc<number, [type: NumericType]>;
/** unpack a `number` in the provided {@link NumericType} byte representation */
export declare const decode_number: DecodeFunc<number, [type: NumericType]>;
