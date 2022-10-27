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
} from "./schema_codec"

export type {
	DecodeFunc,
	EncodeFunc,
	JSPrimitive,
	PrimitiveType,
} from "./primitive_codec"

export {
	concat,
	getEnvironmentEndianess,
	swapEndianess,
	swapEndianessFast,
	is_identical,
	is_subidentical,
	FileParser,
	to_hex_string,
} from "./utiliy"


export type {
	ConstructorOf,
	Require,
	Obj,
	EmptyObj,
	TypedArrayConstructor,
	TypedArray,
} from "./utiliy"


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
