const express = require("express");
const boatController = require("../controllers/boat");
const loadController = require("../controllers/load");
const userController = require("../controllers/user");
const router = express.Router();

// Home route, sign in page
router.get("/", userController.serveWelcome);

// User routes
// User authorization
router.get("/oauth", userController.oauth);
router.post("/oauth", userController.oauth);
// GET users collection
router.get("/users", userController.get_all_users);

// Check for valid JWT on each route/subroute of /boats
router.use("/boats", userController.authenticateToken);

// Boat routes
// CREATE boat and GET boats collection
router.get("/boats", boatController.get_all_boats);
router.post("/boats", boatController.create_boat);
// PUT and DELETE are invalid methods on boats collection
router.put("/boats", boatController.invalid_method);
router.delete("/boats", boatController.invalid_method);
// CRUD individual boat with supplied boat ID
router.get("/boats/:boat_id", boatController.get_boat);
router.put("/boats/:boat_id", boatController.put_boat);
router.patch("/boats/:boat_id", boatController.patch_boat);
router.delete("/boats/:boat_id", boatController.delete_boat);
// GET all loads on boat with supplied boat ID
router.get("/boats/:boat_id/loads", boatController.get_boat_loads);
// CREATE and DELETE relationship between boats and loads 
// 1 (boat) : M (loads) relationship
router.put("/boats/:boat_id/loads/:load_id", boatController.load_boat);
router.delete("/boats/:boat_id/loads/:load_id", boatController.unload_boat);

// Load routes
// CREATE load and GET loads collection
router.get("/loads", loadController.get_all_loads);
router.post("/loads", loadController.create_load);
// CRUD individual load with supplied load ID
router.get("/loads/:load_id", loadController.get_load);
router.put("/loads/:load_id", loadController.put_load);
router.patch("/loads/:load_id", loadController.patch_load);
router.delete("/loads/:load_id", loadController.delete_load);

module.exports = router;
