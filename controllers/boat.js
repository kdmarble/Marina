const loadModel = require("../models/load");
const boatModel = require("../models/boat");
const url = require("url");

/**
 * Returns a JSON object representation of a BOAT entity
 *
 * @param {object} boat The boat data desired for output
 * @param {object} req The req object, used to generate self link pointing
 * to the canonical representation of that entity
 */
function format_response(boat, req) {
  // If data is supplied from DB, properties will be located in a 
  // subobject called data
  if (boat.data) {
    return {
      id: boat.id,
      name: boat.data.name,
      type: boat.data.type,
      length: boat.data.length,
      loads: boat.data.loads,
      owner: boat.data.owner,
      // For some reason, req.baseUrl was returning an empty string, so I had
      // to split the whole url and take the first valid token
      self: `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/${
        boat.id
      }`
    };
  }

  // If data is supplied from elsewhere in the application, properties
  // will be located directly in boat object
  if (!boat.data) {
    return {
      id: boat.id,
      name: boat.name,
      type: boat.type,
      length: boat.length,
      loads: boat.loads,
      owner: boat.owner,
      self: `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/${
        boat.id
      }`
    };
  }
}

/**
 * Used to ensure that the supplied request body matches specifications
 * for PUT and PATCH requests
 *
 * @param {object} req The req object, used to get req body
 */
function validate_request(req) {
  // Name and type must only contain letters and numbers
  const pattern = new RegExp("^[a-zA-Z0-9 ]*$");
  const name = req.body.name;
  const type = req.body.type;
  const length = req.body.length;
  const owner = req.body.owner;
  const public = req.body.public;
  const httpVerb = req.method;

  if (httpVerb === "POST" || httpVerb === "PUT") {
    if (!name || !type || !length || !owner || !public) {
      return false;
    };

    if (name.length > 25) {
      return false;
    }

    if (!pattern.test(name) || !pattern.test(type)) {
      return false;
    }

    if (length > 1000) {
      return false;
    }

    return true;
  }

  if (httpVerb === "PATCH") {
    if (req.body.id) {
      return false;
    }

    if (!name && !type && !length && !owner && !public) {
      return false;
    };

    if (name.length > 25) {
      return false;
    }

    if (!pattern.test(name) || !pattern.test(type)) {
      return false;
    }

    if (length > 1000) {
      return false;
    }

    return true;
  }
}

/**
 * Returns a JSON error message that the method called on the endpoint
 * is unsupported
 *
 * @param {object} res The res object, used to return JSON and 405 status code
 */
function invalid_method(req, res) {
  return res.status(405).json({
    Error: "Unsupported method called on endpoint"
  });
}

/**
 * Controller for POSTing a new boat, protected route
 * Returns a formatted JSON representation of the boat data supplied or
 * error status code and corresponding error message
 *
 * @param {object} req 
 * @param {object} res
 */
async function create_boat(req, res) {
  // Initial check to see if JWT supplied is valid and user has access
  // to this endpoint
  if (res.locals.isValid) {
    const contentTypeSent = req.get("Content-Type");

    if (!req.accepts("json")) {
      return res.status(406).json({
        Error: "Requested a content type that is not supported"
      });
    }

    if (contentTypeSent !== "application/json") {
      return res.status(415).json({
        Error: "Request includes an unsupported media type"
      });
    }

    if (!validate_request(req)) {
      return res.status(400).json({
        Error:
          "The request object is missing at least one of the required attributes, or they are invalid"
      });
    }
    
    const boatKey = await boatModel.post_boat(
      req.body.name,
      req.body.type,
      req.body.length,
      req.body.public,
      req.body.owner
    );
    
    // If post_boat returns false, then the name supplied is already in use
    if (!boatKey) {
      return res.status(403).json({
        Error: "The supplied name is already in use"
      });
    }

    const boat = await boatModel.get_boat(boatKey.id);
    return res.status(201).json(format_response(boat, req));
  } else {
    return res.status(401).json({
      Error: "Missing or invalid token"
    })
  }
}

/**
 * Controller for GETing a boat, semi-protected route
 * If a valid JWT is supplied, Returns a formatted JSON 
 * representation of the owner's boat
 *
 * @param {object} req
 * @param {object} res
 */
async function get_boat(req, res) {
  const contentTypeSent = req.get("Content-Type");

  if (!req.accepts("json")) {
    return res.status(406).json({
      Error: "Requested a content type that is not supported"
    });
  }

  if (contentTypeSent) {
    return res.status(415).json({
      Error: "Request includes an unsupported media type"
    });
  }

  // Initial check to see if supplied JWT is valid and user has access
  // to the route
  if (res.locals.isValid) {
    const boat = await boatModel.get_boat(req.params.boat_id);

    if (!boat.data) {
      return res.status(404).json({
        Error: "No boat with this boat_id exists"
      });
    }

    // If the user isn't the owner of the boat, they can't access said boat
    if (boat.data.owner !== res.locals.userid && boat.data.public !== "true") {
      return res.status(401).json({
        Error: "You are not the owner of this boat, and can't view it"
      })
    } else {
      return res.status(200).json(format_response(boat, req));
    }
  } else {
    return res.status(401).json({
      Error: "Missing or invalid token"
    })
  }
}

