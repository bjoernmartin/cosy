let chatRooms = new Map();
let chatParticipants = new Map();

module.exports = function conference({ send, broadcast }) {
	return function (type, data) {
		switch (type) {
			case "join": {
				// inform the new user about all current chats
				for (let room of chatRooms.values()) {
					send({ type: "chat-started", content: room });
					for (let participant of chatParticipants.get(room.roomName)) {
						send({
							type: "chat-user-joined",
							content: {
								roomName: room.roomName,
								userName: participant,
							},
						});
					}
				}
				break;
			}
			case "chat-started": {
				const room = {
					roomName: data.roomName,
					userName: data.userName,
					point: {
						x: data.point.x,
						y: data.point.y,
					},
				};
				chatRooms.set(room.roomName, room);
				chatParticipants.set(room.roomName, [room.userName]);
				broadcast({ type: "chat-started", content: room });
				broadcast({
					type: "chat-user-joined",
					content: {
						roomName: room.roomName,
						userName: room.userName,
					},
				});
				break;
			}
			case "chat-user-joined": {
				const room = {
					roomName: data.roomName,
					userName: data.userName,
				};
				const participants = chatParticipants.get(room.roomName);
				participants.push(room.userName);
				chatParticipants.set(room.roomName, participants);
				broadcast({
					type: "chat-user-joined",
					content: {
						roomName: room.roomName,
						userName: room.userName,
					},
				});
				break;
			}
			case "chat-user-left": {
				const room = {
					roomName: data.roomName,
					userName: data.userName,
				};
				const currentParticipants = chatParticipants.get(room.roomName);
				const nextParticipants = currentParticipants.filter(
					(username) => username !== room.userName,
				);
				if (nextParticipants.length === 0) {
					chatRooms.delete(room.roomName);
					chatParticipants.delete(room.roomName);
					broadcast({ type: "chat-closed", content: room });
				} else {
					chatParticipants.set(room.roomName, nextParticipants);
					broadcast({
						type: "chat-user-left",
						content: {
							roomName: room.roomName,
							userName: room.userName,
						},
					});
				}
				break;
			}
		}
	};
};