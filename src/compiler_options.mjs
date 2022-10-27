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

//module.exports.compiler_options = { DEBUG, MINIFY, BUNDLE }
export default { DEBUG, MINIFY, BUNDLE }