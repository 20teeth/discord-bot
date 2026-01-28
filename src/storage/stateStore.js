const { STATE_PATH } = require('../config');
const { readJson, writeJson } = require('./jsonStore');

function getChannelState(channelId) {
  const state = readJson(STATE_PATH, {});
  return state[channelId] || {};
}

function setChannelState(channelId, messageId) {
  const state = readJson(STATE_PATH, {});
  state[channelId] = { messageId };
  writeJson(STATE_PATH, state);
}

module.exports = {
  getChannelState,
  setChannelState,
};
