const loadModel = require("../models/load");
const boatModel = require("../models/boat");
const url = require("url");

/**
 * Returns a JSON object representation of a load entity
 *
 * @param {object} load The load data desired for output
 * @param {object} req The req object, used to generate self link pointing
 * to the canonical representation of that entity
 */
function format_response(load, req) {
  if (load.data) {
    return {
      id: load.id,
      weight: load.data.weight,
      content: load.data.content,
      delivery_date: load.data.delivery_date,
      current_load: load.data.current_load,
      self: `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/${
        load.id
      }`
    };
  }

  if (!load.data) {
    return {
      id: load.id,
      weight: load.weight,
      content: load.content,
      delivery_date: load.delivery_date,
      current_load: load.current_load,
      self: `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/${
        load.id
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
  const pattern = new RegExp("^[a-zA-Z0-9 ]*$");
  const weight = req.body.weight;
  const content = req.body.content;
  const delivery_date = req.body.delivery_date;
  const current_boat = req.body.current_boat;
  const httpVerb = req.method;

  if (httpVerb === "POST" || httpVerb === "PUT") {
    if (!weight || !content || !content || !delivery_date || !current_boat) {
      return false;
    };

    if (!pattern.test(weight) || !pattern.test(content)) {
      return false;
    }

    if (content > 1000) {
      return false;
    }

    return true;
  }

  if (httpVerb === "PATCH") {
    if (req.body.id) {
      return false;
    }

    if (!weight && !content && !content && !delivery_date && !current_boat) {
      return false;
    };

    if (!pattern.test(weight) || !pattern.test(content)) {
      return false;
    }

    if (content > 1000) {
      return false;
    }

    return true;
  }
}

/**
 * Controller for POSTing a new load
 * Returns a formatted JSON representation of the load data supplied or
 * error status code and corresponding error message
 *
 * @param {object} req 
 * @param {object} res
 */
async function create_load(req, res) {
  if (!req.body.weight || !req.body.content || !req.body.delivery_date) {
    return res.status(400).json({
      Error: "The request object is missing at least one of the requried attributes"
    });
  } else {
    const loadKey = await loadModel.post_load(req.body.weight, req.body.content, req.body.delivery_date);
    const load = await loadModel.get_load(loadKey.id);
    return res.status(201).json(format_response(load, req));
  }
}

/**
 * Controller for GETing a load
 * Returns a formatted JSON representation of the load
 *
 * @param {object} req
 * @param {object} res
 */
async function get_load(req, res) {
  const load = await loadModel.get_load(req.params.load_id);

  if (load.data !== undefined) {
    return res.status(200).json(format_response(load, req));
  } else {
    return res.status(404).json({
      Error: "No load with this load_id exists"
    });
  }
}

/**
 * Controller for GETing all loads
 * Results are paginated to 5 loads at a time
 * Returns a formatted JSON representation of every load
 *
 * @param {object} req
 * @param {object} res
 */
async function get_all_loads(req, res) {
  const queryObject = url.parse(req.url, true).query;
  const loads = await loadModel.get_all_loads(queryObject.limit, queryObject.offset);
  
  const returnLoads = loads.map(load => {
    return format_response(load, req);
  });
  
  // Builds overall paginated object that's returned
  let returnObject = {};
  returnObject.loads = returnLoads;
  returnObject.offset = queryObject.offset;
  returnObject.limit = queryObject.limit;
  returnObject.count = 5;
  returnObject.next = `${req.protocol}://${req.get("host")}/${req.url.split("/")[1]}/?limit=5&offset=${queryObject.limit+queryObject.offset}`;

  res.status(200).json(returnObject);
}

/**
 * Controller for DELETEing a load
 * Returns 204 status code if valid load and successfully deleted
 *
 * @param {object} req
 * @param {object} res
 */
async function delete_load(req, res) {
  const load = await loadModel.get_load(req.params.load_id);

  if (load.data === undefined) {
    return res.status(404).json({
      Error: "No load with this load_id exists"
    });
  } else {
    // If the load to be deleted is currently on a boat, remove it
    const boatID = load.data.current_boat;
    if (boatID) {
      const load = await boatModel.unload_boat(boatID, req.params.load_id);
    }
  }
  const deletedLoad = await loadModel.delete_load(req.params.load_id);
  return res.status(204).end();
}

/**
 * Controller for updating a load via PUT request
 * Returns status code 303 and new self link to canonical represtation
 * of the new entity
 *
 * @param {object} req
 * @param {object} res
 */
async function put_load(req, res) {
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
  const load = await loadModel.get_load(req.params.load_id);

  if (!load.data) {
    return res.status(404).json({
      Error: "No load with this load_id exists"
    });
  }

  const loadKey = await loadModel.put_load(
    req.params.load_id,
    req.body.weight,
    req.body.content,
    req.body.delivery_date,
    req.body.current_boat,
  );

  const response = format_response(loadKey, req);
  return res.status(303).set("Location", response.self).send({ self: response.self });
}

/**
 * Controller for updating a load via PATCH request
 * Returns the updated, formatted JSON representation of the load
 *
 * @param {object} req
 * @param {object} res
 */
async function patch_load(req, res) {
  const contentTypeSent = req.get("Content-Type");
  let weight = req.body.weight;
  let content = req.body.content;
  let delivery_date = req.body.delivery_date;
  let current_boat = req.body.current_boat;

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
  const load = await loadModel.get_load(req.params.load_id);

  if (!load.data) {
    return res.status(404).json({
      Error: "No load with this load_id exists"
    });
  }

  // If any property isn't supplied, use the pre-existing property value
  if (!weight) {
    weight = load.data.weight;
  }

  if (!content) {
    content = load.data.content;
  }

  if (!delivery_date) {
    delivery_date = load.data.delivery_date;
  }

  if (!current_boat) {
    current_boat = load.data.current_boat;
  }

  const loadKey = await loadModel.put_load(
    req.params.load_id,
    name,
    type,
    length,
    public,
    owner
  );

  const editedLoad = await loadModel.get_load(req.params.load_id);
  return res.status(200).json(format_response(editedLoad, req));
}

module.exports = {
  create_load: create_load,
  get_load: get_load,
  get_all_loads: get_all_loads,
  delete_load: delete_load,
  put_load: put_load,
  patch_load: patch_load
};
