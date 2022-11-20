import { FileParser } from "./deps.ts"
import { concatBytes } from "../src/deps.ts"
import { SArray, SEnum, SEnumEntry, SPrimitive, SRecord } from "../src/mod.ts"

class delimeter extends SEnum {
	constructor() {
		super(
			new SEnumEntry("SOI", [0xFF, 0xD8]), // Start Of Image
			new SEnumEntry("EOI", [0xFF, 0xD9]), // End Of Image
			new SEnumEntry("SOS", [0xFF, 0xDA]), // Start Of Scan
			new SEnumEntry("DQT", [0xFF, 0xDB]), // Define Quantization Table(s)
			new SEnumEntry("DNL", [0xFF, 0xDC]), // Define Number of Lines
			new SEnumEntry("DRI", [0xFF, 0xDD]), // Define Restart Interval
			new SEnumEntry("DHP", [0xFF, 0xDE]), // Define Hierarchical Progression
			new SEnumEntry("EXP", [0xFF, 0xDF]), // EXPand reference components
			new SEnumEntry("COM", [0xFF, 0xFE]), // COMment
			...(new start_of_frame_marker().children),
			...(new app_marker().children),
			...(new restart_marker().children),
		)
	}
}

class app_marker extends SEnum {
	constructor() {
		super(
			new SEnumEntry("APP0", [0xFF, 0xE0]), // if (len >= 14) JFIF, else if (len >= 6) JFXX, else AVI MJPEG
			new SEnumEntry("APP1", [0xFF, 0xE1]), // EXIF/XMP/XAP ?
			new SEnumEntry("APP2", [0xFF, 0xE2]), // FlashPix / ICC
			new SEnumEntry("APP3", [0xFF, 0xE3]), // Kodak/...
			new SEnumEntry("APP4", [0xFF, 0xE4]), // FlashPix/...
			new SEnumEntry("APP5", [0xFF, 0xE5]), // Ricoh...
			new SEnumEntry("APP6", [0xFF, 0xE6]), // GoPro...
			new SEnumEntry("APP7", [0xFF, 0xE7]), // Pentax/Qualcomm
			new SEnumEntry("APP8", [0xFF, 0xE8]), // Spiff
			new SEnumEntry("APP9", [0xFF, 0xE9]), // MediaJukebox
			new SEnumEntry("APPA", [0xFF, 0xEA]), // PhotoStudio
			new SEnumEntry("APPB", [0xFF, 0xEB]), // HDR
			new SEnumEntry("APPC", [0xFF, 0xEC]), // photoshoP ducky / savE foR web
			new SEnumEntry("APPD", [0xFF, 0xED]), // photoshoP savE As
			new SEnumEntry("APPE", [0xFF, 0xEE]), // "adobe" (length = 12)
			new SEnumEntry("APPF", [0xFF, 0xEF]), // GraphicConverter
		)
	}
}

type jpg_segment_type = {
	marker: NonNullable<delimeter["value"]>,
	length: number,
	data: Uint8Array,
}

class jpg_segment extends SRecord<jpg_segment_type> {
	constructor() {
		super()
		this.pushChildren(
			new delimeter().setName("marker"),
			new SPrimitive("u2b").setName("length"),
			new SPrimitive("bytes").setName("data"),
		)
	}
	decode(buf: Uint8Array, offset: number): [value: jpg_segment_type, bytesize: number] {
		const [{ marker }, s0] = super.decode(buf, offset, 0, 1)
		if (marker === "SOI" || marker === "EOI") return [{ marker, length: 0, data: new Uint8Array() }, s0]
		const [{ length }, s1] = super.decode(buf, offset + s0, 1, 2)
		this.children[2].setArgs(length - s1)
		const [{ data }, s2] = super.decode(buf, offset + s0 + s1, 2, 3)
		return [{ marker, length, data, }, s0 + s1 + s2]
	}
	encode(value: jpg_segment_type): Uint8Array {
		const marker = value.marker
		if (marker === "SOI" || marker === "EOI") return super.encode(value, 0, 1)
		// we could easily handle "ECS" here, but then this `encode` and `decode` pair of functions will no longer be bijective. so we leave the "ECS" handling to the parent `jpg_schema`
		return super.encode(value)
	}
}