/**
 * Controller for GETing all boats, semi-protected route
 * Results are paginated to 5 boats at a time
 * If a valid JWT is supplied, Returns a formatted JSON 
 * representation of every boat that user owns
 * If no JWT is supplied, or is invalid, returns a formatted
 * JSON representation of every public boat
 *
 * @param {object} req
 * @param {object} res
 */
async function get_all_boats(req, res) {
  if (!req.accepts("json")) {
    return res.status(406).json({
      Error: "Requested a content type that is not supported"
    });
  }

  if (res.locals.isValid) {
    const queryObject = url.parse(req.url, true).query;
    
    // If it's a valid User, show them all of their owned boats
    const boats = await boatModel.get_all_users_boats(res.locals.userid, queryObject.limit, queryObject.offset);

    // Builds formatted representation of each boat
    const returnBoats = boats.map(boat => {
      return format_response(boat, req);
    });
    
    // Builds overall paginated object that's returned
    const returnObject = {};
    returnObject.boats = returnBoats;
    returnObject.offset = queryObject.offset;
    returnObject.limit = queryObject.limit;
    returnObject.count = 5;
    returnObject.next = `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/?limit=5&offset=${queryObject.limit+queryObject.offset}`;
    return res.status(200).json(returnObject);
  } else {
    const queryObject = url.parse(req.url, true).query;
    
    // If it's not a valid user, show them all public boats
    const boats = await boatModel.get_all_public_boats(queryObject.limit, queryObject.offset);

    const returnBoats = boats.map(boat => {
      return format_response(boat, req);
    });

    const returnObject = {};
    returnObject.boats = returnBoats;
    returnObject.offset = queryObject.offset;
    returnObject.limit = queryObject.limit;
    returnObject.count = 5;
    returnObject.next = `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/?limit=5&offset=${queryObject.limit+queryObject.offset}`;
    return res.status(200).json(returnObject);
  }
}

/**
 * Controller for updating a boat via PUT request
 * Returns status code 303 and new self link to canonical represtation
 * of the new entity
 *
 * @param {object} req
 * @param {object} res
 */
async function put_boat(req, res) {
  const contentTypeSent = req.get("Content-Type");

  if (!req.accepts("json")) {
    return res.status(406).json({
      Error: "Requested a content type that is not supported"
    });
  }

  if (contentTypeSent !== "application/json") {
    return res.status(415).json({
      Error: "Request includes an unsupported media type"
    });
  }

  if (!validate_request(req)) {
    return res.status(400).json({
      Error:
        "The request object is missing at least one of the required attributes, or they are invalid"
    });
  }
  const boat = await boatModel.get_boat(req.params.boat_id);

  if (!boat.data) {
    return res.status(404).json({
      Error: "No boat with this boat_id exists"
    });
  }

  if (boat.data.owner !== res.locals.userid) {
    return res.status(401).json({
      Error: "You are not the owner of this boat, and can't edit it"
    })
  } else {
    const boatKey = await boatModel.put_boat(
      req.params.boat_id,
      req.body.name,
      req.body.type,
      req.body.length,
      boat.data.loads,
      req.body.public,
      req.body.owner
    );
  
    if (!boatKey) {
      return res.status(403).json({
        Error: "The supplied name is already in use"
      });
    }
  
    const response = format_response(boat, req);
    return res.status(303).set("Location", response.self).send({ self: response.self });
  }
}

/**
 * Controller for updating a boat via PATCH request
 * Returns the updated, formatted JSON representation of the boat
 *
 * @param {object} req
 * @param {object} res
 */
