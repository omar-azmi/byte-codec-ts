export {
	default,
	decode,
	decodeSeq,
	encode,
	encodeSeq,
	readFrom,
	writeTo,
} from "./primitive_codec"

export type {
	NumericType,
	NumericArrayType,
	PrimitiveArrayType,
	PrimitiveType,
	JSPrimitive,
} from "./primitive_codec"

export {
	encodeS,
	decodeS,
	makeS,
	SchemaNode,
	SPrimitive,
	SRecord,
	STuple,
	SArray,
	SEnumEntry,
	SEnum,
	SHeadPrimitive,
	SHeadArray,
} from "./schema_codec"

export type {
	DecodeSchemaFunc,
	EncodeSchemaFunc,
	JSSimpleTypes,
	MakeSchemaFrom,
	SRecordChild,
	SchemaArgs,
	SchemaChildNode,
	SchemaNodeConstructor,
} from "./schema_codec"

export {
	concat,
	getEnvironmentEndianess,
	swapEndianess,
	swapEndianessFast,
	is_identical,
	is_subidentical,
	FileParser,
	to_hex_string,
	typed_array_constructor_of,
} from "./utility"

export type {
	ConstructorOf,
	ClassFieldsOf,
	Decoded,
	NumericDType,
	Require,
	Obj,
	OptionalKeysOf,
	EmptyObj,
	TypedArrayConstructor,
	TypedArray,
} from "./utility"

export { default as compiler_options } from "./compiler_options.mjs"

/*
// TO BE DEPRECATED
export {
	encodeS,
	decodeS,
	//PSCodec,
} from "./structure_codec"

export type {
	DecodeSchemaFunc,
	EncodeSchemaFunc,
	JSSimpleTypes,
	SchemaAnyNode,
	SchemaArgs,
	SchemaArrayNode,
	SchemaCallbackNode,
	SchemaLeafNode,
	SchemaNode,
	SchemaRecordNode,
	SchemaTupleNode,
	SchemaTypeName,
} from "./structure_codec"
*/
