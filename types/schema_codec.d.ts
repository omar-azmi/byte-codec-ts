/**
 * a binary serializer for struct like objects based on a schema. <br>
 * @module
*/
import type { ClassFieldsOf, ConstructorOf, Decoded, JSPrimitive, NumericType, PrimitiveArrayType, PrimitiveType, Require, VarNumericType } from "./deps.js";
import { pack } from "./deps.js";
export declare type JSSimpleTypes = JSPrimitive | JSSimpleTypes[] | {
    [name: PropertyKey]: JSSimpleTypes;
};
export declare type SchemaArgs<S extends SchemaChildNode> = S["args"] extends [] ? NonNullable<S["args"]> : [];
/** encoding signature for schema node */
export declare type EncodeSchemaFunc<S extends SchemaNode<any, any>> = (this: S, value: NonNullable<S["value"]>, ...args: SchemaArgs<S>) => Uint8Array;
/** decoding signature for schema node */
export declare type DecodeSchemaFunc<S extends SchemaNode<any, any>> = (this: S, buffer: Uint8Array, offset: number, ...args: SchemaArgs<S>) => Decoded<NonNullable<S["value"]>>;
/** create a schema class instance based off of a simple javascript object */
export declare type MakeSchemaFrom<S extends SchemaNode<any, string>> = (schema_obj: {
    [key: string]: any;
} & {
    type: S["type"];
}) => S;
export declare const encodeS: <T extends unknown, TypeName extends string>(schema: SchemaNode<T, TypeName>, value: NonNullable<T>) => Uint8Array;
export declare const decodeS: <T extends unknown, TypeName extends string>(schema: SchemaNode<T, TypeName>, buf: Uint8Array, offset: number) => Decoded<NonNullable<T>, number>;
export declare const makeS: <T extends unknown, TypeName extends string, S extends SchemaNode<T, TypeName>>(schema_obj: {
    type: TypeName;
    value?: T | undefined;
}) => S;
export interface SchemaChildNode<T extends any = any, TypeName extends string = string> extends SchemaNode<T, TypeName> {
}
export interface SchemaNodeConstructor<S extends SchemaNode<any, string>> extends ConstructorOf<S> {
    from(schema_obj: ClassFieldsOf<S>): S;
}
/** an abstract and un-typed `SchemaNode` for the sake of creating an inheritance tree */
export declare abstract class SchemaNode<T extends any, TypeName extends string> {
    /** describe how an instance of this schema node should be encoded into bytes */
    abstract encode(value: NonNullable<this["value"]>, ...args: SchemaArgs<this>): Uint8Array;
    /** describe bytes from a buffer should decode a value for this schema node */
    abstract decode(buffer: Uint8Array, offset: number, ...args: SchemaArgs<this>): Decoded<NonNullable<this["value"]>>;
    /** an abstract static method that creates an instance of `this` schema class, using a regular javascript object */
    static from: SchemaNodeConstructor<any>["from"];
    /** a mandatory kind descriptior of the primitive kind */
    type: TypeName;
    /** the value held by this schema node. used as a storage for interceptors to interact and read decoded value <br>
     * it can also used as a means for storing default values for the encoder to utilize. <br>
     * but besides those two scenarios, it should typically be left unassigned. <br>
     * this also comes in handy when annotating types both for the encoder or decoder
    */
    value?: T;
    /** name of the node, used for object property key naming by parent {@link SchemaRecordNode} */
    name?: string;
    /** an array collection of child element.
     * typically used by non-leaf nodes, such as {@link SchemaRecordNode} and {@link SchemaTupleNode}
    */
    children?: SchemaChildNode<any, string>[];
    /** args that should be passed on to either the `type` specific encoder or decoder */
    args: any[];
    /** an optional doc string for this schema node, that should be cleared when `MINIFY` is `true` <br>
     * to achive that, you would want to write your doc strings as follows:
     * ```ts
     * declare const [DEBUG, MINIFY, BUNDLE]: [boolean, boolean, boolean]
     * const my_schema_node: SPrimitive<number> {
     * 	type: "u4l",
     * 	doc: MINIFY || "a stupid description of this 32-bit unsinged little piece of endian."
     * }
     * ```
    */
    doc?: string | true;
    constructor(type: TypeName, value?: T, args?: any[]);
    /** manually set `this` schema's `type` to the provided `type_name`, and also
     * register the new `type_name` to global `type_registery` if `register = true`. <br>
     * this is the only easy way to register `type_name`s of sub-sub-classes of abstract {@link SchemaNode}. <br>
     * check out {@link SHeadArray} to see how it extends {@link SArray}, but registers its own `type_name = "headarray"`
     * that's different from its parent class's `type_name = "array"`
    */
    setType<NewTypeName extends string>(type_name: NewTypeName, register?: boolean): this & {
        type: NewTypeName;
    };
    setName<Name extends NonNullable<this["name"]>>(name: Name): this & {
        name: Name;
    };
    pushChildren(...children: NonNullable<this["children"]>): Require<this, "children">;
    setValue(value: NonNullable<this["value"]>): Require<this, "value">;
    setArgs(...args: NonNullable<this["args"]>): this;
    pushArgs(...args: NonNullable<this["args"]>): this;
}
/** a schema node for primitive none-composite and primitive javascript types */
export declare class SPrimitive<T extends JSPrimitive = any, TypeName extends PrimitiveType = any> extends SchemaNode<T, TypeName> {
    type: TypeName;
    value?: T;
    children: never;
    args: Parameters<typeof pack>[2];
    constructor(type: TypeName, default_value?: T, default_args?: any[]);
    static from(schema_obj: ClassFieldsOf<SPrimitive>): SPrimitive;
    encode(value: T, ...args: any[]): Uint8Array;
    decode(buf: Uint8Array, offset: number, ...args: this["args"]): Decoded<T, number>;
}
export interface SRecordChild<Name extends string, T extends any = any, TypeName extends string = string> extends SchemaChildNode<T, TypeName> {
    name: Name;
    value?: T;
}
/** a schema node for nested record-like javascript object types */
export declare class SRecord<REC extends {
    [key: string]: any;
} = {
    [key: string]: any;
}> extends SchemaNode<REC, "record"> {
    type: "record";
    args: [child_start?: number, child_end?: number];
    children: SRecordChild<keyof REC & string, REC[keyof REC]>[];
    constructor(...children: SRecordChild<keyof REC & string, REC[keyof REC]>[]);
    static from(schema_obj: ClassFieldsOf<SRecord>): SRecord<{
        [key: string]: any;
    }>;
    encode(value: NonNullable<this["value"]>, ...args: [child_start?: number, child_end?: number]): Uint8Array;
    decode(buf: Uint8Array, offset: number, ...args: [child_start?: number, child_end?: number]): Decoded<REC, number>;
}
/** a schema node for a nested tuple-like javascript array types */
export declare class STuple extends SchemaNode<any[], "tuple"> {
    type: "tuple";
    value?: any[];
    args: [child_start?: number, child_end?: number];
    children: SchemaNode<any, any>[];
    constructor();
    static from(schema_obj: ClassFieldsOf<STuple>): STuple;
    encode(value: any[], ...args: [child_start?: number, child_end?: number]): Uint8Array;
    decode(buf: Uint8Array, offset: number, ...args: [child_start?: number, child_end?: number]): Decoded<any[], number>;
}
/** a schema node for an array of a single type */
export declare class SArray<ItemSchema extends SchemaChildNode, ItemType = NonNullable<ItemSchema["value"]>> extends SchemaNode<ItemType[], "array"> {
    type: "array";
    /** there must be only a single child element that specifies the schema of the kind of items held by this array */
    children: [item_schema: ItemSchema];
    /** there are two possible syntaxes, and the one that gets chosen is based on the length of `this.args`
     * - if `args.length == 1`, then: `args[0]` must specify the length of the array when decoding
     * - if `args.length == 2`, then: `args[0]` must specify the starting index, and `args[1]` must specify the ending index
    */
    args: [index_start: number, index_end: number] | [len?: number];
    constructor(child?: ItemSchema, array_length?: number);
    static from(schema_obj: ClassFieldsOf<SArray<SchemaChildNode>>): SArray<SchemaNode<unknown, string>, unknown>;
    encode(value: ItemType[], ...args: [index_start?: number, index_end?: number]): Uint8Array;
    decode(buf: Uint8Array, offset: number, ...args: [index_start?: number, index_end?: number] | [len?: number]): Decoded<ItemType[], number>;
    /** decode one item */
    decodeNext(buf: Uint8Array, offset: number, ...args: never[]): Decoded<ItemType>;
}
/** an enum entry to be used as a child of an `SEnum` schema node. this schema node's `value` must be a 2-tuple array with the first element (of type `T`) being the javascript value, and the second element (of type `Uint8Array`) being its corresponding bytes */
export declare class SEnumEntry<T extends (JSPrimitive | undefined)> extends SchemaNode<[T, Uint8Array], "enumentry"> {
    type: "enumentry";
    value: [T, Uint8Array];
    constructor(enum_value: T, enum_bytes: Uint8Array | number[]);
    /** this functionality is made into a method instead of being embeded into `SEnum.decode` mainly so that it's possible to subclass it
     * @returns `true` if the bytes in the provided `buffer` and `offset` match with this enum entry's bytes, else the result is `false`
    */
    matchBytes(buffer: Uint8Array, offset: number, ...args: any[]): boolean;
    /** this functionality is made into a method instead of being embeded into `SEnum.encode` mainly so that it's possible to subclass it
     * @returns `true` if the provided `value` matches with this enum entry's value, else the result is `false`
    */
    matchValue(value: T, ...args: any[]): boolean;
    encode(value?: T | undefined, ...args: any[]): this["value"][1];
    decode(buffer: Uint8Array, offset: number, ...args: any[]): Decoded<this["value"][0]>;
}
/** a schema node for a `Uint8Array` bytes literal that has a one-to-one mapping with a primitive javascript value */
export declare class SEnum extends SchemaNode<JSPrimitive, "enum"> {
    type: "enum";
    value?: this["children"][number]["value"][0];
    /** each child `SEnumEntry` dictates a possible enum bytes and value pair entry */
    children: SEnumEntry<JSPrimitive>[];
    /** if no `value` or `bytes` match with any of the enum entries (`children`) then use the codec of the provided `default_schema` */
    default_schema: SchemaChildNode;
    constructor(...children: SEnumEntry<JSPrimitive>[]);
    setDefault(schema: this["default_schema"]): this;
    getDefault(): this["default_schema"];
    encode(value: NonNullable<this["value"]>, ...args: any[]): Uint8Array;
    decode(buf: Uint8Array, offset: number, ...args: any[]): Decoded<any, number>;
}
/** this behaves just like regular {@link SArray}, but has its array length stored in the head (beginning) bytes in the provided {@link head_type} byte format. */
export declare class SHeadArray<HeadType extends (NumericType | VarNumericType), ItemSchema extends SchemaChildNode<any, string>, ItemType = NonNullable<ItemSchema["value"]>> extends SArray<ItemSchema, ItemType> {
    type: "head_array";
    head_type: HeadType;
    head_schema: SPrimitive<number, this["head_type"]>;
    constructor(head_type: HeadType, child?: ItemSchema);
    static from(schema_obj: ClassFieldsOf<SHeadArray<any, any>>): SHeadArray<any, SchemaNode<unknown, string>, unknown>;
    encode(value: ItemType[]): Uint8Array;
    decode(buf: Uint8Array, offset: number): Decoded<ItemType[], number>;
}
declare type SHeadPrimitive_type<TypeName extends PrimitiveArrayType> = `head_${TypeName}`;
/** {@link PrimitiveArrayType} typically require length information to be decoded. this subclass of {@link SPrimitive} schema stores the length information
 * in the head bytes using the provided {@link HeadType} binary numeric format.
*/
export declare class SHeadPrimitive<HeadType extends (NumericType | VarNumericType), T extends JSPrimitive & {
    length: number;
}, TypeName extends PrimitiveArrayType> extends SchemaNode<T, SHeadPrimitive_type<TypeName>> {
    type: SHeadPrimitive_type<TypeName>;
    head_schema: SPrimitive<number, HeadType>;
    content_schema: SPrimitive<T, TypeName>;
    constructor(head_type: HeadType, content_type: TypeName, default_value?: T, default_args?: any[]);
    static from<HeadType extends (NumericType | VarNumericType), T extends JSPrimitive & {
        length: number;
    }, TypeName extends PrimitiveArrayType>(schema_obj: {
        type: SHeadPrimitive_type<TypeName>;
        head_type: HeadType;
        value?: T;
        args?: any[];
    }): SHeadPrimitive<HeadType, T, TypeName>;
    encode(value: T, ...args: never[]): Uint8Array;
    decode(buf: Uint8Array, offset: number, ...args: never[]): Decoded<T, number>;
}
export {};
/** a schema node representing a union between different types of schema nodes */