async function patch_boat(req, res) {
  const contentTypeSent = req.get("Content-Type");
  let name = req.body.name;
  let type = req.body.type;
  let length = req.body.length;
  let public = req.body.public;
  let owner = req.body.owner;

  if (!req.accepts("json")) {
    return res.status(406).json({
      Error: "Requested a content type that is not supported"
    });
  }

  if (contentTypeSent !== "application/json") {
    return res.status(415).json({
      Error: "Request includes an unsupported media type"
    });
  }

  if (!validate_request(req)) {
    return res.status(400).json({
      Error:
        "The request object is missing at least one of the required attributes, or they are invalid"
    });
  }
  const boat = await boatModel.get_boat(req.params.boat_id);
  
  if (!boat.data) {
    return res.status(404).json({
      Error: "No boat with this boat_id exists"
    });
  }

  // If any value isn't supplied, use the already existing value
  if (!name) {
    name = boat.data.name;
  }

  if (!type) {
    type = boat.data.type;
  }

  if (!length) {
    length = boat.data.length;
  }

  if (!public) {
    public = boat.data.public;
  }

  if (!owner) {
    owner = boat.data.owner;
  }

  if (boat.data.owner !== res.locals.userid) {
    return res.status(401).json({
      Error: "You are not the owner of this boat, and can't edit it"
    })
  } else {
    // PUT model function is used for both PATCH and PUT, controller
    // functions check for property values
    const boatKey = await boatModel.put_boat(
      req.params.boat_id,
      name,
      type,
      length,
      boat.data.loads,
      public,
      owner
    );
    
    if (!boatKey) {
      return res.status(403).json({
        Error: "The supplied name is already in use"
      });
    }
    
    const editedBoat = await boatModel.get_boat(req.params.boat_id);
    return res.status(200).json(format_response(editedBoat, req));
  }
}

/**
 * Controller for DELETEing a boat
 * Returns 204 status code if valid boat and successfully deleted
 *
 * @param {object} req
 * @param {object} res
 */
async function delete_boat(req, res) {
  const contentTypeSent = req.get("Content-Type");

  if (contentTypeSent) {
    return res.status(415).json({
      Error: "Request includes an unsupported media type"
    });
  }

  const boat = await boatModel.get_boat(req.params.boat_id);

  if (!boat.data) {
    return res.status(404).json({
      Error: "No boat with this boat_id exists"
    });
  }

  if (boat.data.owner !== res.locals.userid) {
    return res.status(401).json({
      Error: "You are not the owner of this boat, and can't delete it"
    })
  } else {
    const deletedBoat = await boatModel.delete_boat(req.params.boat_id);
    return res.status(204).end();
  }
}

/**
 * Controller for assigning a load to a boat, thus updating
 * relationship
 * Returns 204 status code if successful
 *
 * @param {object} req
 * @param {object} res
 */
async function load_boat(req, res) {
  const boatID = req.params.boat_id;
  const loadID = req.params.load_id;

  const boat = await boatModel.get_boat(boatID);

  if (boat.data === undefined) {
    return res.status(404).json({
      Error: "The specified boat and/or load does not exist"
    });
  } else {
    const load = await loadModel.get_load(loadID);

    if (load.data === undefined) {
      return res.status(404).json({
        Error: "The specified boat and/or load does not exist"
      });
    } else if ((load.data.current_boat !== null) && (load.data.current_boat === boatID)) {
      return res.status(403).json({
        Error: "The load is already assigned to another boat_id"
      });
    } else {
      const arrival = await boatModel.load_boat(boatID, loadID, req);
      return res.status(204).end();
    }
  }
}

/**
 * Controller for unassigning a load to a boat, thus updating
 * relationship
 * Returns 204 status code if successful
 *
 * @param {object} req
 * @param {object} res
 */
async function unload_boat(req, res) {
  const boatID = req.params.boat_id;
  const loadID = req.params.load_id;
  const boat = await boatModel.get_boat(boatID);

  if (boat.data === undefined) {
    return res.status(404).json({
      Error: "No load with this load_id is at the boat with this boat_id"
    });
  } else {
    const load = await loadModel.get_load(loadID);

    if (load.data === undefined || load.data.current_boat !== boatID) {
      return res.status(404).json({
        Error: "No load with this load_id is at the boat with this boat_id"
      });
    } else {
      const arrival = await boatModel.unload_boat(boatID, loadID);
      return res.status(204).end();
    }
  }
}

/**
 * Controller for GETing all loads currently assigned to boat
 * of given boat_id
 * Returns formatted JSON object containing each load assigned
 * to boat
 *
 * @param {object} req
 * @param {object} res
 */
async function get_boat_loads(req, res) {
  if (!req.accepts("json")) {
    return res.status(406).json({
      Error: "Requested a content type that is not supported"
    });
  }
  
  const boatID = req.params.boat_id;

  const boat = await boatModel.get_boat(boatID);

  if (boat.data === undefined) {
    return res.status(404).json({
      Error: "No boat with this boat_id exists"
    });
  } else {
    // If the user isn't the owner of the boat, they can't access said boat
    if (boat.data.owner !== res.locals.userid && boat.data.public !== "true") {
      return res.status(401).json({
        Error: "You are not the owner of this boat, and can't view it"
      })
    } else {
      return res.status(200).send(boat.data.loads);
    }
  }
}

module.exports = {
  create_boat: create_boat,
  get_boat: get_boat,
  get_all_boats: get_all_boats,
  put_boat: put_boat,
  patch_boat: patch_boat,
  delete_boat: delete_boat,
  load_boat: load_boat,
  unload_boat: unload_boat,
  get_boat_loads: get_boat_loads,
  invalid_method: invalid_method
};
