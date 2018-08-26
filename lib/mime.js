const mimeDB = {
    'js': 'application/javascript',
    'json': 'application/json',
    'html': 'text/html',
    'css': 'text/css',
    'txt': 'text.plain'
};
exports.database = mimeDB;
exports.find = (file) => {
    return mimeDB[file.split('.').pop()] || 'application/octet-stream';
}