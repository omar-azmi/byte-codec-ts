var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/deps/deno.land/x/kitchensink_ts@v0.3.4/src/eightpack_varint.ts
var encode_varint = (value, type) => encode_varint_array([value], type);
var encode_varint_array = (value, type) => type[0] === "u" ? encode_uvar_array(value) : encode_ivar_array(value);
var decode_varint = (buf, offset, type) => {
  const [value, bytesize] = decode_varint_array(buf, offset, type, 1);
  return [value[0], bytesize];
};
var decode_varint_array = (buf, offset, type, array_length) => type[0] === "u" ? decode_uvar_array(buf, offset, array_length) : decode_ivar_array(buf, offset, array_length);
var encode_uvar_array = (value) => {
  const len = value.length, bytes = [];
  for (let i = 0; i < len; i++) {
    let v = value[i];
    v = v * (v >= 0 ? 1 : -1);
    const lsb_to_msb = [];
    do {
      lsb_to_msb.push((v & 127) + 128);
      v >>= 7;
    } while (v > 0);
    lsb_to_msb[0] &= 127;
    bytes.push(...lsb_to_msb.reverse());
  }
  return Uint8Array.from(bytes);
};
var decode_uvar_array = (buf, offset = 0, array_length) => {
  if (array_length === void 0)
    array_length = Infinity;
  const array = [], offset_start = offset, buf_length = buf.length;
  let value = 0;
  for (let byte = buf[offset++]; array_length > 0 && offset < buf_length + 1; byte = buf[offset++]) {
    value <<= 7;
    value += byte & 127;
    if (byte >> 7 === 0) {
      array.push(value);
      array_length--;
      value = 0;
    }
  }
  offset--;
  return [array, offset - offset_start];
};
var encode_ivar_array = (value) => {
  const len = value.length, bytes = [];
  for (let i = 0; i < len; i++) {
    let v = value[i];
    const sign = v >= 0 ? 1 : -1, lsb_to_msb = [];
    v = v * sign;
    while (v > 63) {
      lsb_to_msb.push((v & 127) + 128);
      v >>= 7;
    }
    lsb_to_msb.push(v & 63 | (sign == -1 ? 192 : 128));
    lsb_to_msb[0] &= 127;
    bytes.push(...lsb_to_msb.reverse());
  }
  return Uint8Array.from(bytes);
};
var decode_ivar_array = (buf, offset = 0, array_length) => {
  if (array_length === void 0)
    array_length = Infinity;
  const array = [], offset_start = offset, buf_length = buf.length;
  let sign = 0, value = 0;
  for (let byte = buf[offset++]; array_length > 0 && offset < buf_length + 1; byte = buf[offset++]) {
    if (sign === 0) {
      sign = (byte & 64) > 0 ? -1 : 1;
      value = byte & 63;
    } else {
      value <<= 7;
      value += byte & 127;
    }
    if (byte >> 7 === 0) {
      array.push(value * sign);
      array_length--;
      sign = 0;
      value = 0;
    }
  }
  offset--;
  return [array, offset - offset_start];
};

// src/deps/deno.land/x/kitchensink_ts@v0.3.4/src/typedbuffer.ts
var typed_array_constructor_of = (type) => {
  if (type[2] === "c")
    return Uint8ClampedArray;
  type = type[0] + type[1];
  switch (type) {
    case "u1":
      return Uint8Array;
    case "u2":
      return Uint16Array;
    case "u4":
      return Uint32Array;
    case "i1":
      return Int8Array;
    case "i2":
      return Int16Array;
    case "i4":
      return Int32Array;
    case "f4":
      return Float32Array;
    case "f8":
      return Float64Array;
    default: {
      console.error('an unrecognized typed array type `"${type}"` was provided');
      return Uint8Array;
    }
  }
};
var getEnvironmentEndianess = () => new Uint8Array(Uint32Array.of(1).buffer)[0] === 1 ? true : false;
var env_le = getEnvironmentEndianess();
var swapEndianessFast = (buf, bytesize) => {
  const len = buf.byteLength, swapped_buf = new Uint8Array(len), bs = bytesize;
  for (let offset = 0; offset < bs; offset++) {
    const a = bs - 1 - offset * 2;
    for (let i = offset; i < len + offset; i += bs)
      swapped_buf[i] = buf[i + a];
  }
  return swapped_buf;
};
var concatBytes = (...arrs) => {
  const offsets = [0];
  for (const arr of arrs)
    offsets.push(offsets[offsets.length - 1] + arr.length);
  const outarr = new Uint8Array(offsets.pop());
  for (const arr of arrs)
    outarr.set(arr, offsets.shift());
  return outarr;
};