class jpg_schema extends SArray<jpg_segment> {
	entroy_coded_segment?: Uint8Array
	constructor() {
		super(new jpg_segment())
	}
	override encode(segments: { marker: string, length: number, data: Uint8Array }[]): Uint8Array {
		const
			bytes: Uint8Array[] = [],
			item_schema = this.children[0]
		for (const segment of segments) {
			if (segment.marker === "ECS") bytes.push(segment.data)
			else bytes.push(item_schema.encode(segment))
		}
		return concatBytes(...bytes)
	}
	override decode(buf: Uint8Array, offset: number): [value: jpg_segment_type[], bytesize: number] {
		const segments: jpg_segment_type[] = []
		let total_bytesize = 0
		while (offset + total_bytesize < buf.byteLength) {
			const [segment, bytesize] = super.decodeNext(buf, offset + total_bytesize)
			segments.push(segment)
			total_bytesize += bytesize
			if (segment["marker"] === "SOS") {
				// next block of byte literal contains "Scan Data", which is terminated only when a `0xFF` byte is found, followed by a non-zero byte (ie: not 0x00)
				const sub_buf = buf.subarray(offset + total_bytesize)
				let len = 0 // scan bytes length
				do { len = sub_buf.indexOf(0xFF, len + 1) } while (sub_buf[len + 1] === 0x00)
				this.entroy_coded_segment = sub_buf.slice(0, len)
				segments.push({ marker: "ECS", length: len, data: this.entroy_coded_segment })
				total_bytesize += len
			}
			if (segment["marker"] === "EOI") break
		}
		return [segments, total_bytesize]
	}
}

class start_of_frame_marker extends SEnum {
	constructor() {
		super(
			new SEnumEntry("Baseline", [0xFF, 0xC0]), // Baseline jpeg
			new SEnumEntry("SequHuff", [0xFF, 0xC1]), // extended Sequential, Huffman
			new SEnumEntry("ProgHuff", [0xFF, 0xC2]), // Progressive, Huffman
			new SEnumEntry("LossHuff", [0xFF, 0xC3]), // Lossless, Huffman

			new SEnumEntry("DefHuffTable", [0xFF, 0xC4]), // Define Huffman Tables
			new SEnumEntry("DiffSequHuff", [0xFF, 0xC5]), // Differential Sequential, Huffman
			new SEnumEntry("DiffProgHuff", [0xFF, 0xC6]), // Differential Progressive, Huffman
			new SEnumEntry("DiffLossHuff", [0xFF, 0xC7]), // Differential Lossless, Huffman

			new SEnumEntry("JPEGExtension", [0xFF, 0xC8]), // reserved for JPEG extension
			new SEnumEntry("SequArth", [0xFF, 0xC9]), // extended Sequential, Arithmetic
			new SEnumEntry("ProgArth", [0xFF, 0xCA]), // Progressive, Arithmetic
			new SEnumEntry("LossArth", [0xFF, 0xCB]), // Lossless, Arithmetic

			new SEnumEntry("DefArthCode", [0xFF, 0xCC]), // Define Arithmetic Coding conditioning
			new SEnumEntry("DiffSequArth", [0xFF, 0xCD]), // Differential Sequential, Arithmetic
			new SEnumEntry("DiffProgArth", [0xFF, 0xCE]), // Differential Progressive, Arithmetic
			new SEnumEntry("DiffLossArth", [0xFF, 0xCF]), // Differential Lossless, Arithmetic
		)
	}
}

class restart_marker extends SEnum {
	constructor() {
		super(
			new SEnumEntry("RST0", [0xFF, 0xD0]),
			new SEnumEntry("RST1", [0xFF, 0xD1]),
			new SEnumEntry("RST2", [0xFF, 0xD2]),
			new SEnumEntry("RST3", [0xFF, 0xD3]),
			new SEnumEntry("RST4", [0xFF, 0xD4]),
			new SEnumEntry("RST5", [0xFF, 0xD5]),
			new SEnumEntry("RST6", [0xFF, 0xD6]),
			new SEnumEntry("RST7", [0xFF, 0xD7]),
		)
	}
}

export const jpg_file_parser = new FileParser(new jpg_schema())
Object.assign(window, { jpg_file_parser })
export default jpg_file_parser
