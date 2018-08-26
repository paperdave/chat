Object.defineProperty(module.exports, 'stack', {
    get: function () {
        var orig = Error.prepareStackTrace;
        Error.prepareStackTrace = function (_, stack) {
            return stack;
        };
        var err = new Error;
        Error.captureStackTrace(err, arguments.callee);
        var stack = err.stack;
        Error.prepareStackTrace = orig;
        return stack;
    }
});

Object.defineProperty(module.exports, 'line', {
    get: function () {
        return module.exports.stack[1].getLineNumber();
    }
});

Object.defineProperty(module.exports, 'function', {
    get: function () {
        return module.exports.stack[1].getFunctionName();
    }
});