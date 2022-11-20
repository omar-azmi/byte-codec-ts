import { FileParser } from "./deps.ts"
import { SArray, SPrimitive, SRecord } from "../src/mod.ts"

type png_chunk_type = {
	chunk_length: number,
	chunk_type: string,
	chunk_data: Uint8Array | ihdr_chunk_type,
	chunk_crc: number,
}

class png_chunk extends SRecord<png_chunk_type> {
	constructor() {
		super(
			new SPrimitive("u4b").setName("chunk_length"),
			new SPrimitive("str").setName("chunk_type").setArgs(4),
			new SPrimitive("bytes").setName("chunk_data"),
			new SPrimitive("u4b").setName("chunk_crc"),
		)
	}
	override decode(buf: Uint8Array, offset: number) {
		const [chunk_a, bytesize_a] = super.decode(buf, offset, 0, 2)
		this.children[2].setArgs(chunk_a["chunk_length"])
		const [chunk_b, bytesize_b] = super.decode(buf, offset + bytesize_a, 2)
		return [{ ...chunk_a, ...chunk_b }, bytesize_a + bytesize_b] as [value: png_chunk_type, bytesize: number]
	}
}

class png_chunks extends SArray<png_chunk> {
	constructor() {
		super(new png_chunk())
	}
	override decode(buf: Uint8Array, offset: number) {
		const chunks: png_chunk_type[] = []
		let total_bytesize = 0
		while (offset + total_bytesize < buf.byteLength) {
			const [chunk, bytesize] = super.decodeNext(buf, offset + total_bytesize)
			total_bytesize += bytesize
			if (chunk["chunk_type"] === "IHDR") chunk["chunk_data"] = new data_ihdr().decode(chunk["chunk_data"] as Uint8Array, 0)[0]
			chunks.push(chunk)
			if (chunk["chunk_type"] === "IEND") break
		}
		return [chunks, total_bytesize] as [value: png_chunk_type[], bytesize: number]
	}
	override encode(chunks: png_chunk_type[]): Uint8Array {
		const modified_chunks = chunks.map((chunk) => {
			if (chunk["chunk_type"] !== "IHDR") return chunk
			return {
				...chunk,
				"chunk_data": new data_ihdr().encode(chunk["chunk_data"] as ihdr_chunk_type),
			}
		})
		return super.encode(modified_chunks)
	}
}

type ihdr_chunk_type = {
	width: number
	height: number
	bitdepth: number
	colortype: number
	compression: number
	filter: number
	interlace: number
}

const data_ihdr = class extends SRecord<ihdr_chunk_type> {
	constructor() {
		super()
		this.pushChildren(
			new SPrimitive("i4b").setName("width"),
			new SPrimitive("i4b").setName("height"),
			new SPrimitive("u1").setName("bitdepth"),
			new SPrimitive("u1").setName("colortype"),
			new SPrimitive("u1").setName("compression"),
			new SPrimitive("u1").setName("filter"),
			new SPrimitive("u1").setName("interlace"),
		)
	}
}

export const png_schema = class extends SRecord {
	constructor() {
		super()
		this.pushChildren(
			new SPrimitive("bytes")
				.setName("magic")
				.setValue(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
				.setArgs(8),
			new png_chunks().setName("chunks"),
		)
	}
}

export const png_file_parser = new FileParser(new png_schema())
Object.assign(window, { png_file_parser })
export default png_file_parser
