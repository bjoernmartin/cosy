import "./panning-effect.js";
import { createChatActions } from "./actions/chat-action.js";
import { createWhiteboardActions } from "./actions/whiteboard-action.js";

const { player } = window.synyxoffice;
const playerAvatar = document.getElementById("player");
const actionMenu = document.getElementById("action-menu");

let currentlyChatting = false;

const chat = createChatActions({ send, player, playerAvatar });
const whiteboard = createWhiteboardActions({ send, player, playerAvatar });

chat.onChatStart(function () {
	currentlyChatting = true;
});
chat.onChatEnd(function () {
	currentlyChatting = false;
});

// Create WebSocket connection.
// TODO use 'wss' protocol to enable SSL over websocket
const socket = new WebSocket(`wss://${window.location.host}`);

const nameTooltip = document.createElement("div");
nameTooltip.classList.add(
	"fixed",
	"z-40",
	"px-1",
	"text-black",
	"text-xs",
	"shadow-outline",
	"font-bold",
	"font-mono",
	"bg-white",
	"opacity-75",
	"border",
	"border-black",
	"rounded",
);
document.body.appendChild(nameTooltip);
document.body.style.overflow = "hidden";

const officeSvg = document.getElementById("office");
let officeScale = 1;

document.addEventListener(
	"wheel",
	function (event) {
		if (!event.altKey) {
			return;
		}
		if (event.deltaY < 0) {
			// zoom in
			const nextScaleValue = officeScale + 0.1;
			if (nextScaleValue <= 3.5) {
				officeScale = nextScaleValue;
				officeSvg.setAttributeNS(null, "transform", `scale(${officeScale})`);
			}
		} else {
			// zoom out
			const nextScaleValue = officeScale - 0.1;
			if (nextScaleValue >= 1) {
				officeScale = nextScaleValue;
				officeSvg.setAttributeNS(null, "transform", `scale(${officeScale})`);
			}
		}
	},
	{ passive: true },
);

officeSvg.addEventListener("mousemove", function (event) {
	if (event.target.dataset.tooltip && actionMenu.classList.contains("hidden")) {
		const { pageX: x, pageY: y } = event;
		nameTooltip.innerText = event.target.dataset.tooltip;
		const { width, height } = nameTooltip.getBoundingClientRect();
		nameTooltip.style.top = `${y - height * 1.5}px`;
		nameTooltip.style.left = `${x - width / 2}px`;
	} else {
		nameTooltip.innerText = "";
		nameTooltip.style.top = "-10px";
		nameTooltip.style.left = "-10px";
	}
});

const actionButtons = new Map();

document.body.addEventListener("click", (event) => {
	if (actionMenu.contains(event.target)) {
		//
	} else if (event.target === playerAvatar) {
		stopPlayerAvatarAnimate();
		actionMenu.classList.remove("hidden");

		const { pageX: x, pageY: y } = event;
		const { width, height } = actionMenu.getBoundingClientRect();
		actionMenu.style.top = `${y + 20}px`;
		actionMenu.style.left = `${x - width / 2}px`;

		const actionMenuButtonList = actionMenu.querySelector("ul");
		[chat, whiteboard].forEach(function ({ actions }) {
			for (let action of actions) {
				if (action.shouldBeVisible({ currentRoom })) {
					if (actionButtons.has(action)) {
						actionButtons.get(action).classList.remove("hidden");
					} else {
						const button = document.createElement("button");
						button.type = "button";
						button.textContent = action.label;
						button.addEventListener("click", function () {
							action.handleSelect({ currentRoom, attrs: button.dataset });
						});
						for (let [attr, value] of action.attrs()) {
							button.dataset[attr] = value;
						}
						const li = document.createElement("li");
						li.appendChild(button);
						actionMenuButtonList.appendChild(li);
						actionButtons.set(action, li);
					}
				} else {
					if (actionButtons.has(action)) {
						actionButtons.get(action).classList.add("hidden");
					}
				}
			}
		});
	} else {
		actionMenu.classList.add("hidden");
	}
});

document
	.getElementById("logout-form")
	.addEventListener("submit", function (event) {
		if (!window.confirm("Schon gebucht?!")) {
			event.preventDefault();
			document.activeElement.blur();
		}
	});

let playerAvatarMap = new Map();

// Connection opened
socket.addEventListener("open", function (event) {
	socket.send(
		JSON.stringify({
			type: "join",
			message: {},
		}),
	);
});

