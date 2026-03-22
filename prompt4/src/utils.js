const { nanoid } = require('nanoid');

function generateCode() {
  return nanoid(8);
}

module.exports = { generateCode };
