require('dotenv').config();

// Strip surrounding quotes that may be present in .env values
const clean = (val) => {
    if (typeof val !== 'string') return val;
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        return val.slice(1, -1);
    }
    return val;
};

let { APS_CLIENT_ID, APS_CLIENT_SECRET, APS_BUCKET, PORT } = process.env;
APS_CLIENT_ID = clean(APS_CLIENT_ID);
APS_CLIENT_SECRET = clean(APS_CLIENT_SECRET);
APS_BUCKET = clean(APS_BUCKET);
PORT = clean(PORT);

if (!APS_CLIENT_ID || !APS_CLIENT_SECRET) {
    console.warn('Missing some of the environment variables.');
    process.exit(1);
}
APS_BUCKET = APS_BUCKET || `${APS_CLIENT_ID.toLowerCase()}-basic-app`;
PORT = PORT || 8081;

module.exports = {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    APS_BUCKET,
    PORT
};
