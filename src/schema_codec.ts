/**
 * a binary serializer for struct like objects based on a schema. <br>
 * @module
*/

import { concat, ConstructorOf, Require, Obj, is_subidentical } from "./utility"
import { encode as encodeP, decode as decodeP, JSPrimitive, PrimitiveType } from "./primitive_codec"


export type JSSimpleTypes = JSPrimitive | JSSimpleTypes[] | { [name: PropertyKey]: JSSimpleTypes }

export type SchemaArgs<S extends SchemaNode<any, any>> = S["args"] extends [] ? S["args"] : []

/** encoding signature for schema node */
export type EncodeSchemaFunc<S extends SchemaNode<any, any>> = (this: S, value: NonNullable<S["value"]>, ...args: SchemaArgs<S>) => Uint8Array

/** decoding signature for schema node */
export type DecodeSchemaFunc<S extends SchemaNode<any, any>> = (this: S, buffer: Uint8Array, offset: number, ...args: SchemaArgs<S>) => [value: NonNullable<S["value"]>, bytesize: number]

/** create a schema class instance based off of a simple javascript object */
export type MakeSchemaFrom<S extends SchemaNode<any, any>> = (schema_obj: Obj & { type: S["type"] }) => S

const type_registry: Record<
	string, // schema type name
	ConstructorOf<SchemaNode<any, any>> // schema class
> = {}

export const encodeS = <T extends any, TypeName extends string>(schema: SchemaNode<T, TypeName>, value: NonNullable<T>) => schema.encode(value)

export const decodeS = <T extends any, TypeName extends string>(schema: SchemaNode<T, TypeName>, buf: Uint8Array, offset: number) => schema.decode(buf, offset)

export const makeS = <T extends any, TypeName extends string, S extends SchemaNode<T, TypeName>>(schema_obj: { type: TypeName, value?: T }): S => {
	// TODO find a good way to manage constructor parameters across different schema types
	// return new type_registry[schema_obj.type]()
	// return Object.setPrototypeOf(schema_obj, type_registry[schema_obj.type])
	return (type_registry[schema_obj.type].from as MakeSchemaFrom<S>)(schema_obj)
}

/** an abstract and un-typed `SchemaNode` for the sake of creating an inheritance tree */
export abstract class SchemaNode<T extends any, TypeName extends string> {
	/** describe how an instance of this schema node should be encoded into bytes */
	abstract encode(value: NonNullable<this["value"]>, ...args: SchemaArgs<this>): Uint8Array
	/** describe bytes from a buffer should decode a value for this schema node */
	abstract decode(buffer: Uint8Array, offset: number, ...args: SchemaArgs<this>): [value: NonNullable<this["value"]>, bytesize: number]
	/** an abstract static method that creates an instance of `this` schema class, using a regular javascript object */
	static from: MakeSchemaFrom<any>
	/** a mandatory kind descriptior of the primitive kind */
	type: TypeName
	/** the value held by this schema node. used as a storage for interceptors to interact and read decoded value <br>
	 * it can also used as a means for storing default values for the encoder to utilize. <br>
	 * but besides those two scenarios, it should typically be left unassigned. <br>
	 * this also comes in handy when annotating types both for the encoder or decoder
	*/
	value?: T
	/** name of the node, used for object property key naming by parent {@link SchemaRecordNode} */
	name?: string
	/** an array collection of child element.
	 * typically used by non-leaf nodes, such as {@link SchemaRecordNode} and {@link SchemaTupleNode}
	*/
	children?: SchemaNode<any, any>[]
	/** args that should be passed on to either the `type` specific encoder or decoder */
	args?: any[]
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

	constructor(type: TypeName, value?: T, args?: any[]) {
		this.type = type
		if (!(type in type_registry)) type_registry[type] = this.constructor as ConstructorOf<this>
		if (value) this.setValue(value)
		if (args) this.setArgs(args)
	}

	setName = (name: string): Require<this, "name"> => {
		this.name = name
		return this as Require<this, "name">
	}

	pushChildren = (...children: NonNullable<this["children"]>): Require<this, "children"> => {
		if (this.children === undefined) this.children = []
		this.children.push(...children)
		return this as Require<this, "children">
	}

	setValue = (value: this["value"]) => {
		this.value = value
		return this
	}

	setArgs = (...args: NonNullable<this["args"]>) => {
		if (args) this.args = args
		return this
	}

	pushArgs = (...args: NonNullable<this["args"]>) => {
		if (args) {
			if (this.args === undefined) this.args = []
			this.args.push(args)
		}
		return this
	}
}

