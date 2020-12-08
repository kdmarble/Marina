const { Datastore } = require("@google-cloud/datastore");
const datastore = new Datastore({ projectID: "marblek-project" });
const USER = "User";

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
 * Model for POSTing a new user
 * Returns a key object from Datastore that can be used to GET the user
 *
 * @param {object} user_id The unique ID of the User, equal to the sub value 
 * of JWT
 */
async function post_user(user_id) {
  const key = datastore.key(USER);
  const new_user = { uuid: user_id };

  const all_users = await get_all_users();
  const duplicates = all_users.filter(user => {
    return user.uuid === user_id;
  });

  // Prevent duplication of user in DB
  if (duplicates.length > 0) {
    return false
  } else {
    await datastore.save({ key: key, data: new_user });
    return key;
  };
}

/**
 * Model for GETing all users
 * Returns Datastore object of each found user
 *
 */
function get_all_users() {
  const getAllUsers = datastore.createQuery(USER);
  return datastore.runQuery(getAllUsers).then(entities => {
    return entities[0].map(fromDatastore);
  });
}

module.exports = {
  post_user: post_user,
  get_all_users: get_all_users
};
