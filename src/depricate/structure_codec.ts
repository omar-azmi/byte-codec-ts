/**
 * a binary serializer for struct like objects based on a schema. <br>
 * the bytesizes of `type`s of varying lengths (such as `"str"` and `"bytes"`) must be static, and cannot depend on another child/sibling node's decoded value <br>
 * you may however use the `"callback"` type schema node to intercept the codec midway, and mutate the schema dynamically as you desire.
 * @module
*/

import { concat } from "./utility"
import { encode, decode, JSPrimitive, PrimitiveType } from "./primitive_codec"

export type JSSimpleTypes = JSPrimitive | JSSimpleTypes[] | { [name: PropertyKey]: JSSimpleTypes }

type CallbackType =
	| "callback" // callback a function at the current schema node, for both the encoder and decoder
	| "ecallback" // callback a function at the current schema node, when encoding
	| "dcallback" // callback a function at the current schema node, when decoding

export type SchemaTypeName = PrimitiveType | CallbackType | "record" | "tuple" | "array"

/** a generalized and un-typed `SchemaNode` for the sake of creating an inheritance tree */
export interface SchemaNode<T extends any, TN extends SchemaTypeName> {
	/** name of the node, used for object property key naming by parent {@link SchemaRecordNode} */
	name?: string
	/** a mandatory kind descriptior of the primitive kind */
	type: TN
	/** an array collection of child element. only used by {@link SchemaRecordNode} and {@link SchemaTupleNode} */
	children?: SchemaNode<any, any>[]
	/** args that should be passed on to either the `type` specific encoder or decoder */
	args?: any[]
	/** the value held by this schema node. used as a storage for interceptors to interact and read decoded value <br>
	 * it can also used as a means for storing default values for the encoder to utilize. <br>
	 * but besides those two scenarios, it should typically be left unassigned. <br>
	 * this also comes in handy when annotating types both for the encoder or decoder
	*/
	value?: T
	/** an optional doc string for this schema node, that should be cleared when {@link compiler_options.MINIFY} is `true` <br>
	 * to achive that, you would want to write your doc strings as follows:
	 * ```ts
	 * declare const [DEBUG, MINIFY, BUNDLE]: [boolean, boolean, boolean]
	 * const my_schema_node: SchemaLeafNode<number> {
	 * 	type: "u4l",
	 * 	doc: MINIFY || "a stupid description of this 32-bit unsinged little piece of endian."
	 * }
	 * ```
	*/
	doc?: string | true
}

/** a schema node for primitive none-composite javascript types */
export interface SchemaLeafNode<T extends JSPrimitive = any, TN extends PrimitiveType = any> extends SchemaNode<T, PrimitiveType> {
	children?: never
}

/** a schema node for nested record-like javascript object types */
export interface SchemaRecordNode<T extends { [name: PropertyKey]: JSSimpleTypes } = { [name: PropertyKey]: JSSimpleTypes }> extends SchemaNode<T, "record"> {
	children: (SchemaAnyNode & { name: string })[]
	args?: never
}

/** a schema node for a nested tuple-like javascript array types */
export interface SchemaTupleNode<T extends JSSimpleTypes[] = JSSimpleTypes[]> extends SchemaNode<T, "tuple"> {
	children: (SchemaAnyNode & { name?: never })[]
	args?: never
}

/** a schema node for an array of a single type */
export interface SchemaArrayNode<T extends JSSimpleTypes[] = JSSimpleTypes[]> extends SchemaNode<T, "array"> {
	/** there must be only a single child element that specifies the schema of the kind of items held by this array */
	children: [item_schema: SchemaAnyNode,]
	/** `args[0]` must specify the length of the array when decoding */
	args: [array_length: number,]
}

/** a schema node for an array of a single type 
 * @TODO
*/
export interface SchemaArrayWhileNode<T extends JSSimpleTypes[] = JSSimpleTypes[]> extends SchemaNode<T, "array-while"> {
	/** there must be only a single child element that specifies the schema of the kind of items held by this array */
	children: [item_schema: SchemaAnyNode,]
	/** `args[0]` must specify the while-loop condition as a function when decoding <br>
	 * while `args[i]` for `i >=1 ` should provide optional default function arguments embedded into the schema
	 * the conditional function's signature must be as follows:
	 * ```ts
	 * 
	 * ```
	*/
	args: [
		condition_func: (
			schema: SchemaArrayWhileNode,
			buffer: Uint8Array,
			offset: number,
			current_decoded_value: SchemaArrayWhileNode["children"][0]["value"][]
		) => boolean,
		...default_args: [
			schema?: SchemaArrayWhileNode,
			buffer?: Uint8Array,
			offset?: number,
			current_decoded_value?: SchemaArrayWhileNode["children"][0]["value"][]
		]
	]
}

/** callback type schema nodes intercept the codec's execution by calling the functions provided under args in sequence, in order for you to manipulate other schema nodes and data */
export interface SchemaCallbackNode<T extends any = any> extends SchemaNode<T, CallbackType> {
	children?: SchemaAnyNode[]
	args: [func: CallableFunction & (
		| ((...func_args: any[]) => Uint8Array | undefined) // for encoding purposes 
		| ((...func_args: any[]) => [value: any | undefined, bytesize: number | undefined]) // for decoding purposes
	), ...func_args: any[]]
}

