require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes/route");
const cookieSession = require("cookie-session");
const app = express();

app.use(cors());
app.set('trust proxy', 1);
app.use(bodyParser.json());
app.set('view engine', 'ejs');
app.use(cookieSession({
  name: "session",
  secret: "493"
}));
app.use(express.static("public"));
app.use("/", routes);

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
