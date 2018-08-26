module.exports = function ObjectForEach(obj, callback) {
    Object.keys(obj).forEach(x=>callback(obj[x], x));
}