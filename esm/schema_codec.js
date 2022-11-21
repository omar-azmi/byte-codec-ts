/** a binary serializer for struct like objects based on a schema. <br>
 * @module
*/
import { concatBytes, pack, unpack } from "./deps.js";
const type_registry = {};
export const encodeS = (schema, value) => schema.encode(value);
export const decodeS = (schema, buf, offset) => schema.decode(buf, offset);
export const makeS = (schema_obj) => {
    // TODO find a good way to manage constructor parameters across different schema types
    // return new type_registry[schema_obj.type]()
    // return Object.setPrototypeOf(schema_obj, type_registry[schema_obj.type])
    return type_registry[schema_obj.type].from(schema_obj);
};
/** an abstract and un-typed `SchemaNode` for the sake of creating an inheritance tree */
export class SchemaNode {
    constructor(type, value, args) {
        /** a mandatory kind descriptior of the primitive kind */
        Object.defineProperty(this, "type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** the value held by this schema node. used as a storage for interceptors to interact and read decoded value <br>
         * it can also used as a means for storing default values for the encoder to utilize. <br>
         * but besides those two scenarios, it should typically be left unassigned. <br>
         * this also comes in handy when annotating types both for the encoder or decoder
        */
        Object.defineProperty(this, "value", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** name of the node, used for object property key naming by parent {@link SchemaRecordNode} */
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** an array collection of child element.
         * typically used by non-leaf nodes, such as {@link SchemaRecordNode} and {@link SchemaTupleNode}
        */
        Object.defineProperty(this, "children", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** args that should be passed on to either the `type` specific encoder or decoder */
        Object.defineProperty(this, "args", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
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
        Object.defineProperty(this, "doc", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.type = type;
        if (!(type in type_registry))
            this.setType(type, true);
        if (value)
            this.setValue(value);
        if (args)
            this.setArgs(...args);
    }
    /** manually set `this` schema's `type` to the provided `type_name`, and also
     * register the new `type_name` to global `type_registery` if `register = true`. <br>
     * this is the only easy way to register `type_name`s of sub-sub-classes of abstract {@link SchemaNode}. <br>
     * check out {@link SHeadArray} to see how it extends {@link SArray}, but registers its own `type_name = "headarray"`
     * that's different from its parent class's `type_name = "array"`
    */
    setType(type_name, register = true) {
        this.type = type_name;
        if (register)
            type_registry[type_name] = this.constructor;
        return this;
    }
    setName(name) {
        this.name = name;
        return this;
    }
    pushChildren(...children) {
        if (this.children === undefined)
            this.children = [];
        this.children.push(...children);
        return this;
    }
    setValue(value) {
        this.value = value;
        return this;
    }
    setArgs(...args) {
        if (args)
            this.args = args;
        return this;
    }
    pushArgs(...args) {
        if (args) {
            if (this.args === undefined)
                this.args = [];
            this.args.push(args);
        }
        return this;
    }
}
/** an abstract static method that creates an instance of `this` schema class, using a regular javascript object */
Object.defineProperty(SchemaNode, "from", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (schema_obj) => {
        console.error("tried to create schema from `Object`: ", schema_obj);
        throw new Error("abstract `SchemaNode` class cannot create schema instances");
    }
});
/** a schema node for primitive none-composite and primitive javascript types */
export class SPrimitive extends SchemaNode {
    constructor(type, default_value, default_args) {
        super(type, default_value, default_args);
    }
    static from(schema_obj) {
        return new this(schema_obj.type, schema_obj.value, schema_obj.args);
    }
    encode(value, ...args) {
        if (value === undefined)
            value = this.value;
        return pack(this.type, value, ...(args.length > 0 ? args : this.args));
    }
    decode(buf, offset, ...args) {
        return unpack(this.type, buf, offset, ...(args.length > 0 ? args : this.args));
    }
}
/** a schema node for nested record-like javascript object types */
export class SRecord extends SchemaNode {
    constructor(...children) {
        super("record");
        Object.defineProperty(this, "children", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        if (children.length > 0)
            this.pushChildren(...children);
    }
    static from(schema_obj) {
        const new_schema = new this(), children = schema_obj.children;
        for (const child of children)
            new_schema.pushChildren(makeS(child).setName(child.name));
        return new_schema;
    }
    encode(value, ...args) {
        const bytes = [], child_start = args[0] || this.args[0] || 0, child_end = args[1] || this.args[1] || this.children.length;
        for (let ch = child_start; ch < child_end; ch++) {
            const child = this.children[ch];
            bytes.push(child.encode(value[child.name]));
        }
        //for (const child of this.children) bytes.push(child.encode(value[child.name]))
        return concatBytes(...bytes);
    }
    decode(buf, offset, ...args) {
        const record = {}, child_start = args[0] || this.args[0] || 0, child_end = args[1] || this.args[1] || this.children.length;
        let total_bytesize = 0;
        for (let ch = child_start; ch < child_end; ch++) {
            const child = this.children[ch], [value, bytesize] = child.decode(buf, offset + total_bytesize);
            total_bytesize += bytesize;
            record[child.name] = value;
        }
        return [record, total_bytesize];
    }
}
/** a schema node for a nested tuple-like javascript array types */
export class STuple extends SchemaNode {
    constructor() {
        super("tuple");
        Object.defineProperty(this, "children", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    static from(schema_obj) {
        const new_schema = new this(), children = schema_obj.children;
        for (const child of children)
            new_schema.pushChildren(makeS(child));
        return new_schema;
    }
    encode(value, ...args) {
        const bytes = [], children = this.children, child_start = args[0] || this.args[0] || 0, child_end = args[1] || this.args[1] || this.children.length;
        for (let ch = child_start; ch < child_end; ch++)
            bytes.push(children[ch].encode(value[ch]));
        return concatBytes(...bytes);
    }
    decode(buf, offset, ...args) {
        const tuple = [], children = this.children, child_start = args[0] || this.args[0] || 0, child_end = args[1] || this.args[1] || this.children.length;
        let total_bytesize = 0;
        for (let ch = child_start; ch < child_end; ch++) {
            const [value, bytesize] = children[ch].decode(buf, offset + total_bytesize);
            total_bytesize += bytesize;
            tuple.push(value);
        }
        return [tuple, total_bytesize];
    }
}
/** a schema node for an array of a single type */
export class SArray extends SchemaNode {
    constructor(child, array_length) {
        super("array");
        if (child)
            this.pushChildren(child);
        if (array_length)
            this.setArgs(0, array_length);
    }
    static from(schema_obj) {
        const child = schema_obj.children[0], len = schema_obj.args ? schema_obj.args[0] : undefined, new_schema = new this(makeS(child), len);
        return new_schema;
    }
    encode(value, ...args) {
        const bytes = [], item_schema = this.children[0], index_start = args[0] || this.args[0] || 0, // `this.args[0]` should equal to `index_start` when decoding
        index_end = args[1] || this.args[1] || value.length; // `this.args[1]` should equal to `index_end` when decoding
        for (let i = index_start; i < index_end; i++)
            bytes.push(item_schema.encode(value[i]));
        return concatBytes(...bytes);
    }
    decode(buf, offset, ...args) {
        const arr = [], item_schema = this.children[0];
        let total_bytesize = 0, index_start = args[0] || this.args[0] || 0, index_end = args[1] || this.args[1];
        // BAD LOOSE TYPING PRACTICE. for the sake of accounting for user mistake
        // if only a single argument is passed as `...args`, or if only a single item is present in `this.args`, then interpret it as `index_end` (array length) instead of `index_start`
        if (index_end === undefined) {
            index_end = index_start;
            index_start = 0;
        }
        for (let i = index_start; i < index_end; i++) {
            const [value, bytesize] = item_schema.decode(buf, offset + total_bytesize);
            total_bytesize += bytesize;
            arr[i] = value;
        }
        return [arr, total_bytesize];
    }
    /** decode one item */
    decodeNext(buf, offset, ...args) {
        return this.children[0].decode(buf, offset);
    }
}
/** an enum entry to be used as a child of an `SEnum` schema node. this schema node's `value` must be a 2-tuple array with the first element (of type `T`) being the javascript value, and the second element (of type `Uint8Array`) being its corresponding bytes */
export class SEnumEntry extends SchemaNode {
    constructor(enum_value, enum_bytes) {
        if (!(enum_bytes instanceof Uint8Array))
            enum_bytes = Uint8Array.from(enum_bytes);
        super("enumentry", [enum_value, enum_bytes]);
    }
    /** this functionality is made into a method instead of being embeded into `SEnum.decode` mainly so that it's possible to subclass it
     * @returns `true` if the bytes in the provided `buffer` and `offset` match with this enum entry's bytes, else the result is `false`
    */
    matchBytes(buffer, offset, ...args) {
        const sub_buf = buffer.subarray(offset), enum_bytes = this.value[1], len = enum_bytes.byteLength;
        for (let i = 0; i < len; i++)
            if (sub_buf[i] != enum_bytes[i])
                return false;
        return true;
    }
    /** this functionality is made into a method instead of being embeded into `SEnum.encode` mainly so that it's possible to subclass it
     * @returns `true` if the provided `value` matches with this enum entry's value, else the result is `false`
    */
    matchValue(value, ...args) {
        const enum_value = this.value[0];
        if (value !== enum_value)
            return false;
        return true;
    }
    encode(value, ...args) {
        return this.value[1];
    }
    decode(buffer, offset, ...args) {
        return [this.value[0], this.value[1].byteLength];
    }
}
/** a schema node for a `Uint8Array` bytes literal that has a one-to-one mapping with a primitive javascript value */
export class SEnum extends SchemaNode {
    constructor(...children) {
        super("enum");
        /** if no `value` or `bytes` match with any of the enum entries (`children`) then use the codec of the provided `default_schema` */
        Object.defineProperty(this, "default_schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new SEnumEntry(undefined, new Uint8Array())
        });
        this.pushChildren(...children);
    }
    setDefault(schema) {
        this.default_schema = schema;
        return this;
    }
    getDefault() {
        return this.default_schema;
    }
    encode(value, ...args) {
        for (const entry_schema of this.children)
            if (entry_schema.matchValue(value))
                return entry_schema.encode();
        console.log(args);
        return this.default_schema.encode(value, ...args);
    }
    decode(buf, offset, ...args) {
        for (const entry_schema of this.children)
            if (entry_schema.matchBytes(buf, offset))
                return entry_schema.decode(buf, offset);
        return this.default_schema.decode(buf, offset, ...args);
    }
}
/** this behaves just like regular {@link SArray}, but has its array length stored in the head (beginning) bytes in the provided {@link head_type} byte format. */
export class SHeadArray extends SArray {
    constructor(head_type, child) {
        super(child);
        Object.defineProperty(this, "head_type", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "head_schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.setType("head_array");
        this.head_type = head_type;
        this.head_schema = new SPrimitive(head_type);
    }
    static from(schema_obj) {
        const child = schema_obj.children[0];
        return new this(schema_obj.head_type, makeS(child));
    }
    encode(value) {
        return concatBytes(this.head_schema.encode(value.length), super.encode(value));
    }
    decode(buf, offset) {
        const [arr_len, s0] = this.head_schema.decode(buf, offset), [arr, s1] = super.decode(buf, offset + s0, arr_len);
        return [arr, s0 + s1];
    }
}
/** {@link PrimitiveArrayType} typically require length information to be decoded. this subclass of {@link SPrimitive} schema stores the length information
 * in the head bytes using the provided {@link HeadType} binary numeric format.
*/
export class SHeadPrimitive extends SchemaNode {
    constructor(head_type, content_type, default_value, default_args) {
        super(`head_${content_type}`);
        Object.defineProperty(this, "head_schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "content_schema", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.head_schema = new SPrimitive(head_type);
        this.content_schema = new SPrimitive(content_type, default_value, default_args);
    }
    static from(schema_obj) {
        const content_type = schema_obj.type.replace("head_", "");
        return new this(schema_obj.head_type, content_type, schema_obj.value, schema_obj.args);
    }
    encode(value, ...args) {
        return concatBytes(this.head_schema.encode(value.length), this.content_schema.encode(value));
    }
    decode(buf, offset, ...args) {
        const [len, s0] = this.head_schema.decode(buf, offset), [value, s1] = this.content_schema.decode(buf, offset + s0, len);
        return [value, s0 + s1];
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
