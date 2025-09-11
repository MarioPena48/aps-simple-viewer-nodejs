const express = require('express');
const formidable = require('express-formidable');
const { listObjects, uploadObject, translateObject, getManifest, deleteModel, urnify } = require('../services/aps.js'); // Added deleteModel

let router = express.Router();
router.use(express.json()); // To parse JSON bodies

router.get('/api/aps/models', async function (req, res, next) {
    try {
        const objects = await listObjects();
        res.json(objects.map(o => ({
            name: o.objectKey,
            urn: urnify(o.objectId)
        })));
    } catch (err) {
        next(err);
    }
});

router.get('/api/aps/models/:urn/status', async function (req, res, next) {
    try {
        const manifest = await getManifest(req.params.urn);
        if (manifest) {
            let messages = [];
            if (manifest.derivatives) {
                for (const derivative of manifest.derivatives) {
                    messages = messages.concat(derivative.messages || []);
                    if (derivative.children) {
                        for (const child of derivative.children) {
                            messages.concat(child.messages || []);
                        }
                    }
                }
            }
            res.json({ status: manifest.status, progress: manifest.progress, messages });
        } else {
            res.json({ status: 'n/a' });
        }
    } catch (err) {
        next(err);
    }
});

router.post('/api/aps/models', formidable({ maxFileSize: Infinity }), async function (req, res, next) {
    const file = req.files['model-file'];
    if (!file) {
        res.status(400).send('The required field ("model-file") is missing.');
        return;
    }
    try {
        const modelName = req.fields['model-name'] || file.name;
        const obj = await uploadObject(modelName, file.path);
        await translateObject(urnify(obj.objectId), req.fields['model-zip-entrypoint']);
        res.json({
            name: obj.objectKey,
            urn: urnify(obj.objectId)
        });
    } catch (err) {
        next(err);
    }
});

router.delete('/api/aps/models', async function (req, res, next) {
    try {
        const { objectKey, urn } = req.body;
        if (!objectKey || !urn) {
            return res.status(400).send('The required fields ("objectKey", "urn") are missing.');
        }
        await deleteModel(urn, objectKey);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

module.exports = router;