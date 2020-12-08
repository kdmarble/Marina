const userModel = require("../models/user");
const url = require("url");
const axios = require("axios");
const {OAuth2Client} = require("google-auth-library");
const client = new OAuth2Client(process.env.CLIENT_ID);

/**
 * Controller for rendering the main welcome page that prompts user
 * to sign in with Google
 *
 * @param {object} req
 * @param {object} res
 */
async function serveWelcome(req, res) {
  req.session.secret = Math.floor((Math.random() * 1000) + 1);

  res.render('pages/welcome', {secret: req.session.secret});
}

/**
 * Middleware
 * Checks authorization by pulling supplied JWT, sends it to Google
 * OAuth2 Client for validation
 * If JWT is validated, set boolean flag variable isValid in res.locals
 * to True
 * Stores User's unique ID in res.locals.userid
 *
 * @param {object} req
 * @param {object} res
 */
async function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  let isValid = false;

  if (token !== undefined) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.CLIENT_ID
      });

      const payuser = ticket.getPayload();
      const userid = payuser['sub'];
      
      if (userid !== undefined) {
        isValid = true;
      }
      
      res.locals.isValid = isValid;
      res.locals.userid = userid;
    } catch (err) {
      return res.status(403).json({
        Error: err.message
      });
    }
  }
  next();
}

/**
 * Returns a JSON object representation of a User entity
 *
 * @param {object} user The user data desired for output
 * @param {object} req The req object, used to generate self link pointing
 * to the canonical representation of that entity
 */
function format_response(user, req) {
  if (user.data) {
    return {
      id: user.id,
      uuid: user.data.uuid,
      // For some reason, req.baseUrl was returning an empty string, so I had
      // to split the whole url and take the first valid token
      self: `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/${
        user.id
      }`
    };
  }

  if (!user.data) {
    return {
      id: user.id,
      uuid: user.uuid,
      self: `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/${
        user.id
      }`
    };
  }
}

/**
 * Controller for authorizing access to user's Google account
 * Receives a JWT from Google, and renders JWT, User's unique ID,
 * and the expiration time of the JWT 
 *
 * @param {object} req 
 * @param {object} res
 */
async function oauth(req, res) {
  const state = req.query.state;
  const code = req.query.code;
  const scope = req.query.scope;

  if (state != req.session.secret) {
    res.status(401).send({
      Error: "State does not match"
    })
  } else {
    try {
      const params = new url.URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: "https://marblek-project.uc.r.appspot.com/oauth"
      });
      const response = await axios.post('https://oauth2.googleapis.com/token', params.toString());
      
      const ticket = await client.verifyIdToken({
        idToken: response.data.id_token,
        audience: process.env.CLIENT_ID
      });
      
      const payuser = ticket.getPayload();
      const userid = payuser['sub'];
      const id_token = response.data.id_token;
      const expires_in = response.data.expires_in;

      userModel.post_user(userid);
      res.render("pages/user", {
        token: id_token, 
        user_id:  userid,
        expires_in: expires_in
      });
    } catch (err) {
      console.log(err);
    }
  }
}

/**
 * Controller for GETing the Users collection
 * Returns a formatted JSON collection of each User
 *
 * @param {object} req 
 * @param {object} res
 */
async function get_all_users(req, res) {
  const users = await userModel.get_all_users();
  const returnUsers = users.map(user => {
    return format_response(user, req);
  });
  return res.status(200).json(returnUsers);
}

module.exports = {
  serveWelcome: serveWelcome,
  authenticateToken: authenticateToken,
  oauth: oauth,
  get_all_users: get_all_users
}