// Listen for messages
socket.addEventListener("message", function (event) {
	const data = JSON.parse(event.data);

	chat.handleWebsocket(data.type, data.content);
	whiteboard.handleWebsocket(data.type, data.content);

	switch (data.type) {
		case "user-joined": {
			const newPlayer = data.content;
			if (newPlayer.name === window.synyxoffice.player.name) {
				return;
			}

			// avatar image
			const newPlayerAvatarImagePattern = playerAvatarImagePattern.cloneNode(
				true,
			);
			newPlayerAvatarImagePattern.setAttributeNS(
				null,
				"id",
				`${newPlayer.nickname}-image-pattern`,
			);
			newPlayerAvatarImagePattern
				.querySelector("image")
				.setAttributeNS(null, "href", newPlayer.avatarUrl);
			playerAvatarImagePattern.parentNode.appendChild(
				newPlayerAvatarImagePattern,
			);

			// avatar element
			const newPlayerAvatar = playerAvatar.cloneNode();
			newPlayerAvatar.dataset.tooltip = newPlayer.name;
			newPlayerAvatar.setAttributeNS(null, "id", "");
			newPlayerAvatar.setAttributeNS(null, "cx", startPointMainEntrance.x);
			newPlayerAvatar.setAttributeNS(null, "cy", startPointMainEntrance.y);
			newPlayerAvatar.setAttributeNS(
				null,
				"fill",
				newPlayerAvatar
					.getAttributeNS(null, "fill")
					.replace(
						"#player-avatar-image-pattern",
						`#${newPlayer.nickname}-image-pattern`,
					),
			);
			if (newPlayer.position) {
				newPlayerAvatar.cx.baseVal.value = newPlayer.position.x;
				newPlayerAvatar.cy.baseVal.value = newPlayer.position.y;
			}
			playerAvatar.parentNode.insertBefore(newPlayerAvatar, playerAvatar);
			playerAvatarMap.set(newPlayer.name, newPlayerAvatar);
			break;
		}

		case "user-moved": {
			const player = data.content;
			if (player.name === window.synyxoffice.player.name) {
				return;
			}
			const playerAvatar = playerAvatarMap.get(player.name);
			playerAvatar.cx.baseVal.value = player.position.x;
			playerAvatar.cy.baseVal.value = player.position.y;
			break;
		}
	}
});

function send(data) {
	if (socket.readyState === 1) {
		// 1 == OPEN
		socket.send(JSON.stringify(data));
	} else {
		socket.addEventListener("open", function () {
			socket.send(JSON.stringify(data));
		});
	}
}

let moveSteps = 1;
let moveStepsFactor = 1;
const startPointMainEntrance = { x: 799, y: 692 };
const playerAvatarImagePattern = document.getElementById(
	"player-avatar-image-pattern",
);
const floors = [...document.querySelectorAll("path[id^=floor-]")].map((floor) =>
	pathToPolyglot(floor),
);
const pillars = [
	...document.querySelectorAll("path[id^=pillar-]"),
].map((pillar) => pathToPolyglot(pillar));
const doors = [...document.querySelectorAll("path[id^=door-]")].map((floor) =>
	pathToPolyglot(floor, { precision: 0.3, color: "black" }),
);

let currentRoom = floors.find((floor) => {
	let yep = pointInPolygon(
		[
			playerAvatar.cx.baseVal.value,
			playerAvatar.cy.baseVal.value,
			playerAvatar.r.baseVal.value,
		],
		floor.polygon.points,
	);
	return yep;
});

animatePlayerAvatar();

const keyCodes = Object.freeze({
	w: 87,
	a: 65,
	s: 83,
	d: 68,
	arrowUp: 38,
	arrowDown: 40,
	arrowLeft: 37,
	arrowRight: 39,
	byCode: (code) => Object.keys(keyCodes).find((key) => keyCodes[key] === code),
});

let movementInterval;
const keyPressedMap = new Map();

document.addEventListener("keyup", function (event) {
	if (!event.shiftKey) {
		keyPressedMap.delete("shift");
	}
	keyPressedMap.delete(keyCodes.byCode(event.keyCode));
	if (keyPressedMap.size === 0) {
		stopMovementLoop();
	}
});

function stopMovementLoop() {
	window.clearInterval(movementInterval);
	keyPressedMap.clear();
}

