import { packSeq, unpackSeq } from "../src/mod.ts"

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
