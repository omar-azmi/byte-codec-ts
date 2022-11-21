/** utility functions for packing and unpacking bytes (8-bits) of primitive javascript objects. <br>
 * and hence the name of the module (*8(bit)pack*)
 * @module
*/
import { decode_varint, decode_varint_array, encode_varint, encode_varint_array } from "./eightpack_varint.js";
import { concatBytes, env_le, swapEndianessFast, typed_array_constructor_of } from "./typedbuffer.js";
const txt_encoder = new TextEncoder();
const txt_decoder = new TextDecoder();
/** read `type` of value from buffer `buf` starting at position `offset` */
export const readFrom = (buf, offset, type, ...args) => {
    const [value, bytesize] = unpack(type, buf, offset, ...args);
    return [value, offset + bytesize];
};
/** write `type` of `value` to buffer `buf` starting at position `offset` */
export const writeTo = (buf, offset, type, value, ...args) => {
    const value_buf = pack(type, value, ...args);
    buf.set(value_buf, offset);
    return [buf, offset + value_buf.length];
};
/** encode a sequential array of items.
 * @example
 * ```ts
 * packSeq(["u4b", 0x12AB98], ["str", "hello"], ["bool", false]) === Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0)
 * ```
*/
export const packSeq = (...items) => {
    const bufs = [];
    for (const item of items)
        bufs.push(pack(...item));
    return concatBytes(...bufs);
};
/** decode as a sequential array of items. this is the inverse of {@link packSeq}
 * @example
 * ```ts
 * unpackSeq(Uint8Array.of(0x00, 0x12, 0xAB, 0x98, 104, 101, 108, 108, 111, 0), 0, ["u4b"], ["str", 5], ["bool"]) === [[0x12AB98, "hello", false], 10]
 * ```
*/
export const unpackSeq = (buf, offset, ...items) => {
    const values = [];
    let total_bytesize = 0;
    for (const [type, ...args] of items) {
        const [value, bytesize] = unpack(type, buf, offset + total_bytesize, ...args);
        values.push(value);
        total_bytesize += bytesize;
    }
    return [values, total_bytesize];
};
/** auto value encoder/packer for {@link PrimitiveType} */
export const pack = (type, value, ...args) => {
    switch (type) {
        case "bool": return encode_bool(value);
        case "cstr": return encode_cstr(value);
        case "str": return encode_str(value);
        case "bytes": return encode_bytes(value);
        default: {
            if (type[1] === "v")
                return type.endsWith("[]") ?
                    encode_varint_array(value, type) :
                    encode_varint(value, type);
            else
                return type.endsWith("[]") ?
                    encode_number_array(value, type) :
                    encode_number(value, type);
        }
    }
};
/** auto buffer decoder/unpacker for {@link PrimitiveType} */
export const unpack = (type, buf, offset, ...args) => {
    switch (type) {
        case "bool": return decode_bool(buf, offset);
        case "cstr": return decode_cstr(buf, offset);
        case "str": return decode_str(buf, offset, ...args);
        case "bytes": return decode_bytes(buf, offset, ...args);
        default: {
            if (type[1] === "v")
                return type.endsWith("[]") ?
                    decode_varint_array(buf, offset, type, ...args) :
                    decode_varint(buf, offset, type);
            else
                return type.endsWith("[]") ?
                    decode_number_array(buf, offset, type, ...args) :
                    decode_number(buf, offset, type);
        }
    }
};
/** pack a `boolean` as 1-byte of data */
export const encode_bool = (value) => Uint8Array.of(value ? 1 : 0);
/** unpack a `boolean` from 1-byte of data */
export const decode_bool = (buf, offset = 0) => [buf[offset] >= 1 ? true : false, 1];
/** pack a `string` as an array of characters, terminated by the `"\u0000"` charbyte. this is the c convention of strings */
export const encode_cstr = (value) => txt_encoder.encode(value + "\u0000");
/** unpack a `string` as an array of characters that's terminated by `"\u0000"` charbyte. this is the c convention of strings */
export const decode_cstr = (buf, offset = 0) => {
    const offset_end = buf.indexOf(0x00, offset), txt_arr = buf.subarray(offset, offset_end), value = txt_decoder.decode(txt_arr);
    return [value, txt_arr.length + 1];
};
/** pack a `string` as an array of characters */
export const encode_str = (value) => txt_encoder.encode(value);
/** unpack a `string` as an array of characters. you must provide the `bytesize` of the string being decoded, otherwise the decoder will unpack till the end of the buffer */
export const decode_str = (buf, offset = 0, bytesize) => {
    const offset_end = bytesize === undefined ? undefined : offset + bytesize, txt_arr = buf.subarray(offset, offset_end), value = txt_decoder.decode(txt_arr);
    return [value, txt_arr.length];
};
/** pack a `Uint8Array` array of bytes as is. (ie: don't perform any operation) */
export const encode_bytes = (value) => value;
/** unpack a `Uint8Array` array of bytes. you must provide the `bytesize` of the bytes being decoded, otherwise the decoder will unpack till the end of the buffer */
export const decode_bytes = (buf, offset = 0, bytesize) => {
    const offset_end = bytesize === undefined ? undefined : offset + bytesize, value = buf.slice(offset, offset_end);
    return [value, value.length];
};
/** pack a numeric array (`number[]`) in the provided {@link NumericArrayType} byte representation */
export const encode_number_array = (value, type) => {
    const [t, s, e] = type, typed_arr_constructor = typed_array_constructor_of(type), bytesize = parseInt(s), is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false, typed_arr = typed_arr_constructor.from(value);
    if (typed_arr instanceof Uint8Array)
        return typed_arr;
    const buf = new Uint8Array(typed_arr.buffer);
    if (is_native_endian)
        return buf;
    else
        return swapEndianessFast(buf, bytesize);
};
/** unpack a numeric array (`number[]`) that's encoded in one of {@link NumericArrayType} byte representation. you must provide the `array_length` of the array being decoded, otherwise the decoder will unpack till the end of the buffer */
export const decode_number_array = (buf, offset = 0, type, array_length) => {
    const [t, s, e] = type, bytesize = parseInt(s), is_native_endian = (e === "l" && env_le) || (e === "b" && !env_le) || bytesize === 1 ? true : false, bytelength = array_length ? bytesize * array_length : undefined, array_buf = buf.slice(offset, bytelength ? offset + bytelength : undefined), array_bytesize = array_buf.length, typed_arr_constructor = typed_array_constructor_of(type), typed_arr = new typed_arr_constructor(is_native_endian ? array_buf.buffer : swapEndianessFast(array_buf, bytesize).buffer);
    return [Array.from(typed_arr), array_bytesize];
};
/** pack a `number` in the provided {@link NumericType} byte representation */
export const encode_number = (value, type) => encode_number_array([value,], type);
/** unpack a `number` in the provided {@link NumericType} byte representation */
export const decode_number = (buf, offset = 0, type) => {
    const [value_arr, bytesize] = decode_number_array(buf, offset, type, 1);
    return [value_arr[0], bytesize];
};