/** a schema node for primitive none-composite and primitive javascript types */
export class SPrimitive<T extends JSPrimitive = any, TypeName extends PrimitiveType = any> extends SchemaNode<T, TypeName> {
	declare type: TypeName
	declare value?: T
	declare children: never
	args: Parameters<typeof encodeP>[2] = []

	constructor(type: TypeName, default_value?: T, default_args?: any[]) {
		super(type, default_value, default_args)
	}
	static override from: MakeSchemaFrom<SPrimitive<JSPrimitive, PrimitiveType>> = (schema_obj) => new this(schema_obj.type, schema_obj.value, schema_obj.args)
	override encode(value: T, ...args: any[]) {
		return encodeP(this.type, value, ...(args.length > 0 ? args : this.args))
	}
	override decode(buf: Uint8Array, offset: number, ...args: Parameters<typeof encodeP>[2]) {
		return decodeP(this.type, buf, offset, ...(args.length > 0 ? args : this.args)) as [value: T, bytesize: number]
	}
}

/** a schema node for nested record-like javascript object types */
export class SRecord extends SchemaNode<Obj, "record"> {
	declare type: "record"
	declare value?: Obj
	children: Require<SchemaNode<any, any>, "name">[] = []
	args: [child_start?: number, child_end?: number] = []

	constructor() {
		super("record")
	}
	static override from: MakeSchemaFrom<SRecord> = (schema_obj) => {
		const
			new_schema = new this(),
			children: { type: string, name: string }[] = schema_obj.children
		for (const child of children) new_schema.pushChildren(makeS(child).setName(child.name))
		return new_schema
	}
	override encode(value: Obj, ...args: [child_start?: number, child_end?: number]) {
		const
			bytes: Uint8Array[] = [],
			child_start = args[0] || this.args[0] || 0,
			child_end = args[1] || this.args[1] || this.children.length
		for (let ch = child_start; ch < child_end; ch++) {
			const child = this.children[ch]
			bytes.push(child.encode(value[child.name]))
		}
		//for (const child of this.children) bytes.push(child.encode(value[child.name]))
		return concat(...bytes)
	}
	override decode(buf: Uint8Array, offset: number, ...args: [child_start?: number, child_end?: number]) {
		const
			record: typeof this["value"] = {},
			child_start = args[0] || this.args[0] || 0,
			child_end = args[1] || this.args[1] || this.children.length
		let total_bytesize = 0
		for (let ch = child_start; ch < child_end; ch++) {
			const
				child = this.children[ch],
				[value, bytesize] = child.decode(buf, offset + total_bytesize)
			total_bytesize += bytesize
			record[child.name] = value
		}
		return [record, total_bytesize] as [value: Obj, bytesize: number]
	}
	/** an iterator to decode child schemas sequentially as needed
	*decodeIter(buf: Uint8Array, offset: number, initial_number_of_items: number = 1): Generator<
		[value: Partial<this["value"]>, bytesize: number],
		[value: NonNullable<this["value"]>, bytesize: number],
		number
	> {
		const
			record: typeof this["value"] = {},
			child_start = args[0] || this.args[0] || 0,
			child_end = args[1] || this.args[1] || this.children.length
		let total_bytesize = 0
		for (let ch = child_start; ch < child_end; ch++) {
			const
				child = this.children[ch],
				[value, bytesize] = child.decode(buf, offset + total_bytesize)
			total_bytesize += bytesize
			record[child.name] = value
		}
		return [record, total_bytesize] as [value: Obj, bytesize: number]
	}
	*/
}

/** a schema node for a nested tuple-like javascript array types */
export class STuple extends SchemaNode<any[], "tuple"> {
	declare type: "tuple"
	declare value?: any[]
	children: SchemaNode<any, any>[] = []
	args: [child_start?: number, child_end?: number] = []

	constructor() {
		super("tuple")
	}
	static override from: MakeSchemaFrom<STuple> = (schema_obj) => {
		const
			new_schema = new this(),
			children: { type: string }[] = schema_obj.children
		for (const child of children) new_schema.pushChildren(makeS(child) as SchemaNode<any, any>)
		return new_schema
	}
	override encode(value: any[], ...args: [child_start?: number, child_end?: number]) {
		const
			bytes: Uint8Array[] = [],
			children = this.children,
			child_start = args[0] || this.args[0] || 0,
			child_end = args[1] || this.args[1] || this.children.length
		for (let ch = child_start; ch < child_end; ch++) bytes.push(children[ch].encode(value[ch]))
		return concat(...bytes)
	}
	override decode(buf: Uint8Array, offset: number, ...args: [child_start?: number, child_end?: number]) {
		const
			tuple: typeof this["value"] = [],
			children = this.children,
			child_start = args[0] || this.args[0] || 0,
			child_end = args[1] || this.args[1] || this.children.length
		let total_bytesize = 0
		for (let ch = child_start; ch < child_end; ch++) {
			const [value, bytesize] = children[ch].decode(buf, offset + total_bytesize)
			total_bytesize += bytesize
			tuple.push(value)
		}
		return [tuple, total_bytesize] as [value: any[], bytesize: number]
	}
}

