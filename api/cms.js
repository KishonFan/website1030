const { handleCms } = require('../lib/cms-auth.cjs');

module.exports = (request, response) => handleCms(request, response);
