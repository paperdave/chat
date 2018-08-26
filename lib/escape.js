var html_entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

exports.escapeHTML = (string) => {
    return String(string).replace(/[&<>"'`=\/]/g, function (s) {
        return html_entities[s];
    });
}