let app = require("express")();
let http = require("http").Server(app);
let io = require("socket.io")(http);
let Redis = require("ioredis");
let redis = new Redis();
let users = [];
let groups = [];

io.use((socket, next) => {
    const name = socket?.handshake?.auth?.name;
    if (!name) return next(new Error("invalid name"));

    socket.name = name;
    socket.userId = socket.handshake.auth.userId;
    next();
});

http.listen(8005, function () {
    console.log("Listening to port 8005");
});

redis.subscribe("private-channel", function () {
    console.log("subscribed to private channel");
});

redis.subscribe("group-channel", function () {
    console.log("subscribed to group channel");
});

redis.on("message", function (channel, message) {
    message = JSON.parse(message);
    console.log(message);
    if (channel == "private-channel") {
        let data = message.data;
        let receiver_id = data.receiver_id;
        const receiver = users.find((user) => user?.id === receiver_id);
        const sender = users.find((user) => user?.id === data.sender_id);
        console.log("receiver", sender, data.sender_id);


        io.to(`${receiver?.socket_id}`).emit('NewMessage', data);
        io.to(`${sender?.socket_id}`).emit('SendNewMessages', data);
    }

    // if (channel == "group-channel") {
    //     let data = message.data.data;

    //     if (data.type == 2) {
    //         let socket_id = getSocketIdOfUserInGroup(
    //             data.sender_id,
    //             data.group_id
    //         );
    //         let socket = io.sockets.connected[socket_id];
    //         socket.broadcast
    //             .to("group" + data.group_id)
    //             .emit("groupMessage", data);
    //     }
    // }
});

io.on("connection", function (socket) {
    socket.on("user_connected", function (dataUser) {
        const userLength = users.length === 0 ? 1 : users.length + 1;
        const userIndex = users.findIndex((user) => user.id === dataUser.id);
        if (userIndex !== -1) {
            users[userIndex] = {
                socket_id: socket.id,
                id: `${dataUser.id}`,
                name: dataUser.name,
            };
            io.emit("updateUserStatus", users);
            return;
        }
        if (!dataUser?.id) return;
        users[userLength - 1] = {
            socket_id: socket.id,
            id: `${dataUser.id}`,
            name: dataUser.name,
        };
        io.emit("updateUserStatus", users);
    });

    socket.on("disconnect", function () {
        console.log("user disconnected", socket?.userId, socket?.name);
        const userRemove = users.filter((user) => user.id !== socket?.userId);
        io.emit("updateUserStatus", userRemove);
    });

    socket.on("typing", function (data) {
        const usersTyping = users.find((user) => user.id === data.receiver_id);
        io.to(`${usersTyping?.socket_id}`).emit("typing", data);
        // io.emit("typing", data);
    });

    socket.on("joinGroup", function (data) {
        data["socket_id"] = socket.id;
        if (groups[data.group_id]) {
            console.log("group already exist");
            var userExist = checkIfUserExistInGroup(
                data.user_id,
                data.group_id
            );

            if (!userExist) {
                groups[data.group_id].push(data);
                socket.join(data.room);
            } else {
                var index = groups[data.group_id]
                    .map(function (o) {
                        return o.user_id;
                    })
                    .indexOf(data.user_id);

                groups[data.group_id].splice(index, 1);
                groups[data.group_id].push(data);
                socket.join(data.room);
            }
        } else {
            console.log("nwe group");
            groups[data.group_id] = [data];
            socket.join(data.room);
        }

        console.log("socket-id: " + socket.id + " - user-id: " + data.user_id);
        console.log(groups);
    });
});

function checkIfUserExistInGroup(user_id, group_id) {
    var group = groups[group_id];
    var exist = false;
    if (groups.length > 0) {
        for (var i = 0; i < group.length; i++) {
            if (group[i]["user_id"] == user_id) {
                exist = true;
                break;
            }
        }
    }

    return exist;
}

function getSocketIdOfUserInGroup(user_id, group_id) {
    var group = groups[group_id];
    if (groups.length > 0) {
        for (var i = 0; i < group.length; i++) {
            if (group[i]["user_id"] == user_id) {
                return group[i]["socket_id"];
            }
        }
    }
}