// src/deps/deno.land/x/kitchensink_ts@v0.3.4/src/eightpack.ts
var txt_encoder = new TextEncoder();
var txt_decoder = new TextDecoder();
var packSeq = (...items) => {
  const bufs = [];
  for (const item of items)
    bufs.push(pack(...item));
  return concatBytes(...bufs);
};
var unpackSeq = (buf, offset, ...items) => {
  const values = [];
  let total_bytesize = 0;
  for (const [type, ...args] of items) {
    const [value, bytesize] = unpack(type, buf, offset + total_bytesize, ...args);
    values.push(value);
    total_bytesize += bytesize;
  }
  return [values, total_bytesize];
};
var pack = (type, value, ...args) => {
  switch (type) {
    case "bool":
      return encode_bool(value);
    case "cstr":
      return encode_cstr(value);
    case "str":
      return encode_str(value);
    case "bytes":
      return encode_bytes(value);
    default: {
      if (type[1] === "v")
        return type.endsWith("[]") ? encode_varint_array(value, type) : encode_varint(value, type);
      else
        return type.endsWith("[]") ? encode_number_array(value, type) : encode_number(value, type);
    }
  }
};
var unpack = (type, buf, offset, ...args) => {
  switch (type) {
    case "bool":
      return decode_bool(buf, offset);
    case "cstr":
      return decode_cstr(buf, offset);
    case "str":
      return decode_str(buf, offset, ...args);
    case "bytes":
      return decode_bytes(buf, offset, ...args);
    default: {
      if (type[1] === "v")
        return type.endsWith("[]") ? decode_varint_array(buf, offset, type, ...args) : decode_varint(buf, offset, type);
      else
        return type.endsWith("[]") ? decode_number_array(buf, offset, type, ...args) : decode_number(buf, offset, type);
    }
  }
};
var encode_bool = (value) => Uint8Array.of(value ? 1 : 0);
var decode_bool = (buf, offset = 0) => [buf[offset] >= 1 ? true : false, 1];
var encode_cstr = (value) => txt_encoder.encode(value + "\0");
var decode_cstr = (buf, offset = 0) => {
  const offset_end = buf.indexOf(0, offset), txt_arr = buf.subarray(offset, offset_end), value = txt_decoder.decode(txt_arr);
  return [value, txt_arr.length + 1];
};
var encode_str = (value) => txt_encoder.encode(value);
var decode_str = (buf, offset = 0, bytesize) => {
  const offset_end = bytesize === void 0 ? void 0 : offset + bytesize, txt_arr = buf.subarray(offset, offset_end), value = txt_decoder.decode(txt_arr);
  return [value, txt_arr.length];
};
var encode_bytes = (value) => value;
var decode_bytes = (buf, offset = 0, bytesize) => {
  const offset_end = bytesize === void 0 ? void 0 : offset + bytesize, value = buf.slice(offset, offset_end);
  return [value, value.length];
};
var encode_number_array = (value, type) => {
  const [t, s, e] = type, typed_arr_constructor = typed_array_constructor_of(type), bytesize = parseInt(s), is_native_endian = e === "l" && env_le || e === "b" && !env_le || bytesize === 1 ? true : false, typed_arr = typed_arr_constructor.from(value);
  if (typed_arr instanceof Uint8Array)
    return typed_arr;
  const buf = new Uint8Array(typed_arr.buffer);
  if (is_native_endian)
    return buf;
  else
    return swapEndianessFast(buf, bytesize);
};
var decode_number_array = (buf, offset = 0, type, array_length) => {
  const [t, s, e] = type, bytesize = parseInt(s), is_native_endian = e === "l" && env_le || e === "b" && !env_le || bytesize === 1 ? true : false, bytelength = array_length ? bytesize * array_length : void 0, array_buf = buf.slice(offset, bytelength ? offset + bytelength : void 0), array_bytesize = array_buf.length, typed_arr_constructor = typed_array_constructor_of(type), typed_arr = new typed_arr_constructor(is_native_endian ? array_buf.buffer : swapEndianessFast(array_buf, bytesize).buffer);
  return [Array.from(typed_arr), array_bytesize];
};
var encode_number = (value, type) => encode_number_array([value], type);
var decode_number = (buf, offset = 0, type) => {
  const [value_arr, bytesize] = decode_number_array(buf, offset, type, 1);
  return [value_arr[0], bytesize];
};

