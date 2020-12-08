const { Datastore } = require("@google-cloud/datastore");
const loadModel = require("./load");
const datastore = new Datastore({ projectID: "marblek-project" });
const BOAT = "Boat";

/**
 * Utility function
 * Returns a formatted, easier to work with object representation of the
 * item passed as param, from Datastore
 *
 * @param {object} item The item you wish to retrieve from Datastore
 */
function fromDatastore(item) {
  item.id = item[Datastore.KEY].id;
  return item;
}

/**
 * Model for POSTing a new boat
 * New boats start with no loads
 * Returns a key object from Datastore that can be used to GET the boat
 *
 * @param {object} name The name of the boat 
 * @param {object} type The type of the boat
 * @param {object} length The length of the boat
 * @param {object} public Whether or not the boat is publicly listed
 * @param {object} owner The unique ID of the boat's owner
 */
function post_boat(name, type, length, public, owner) {
  const key = datastore.key(BOAT);

  const new_boat = { name: name, type: type, length: length, public: public, owner: owner, loads: [] };

  return datastore.save({ key: key, data: new_boat }).then(() => {
    return key;
  });
}

/**
 * Model for GETing all publicly listed boats
 * Paginated to 5 results
 * Returns Datastore object of each found boat
 *
 * @param {object} limit Amount of results to return per page 
 * @param {object} offset Index number of last result returned
 */
function get_all_public_boats(limit, offset) {
  const getAllBoats = datastore
                              .createQuery(BOAT)
                              .filter("public", "=", true)
                              .limit(limit)
                              .offset(offset);

  return datastore.runQuery(getAllBoats).then(entities => {
    return entities[0].map(fromDatastore);
  });
}

/**
 * Model for GETing all boats owned by a User
 * Paginated to 5 results
 * Returns Datastore object of each found boat
 *
 * @param {object} userid Unique ID of User object 
 * @param {object} limit Amount of results to return per page 
 * @param {object} offset Index number of last result returned
 */
function get_all_users_boats(userid, limit, offset) {
  const getAllBoats = datastore
                              .createQuery(BOAT)
                              .filter("owner", "=", userid)
                              .limit(limit)
                              .offset(offset);

  return datastore.runQuery(getAllBoats).then(entities => {
    return entities[0].map(fromDatastore);
  });
}

/**
 * Model for GETing all boats
 * Returns Datastore object of each found boat
 *
 */
function get_all_boats() {
  const getAllBoats = datastore.createQuery(BOAT);
  
  return datastore.runQuery(getAllBoats).then(entities => {
    return entities[0].map(fromDatastore);
  });
}

/**
 * Model for GETing a specific boat
 * Returns object containing Data object that holds parameter
 * values and ID parameter 
 *
 * @param {object} id The boat's ID
 */
function get_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);

  return datastore.get(key).then(data => {
    return { data: data[0], id: id };
  });
}

/**
 * Model for updating a boat via PUT OR PATCH
 * Can be used for both PATCH and PUT because Controllers always pass
 * every value needed
 * Returns Datastore object of updated Boat
 *
 * @param {object} id The boat's ID
 * @param {object} name The name of the boat 
 * @param {object} type The type of the boat
 * @param {object} length The length of the boat
 * @param {object} public Whether or not the boat is publicly listed
 * @param {object} owner The unique ID of the boat's owner
 */
async function put_boat(id, name, type, length, loads, public, owner) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);
  const boat = { name: name, type: type, length: length, public: public, owner: String(owner), loads: loads };
  
  return datastore.save({ key: key, data: boat }).then(() => {
    return key;
  });
}

/**
 * Model for DELETEing a boat
 * Returns Datastore result object of DELETE method
 *
 * @param {object} id The boat's ID
 */
function delete_boat(id) {
  const key = datastore.key([BOAT, parseInt(id, 10)]);

  const boat = datastore.get(key).then(data => {
    // If there are loads on the boat, remove the relationship before 
    // DELETEing the boat
    if (data[0] !== undefined && data[0].loads.length > 0) {
      data[0].loads.forEach(async load => {
        await loadModel.remove_load_from_boat(id, load.id)
      })
    }
  })

  return datastore.delete(key);
}

/**
 * Model for adding a load to a boat
 * Returns a key object from Datastore that can be used to GET the boat
 *
 * @param {object} boatID The boat's ID
 * @param {object} loadID The load's ID
 * @param {object} req Request object used to create SELF link
 */
async function load_boat(boatID, loadID, req) {
  // Pass values to update LOAD object's current_boat parameter with
  // boatID value
  const newLoad = await loadModel.add_load_to_boat(boatID, loadID);

  const boatKey = datastore.key([BOAT, parseInt(boatID, 10)]);

  datastore.get(boatKey).then(async data => {
    const loadObject = {
      id: loadID,
      self: `${req.protocol}://${req.get("host")}/loads/${loadID}`
    };
    data[0].loads.push(loadObject);
    
    // Build new boat object with updated loads array
    const newBoat = {
      name: data[0].name,
      type: data[0].type,
      length: data[0].length,
      loads: data[0].loads,
      public: data[0].public,
      owner: data[0].owner
    }
    // Save the updated boat object
    await datastore.save({ key: boatKey, data: newBoat });
    return boatKey;
  })
}

/**
 * Model for removing a load to a boat
 * Returns a key object from Datastore that can be used to GET the boat
 *
 * @param {object} boatID The boat's ID
 * @param {object} loadID The load's ID
 */
async function unload_boat(boatID, loadID) {
  // Pass values to update LOAD object's current_boat parameter to null
  const removedLoad = await loadModel.remove_load_from_boat(loadID);

  const boatKey = datastore.key([BOAT, parseInt(boatID, 10)]);
  
  datastore.get(boatKey).then(async data => {
    // If boat currently has any loads
    if (data[0] !== undefined && data[0].loads) {
      // Create new array that contains every load that does NOT have
      // an ID of the passed parameter loadID
      const newLoads = data[0].loads.filter(load => {
        return load.id !== loadID;
      })

      // Create new boat object to update Datastore
      const newBoat = {
        name: data[0].name,
        type: data[0].type,
        length: data[0].length,
        loads: newLoads,
        public: data[0].public,
        owner: data[0].owner
      }

      // Save new boat object
      await datastore.save({ key: boatKey, data: newBoat });
      return boatKey;
    }
  })
}

module.exports = {
  post_boat: post_boat,
  get_all_public_boats: get_all_public_boats,
  get_all_users_boats: get_all_users_boats,
  get_boat: get_boat,
  put_boat: put_boat,
  delete_boat: delete_boat,
  load_boat: load_boat,
  unload_boat: unload_boat
};
