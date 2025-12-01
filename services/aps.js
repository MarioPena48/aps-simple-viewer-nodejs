const { AuthenticationClient, Scopes } = require('@aps_sdk/authentication');
const { OssClient, Region, PolicyKey } = require('@aps_sdk/oss');
const { ModelDerivativeClient, View, OutputType } = require('@aps_sdk/model-derivative');
const { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET } = require('../config.js');

const authenticationClient = new AuthenticationClient();
const ossClient = new OssClient();
const modelDerivativeClient = new ModelDerivativeClient();

const service = module.exports = {};

async function getInternalToken() {
    const credentials = await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [
        Scopes.DataRead,
        Scopes.DataCreate,
        Scopes.DataWrite,
        Scopes.BucketCreate,
        Scopes.BucketRead,
        Scopes.DataDelete,      // Added for manifest deletion
        Scopes.BucketDelete     // Added for object deletion
    ]);
    return credentials.access_token;
}

service.getViewerToken = async () => {
    return await authenticationClient.getTwoLeggedToken(APS_CLIENT_ID, APS_CLIENT_SECRET, [Scopes.ViewablesRead]);
};

service.ensureBucketExists = async (bucketKey) => {
    const accessToken = await getInternalToken();
    try {
        await ossClient.getBucketDetails(bucketKey, { accessToken });
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            await ossClient.createBucket(Region.Us, { bucketKey: bucketKey, policyKey: PolicyKey.Persistent }, { accessToken});
        } else {
            throw err;  
        }
    }
};

service.listObjects = async () => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    let resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, accessToken });
    let objects = resp.items;
    while (resp.next) {
        const startAt = new URL(resp.next).searchParams.get('startAt');
        resp = await ossClient.getObjects(APS_BUCKET, { limit: 64, startAt, accessToken });
        objects = objects.concat(resp.items);
    }
    return objects;
};

service.uploadObject = async (objectName, filePath) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    const obj = await ossClient.uploadObject(APS_BUCKET, objectName, filePath, { accessToken });
    return obj;
};

service.translateObject = async (urn, rootFilename) => {
    const accessToken = await getInternalToken();
    const job = await modelDerivativeClient.startJob({
        input: {
            urn,
            compressedUrn: !!rootFilename,
            rootFilename
        },
        output: {
            formats: [{
                views: [View._2d, View._3d],
                type: OutputType.Svf2
            }]
        }
    }, { accessToken });
    return job.result;
};

service.getManifest = async (urn) => {
    const accessToken = await getInternalToken();
    try {
        const manifest = await modelDerivativeClient.getManifest(urn, { accessToken });
        return manifest;
    } catch (err) {
        if (err.axiosError.response.status === 404) {
            return null;
        } else {
            throw err;
        }
    }
};

service.deleteModel = async (urn, objectKey) => {
    console.log(`Deleting model with URN: ${urn} and Object Key: ${objectKey}`);
    const accessToken = await getInternalToken();
    // It's safer to delete the manifest first. If this fails, we don't
    // want to delete the source file.
    try {
        await modelDerivativeClient.deleteManifest(urn, { accessToken });
    } catch (err) {
        // Manifest deletion may fail if the translation is not complete, but we can still delete the source file.
        console.warn('Could not delete manifest for urn', urn, err);
    }
    await ossClient.deleteObject(APS_BUCKET, objectKey, { accessToken });
};

service.getObjectSize = async (objectKey) => {
    await service.ensureBucketExists(APS_BUCKET);
    const accessToken = await getInternalToken();
    const details = await ossClient.getObjectDetails(APS_BUCKET, objectKey, { accessToken });
    return details.size;
};

service.getBucketUsage = async () => {
    // Sum sizes of every object in the bucket to report total usage.
    const objects = await service.listObjects();
    const totalBytes = objects.reduce((sum, obj) => sum + (obj.size || 0), 0);
    return {
        bucketKey: APS_BUCKET,
        objectCount: objects.length,
        totalBytes
    };
};

service.urnify = (id) => Buffer.from(id).toString('base64').replace(/=/g, '');

service.unurnify = (urn) => Buffer.from(urn, 'base64').toString('ascii');
