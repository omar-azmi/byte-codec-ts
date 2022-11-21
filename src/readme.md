# Byte_Codec_TS

This is a simple typescript library that helps you serialize primitive javascript types and composite objects into or from binary. The main focus of this library is to:
- primarily target the browser
- have a moderately small bundle size. currently:
  - `30kb` typescript source code
  - `7.5kb` minified
  - `3.4kb` minified + gzip
  - `3.1kb` minified + brotli
- have no external library dependencies (besides esbuild, which is used for transpiling, bundling, and minification)
- have a readable, strong-typed, and type-extensible source code, at the expense of the possiblity of sacrificing performance

### Examples

- encode player `name` as cstring (null-terminated), and xyz `position` as an array of signed 16-bit integers in big-endian format. <br> then follow it by decoding the encoded data

```ts
import { packSeq, unpackSeq } from "byte_codec_ts"

let player = { name: "creeper", position: [-2822.323, 992.1, 3] }

// encoding
const player_data = packSeq(["cstr", player.name], ["i2b[]", player.position])
// player_data === Uint8Array.from([0x63, 0x72, 0x65, 0x65, 0x70, 0x65, 0x72, 0x00 , 0xf4, 0xfa , 0x03, 0xe0 , 0x00, 0x03])
// ////////////////////////////////|---  player.name + null-termination (0x00) ---|,|--- x  ---|,|--- y  ---|,|--- z  ---|

// decoding
let [[name, position], bytesize] = unpackSeq(player_data, 0, ["cstr"], ["i2b[]", 3])
let player_clone = { name: name, position: position }

console.debug("original player data:", player) // original player data: { name: "creeper", position: [ -2822.323, 992.1, 3 ] }
console.debug("reconstructed player data:", player_clone) // reconstructed player data: { name: "creeper", position: [ -2822, 992, 3 ] }
```

- repeating a more complex version of the previous example using the `schema` codec api that uses a classed based json-like schema for defining player data

```ts
import { SRecord, SPrimitive, SHeadPrimitive, SHeadArray } from "byte_codec_ts"

const player = {
	name: "creeper",
	position: [-2822.323, 992.1, 3],
	inventory: [
		{ item: "great-axe", attack: 7, speed: 1, element: "W" },
		{ item: "short-sword", attack: 3, speed: 4, element: "F" },
		{ item: "morning-star", attack: 6, speed: 2, element: "E" },
		{ item: "pistol", attack: 100, speed: 100, element: "A" },
	]
}
const item_schema = new SRecord(
	new SPrimitive("cstr").setName("item"),
	new SPrimitive("u1").setName("attack"),
	new SPrimitive("u1").setName("speed"),
	new SHeadPrimitive("uv", "str").setName("element"),
)

const player_schema = new SRecord(
	new SPrimitive("cstr").setName("name"),
	new SPrimitive("i2b[]", [0, 0, 0], [3]).setName("position"),
	new SHeadArray("u1c", item_schema).setName("inventory")
)

// encoding
const player_data = player_schema.encode(player)
// decoding
const [player_clone, bytesize] = player_schema.decode(player_data, 0)
// player_clone ~= player

console.debug("original player data:", player) /** original player data: {
name: "creeper", position: [ -2822.323, 992.1, 3 ],inventory: [
	{ item: "great-axe", attack: 7, speed: 1, element: "W" },
	{ item: "short-sword", attack: 3, speed: 4, element: "F" },
	{ item: "morning-star", attack: 6, speed: 2, element: "E" },
	{ item: "pistol", attack: 100, speed: 100, element: "A" }
]} */
console.debug("reconstructed player data:", player_clone) /** reconstructed player data: {
name: "creeper", position: [ -2822, 992, 3 ],inventory: [
	{ item: "great-axe", attack: 7, speed: 1, element: "W" },
	{ item: "short-sword", attack: 3, speed: 4, element: "F" },
	{ item: "morning-star", attack: 6, speed: 2, element: "E" },
	{ item: "pistol", attack: 100, speed: 100, element: "A" }
]} */
```