/** this helper type is able to distinguish between the three kinds of {@link SchemaNode}s, just by infering/looking at the structure of the object */
export type SchemaAnyNode = SchemaRecordNode | SchemaTupleNode | SchemaArrayNode | SchemaCallbackNode | SchemaLeafNode

export type SchemaArgs<S extends SchemaAnyNode> = S["args"] extends [] ? S["args"] : []

/** encoding signature for schema node */
export type EncodeSchemaFunc<S extends SchemaAnyNode, ARGS extends SchemaArgs<S> = SchemaArgs<S>> = (schema: S, value: NonNullable<S["value"]>, ...args: ARGS) => Uint8Array

/** decoding signature for schema node */
export type DecodeSchemaFunc<S extends SchemaAnyNode, ARGS extends SchemaArgs<S> = SchemaArgs<S>> = (schema: S, buffer: Uint8Array, offset: number, ...args: ARGS) => [value: NonNullable<S["value"]>, bytesize: number]


export const encodeS: EncodeSchemaFunc<SchemaAnyNode, []> = (schema, value) => {
	value = value || schema.value
	switch (schema.type) {
		case "record": return encode_record(schema, value as { [name: PropertyKey]: JSSimpleTypes })
		case "tuple": return encode_tuple(schema, value as JSSimpleTypes[])
		case "array": return encode_array(schema, value as JSSimpleTypes[])
		case "callback": return encode_callback(schema, value as undefined)
		case "ecallback": return encode_callback(schema, value as undefined)
		case "dcallback": return new Uint8Array(0)
		default: return encode(schema.type, value as JSPrimitive, ...(schema.args === undefined ? [] : schema.args))
	}
}

export const decodeS: DecodeSchemaFunc<SchemaAnyNode, []> = (schema, buf, offset) => {
	switch (schema.type) {
		case "record": return decode_record(schema, buf, offset)
		case "tuple": return decode_tuple(schema, buf, offset)
		case "array": return decode_array(schema, buf, offset)
		case "callback": return decode_callback(schema, buf, offset)
		case "ecallback": return [undefined, 0]
		case "dcallback": return decode_callback(schema, buf, offset)
		default: return decode(schema.type, buf, offset, ...(schema.args === undefined ? [] : schema.args))
	}
}

/** @notExported */
const encode_callback: EncodeSchemaFunc<SchemaCallbackNode> = (schema, value) => {
	const
		[func, ...args] = schema.args,
		bytes = func(...args) as Uint8Array | undefined
	return bytes || new Uint8Array(0)
}

/** @notExported */
const decode_callback: DecodeSchemaFunc<SchemaCallbackNode> = (schema, buf, offset) => {
	const
		[func, ...args] = schema.args,
		[value, bytesize] = func(...args) as [value: any | undefined, bytesize: number | undefined]
	return [value || undefined, bytesize || 0]
}

/** @notExported */
const encode_record: EncodeSchemaFunc<SchemaRecordNode> = (schema, value) => {
	const bytes: Uint8Array[] = []
	for (const child of schema.children) bytes.push(encodeS(child, value[child.name]))
	return concat(...bytes)
}

/** @notExported */
const decode_record: DecodeSchemaFunc<SchemaRecordNode> = (schema, buf, offset) => {
	const record: typeof schema["value"] = {}
	let total_bytesize = 0
	for (const child of schema.children) {
		const [value, bytesize] = decodeS(child, buf, offset + total_bytesize)
		total_bytesize += bytesize
		record[child.name] = value
	}
	return [record, total_bytesize]
}

/** @notExported */
const encode_tuple: EncodeSchemaFunc<SchemaTupleNode> = (schema, value) => {
	const
		bytes: Uint8Array[] = [],
		children = schema.children,
		len = children.length
	for (let ch = 0; ch < len; ch++) bytes.push(encodeS(children[ch], value[ch]))
	return concat(...bytes)
}

/** @notExported */
const decode_tuple: DecodeSchemaFunc<SchemaTupleNode> = (schema, buf, offset) => {
	const
		tuple: typeof schema["value"] = [],
		children = schema.children,
		len = children.length
	let total_bytesize = 0
	for (let ch = 0; ch < len; ch++) {
		const [value, bytesize] = decodeS(children[ch], buf, offset + total_bytesize)
		total_bytesize += bytesize
		tuple.push(value)
	}
	return [tuple, total_bytesize]
}

/** @notExported */
const encode_array: EncodeSchemaFunc<SchemaArrayNode> = (schema, value) => {
	const
		bytes: Uint8Array[] = [],
		item_schema = schema.children[0],
		len = value.length //schema.args[0]
	for (let ch = 0; ch < len; ch++) bytes.push(encodeS(item_schema, value[ch]))
	return concat(...bytes)
}

/** @notExported */
const decode_array: DecodeSchemaFunc<SchemaArrayNode> = (schema, buf, offset) => {
	const
		arr: typeof schema["value"] = [],
		item_schema = schema.children[0],
		len = schema.args[0]
	let total_bytesize = 0
	for (let ch = 0; ch < len; ch++) {
		const [value, bytesize] = decodeS(item_schema, buf, offset + total_bytesize)
		total_bytesize += bytesize
		arr.push(value)
	}
	return [arr, total_bytesize]
}

export default { encodeS, decodeS }