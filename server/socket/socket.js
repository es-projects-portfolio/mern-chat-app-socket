import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
	cors: {
		origin: ["http://localhost:5173", "http://localhost:3000", ""],
		methods: ["GET", "POST"],
	},
});

const userSocketMap = {}; // {userId: socketId}

const allUsers = {};
const allRooms = [];

export const getReceiverSocketId = (receiverId) => {
    return userSocketMap[receiverId];
};

io.on("connection", (socket) => {
	console.log("a user connected", socket.id);

	const userId = socket.handshake.query.userId;
	if (userId != "undefined") userSocketMap[userId] = socket.id;

	// io.emit() is used to send events to all the connected clients
	io.emit("getOnlineUsers", Object.keys(userSocketMap));

    // Tic-Tac-Toe Logic
    allUsers[socket.id] = {
        socket: socket,
        online: true,
    };

    socket.on("request_to_play", (data) => {
        const currentUser = allUsers[socket.id];
        currentUser.playerName = data.playerName;

        let opponentPlayer;

        for (const key in allUsers) {
            const user = allUsers[key];
            if (user.online && !user.playing && socket.id !== key) {
                opponentPlayer = user;
                break;
            }
        }

        if (opponentPlayer) {
            allRooms.push({
                player1: opponentPlayer,
                player2: currentUser,
            });

            currentUser.socket.emit("OpponentFound", {
                opponentName: opponentPlayer.playerName,
                playingAs: "circle",
            });

            opponentPlayer.socket.emit("OpponentFound", {
                opponentName: currentUser.playerName,
                playingAs: "cross",
            });

            currentUser.socket.on("playerMoveFromClient", (data) => {
                opponentPlayer.socket.emit("playerMoveFromServer", {
                    ...data,
                });
            });

            opponentPlayer.socket.on("playerMoveFromClient", (data) => {
                currentUser.socket.emit("playerMoveFromServer", {
                    ...data,
                });
            });
        } else {
            currentUser.socket.emit("OpponentNotFound");
        }
    });

    socket.on("disconnect", () => {
        console.log("user disconnected", socket.id);
        delete userSocketMap[userId];
        io.emit("getOnlineUsers", Object.keys(userSocketMap));

        const currentUser = allUsers[socket.id];
        currentUser.online = false;
        currentUser.playing = false;

        for (let index = 0; index < allRooms.length; index++) {
            const { player1, player2 } = allRooms[index];

            if (player1.socket.id === socket.id) {
                player2.socket.emit("opponentLeftMatch");
                break;
            }

            if (player2.socket.id === socket.id) {
                player1.socket.emit("opponentLeftMatch");
                break;
            }
        }
    });
});

export { app, io, server };