document.addEventListener("keydown", function (event) {
	if (event.shiftKey) {
		keyPressedMap.set("shift", true);
	}
	const key = keyCodes.byCode(event.keyCode);
	if (key) {
		if (keyPressedMap.size === 0) {
			stopPlayerAvatarAnimate();
			movementInterval = window.setInterval(move, 20);
		}
		keyPressedMap.set(key, true);
	}
});

function animatePlayerAvatar(times = 0) {
	const playerHint = document.getElementById("player-hint");
	for (let animate of playerHint.querySelectorAll("animate")) {
		animate.setAttributeNS(null, "repeatCount", times ? times : "indefinite");
	}
}

function stopPlayerAvatarAnimate() {
	const playerHint = document.getElementById("player-hint");
	const promises = [...playerHint.querySelectorAll("animate")].map(
		(animate) =>
			new Promise((resolve) => {
				function stop() {
					animate.setAttributeNS(null, "repeatCount", "0");
					resolve();
				}
				// safari doesn't fire the "repeatEvent"
				// therefore just add a 1s fallback ¯\_(ツ)_/¯
				setTimeout(stop, 1000);
				animate.addEventListener(
					"repeatEvent",
					function (event) {
						event.preventDefault();
						event.stopImmediatePropagation();
						stop();
					},
					{ once: true },
				);
			}),
	);
	Promise.all(promises).then(() => {
		console.log("hide");
		playerHint.classList.add("hidden");
	});
}

function move() {
	moveStepsFactor = keyPressedMap.has("shift") ? 2 : 1;

	if (keyPressedMap.has("arrowDown") || keyPressedMap.has("s")) {
		moveDown();
	}
	if (keyPressedMap.has("arrowUp") || keyPressedMap.has("w")) {
		moveUp();
	}
	if (keyPressedMap.has("arrowLeft") || keyPressedMap.has("a")) {
		moveLeft();
	}
	if (keyPressedMap.has("arrowRight") || keyPressedMap.has("d")) {
		moveRight();
	}

	send({
		type: "moved",
		content: {
			x: playerAvatar.cx.baseVal.value,
			y: playerAvatar.cy.baseVal.value,
		},
	});
}

function moveDown() {
	const nextX = playerAvatar.cx.baseVal.value;
	const nextY = playerAvatar.cy.baseVal.value + moveSteps * moveStepsFactor;
	doMovement({ nextX, nextY });
}

function moveUp() {
	const nextX = playerAvatar.cx.baseVal.value;
	const nextY = playerAvatar.cy.baseVal.value - moveSteps * moveStepsFactor;
	doMovement({ nextX, nextY });
}

function moveLeft() {
	const nextX = playerAvatar.cx.baseVal.value - moveSteps * moveStepsFactor;
	const nextY = playerAvatar.cy.baseVal.value;
	doMovement({ nextX, nextY });
}

function moveRight() {
	const nextX = playerAvatar.cx.baseVal.value + moveSteps * moveStepsFactor;
	const nextY = playerAvatar.cy.baseVal.value;
	doMovement({ nextX, nextY });
}

function doMovement({ nextX, nextY }) {
	if (currentlyChatting) {
		return;
	}

	actionMenu.classList.add("hidden");

	const pillar = getIntersectingPillar([
		nextX,
		nextY,
		playerAvatar.r.baseVal.value,
	]);
	if (pillar) {
		return;
	}

	let isStillInRoom = circleFullyInsidePolygon(
		[nextX, nextY, playerAvatar.r.baseVal.value],
		currentRoom.polygon.points,
	);

	const updateCoordinates = () => {
		// player pulse circle
		const playerHint = document.getElementById("player-hint");
		playerHint.cx.baseVal.value = nextX;
		playerHint.cy.baseVal.value = nextY;
		// player avatar circle
		playerAvatar.cx.baseVal.value = nextX;
		playerAvatar.cy.baseVal.value = nextY;
	};

	if (isStillInRoom) {
		updateCoordinates();
	} else {
		const rooms = getIntersectingFloors([
			nextX,
			nextY,
			playerAvatar.r.baseVal.value,
		]);
		if (rooms.length > 1) {
			updateCoordinates();
			return;
		}
		const door = getIntersectingDoor([
			nextX,
			nextY,
			playerAvatar.r.baseVal.value,
		]);
		if (door) {
			const { allowedUsers = "" } = door.polygon.element.dataset;
			if (
				!allowedUsers ||
				allowedUsers.includes(window.synyxoffice.player.email)
			) {
				updateCoordinates();
			} else if (allowedUsers) {
				window.alert(`Hey! hier kommt nur ${allowedUsers} durch!`);
				stopMovementLoop();
			}
		}
	}

	updateCurrentRoom();
}