/** a schema node for an array of a single type */
export class SArray<ItemType extends object, ItemTypeName extends string> extends SchemaNode<ItemType[], "array"> {
	declare type: "array"
	declare value?: ItemType[]
	/** there must be only a single child element that specifies the schema of the kind of items held by this array */
	declare children: [item_schema: SchemaNode<ItemType, ItemTypeName>,]
	/** there are two possible syntaxes, and the one that gets chosen is based on the length of `this.args`
	 * - if `args.length == 1`, then: `args[0]` must specify the length of the array when decoding
	 * - if `args.length == 2`, then: `args[0]` must specify the starting index, and `args[1]` must specify the ending index
	*/
	args:
		| [index_start?: number, index_end?: number,]
		| [len?: number,]
		= []

	constructor(child?: SchemaNode<ItemType, ItemTypeName>, array_length?: number) {
		super("array")
		if (child) this.pushChildren(child)
		if (array_length) this.setArgs(0, array_length)
	}
	static override from: MakeSchemaFrom<SArray<any, string>> = (schema_obj) => {
		const
			child: { type: string } = schema_obj.children[0],
			len: number = schema_obj.args ? schema_obj.args[0] : undefined,
			new_schema = new this(makeS(child) as SchemaNode<any, any>, len)
		return new_schema
	}
	override encode(value: ItemType[], ...args: [index_start?: number, index_end?: number]) {
		const
			bytes: Uint8Array[] = [],
			item_schema = this.children[0],
			index_start = args[0] || this.args[0] || 0, // `this.args[0]` should equal to `index_start` when decoding
			index_end = args[1] || this.args[1] || value.length // `this.args[1]` should equal to `index_end` when decoding
		for (let i = index_start; i < index_end; i++) bytes.push(item_schema.encode(value[i]))
		return concat(...bytes)
	}
	override decode(buf: Uint8Array, offset: number, ...args: [index_start?: number, index_end?: number] | [len?: number,]) {
		const
			arr: typeof this["value"] = [],
			item_schema = this.children[0]
		let
			total_bytesize = 0,
			index_start = args[0] || this.args[0] || 0,
			index_end = args[1] || this.args[1]
		// BAD LOOSE TYPING PRACTICE. for the sake of accounting for user mistake
		// if only a single argument is passed as `...args`, or if only a single item is present in `this.args`, then interpret it as `index_end` (array length) instead of `index_start`
		if (index_end === undefined) {
			index_end = index_start
			index_start = 0
		}
		for (let i = index_start; i < index_end; i++) {
			const [value, bytesize] = item_schema.decode(buf, offset + total_bytesize)
			total_bytesize += bytesize
			arr[i] = value
		}
		return [arr, total_bytesize] as [value: ItemType[], bytesize: number]
	}
	/** decode one item */
	decodeNext(buf: Uint8Array, offset: number, ...args: never[]): [value: ItemType, bytesize: number] {
		return this.children[0].decode(buf, offset)
	}
}

/** an enum entry to be used as a child of an `SEnum` schema node. this schema node's `value` must be a 2-tuple array with the first element (of type `T`) being the javascript value, and the second element (of type `Uint8Array`) being its corresponding bytes */
export class SEnumEntry<T> extends SchemaNode<[T, Uint8Array], "enumentry"> {
	declare type: "enumentry"
	declare value: [T, Uint8Array]
	constructor(enum_value: T, enum_bytes: Uint8Array | number[]) {
		if (!(enum_bytes instanceof Uint8Array)) enum_bytes = Uint8Array.from(enum_bytes)
		super("enumentry", [enum_value, enum_bytes])
	}
	/** this functionality is made into a method instead of being embeded into `SEnum.decode` mainly so that it's possible to subclass it
	 * @returns `true` if the bytes in the provided `buffer` and `offset` match with this enum entry's bytes, else the result is `false`
	*/
	matchBytes(buffer: Uint8Array, offset: number, ...args: any[]): boolean {
		const
			sub_buf = buffer.subarray(offset),
			enum_bytes = this.value[1],
			len = enum_bytes.byteLength
		for (let i = 0; i < len; i++) if (sub_buf[i] != enum_bytes[i]) return false
		return true
	}
	/** this functionality is made into a method instead of being embeded into `SEnum.encode` mainly so that it's possible to subclass it
	 * @returns `true` if the provided `value` matches with this enum entry's value, else the result is `false`
	*/
	matchValue(value: T, ...args: any[]): boolean {
		const enum_value = this.value[0]
		if (value !== enum_value) return false
		return true
	}
	override encode(value?: T, ...args: any[]): this["value"][1] {
		return this.value[1]
	}
	override decode(buffer: Uint8Array, offset: number, ...args: any[]): [value: this["value"][0], bytesize: number] {
		return [this.value[0], this.value[1].byteLength]
	}
}

