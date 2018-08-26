let color = (code, end_code = 39) => (string) => `[${code}m${string}[${end_code}m`;

let colors = {}
colors.green = color(32);
colors.red = color(31);
colors.cyan = color(36);
colors.yellow = color(33);
colors.magenta = color(35);
colors.bold = color(1,22);
colors.underline = color(4,24);

module.exports = function StringPrototype() {
    // APPLY TO STRING PROTOTYPE
    Object.keys(colors).forEach(color_name => Object.defineProperty(String.prototype, color_name, { get: function() { return colors[color_name](this)}}));
}
module.exports = Object.assign(module.exports, colors);