// src/schema_codec.ts
var type_registry = {};
var encodeS = (schema, value) => schema.encode(value);
var decodeS = (schema, buf, offset) => schema.decode(buf, offset);
var makeS = (schema_obj) => {
  return type_registry[schema_obj.type].from(schema_obj);
};
var SchemaNode = class {
  type;
  value;
  name;
  children;
  args = [];
  doc;
  constructor(type, value, args) {
    this.type = type;
    if (!(type in type_registry))
      this.setType(type, true);
    if (value)
      this.setValue(value);
    if (args)
      this.setArgs(...args);
  }
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
    if (this.children === void 0)
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
      if (this.args === void 0)
        this.args = [];
      this.args.push(args);
    }
    return this;
  }
};
__publicField(SchemaNode, "from", (schema_obj) => {
  console.error("tried to create schema from `Object`: ", schema_obj);
  throw new Error("abstract `SchemaNode` class cannot create schema instances");
});
var SPrimitive = class extends SchemaNode {
  constructor(type, default_value, default_args) {
    super(type, default_value, default_args);
  }
  static from(schema_obj) {
    return new this(schema_obj.type, schema_obj.value, schema_obj.args);
  }
  encode(value, ...args) {
    if (value === void 0)
      value = this.value;
    return pack(this.type, value, ...args.length > 0 ? args : this.args);
  }
  decode(buf, offset, ...args) {
    return unpack(this.type, buf, offset, ...args.length > 0 ? args : this.args);
  }
};
var SRecord = class extends SchemaNode {
  children = [];
  constructor(...children) {
    super("record");
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
};
var STuple = class extends SchemaNode {
  children = [];
  constructor() {
    super("tuple");
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
};
var SArray = class extends SchemaNode {
  constructor(child, array_length) {
    super("array");
    if (child)
      this.pushChildren(child);
    if (array_length)
      this.setArgs(0, array_length);
  }
  static from(schema_obj) {
    const child = schema_obj.children[0], len = schema_obj.args ? schema_obj.args[0] : void 0, new_schema = new this(makeS(child), len);
    return new_schema;
  }
  encode(value, ...args) {
    const bytes = [], item_schema = this.children[0], index_start = args[0] || this.args[0] || 0, index_end = args[1] || this.args[1] || value.length;
    for (let i = index_start; i < index_end; i++)
      bytes.push(item_schema.encode(value[i]));
    return concatBytes(...bytes);
  }
  decode(buf, offset, ...args) {
    const arr = [], item_schema = this.children[0];
    let total_bytesize = 0, index_start = args[0] || this.args[0] || 0, index_end = args[1] || this.args[1];
    if (index_end === void 0) {
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
  decodeNext(buf, offset, ...args) {
    return this.children[0].decode(buf, offset);
  }
};
var SEnumEntry = class extends SchemaNode {
  constructor(enum_value, enum_bytes) {
    if (!(enum_bytes instanceof Uint8Array))
      enum_bytes = Uint8Array.from(enum_bytes);
    super("enumentry", [enum_value, enum_bytes]);
  }
  matchBytes(buffer, offset, ...args) {
    const sub_buf = buffer.subarray(offset), enum_bytes = this.value[1], len = enum_bytes.byteLength;
    for (let i = 0; i < len; i++)
      if (sub_buf[i] != enum_bytes[i])
        return false;
    return true;
  }
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
};
var SEnum = class extends SchemaNode {
  default_schema = new SEnumEntry(void 0, new Uint8Array());
  constructor(...children) {
    super("enum");
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
};
var SHeadArray = class extends SArray {
  head_type;
  head_schema;
  constructor(head_type, child) {
    super(child);
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
};
var SHeadPrimitive = class extends SchemaNode {
  head_schema;
  content_schema;
  constructor(head_type, content_type, default_value, default_args) {
    super(`head_${content_type}`);
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
};
export {
  SArray,
  SEnum,
  SEnumEntry,
  SHeadArray,
  SHeadPrimitive,
  SPrimitive,
  SRecord,
  STuple,
  SchemaNode,
  concatBytes,
  decodeS,
  encodeS,
  makeS,
  pack,
  packSeq,
  unpack,
  unpackSeq
};
