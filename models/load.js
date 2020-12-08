const { Datastore } = require("@google-cloud/datastore");
const datastore = new Datastore({ projectID: "marblek-project" });
const LOAD = "Load";

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
 * Model for POSTing a new load
 * New loads start with no current_boat
 * Returns a key object from Datastore that can be used to GET the load
 *
 * @param {object} weight The weight of the load
 * @param {object} content The content of the load
 * @param {object} delivery_date The delivery_date of the load
 */
async function post_load(weight, content, delivery_date) {
  const key = datastore.key(LOAD);

  const new_load = { weight: weight, content: content, delivery_date: delivery_date, current_boat: null };

  await datastore.save({ key: key, data: new_load });
  return key;
}

/**
 * Model for GETing all loads
 * Paginated to 5 results
 * Returns Datastore object of each found load
 *
 * @param {object} limit Amount of results to return per page 
 * @param {object} offset Index number of last result returned
 */
async function get_all_loads(limit, offset) {
  const getAllLoads = datastore.createQuery(LOAD).limit(limit).offset(offset);

  const entities = await datastore.runQuery(getAllLoads);

  return entities[0].map(fromDatastore);
}

/**
 * Model for GETing a specific load
 * Returns object containing Data object that holds parameter
 * values and ID parameter 
 *
 * @param {object} id The load's ID
 */
async function get_load(id) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  const data = await datastore.get(key);
  return { data: data[0], id: id };
}

/**
 * Model for updating a load via PUT OR PATCH
 * Can be used for both PATCH and PUT because Controllers always pass
 * every value needed
 * Returns Datastore object of updated load
 *
 * @param {object} id The load's ID
 * @param {object} weight The weight of the load
 * @param {object} content The content of the load
 * @param {object} delivery_date The delivery_date of the load
 * @param {object} boat_id The boat_id of the boad the load is currently on
 */
async function put_load(id, weight, content, delivery_date, boat_id) {
  const key = datastore.key([load, parseInt(id, 10)]);
  const load = { weight: weight, content: content, delivery_date: delivery_date, current_boat: boat_id };
  
  return datastore.save({ key: key, data: load }).then(() => {
      return key;
  });
}

/**
 * Model for DELETEing a load
 * Returns Datastore result object of DELETE method
 *
 * @param {object} id The load's ID
 */
function delete_load(id) {
  const key = datastore.key([LOAD, parseInt(id, 10)]);
  return datastore.delete(key);
}

/**
 * Model for adding a load to a boat
 * Updates load's current_boat parameter with boat's ID
 * Returns a key object from Datastore that can be used to GET the load
 *
 * @param {object} boatID The boat's ID
 * @param {object} loadID The load's ID
 */
function add_load_to_boat(boatID, loadID) {
  const loadKey = datastore.key([LOAD, parseInt(loadID, 10)]);

  datastore.get(loadKey).then(async data => {
    // A load can only be put on a boat AFTER it has been removed from
    // another. Must unload before you can load
    if (!data[0].current_boat) {
      newLoad = {
        weight: data[0].weight,
        content: data[0].content,
        delivery_date: data[0].delivery_date,
        current_boat: boatID
      };
      await datastore.save({ key: loadKey, data: newLoad });
      return loadKey;
    }
  });
}

/**
 * Model for removing a load to a load
 * Updates load's current_boat paramter to null
 * Returns a key object from Datastore that can be used to GET the load
 *
 * @param {object} loadID The load's ID
 */
function remove_load_from_boat(loadID) {
  const loadKey = datastore.key([LOAD, parseInt(loadID, 10)]);

  datastore.get(loadKey).then(async data => {
    if (data[0] !== undefined) {
      newLoad = {
        weight: data[0].weight,
        content: data[0].content,
        delivery_date: data[0].delivery_date,
        current_boat: null
      };
      await datastore.save({ key: loadKey, data: newLoad });
      return loadKey;
    }
  })
}

module.exports = {
  post_load: post_load,
  get_all_loads: get_all_loads,
  get_load: get_load,
  put_load: put_load,
  delete_load: delete_load,
  add_load_to_boat: add_load_to_boat,
  remove_load_from_boat: remove_load_from_boat
};