function getIntersectingPillar(nextPlayer) {
	return pillars.find((pillar) => {
		return circleTouchesPolygonEdges(nextPlayer, pillar.polygon.points);
	});
}

function getIntersectingDoor(nextPlayer) {
	return doors.find((door) => {
		return circleTouchesPolygonEdges(nextPlayer, door.polygon.points);
	});
}

function getIntersectingFloors(nextPlayer) {
	return floors.filter((floor) => {
		return circleTouchesPolygonEdges(nextPlayer, floor.polygon.points);
	});
}

function updateCurrentRoom() {
	const nextCurrentRoom = floors.find((floor) => {
		return pointInPolygon(
			[
				playerAvatar.cx.baseVal.value,
				playerAvatar.cy.baseVal.value,
				playerAvatar.r.baseVal.value,
			],
			floor.polygon.points,
		);
	});

	// no room found -> we're crossing a door right now

	if (nextCurrentRoom) {
		currentRoom = nextCurrentRoom;
	}
}

/// ---------------------------------------
// https://stackoverflow.com/questions/53393966/convert-svg-path-to-polygon-coordinates
//
function pathToPolyglot(path, { precision = 0.2, color = "tomato" } = {}) {
	var len = path.getTotalLength();
	var points = [];

	var NUM_POINTS = Math.round(len * precision);

	for (var i = 0; i < NUM_POINTS; i++) {
		var pt = path.getPointAtLength((i * len) / (NUM_POINTS - 1));
		points.push([pt.x, pt.y]);
	}

	let polygon = document.createElementNS(
		"http://www.w3.org/2000/svg",
		"polygon",
	);
	polygon.setAttributeNS(null, "id", path.id);
	polygon.setAttributeNS(null, "fill", color);
	polygon.setAttributeNS(null, "points", pointCommandsToSVGPoints(points));

	for (let [key, value] of Object.entries(path.dataset)) {
		polygon.dataset[key] = value;
	}

	return {
		id: path.id,
		polygon: {
			element: polygon,
			points,
		},
	};
}
/// ---------------------------------------

function pointInPolygon(point, polygon) {
	for (
		var n = polygon.length,
			i = 0,
			j = n - 1,
			x = point[0],
			y = point[1],
			inside = false;
		i < n;
		j = i++
	) {
		var xi = polygon[i][0],
			yi = polygon[i][1],
			xj = polygon[j][0],
			yj = polygon[j][1];
		if ((yi > y) ^ (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

function circleFullyInsidePolygon(circle, polygon) {
	const touchesEdges = circleTouchesPolygonEdges(circle, polygon);
	if (touchesEdges) {
		return false;
	}

	const withinPolygon = pointInPolygon(circle, polygon);
	return withinPolygon;
}

function circleTouchesPolygonEdges(circle, polygon) {
	const edges = polygonEdges(polygon);
	const touchesEdges = edges.some(function (line) {
		const radius = circle[2];
		const distance = pointLineSegmentDistance(circle, line);
		return distance < radius;
	});

	return touchesEdges;
}

function polygonEdges(polygon) {
	return polygon.map(function (p, i) {
		return i ? [polygon[i - 1], p] : [polygon[polygon.length - 1], p];
	});
}

function pointLineSegmentDistance(point, line) {
	var v = line[0],
		w = line[1],
		d,
		t;
	return Math.sqrt(
		pointPointSquaredDistance(
			point,
			// eslint-disable-next-line no-cond-assign
			(d = pointPointSquaredDistance(v, w))
				? (t =
						((point[0] - v[0]) * (w[0] - v[0]) +
							(point[1] - v[1]) * (w[1] - v[1])) /
						d) < 0
					? v
					: t > 1
					? w
					: [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])]
				: v,
		),
	);
}

function pointPointSquaredDistance(v, w) {
	var dx = v[0] - w[0],
		dy = v[1] - w[1];
	return dx * dx + dy * dy;
}

function pointCommandsToSVGPoints(pointCommands) {
	return pointCommands
		.map((value, index) => (index % 2 === 1 ? "," : " ") + value)
		.join("");
}