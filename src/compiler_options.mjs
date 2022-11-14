/** when true, additional assignments are done by the codecs to the schema objects themselves, in order to inspect the values in case of a breakdown. <br>
 * @type {boolean}
 * @category Compiler Options
*/
export const DEBUG = true

/** when true, we shall eliminate items that have no effect to the end user (although it might be useful enough for a libary developer). <br>
 * one such feature is the optional `doc` string under {@link SchemaNode}, which can come in hand for others extending your library, but not to the end browser user. <br>
 * @type {boolean}
 * @category Compiler Options
*/
export const MINIFY = true

/** do we wish to bundle the code into one javascript file? <br>
 * @type {boolean}
 * @category Compiler Options
*/
export const BUNDLE = true

/** define the set of primitive type codec functions not to include in your build, by setting their corresponding value to `true` <br>
 * the items presented here cannot be automatically ommited by `esbuild`, because the exported `encode` and `decode` functions of `"./primitive_codec.ts"` do reference them. <br>
 * only *you*, as the library utilizer, can know whether a certain portion is unused by your application. <br>
 * the minified space savings are not really impressive. you save about only `2.5kb` if you set everything to `true` (ie, discarding all primitive codecs).
*/
export const DONOT_INCLUDE_PRIMITIVES = {
	DONOT_BOOLEAN: false,
	DONOT_CSTR: false,
	DONOT_STR: false,
	DONOT_BYTES: false,
	DONOT_NUMBER: false,
	DONOT_UVAR: false,
	DONOT_IVAR: false,
}

//module.exports.compiler_options = { DEBUG, MINIFY, BUNDLE }
export default { DEBUG, MINIFY, BUNDLE, ...DONOT_INCLUDE_PRIMITIVES }
