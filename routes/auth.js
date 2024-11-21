const express = require('express');
const { getViewerToken } = require('../services/aps.js');

let router = express.Router();

router.get('/api/auth/token', async function (req, res) {
    res.json(await getViewerToken());
});

module.exports = router;
