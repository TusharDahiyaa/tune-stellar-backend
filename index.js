require("dotenv").config();
const express = require("express");
const querystring = require("querystring");
const cors = require("cors");
const axios = require("axios");
const { getLyrics } = require("genius-lyrics-api");

const port = process.env.PORT || 8080;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const GENIUS_API_KEY = process.env.GENIUS_API_KEY;

var app = express();
app.use(
  cors({
    origin: "https://tunestellar.vercel.app",
  })
);
app.use(express.json());

var generateRandomString = function (length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const stateKey = "spotify_auth_state";

app.get("/getLyrics", async (req, res) => {
  const songName = req.query.songName;
  const artist = req.query.artist;

  const options = {
    apiKey: GENIUS_API_KEY,
    title: songName,
    artist: artist,
    optimizeQuery: true,
  };

  try {
    const lyrics = await getLyrics(options);
    res.json(lyrics);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/login", (req, res) => {
  try {
    const state = generateRandomString(16);
    res.cookie(stateKey, state);

    const BASE_AUTH = "https://accounts.spotify.com/authorize?";
    const scopes = [
      "streaming",
      "user-read-email",
      "user-read-private",
      "user-read-currently-playing",
      "user-read-playback-state",
      "user-modify-playback-state",
      "playlist-modify-public",
      "playlist-read-private",
      "user-library-modify",
      "user-library-read",
      "user-top-read",
      "user-read-playback-position",
      "user-read-recently-played",
    ];

    const queryParams = querystring.stringify({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: scopes.join("%20"),
    });

    res.redirect(`${BASE_AUTH}${queryParams}`);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/callback", (req, res) => {
  try {
    console.log("Reached callback auth route");
    var code = req.query.code || null;
    // console.log(code);

    if (code === null) {
      res.redirect(
        "/#" +
          JSON.stringify({
            error: "code_mismatch",
          })
      );
    } else {
      axios({
        method: "POST",
        url: "https://accounts.spotify.com/api/token",
        data: querystring.stringify({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: REDIRECT_URI,
        }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(
            `${CLIENT_ID}:${CLIENT_SECRET}`
          ).toString("base64")}`,
        },
      })
        .then((response) => {
          if (response.status === 200) {
            // console.log(response.data);
            process.env.ACCESS_TOKEN = response.data.access_token;
            process.env.REFRESH_TOKEN = response.data.refresh_token;
            process.env.EXPIRES_IN = response.data.expires_in;
            res.redirect(`https://tunestellar.vercel.app`);
            // res.json(response.data);
          } else {
            res.send(response);
          }
        })
        .catch((error) => {
          console.log(error);
          res.send("Internal Server error");
        });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/auth/getTokens", (req, res) => {
  try {
    res.status(200).json({
      access_token: process.env.ACCESS_TOKEN,
      refresh_token: process.env.REFRESH_TOKEN,
      expires_in: process.env.EXPIRES_IN,
    });
  } catch (err) {
    console.log("Error in /getTokens");
    console.log(err);
    res.status(500).end();
  }
});

app.get("/refresh_token", function (req, res) {
  console.log("Reached inside refresh Token GET call");
  const refreshToken = req.query.refresh_token;

  axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    data: querystring.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${CLIENT_ID}:${CLIENT_SECRET}`
      ).toString("base64")}`,
    },
  })
    .then((response) => {
      // Update the access token in the response
      res.send(response.data);
    })
    .catch((error) => {
      console.error("Error refreshing access token:", error);
      res.status(500).send("Internal Server Error");
    });
});

app.listen(port, () => {
  console.log(`Listening at ${port}`);
});
