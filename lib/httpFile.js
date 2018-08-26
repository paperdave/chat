const mime = require('./mime');
const fs = require('fs');
module.exports = (file) => {
    return (req, res) => {
        fs.stat(file, (err, stats)=>{
            if(err) {
                res.statusCode = 500;
                res.write('File Read Error, Please Try Again\n\n'+err);
                res.end();
            } else {
                if(req.headers['if-modified-since']) {
                    let date = new Date(req.headers['if-modified-since']).getTime()/1000;
              
                    if (date >= Math.floor(stats.mtime.getTime()/1000)) {
                        res.statusCode = 304;
                        res.end();
                        return;
                    }
                }
                res.setHeader('Last-Modified', stats.mtime.toUTCString())
                res.setHeader('Content-Type', mime.find(file))
                fs.createReadStream(file).pipe(res);
            }
        });
    }
};