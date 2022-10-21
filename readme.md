# Byte-Codec-TS

This is a simple typescript library that helps you serialize primitive javascript types and composite objects into or from binary. The main focus of this library is to:
- primarily target the browser
- have a moderately small bundle size. currently:
  - 30kb typescript source code
  - 4.5kb minified
  - 2.3kb minified + gzip
  - 2.0kb minified + brotli
- have no external library dependencies (besides esbuild, which is used for transpiling, bundling, and minification)
- have a readable, strong-typed, and type-extensible source code, at the expense of the possiblity of sacrificing performance

### Examples

- encode player `name` as cstring (null-terminated), and xyz `position` as an array of signed 16-bit integers in big-endian format. <br> then follow that it decoding the data

```ts
import { encodeSeq, decodeSeq } from "byte-codec-ts"

let player = { name: "creeper", position: [-2822, 992, 3] }
// encoding
const player_data = encodeSeq(["cstr", player.name], ["i2b[]", player.position])
// player_data === Uint8Array.from([0x63, 0x72, 0x65, 0x65, 0x70, 0x65, 0x72, 0x00 , 0xf4, 0xfa , 0x03, 0xe0 , 0x00, 0x03])
// ................................|---  player.name + null-termination (0x00) ---|,|--- x  ---|,|--- y  ---|,|--- z  ---|
// decoding
let [[name, position], bytesize] = decodeSeq(player_data, 0, ["cstr"], ["i2b[]", 3])
let player_clone = { name: name, position: position }
```

- repeating a more complex version of the previous example using the `structure` codec api that uses a json-like schema for defining player data

```ts
import { encodeS, decodeS } from "byte-codec-ts"
import type { SchemaRecordNode } from "byte-codec-ts"

let player = {
	name: "creeper",
	position: [-2822, 992, 3],
	inventory: [
		{ item: "great-axe", attack: 7, speed: 1, element: "W" },
		{ item: "short-sword", attack: 3, speed: 4, element: "F" },
		{ item: "morning-star", attack: 6, speed: 2, element: "E" },
		{ item: "pistol", attack: 100, speed: 100, element: "A" },
	]
}
const item_schema: SchemaRecordNode = { type: "record", children: [
	{ name: "item", type: "cstr" },
	{ name: "attack", type: "u1" },
	{ name: "speed", type: "u1" },
	{ name: "element", type: "str", args: [1] },
]}
const player_schema: SchemaRecordNode = { type: "record", children: [
	{ name: "name", type: "cstr" },
	{ name: "position", type: "i2b[]", args: [3] },
	{ name: "inventory", type: "array", args: [4], children: [item_schema] },
]}
// encoding
const player_data = encodeS(player_schema, player)
// decoding
let [player_clone, bytesize] = decodeS(player_schema, player_data, 0)
// player_clone === player
```
