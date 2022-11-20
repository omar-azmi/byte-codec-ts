/** utility functions for handling buffers and typed arrays, and also reading and writing data to them
 * @module
*/
import { NumericArray, NumericDType, TypedArray, TypedArrayConstructor } from "./typedefs.js";
/** checks if an object `obj` is a {@link TypedArray}, based on simply checking whether `obj.buffer` exists or not. <br>
 * this is certainly not a very robust way of verifying. <br>
 * a better approach would be to check if `obj instanceof Object.getPrototypeOf(Uint8Array)`, but this is quicker <br>
*/
export declare const isTypedArray: (obj: unknown) => obj is TypedArray<NumericDType>;
/** get a typed array constructor by specifying the type as a string */
export declare const typed_array_constructor_of: <DType extends NumericDType = NumericDType>(type: `${DType}${string}`) => TypedArrayConstructor<DType>;
/** dictates if the native endianess of your `TypedArray`s is little endian. */
export declare const getEnvironmentEndianess: () => boolean;
/** this variable dictates if the native endianess of your `TypedArray`s is little endian. */
export declare const env_le: boolean;
/** swap the endianess of the provided `Uint8Array` buffer array in-place, given that each element has a byte-size of `bytesize`
 * @category inplace
*/
export declare const swapEndianess: (buf: Uint8Array, bytesize: number) => Uint8Array;
/** 10x faster implementation of {@link swapEndianess} that does not mutatate the original `buf` array
 * @category copy
*/
export declare const swapEndianessFast: (buf: Uint8Array, bytesize: number) => Uint8Array;
/** concatenate a bunch of `Uint8Array` and `Array<number>` into a single `Uint8Array` array
 * @category copy
*/
export declare const concatBytes: (...arrs: (Uint8Array | Array<number>)[]) => Uint8Array;
/** concatenate a bunch of {@link TypedArray}
 * @category copy
*/
export declare const concatTyped: <TA extends TypedArray<NumericDType>>(...arrs: TA[]) => TA;
/** resovle the positive (normalized) starting and ending indexes of a range. <br>
 * for both `start` and `end`, a negative index can be used to indicate an index from the end of the range, if a `length` is given. <br>
 * for example, `-2` refers to the second to last index (ie `length - 2`).
 * @param start starting index. defaults to `0`
 * @param end ending index. defaults to `undefined` if `length` is not provided. else `end = length` (before offsetting)
 * @param length length of the array in question. required if you want a numeric value of `end` that is `undefined`. defaults to `undefined`
 * @param offset in the very end of evauation, add an addition offset to `start` and `end` indexes
 * @returns a 3-tuple array of resolved [`start` index, `end` index, and `length` of range (ie `end - start`)]
*/
export declare function resolveRange(start: number | undefined, end: number | undefined, length: number, offset?: number): [start: number, end: number, length: number];
export declare function resolveRange(start?: number | undefined, end?: number | undefined, length?: undefined, offset?: number): [start: number, end: number | undefined, length: undefined];
/** split {@link TypedArray} after every `step` number of elements through the use of subarray views <br>
 * @deprecated kind of pointless, when {@link sliceSkipTypedSubarray} and {@link sliceSkip} exist
 * @category inplace
*/
export declare const splitTypedSubarray: <TA extends TypedArray<NumericDType>>(arr: TA, step: number) => TA[];
/** slice `slice_length` number of elements, then jump forward `skip_length` number of elements, and repeat <br>
 * optionally provide a `start` index to begin at, and an `end` index to stop at. <br>
 * if you want to skip first and slice second, you can set `start = skip_length` to get the desired equivalent result <br>
 * @category copy
*/
export declare const sliceSkip: <A extends NumericArray>(arr: A, slice_length: number, skip_length?: number, start?: number, end?: number) => A[];
/** similar to {@link sliceSkip}, but for subarray views of {@link TypedArray}. <br>
 * @category inplace
*/
export declare const sliceSkipTypedSubarray: <TA extends TypedArray<NumericDType>>(arr: TA, slice_length: number, skip_length?: number, start?: number, end?: number) => TA[];
/** find out if two regular, or typed arrays are element wise equal, and have the same lengths */
export declare const isIdentical: <T extends [] | TypedArray<NumericDType>>(arr1: T, arr2: T) => boolean;
/** find out if two regular, or typed arrays are element wise equal upto the last element of the shorter of the two arrays */
export declare const isSubidentical: <T extends [] | TypedArray<NumericDType>>(arr1: T, arr2: T) => boolean;
