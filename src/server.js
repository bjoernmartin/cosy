const fs = require("fs");
const path = require("path");
const Koa = require("koa");
const views = require("koa-views");
const bodyParser = require("koa-bodyparser");
const passport = require("koa-passport");
const session = require("koa-session");
const route = require("koa-route");
const serve = require("koa-static");
const websockify = require("koa-websocket");
const LdapStrategy = require("passport-ldapauth");

const { PORT = 3000, APP_SECRET = "app-secret" } = process.env;

const app = websockify(new Koa());
app.use(bodyParser());

// authentication
passport.use(
	new LdapStrategy({
		server: {
			url: "ldap://---------------",
			searchBase: "----------------",
			searchFilter: "(uid={{username}})",
		},
		// form post requestBody field names
		usernameField: "username",
		passwordField: "password",
	}),
);
app.keys = [APP_SECRET];
app.use(session({}, app));
app.use(passport.initialize());
// app.use(passport.session());

// Must be used before any router is used
app.use(
	views(path.resolve(__dirname, "views"), {
		extension: "hbs",
		map: { hbs: "handlebars" },
	}),
);

// ensure authenticated access
app.use(async function (ctx, next) {
	if (
		ctx.isAuthenticated() ||
		ctx.originalUrl.startsWith("/login") ||
		ctx.originalUrl.startsWith("/css/")
	) {
		await next();
	} else {
		console.log("not authenticated. redirecting to /login");
		ctx.redirect("/login");
	}
});

// static assets
const assetsRootDir = path.resolve(__dirname, "../static");
app.use(serve(assetsRootDir));

// ---------------------------------------------------------
// LOGIN
app.use(
	route.get("/login", async function (ctx) {
		console.log(":: /login");
		console.log(":: ", ctx);
		const { error, username } = ctx.request.query;
		await ctx.render("login", {
			error: error != undefined,
			username,
		});
	}),
);
app.use(
	route.post("/login", async function (ctx, next) {
		const { username } = ctx.request.body;
		await passport.authenticate("ldapauth", {
			session: false,
			successRedirect: "/",
			failureRedirect: `/login?error&username=${username}`,
		})(ctx, next);
	}),
);

// ---------------------------------------------------------
// LOGOUT
//
app.use(
	route.post("/logout", async function (ctx) {
		await ctx.logout();
		ctx.rdirect("/");
	}),
);

// ---------------------------------------------------------
// GAME
//
app.use(
	route.get("/", function (ctx) {
		ctx.type = "html";
		ctx.body = fs.createReadStream(
			path.resolve(__dirname, "../templates/index.html"),
		);
	}),
);

let users = [];

function user(username) {
	return {
		name: username,
	};
}

app.ws.use((ctx) => {
	// `ctx` is the regular koa context created from the `ws` onConnection `socket.upgradeReq` object.
	// the websocket is added to the context on `ctx.websocket`.
	ctx.websocket.send("Hello World");
	ctx.websocket.on("message", function (message) {
		// do something with the message from client
		console.log(message);

		let messageJson;
		try {
			messageJson = JSON.parse(message);
		} catch (error) {
			console.log("FAILED to parse message");
		}

		if (!messageJson) {
			return;
		}

		switch (messageJson.type) {
			case "login":
				users.push(user(messageJson.user));
				break;
		}
	});
});

app.listen(PORT, () => {
	console.log(`server is listening in http://localhost:${PORT}`);
});
