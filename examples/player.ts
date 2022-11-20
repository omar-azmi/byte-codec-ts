import { SRecord, SPrimitive, SHeadPrimitive, SHeadArray } from "../src/mod.ts"

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

console.debug("original player data:", player)
console.debug("reconstructed player data:", player_clone)
