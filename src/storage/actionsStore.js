const { ACTIONS_PATH } = require('../config');
const { readJson, writeJson } = require('./jsonStore');

function saveAction(actionId, action) {
  const actions = readJson(ACTIONS_PATH, {});
  actions[actionId] = action;
  writeJson(ACTIONS_PATH, actions);
}

function updateAction(actionId, patch) {
  const actions = readJson(ACTIONS_PATH, {});
  if (!actions[actionId]) {
    return null;
  }

  actions[actionId] = { ...actions[actionId], ...patch };
  writeJson(ACTIONS_PATH, actions);
  return actions[actionId];
}

function getAction(actionId) {
  const actions = readJson(ACTIONS_PATH, {});
  return actions[actionId] || null;
}

module.exports = {
  saveAction,
  updateAction,
  getAction,
};
