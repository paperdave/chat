// This is all the javascript for the chat client

const blank_uuid = '00000000-0000-0000-0000-000000000000';
window.chat_room_name = 'chat';
window.state = 'menu';
const errors = {
    name_length: 'Screen Name must be between 3 and 16 characters.',
    name_invalid: 'Screen Name contains invalid characters.<br>(only letters, numbers, space, underscore and dash)',
    name_taken: 'Screen Name in use! Wait for them to log off or try a new name.',
    unknown_disconnect: 'Disconnected, Unknown Error.',
    cmd_jump_args_error: 'You only need to pass one argument to !jump.',
    cmd_jump_not_a_room: '%s is not a valid chat room. (Example: #chat, #abcd-1234)',
    cmd_jump_already_there: 'You are already in %s.'
}

window.addEventListener('popstate', () => {
    let new_room;
    if (location.href.indexOf('#') !== -1) {
        new_room = location.href.substring(location.href.indexOf('#') + 1);
    } else {
        history.replaceState({ room: 'chat' }, '#chat', '#chat');
        new_room = 'chat';
    }
    if (state === 'in_room' && chat_room_name !== new_room && window.switchRoom) {
        window.switchRoom(new_room);
    }
    chat_room_name = new_room;
});

document.addEventListener('DOMContentLoaded', () => {
    chat_room_name = 'chat';
    if (location.href.indexOf('#') !== -1) {
        chat_room_name = location.href.substring(location.href.indexOf('#') + 1);
    } else {
        history.replaceState('chat', '#chat', '#chat');
    }

    button_join = document.getElementById('join-button');
    name_enter = document.getElementById('name-enter');
    login_warning = document.getElementById('warn');
    login_loading = document.getElementById('loading');

    name_enter.focus();

    let connected = false;
    let entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };

    function escapeHTML(string) {
        return String(string).replace(/[&<>"'`=\/]/g, function (s) {
            return entityMap[s];
        });
    }
    function format(string) {
        return string.replace(/\*\*(.*)\*\*/, '<b>$1</b>').replace(/\*(.*)\*/, '<i>$1</i>').replace(/~~(.*)~~/, '<span class="line-through">$1</span>');
    }

    let promiseWait = (ms) => new Promise(r => setTimeout(r, ms));
    let fade_in = async() => {
        document.getElementById('fade-overlay').className = 'time-250ms fade';
        await promiseWait(250);
        document.getElementsByTagName('body')[0].classList.remove('gradient')
        return;
    };
    let fade_out = () => {
        document.getElementById('fade-overlay').className = 'time-250ms';
        return promiseWait(250);
    };

    login_error = (str) => {
        login_warning.innerHTML = str;
        login_loading.innerHTML = '&nbsp;';
        connected = false;
    };

    let genMessage = (name, message) => {
        let container = document.createElement('div');
        let author = document.createElement('div');
        let content = document.createElement('div');
        author.classList = 'message-author';
        content.classList = 'message-content';
        container.classList = 'message';

        author.innerHTML = name;
        content.innerHTML = message;

        container.appendChild(author);
        container.appendChild(content);

        return container;
    }
    let genMessageSpecial = (message) => {
        let container = document.createElement('div');
        let content = document.createElement('div');
        content.classList = 'message-content';
        container.classList = 'message message-special';

        content.innerHTML = message;

        container.appendChild(content);

        return container;
    }
    let genChatRoom = (s, name) => {
        let container = document.createElement('div');
        container.className = 'chat';
        let content = document.createElement('div');
        content.className = 'chat-content';
        container.appendChild(content);

        let messageList = document.createElement('div');
        messageList.className = 'message-list';
        let messageListWrapper = document.createElement('div');
        messageListWrapper.className = 'message-list-wrapper';
        messageListWrapper.appendChild(messageList);
        content.appendChild(messageListWrapper);

        let inputArea = document.createElement('div');
        inputArea.className = 'input-area';
        let inputTextField = document.createElement('input');
        inputTextField.className = 'input-text-field browser-default';
        inputTextField.setAttribute('placeholder', 'Send a message...');
        inputTextField.setAttribute('type', 'text');
        inputArea.appendChild(inputTextField);
        content.appendChild(inputArea);

        document.body.appendChild(container);

        inputTextField.focus();

        let self = {
            onMessageCreation: null,
            containerElement: container
        }
        inputTextField.addEventListener('keydown', (ev) => {
            if (ev.keyCode === 13) {
                if (inputTextField.value.trim() === '') return;

                // Enter
                if (typeof self.onMessageCreation === 'function') self.onMessageCreation(inputTextField.value);
                inputTextField.value = '';
            }
        });
        
        let lastMessageGroup = null;
        let lastMessageGroupID = null;

        self.pushMessage = (name, message, uid) => {
            if(!uid) {debugger}
            let elem = genMessage(name, message);
            if (uid !== lastMessageGroupID) {
                lastMessageGroupID = uid;
                lastMessageGroup = document.createElement('div');
                lastMessageGroup.className = 'message-group';
                
                messageList.appendChild(lastMessageGroup);
            }
            lastMessageGroup.appendChild(elem);
        };
        self.pushMessageSpecial = (m) => {
            lastMessageGroupID = null;
            lastMessageGroup = document.createElement('div');
            lastMessageGroup.className = 'message-group';
            messageList.appendChild(lastMessageGroup);
            lastMessageGroup.appendChild(genMessageSpecial(m));
        };

        return self;
    }

    state = 'connecting';
    let tryConnect = async() => {
        if (connected) return;
        connected = true;
        login_warning.innerHTML = '&nbsp;';
        let name = name_enter.value;
        if (name.length > 16 || name.length < 3) return login_error(errors.name_length);
        if (!(/^[a-zA-Z0-9_\- ]*$/).test(name)) return login_error(errors.name_invalid);

        let socket = io();
        socket.on('disconnect', () => {
            if (state === 'connecting') {
                return login_error(errors.unknown_disconnect);
            }
        });
        socket.on('join_success', async (data) => {
            socket.off('member_join');
            socket.off('message');
            await fade_in();
            state = 'in_room';
            (document.getElementById('login') || {remove:_=>_}).remove();

            let user_id = data[3];

            let members = {};
            data[2].forEach(m => {
                members[m[1]] = { name: m[0] };
            });

            let room = genChatRoom(data[0], data[1]);

            window.switchRoom = async(new_room) => {
                await fade_in();
                state = 'switch';
                members = null;
                
                room.containerElement.remove();
                room = null;
                socket.emit('switch', new_room);

                chat_room_name = new_room;
                history.pushState({ room: chat_room_name }, '#' + chat_room_name, '#'+chat_room_name);
            }

            room.onMessageCreation = (message) => {
                if(state !== 'in_room') return;
                let cmd_args = message.split(' ');
                if (cmd_args[0] == '!jump') {
                    if (cmd_args.length !== 2) {
                        room.pushMessage('<span class="message-blue">Chat Commands</span>', '<span class="message-red">'+errors.cmd_jump_args_error+'</span>');
                        return;
                    }
                    if (!cmd_args[1].startsWith('#') || !(/^#[a-zA-Z0-9_-]*$/).test(cmd_args[1])) {
                        room.pushMessage('<span class="message-blue">Chat Commands</span>', '<span class="message-red">' + errors.cmd_jump_not_a_room.replace('%s', escapeHTML(cmd_args[1])) +'</span>');
                        return;
                    }
                    if(cmd_args[1].substring(1) === chat_room_name) {
                        room.pushMessage('<span class="message-blue">Chat Commands</span>', '<span class="message-red">' + errors.cmd_jump_already_there.replace('%s', '#'+chat_room_name) + '</span>');
                        return;
                    }
                    switchRoom(cmd_args[1].substring(1));
                    return;
                }
                room.pushMessage(name, format(escapeHTML(message)), user_id);
                socket.emit('message', message);
            }
            socket.on('member_join', (data) => {
                if(state !== 'in_room') return;

                members[data[0]] = { name: data[1] };
                room.pushMessageSpecial(`<i>${data[1]} joined the chat.</i>`);
            });
            socket.on('member_left', (data) => {
                console.log(data);
                if(state !== 'in_room') return;
                room.pushMessageSpecial(`<i>${members[data].name} left the chat.</i>`);
                delete members[data];
            });
            socket.on('message', (data) => {
                if(state !== 'in_room') return;
                let name = '';
                if (data[0] == blank_uuid) {
                    name='<span class="message-blue">Chat Commands</span>'
                }
                else name = (members[data[0]] && members[data[0]].name) || "<Unknown User>";
                room.pushMessage(name, format(data[1]), data[0]);
            });

            let array = Object.keys(members).map(id => `<b>${members[id].name}</b>`);

            if (array.length > 1) {
                array[array.length - 2] = array[array.length - 2] + ' and ' + array[array.length - 1];
                array.splice(array.length - 1, 1);
            }

            if(array.length === 0) {
                userString = 'No users are online'
            } else {
                userString = 'Online users: ' + array.join(', ')
            }

            room.pushMessageSpecial(`Welcome to #${chat_room_name}, ${name}<br>${userString}.`, blank_uuid);

            fade_out();
        });
        socket.emit('join', [name, chat_room_name]);
        login_loading.innerHTML = 'Connecting...';
    }

    button_join.addEventListener('click', tryConnect);
    name_enter.addEventListener('keypress', (ev) => {
        if (ev.keyCode == 13) tryConnect();
    });
})