/** a schema node for a `Uint8Array` bytes literal that has a one-to-one mapping with a primitive javascript value */
export class SEnum extends SchemaNode<JSPrimitive, "enum"> {
	declare type: "enum"
	declare value?: this["children"][number]["value"][0]
	/** each child `SEnumEntry` dictates a possible enum bytes and value pair entry */
	declare children: SEnumEntry<JSPrimitive>[]
	/** if no `value` or `bytes` match with any of the enum entries (`children`) then use the codec of the provided `default_schema` */
	default_schema: SchemaNode<any, any> = new SEnumEntry(undefined, new Uint8Array())

	constructor(...children: SEnumEntry<JSPrimitive>[]) {
		super("enum")
		this.pushChildren(...children)
	}
	setDefault(schema: this["default_schema"]): this {
		this.default_schema = schema
		return this
	}
	getDefault(): this["default_schema"] {
		return this.default_schema
	}
	override encode(value: NonNullable<this["value"]>, ...args: []) {
		for (const entry_schema of this.children)
			if (entry_schema.matchValue(value))
				return entry_schema.encode()
		return this.default_schema.encode(value, ...args)
	}
	override decode(buf: Uint8Array, offset: number, ...args: []) {
		for (const entry_schema of this.children)
			if (entry_schema.matchBytes(buf, offset))
				return entry_schema.decode(buf, offset)
		return this.default_schema.decode(buf, offset, ...args)
	}
}

/** a schema node representing a union between different types of schema nodes */
/*
export class SUnion<ItemType extends object, ItemTypeName extends string> extends SchemaNode<ItemType[], "union"> {
	declare type: "union"
	declare value?: ItemType[]

	constructor(child?: SchemaNode<ItemType, ItemTypeName>, array_length?: number) {
		super("union")
		if (child) this.pushChildren(child)
		if (array_length) this.setArgs(0, array_length)
	}
	static override from: MakeSchemaFrom<SArray<any, string>> = (schema_obj) => {
		const
			child: { type: string } = schema_obj.children[0],
			len: number = schema_obj.args ? schema_obj.args[0] : undefined,
			new_schema = new this(makeS(child) as SchemaNode<any, any>, len)
		return new_schema
	}
	override encode(value: ItemType[], ...args: [index_start?: number, index_end?: number]) {
		const
			bytes: Uint8Array[] = [],
			item_schema = this.children[0],
			index_start = args[0] || this.args[0] || 0, // `this.args[0]` should equal to `index_start` when decoding
			index_end = args[1] || this.args[1] || value.length // `this.args[1]` should equal to `index_end` when decoding
		for (let i = index_start; i < index_end; i++) bytes.push(item_schema.encode(value[i]))
		return concat(...bytes)
	}
	override decode(buf: Uint8Array, offset: number, ...args: [index_start?: number, index_end?: number] | [len?: number,]) {
		const
			arr: typeof this["value"] = [],
			item_schema = this.children[0]
		let
			total_bytesize = 0,
			index_start = args[0] || this.args[0] || 0,
			index_end = args[1] || this.args[1]
		// BAD LOOSE TYPING PRACTICE. for the sake of accounting for user mistake
		// if only a single argument is passed as `...args`, or if only a single item is present in `this.args`, then interpret it as `index_end` (array length) instead of `index_start`
		if (index_end === undefined) {
			index_end = index_start
			index_start = 0
		}
		for (let i = index_start; i < index_end; i++) {
			const [value, bytesize] = item_schema.decode(buf, offset + total_bytesize)
			total_bytesize += bytesize
			arr[i] = value
		}
		return [arr, total_bytesize] as [value: ItemType[], bytesize: number]
	}
}
*/