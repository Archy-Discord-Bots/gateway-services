/**
 * src/utils/templateParser.js
 *
 * Pure template-string utility. No dependencies, no side effects.
 */

/**
 * Replace every {key} placeholder in `template` with the matching value
 * from `variables`.
 *
 * - Unknown placeholders (key not in variables) are left as-is.
 * - null / undefined values are replaced with an empty string.
 *
 * @param {string} template  - String containing {key} placeholders
 * @param {Record<string, unknown>} variables - Map of placeholder → value
 * @returns {string}
 */
export function parseTemplate(template, variables) {
  return template.replace(/\{([^{}]+)\}/g, (match, key) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) return match
    const value = variables[key]
    return value == null ? '' : String(value)
  })
}