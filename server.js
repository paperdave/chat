// This is all the javascript for the server program.
'use strict';
const socket_io = require('socket.io');
const debug = require('./lib/debug');
const http = require('http');
const fs = require('fs');
const parse_url = require('url').parse;
const send_file = require('./lib/httpFile');
const uuid = require('./lib/uuid4');
const objectForEach = require('./lib/object-for-each');
const { escapeHTML } = require('./lib/escape');
const color = require('./lib/color');

const genMetaString = (room) => `<meta chat-room='${room.id || room}'>`;
const blank_uuid = '00000000-0000-0000-0000-000000000000';
const message = {
    join: 'join',
    join_success: 'join_success',
    message: 'message',
    member_join: 'member_join',
    member_left: 'member_left',
    switch: 'switch'
}

const routes = {};
const chat_room_root = 'a76ec69f-f4ef-480b-b45f-56e914b76ff9';

// Static Stuff
routes['/chat.js']      = send_file(__dirname + '/client/chat.js');
routes['/main.css']     = send_file(__dirname + '/client/main.css');
routes['/']             = send_file(__dirname + '/client/index.html');

// Simple Server
const server = http.createServer((req,res) => {
    let url = parse_url(req.url);
    let endpoint = url.path;
    if (endpoint!=='/' && endpoint.endsWith('/')) endpoint = endpoint.substring(0,endpoint.length - 1);

    if (endpoint in routes) {
        routes[endpoint](req, res);
    } else {
        res.statusCode = 404;
        res.write('404 Not Found');
        res.end();
    }
});
const io = socket_io(server);

const rooms = {};
const connections = {};
let createNewRoom = (name, id = uuid()) => {
    let room = { id: id, members: [], messages: [], name};
    rooms[id] = room;

    room.pushMessage = (user, message) => {
        room.messages.push(message);
    }
    room.destroy = () => {

    }

    return room;
}

io.on('connection', function (socket) {
    let id = uuid();
    let con = { socket, room: null, name: null, id };
    connections[id] = con;
    socket.on('disconnect', function() {
        if(con.room) {
            rooms[con.room].members.splice(rooms[con.room].members.indexOf(con),1);
            console.log(color.red(`<-- ${con.name.padEnd(16)}`) + ` (${id.substring(0, 6)}...) left     ` + color.cyan(`#${rooms[con.room].name}`));
            // notify others
            Object.keys(rooms[con.room].members).forEach(c => rooms[con.room].members[c].socket.emit(message.member_left, id));
        }
        delete connections[id];
    });
    let invalid = (line) => {
        console.log(`Socket kicked for invalid data -> ` + `line ${line}`.magenta)
        socket.disconnect();
    }
    socket.on(message.join, function(data) {
        if (!Array.isArray(data)) return invalid(debug.line);
        if (data.length !== 2) return invalid(debug.line);
        if (typeof data[0] !== 'string') return invalid(debug.line);
        if (typeof data[1] !== 'string') return invalid(debug.line);

        let name = data[0];
        let chat_room = data[1].toLowerCase();

        // validate information on the server!
        if (name.length > 16 || name.length < 3) return invalid(debug.line);
        if (!(/^[a-zA-Z0-9_\- ]*$/).test(name)) return invalid(debug.line);
        if (!(/^[a-zA-Z0-9_-]*$/).test(chat_room)) return invalid(debug.line);
        
        let room_exists = false;
        let room_id = null;
        objectForEach(rooms, (room, id) => {
            if(room.name == chat_room) {
                room_exists = true;
                room_id = id;
            }
        });
        if(!room_exists) {
            let room = createNewRoom(chat_room);
            room_id = room.id;
        }

        // get other users
        let others_array = rooms[room_id].members.map( m => [ m.name, m.id ] );

        // add them
        con.room = room_id;
        con.name = name;
        rooms[room_id].members.push(con);

        Object.keys(rooms[room_id].members).forEach(c => rooms[room_id].members[c].socket.emit(message.member_join, [id, name]));
        
        console.log(color.green(`--> ${name.padEnd(16)}`) + ` (${id.substring(0, 6)}...) joined   ` + color.cyan(`#${rooms[room_id].name}`));
        socket.emit(message.join_success, [room_id, rooms[room_id].name, others_array, id]);
    });
    socket.on(message.message, (str) => {
        if (typeof str !== 'string') return invalid(debug.line);
        if (!con.room) return invalid(debug.line);
        str = escapeHTML(str);
        if(str==='!room') {
            // get current room
            socket.emit(message.message, [blank_uuid, 'You are in **#' + rooms[con.room].name + '** (`' + con.room +'`)'])
        } else {
            // send to all
            Object.keys(connections).filter(x => x !== id).filter(x => connections[x].room === con.room).forEach(c => connections[c].socket.emit(message.message, [id, str]));
        }
    });
    socket.on(message.switch, (chat_room) => {
        if (!con.room) return invalid(debug.line);
        if (typeof chat_room !== 'string') return invalid(debug.line);
        chat_room = chat_room.toLowerCase();
        if (!(/^[a-zA-Z0-9_-]*$/).test(chat_room)) return invalid(debug.line);
        if(chat_room === con.room.name) return; // not invalid

        let room_exists = false;
        let room_id = null;
        objectForEach(rooms, (room, id) => {
            if (room.name == chat_room) {
                room_exists = true;
                room_id = id;
            }
        });
        if (!room_exists) {
            let room = createNewRoom(chat_room);
            room_id = room.id;
        }

        // leave
        rooms[con.room].members.splice(rooms[con.room].members.indexOf(con), 1);

        // get other users
        let others_array = rooms[room_id].members.map(m => [m.name, m.id]);

        let old_room = con.room;

        // enter
        con.room = room_id;
        rooms[room_id].members.push(con);
        Object.keys(rooms[room_id].members).forEach(c => rooms[room_id].members[c].socket.emit(message.member_join, [id, con.name]));

        socket.emit(message.join_success, [room_id, rooms[room_id].name, others_array, id]);

        console.log(color.magenta(`<-> ${con.name.padEnd(16)}`) + ` (${id.substring(0, 6)}...) switched ` + color.cyan(`#${rooms[old_room].name}`) + ' --> ' + color.cyan(`#${rooms[room_id].name}`));
    });
});

server.listen(80);
