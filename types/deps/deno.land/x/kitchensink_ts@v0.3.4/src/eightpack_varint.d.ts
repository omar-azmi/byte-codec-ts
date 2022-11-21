/** submodule for {@link eightpack} that adds the ability to encode and decode variable byte-sized integers. <br>
 * this part of the library has been separated from  {@link eightpack} because of its unlikeyhood of being used.
 * @module
*/
import { DecodeFunc, EncodeFunc } from "./eightpack.js";
import { VarNumericArrayType, VarNumericType } from "./typedefs.js";
export declare const encode_varint: EncodeFunc<number, [type: VarNumericType]>;
export declare const encode_varint_array: EncodeFunc<number[], [type: VarNumericArrayType]>;
export declare const decode_varint: DecodeFunc<number, [type: VarNumericType]>;
export declare const decode_varint_array: DecodeFunc<number[], [type: VarNumericArrayType, array_length?: number]>;
/** array encode version of {@link encode_ivar} */
export declare const encode_uvar_array: EncodeFunc<number[]>;
/** array encode version of {@link encode_ivar} */
export declare const encode_ivar_array: EncodeFunc<number[]>;
/** array decode version of {@link decode_ivar} */
export declare const decode_ivar_array: DecodeFunc<number[], [array_length?: number]>;
/** `uvar` stands for unsigned variable-sized integer <br>
 * this number occupies a variable number of bytes to accomodate the integer that it's holding <br>
 * it uses the first bit of the octet (0bXYYYYYYY) to signal whether the integer carries on to the next byte (X == 1) or not (X == 0), <br>
 * and uses base 7 big endian encoding to read the data bytes (YYYYYYY) <br>
 * you can read more about it on [wikipedia](https://en.wikipedia.org/wiki/Variable-length_quantity). <br>
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
*/
export declare const encode_uvar: EncodeFunc<number>;
/** see {@link encode_uvar} */
export declare const decode_uvar: DecodeFunc<number>;
/** `ivar` stands for signed variable-sized integer <br>
 * it's similar to `uvar` (see {@link encode_uvar}), except that in the first byte, the second-major bit `Z` of the octet (0b0ZYYYYYY), signals whether the number is positive (Z == 0), or negative (Z == 1) <br>
 * the following table lists the first few bounds of this encoding: <br>
 * | decimal             | signed big endian binary                    | signed variable binary           |
 * |---------------------|---------------------------------------------|----------------------------------|
 * |  0                  | 0b00000000 0b00000000 0b00000000 0b00000000 | 0b00000000 or 0b01000000         |
 * |  63 =   2^6 - 1     | 0b00000000 0b00000000 0b00000000 0b00111111 | 0b00111111                       |
 * | -63 = -(2^6 - 1)    | 0b00000000 0b00000000 0b00000000 0b11000001 | 0b01111111                       |
 * |  8191 =   2^13 - 1  | 0b00000000 0b00000000 0b00011111 0b11111111 | 0b10111111 0b01111111            |
 * | -8191 = -(2^13 - 1) | 0b00000000 0b00000000 0b11100000 0b00000001 | 0b11111111 0b01111111            |
 * <br>
*/
export declare const encode_ivar: EncodeFunc<number>;
/** see {@link encode_ivar} */
export declare const decode_ivar: DecodeFunc<number>;
